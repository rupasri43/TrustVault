import os
import uuid
import sqlite3
import hashlib
from pathlib import Path

from flask import (
    Blueprint, current_app, request, jsonify,
    g, send_file
)
from werkzeug.utils import secure_filename

from auth import get_auth_db, login_required, write_auth_audit


documents_bp = Blueprint("documents", __name__, url_prefix="/api/documents")

ALLOWED_EXTENSIONS = {
    ".pdf", ".png", ".jpg", ".jpeg",
    ".docx", ".txt", ".csv"
}


def has_document_access(connection, document_id, user_id):
    """Return the document and the user's effective permission."""
    document = connection.execute(
        """SELECT d.*, owner.name AS owner_name, owner.email AS owner_email,
                  (SELECT COUNT(*) FROM permissions p WHERE p.document_id = d.id) AS shared_with
           FROM documents d JOIN users owner ON owner.id = d.owner_id
           WHERE d.id = ?""",
        (document_id,)
    ).fetchone()

    if not document:
        return None, None

    if document["owner_id"] == user_id:
        return document, "owner"

    permission = connection.execute(
        """
        SELECT permission FROM permissions
        WHERE document_id = ? AND user_id = ?
        """,
        (document_id, user_id)
    ).fetchone()

    return document, permission["permission"] if permission else None


def audit_document(actor_id, document_id, action, outcome, details=None):
    write_auth_audit(
        actor_id=actor_id,
        action=action,
        outcome=outcome,
        details=details,
        document_id=document_id
    )


def valid_file_signature(path, extension):
    """Check basic file signatures for supported file types."""
    with open(path, "rb") as uploaded:
        header = uploaded.read(16)

    if extension == ".pdf":
        return header.startswith(b"%PDF-")
    if extension == ".png":
        return header.startswith(b"\x89PNG\r\n\x1a\n")
    if extension in (".jpg", ".jpeg"):
        return header.startswith(b"\xff\xd8\xff")
    if extension == ".docx":
        return header.startswith(b"PK")

    if extension in (".txt", ".csv"):
        try:
            with open(path, "r", encoding="utf-8-sig") as uploaded:
                content = uploaded.read()
            return "\x00" not in content
        except (UnicodeDecodeError, OSError):
            return False

    return False


def document_response(document):
    stored_path = Path(current_app.config["UPLOAD_FOLDER"]) / document["stored_filename"]
    file_size = stored_path.stat().st_size if stored_path.is_file() else 0
    file_hash = ""
    if stored_path.is_file():
        digest = hashlib.sha256()
        with stored_path.open("rb") as file_handle:
            for chunk in iter(lambda: file_handle.read(1024 * 1024), b""):
                digest.update(chunk)
        file_hash = digest.hexdigest()

    return {
        "id": document["id"],
        "title": document["title"],
        "description": document["description"],
        "category": document["category"],
        "original_filename": document["original_filename"],
        "owner_id": document["owner_id"],
        "owner_name": document["owner_name"],
        "owner_email": document["owner_email"],
        "size_bytes": file_size,
        "sha256": file_hash,
        "shared_with": document["shared_with"],
        "created_at": document["created_at"],
        "updated_at": document["updated_at"]
    }


