import os
import uuid
import sqlite3
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
        "SELECT * FROM documents WHERE id = ?",
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
    return {
        "id": document["id"],
        "title": document["title"],
        "description": document["description"],
        "category": document["category"],
        "original_filename": document["original_filename"],
        "owner_id": document["owner_id"],
        "created_at": document["created_at"],
        "updated_at": document["updated_at"]
    }


@documents_bp.route("", methods=["POST"])
@login_required
def upload_document():
    user = g.current_user

    if user["role"] != "owner":
        return jsonify({"error": "Only document owners can upload files"}), 403

    uploaded_file = request.files.get("file")
    title = request.form.get("title", "").strip()
    description = request.form.get("description", "").strip()
    category = request.form.get("category", "").strip()

    if not uploaded_file or not uploaded_file.filename:
        return jsonify({"error": "A file is required"}), 400

    if not title or not category:
        return jsonify({"error": "Title and category are required"}), 400

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
            SELECT DISTINCT d.*
            FROM documents d
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
                )
            """
            pattern = f"%{search}%"
            parameters.extend([pattern, pattern, pattern])

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

        # Record deletion before removing the document.
        # Keep document_id in details because audit_logs has a foreign key.
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