@documents_bp.route("", methods=["POST"])
@login_required
def upload_document():
    user = g.current_user

    if user["role"] != "owner":
        audit_document(user["id"], None, "document_upload", "denied", {"reason": "Role cannot upload"})
        return jsonify({"error": "Only document owners can upload files"}), 403

    uploaded_file = request.files.get("file")
    title = request.form.get("title", "").strip()
    description = request.form.get("description", "").strip()
    category = request.form.get("category", "").strip()

    if not uploaded_file or not uploaded_file.filename:
        return jsonify({"error": "A file is required"}), 400

    if not title or not category:
        return jsonify({"error": "Title and category are required"}), 400

    if len(title) > 200 or len(description) > 2000:
        return jsonify({"error": "Title or description is too long"}), 400

    if category not in {"public", "internal", "confidential", "restricted"}:
        return jsonify({"error": "Invalid document category"}), 400

    original_filename = secure_filename(uploaded_file.filename)

    if not original_filename:
        return jsonify({"error": "Invalid filename"}), 400

    extension = Path(original_filename).suffix.lower()

    if extension not in ALLOWED_EXTENSIONS:
        return jsonify({"error": "File type is not allowed"}), 400

    stored_filename = f"{uuid.uuid4().hex}{extension}"
    upload_folder = Path(current_app.config["UPLOAD_FOLDER"])
    upload_folder.mkdir(parents=True, exist_ok=True)
    file_path = upload_folder / stored_filename

    try:
        uploaded_file.save(file_path)

        if not valid_file_signature(file_path, extension):
            file_path.unlink(missing_ok=True)
            return jsonify({"error": "File content does not match its extension"}), 400

        connection = get_auth_db()

        try:
            cursor = connection.execute(
                """
                INSERT INTO documents (
                    title, description, category,
                    original_filename, stored_filename, owner_id
                )
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    title,
                    description,
                    category,
                    original_filename,
                    stored_filename,
                    user["id"]
                )
            )
            document_id = cursor.lastrowid
            connection.commit()
        finally:
            connection.close()

        audit_document(
            user["id"], document_id,
            "document_upload", "success",
            {"filename": original_filename}
        )

        return jsonify({
            "message": "Document uploaded successfully",
            "document_id": document_id
        }), 201

    except Exception:
        if file_path.exists():
            file_path.unlink()
        current_app.logger.exception("Document upload failed")
        return jsonify({"error": "Document upload failed"}), 500


@documents_bp.route("", methods=["GET"])
@login_required
def list_documents():
    user = g.current_user
    search = request.args.get("q", "").strip()
    category = request.args.get("category", "").strip()

    connection = get_auth_db()

    try:
        query = """
            SELECT DISTINCT d.*, owner.name AS owner_name, owner.email AS owner_email,
                   (SELECT COUNT(*) FROM permissions p2 WHERE p2.document_id = d.id) AS shared_with
            FROM documents d
            JOIN users owner ON owner.id = d.owner_id
            LEFT JOIN permissions p
                ON p.document_id = d.id AND p.user_id = ?
            WHERE (d.owner_id = ? OR p.user_id = ?)
        """
        parameters = [user["id"], user["id"], user["id"]]

        if search:
            query += """
                AND (
                    d.title LIKE ?
                    OR d.original_filename LIKE ?
                    OR d.category LIKE ?
                    OR owner.name LIKE ?
                    OR owner.email LIKE ?
                )
            """
            pattern = f"%{search}%"
            parameters.extend([pattern, pattern, pattern, pattern, pattern])

        owner_filter = request.args.get("owner", "").strip()
        if owner_filter:
            query += " AND (owner.name LIKE ? OR owner.email LIKE ?)"
            owner_pattern = f"%{owner_filter}%"
            parameters.extend([owner_pattern, owner_pattern])

        date_from = request.args.get("date_from", "").strip()
        if date_from:
            query += " AND date(d.created_at) >= date(?)"
            parameters.append(date_from)

        date_to = request.args.get("date_to", "").strip()
        if date_to:
            query += " AND date(d.created_at) <= date(?)"
            parameters.append(date_to)

        if category:
            query += " AND d.category = ?"
            parameters.append(category)

        query += " ORDER BY d.created_at DESC"

        documents = connection.execute(
            query, parameters
        ).fetchall()

        return jsonify({
            "documents": [document_response(d) for d in documents]
        }), 200

    finally:
        connection.close()


@documents_bp.route("/<int:document_id>", methods=["GET"])
@login_required
def get_document(document_id):
    user = g.current_user
    connection = get_auth_db()

    try:
        document, permission = has_document_access(
            connection, document_id, user["id"]
        )

        if not document or not permission:
            audit_document(
                user["id"], document_id,
                "document_view", "denied"
            )
            return jsonify({"error": "Document not found or access denied"}), 404

        audit_document(user["id"], document_id, "document_view", "success")
        return jsonify({
            "document": document_response(document),
            "permission": permission
        }), 200

    finally:
        connection.close()


@documents_bp.route("/<int:document_id>/download", methods=["GET"])
@login_required
def download_document(document_id):
    user = g.current_user
    connection = get_auth_db()

    try:
        document, permission = has_document_access(
            connection, document_id, user["id"]
        )

        if not document or not permission:
            audit_document(
                user["id"], document_id,
                "document_download", "denied"
            )
            return jsonify({"error": "Document not found or access denied"}), 404

        file_path = (
            Path(current_app.config["UPLOAD_FOLDER"])
            / document["stored_filename"]
        )

        if not file_path.is_file():
            audit_document(
                user["id"], document_id,
                "document_download", "failure",
                {"reason": "File missing"}
            )
            return jsonify({"error": "Stored file not found"}), 404

        audit_document(
            user["id"], document_id,
            "document_download", "success"
        )

        return send_file(
            file_path,
            as_attachment=True,
            download_name=document["original_filename"]
        )

    finally:
        connection.close()


@documents_bp.route("/<int:document_id>", methods=["PUT"])
@login_required
def update_document(document_id):
    user = g.current_user
    data = request.get_json(silent=True) or {}

    connection = get_auth_db()

    try:
        document, permission = has_document_access(
            connection, document_id, user["id"]
        )

        if not document or permission not in ("owner", "edit"):
            audit_document(
                user["id"], document_id,
                "document_edit", "denied"
            )
            return jsonify({"error": "Edit access denied"}), 403

        title = data.get("title", document["title"])
        description = data.get("description", document["description"])
        category = data.get("category", document["category"])

        if not isinstance(title, str) or not title.strip():
            return jsonify({"error": "A valid title is required"}), 400

        if not isinstance(category, str) or not category.strip():
            return jsonify({"error": "A valid category is required"}), 400

        if description is not None and not isinstance(description, str):
            return jsonify({"error": "Invalid description"}), 400

        connection.execute(
            """
            UPDATE documents
            SET title = ?, description = ?, category = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            """,
            (title.strip(), description, category.strip(), document_id)
        )
        connection.commit()

        audit_document(
            user["id"], document_id,
            "document_edit", "success"
        )

        return jsonify({"message": "Document updated successfully"}), 200

    finally:
        connection.close()
@documents_bp.route("/<int:document_id>", methods=["DELETE"])
@login_required
def delete_document(document_id):
    user = g.current_user
    connection = get_auth_db()

    try:
        document = connection.execute(
            "SELECT * FROM documents WHERE id = ?",
            (document_id,)
        ).fetchone()

        if not document or document["owner_id"] != user["id"]:
            audit_document(
                user["id"], document_id,
                "document_delete", "denied"
            )
            return jsonify({
                "error": "Only the document owner can delete it"
            }), 403

        file_path = (
            Path(current_app.config["UPLOAD_FOLDER"])
            / document["stored_filename"]
        )

        connection.execute(
            "DELETE FROM permissions WHERE document_id = ?",
            (document_id,)
        )

        connection.execute(
            "DELETE FROM documents WHERE id = ?",
            (document_id,)
        )

        connection.commit()
        audit_document(
            user["id"],
            None,
            "document_delete",
             "success",
            {
                "document_id": document_id,
                "filename": document["original_filename"]
            }
        )
        if file_path.is_file():
            os.remove(file_path)

        return jsonify({
            "message": "Document deleted successfully"
        }), 200

    except Exception:
        connection.rollback()
        raise

    finally:
        connection.close()

@documents_bp.route("/<int:document_id>/permissions", methods=["GET"])
@login_required
def list_document_permissions(document_id):
    connection = get_auth_db()

    try:
        document, access = has_document_access(
            connection, document_id, g.current_user["id"]
        )

        if not document or access != "owner":
            audit_document(g.current_user["id"], document_id, "permission_list", "denied")
            return jsonify({"error": "Only the document owner can view the access list"}), 403

        rows = connection.execute(
            """
            SELECT p.id, p.document_id, p.user_id, p.permission,
                   p.granted_at, u.name AS user_name, u.email AS user_email
            FROM permissions p
            JOIN users u ON u.id = p.user_id
            WHERE p.document_id = ?
            ORDER BY p.id DESC
            """,
            (document_id,)
        ).fetchall()

        return jsonify([
            {
                "id": str(row["id"]),
                "documentId": str(row["document_id"]),
                "userId": str(row["user_id"]),
                "userName": row["user_name"],
                "userEmail": row["user_email"],
                "access": "edit" if row["permission"] == "edit" else "view",
                "grantedAt": row["granted_at"],
                "expiresAt": None
            }
            for row in rows
        ]), 200

    finally:
        connection.close()
@documents_bp.route("/<int:document_id>/permissions", methods=["POST"])
@login_required
def grant_document_permission(document_id):
    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return jsonify({"error": "Invalid request data"}), 400

    email = data.get("email")
    access = data.get("access")

    if not isinstance(email, str) or access not in ("view", "download", "edit"):
        return jsonify({"error": "Valid email and access level are required"}), 400

    email = email.strip().lower()
    if len(email) > 254 or "@" not in email or any(ch.isspace() for ch in email):
        return jsonify({"error": "Invalid email address"}), 400
    backend_permission = "edit" if access == "edit" else "read"

    connection = get_auth_db()

    try:
        document, permission = has_document_access(
            connection, document_id, g.current_user["id"]
        )

        if not document or permission != "owner":
            audit_document(g.current_user["id"], document_id, "document_share", "denied")
            return jsonify({"error": "Only the document owner can share it"}), 403

        recipient = connection.execute(
            "SELECT id, name, email FROM users WHERE email = ?",
            (email,)
        ).fetchone()

        if recipient is None:
            return jsonify({"error": "Recipient account not found. They must register first."}), 404

        if recipient["id"] == document["owner_id"]:
            return jsonify({"error": "You already own this document"}), 400

        connection.execute(
            """
            INSERT INTO permissions (document_id, user_id, permission, granted_by)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(document_id, user_id)
            DO UPDATE SET permission = excluded.permission,
                          granted_by = excluded.granted_by,
                          granted_at = CURRENT_TIMESTAMP
            """,
            (
                document_id,
                recipient["id"],
                backend_permission,
                g.current_user["id"]
            )
        )
        connection.commit()

        write_auth_audit(
            actor_id=g.current_user["id"],
            action="document_share",
            outcome="success",
            details={
                "document_id": document_id,
                "recipient": email,
                "permission": backend_permission
            },
            document_id=document_id
        )

        row = connection.execute(
            """
            SELECT id, document_id, user_id, permission, granted_at
            FROM permissions
            WHERE document_id = ? AND user_id = ?
            """,
            (document_id, recipient["id"])
        ).fetchone()

        return jsonify({
            "id": str(row["id"]),
            "documentId": str(row["document_id"]),
            "userId": str(row["user_id"]),
            "userName": recipient["name"],
            "userEmail": recipient["email"],
            "access": access,
            "grantedAt": row["granted_at"],
            "expiresAt": None
        }), 201

    finally:
        connection.close()


@documents_bp.route(
    "/<int:document_id>/permissions/<int:permission_id>",
    methods=["DELETE"]
)
@login_required
def revoke_document_permission(document_id, permission_id):
    connection = get_auth_db()

    try:
        document, permission = has_document_access(
            connection, document_id, g.current_user["id"]
        )

        if not document or permission != "owner":
            audit_document(g.current_user["id"], document_id, "document_revoke", "denied")
            return jsonify({"error": "Only the document owner can revoke access"}), 403

        row = connection.execute(
            """
            SELECT id, user_id FROM permissions
            WHERE id = ? AND document_id = ?
            """,
            (permission_id, document_id)
        ).fetchone()

        if row is None:
            audit_document(g.current_user["id"], document_id, "document_revoke", "denied", {"reason": "Permission not found"})
            return jsonify({"error": "Permission not found"}), 404

        connection.execute(
            "DELETE FROM permissions WHERE id = ?",
            (permission_id,)
        )
        connection.commit()

        write_auth_audit(
            actor_id=g.current_user["id"],
            action="document_revoke",
            outcome="success",
            details={
                "document_id": document_id,
                "permission_id": permission_id,
                "user_id": row["user_id"]
            },
            document_id=document_id
        )

        return jsonify({"message": "Document access revoked"}), 200

    finally:
        connection.close()
