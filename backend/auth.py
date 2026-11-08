from functools import wraps
from flask import g
import sqlite3
import re
import hashlib
import json
from datetime import datetime, timezone
from flask import Blueprint, current_app, jsonify, request, session
from werkzeug.security import generate_password_hash, check_password_hash

auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")


def get_auth_db():
    connection = sqlite3.connect(current_app.config["DATABASE"])
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    return connection
def write_auth_audit(actor_id, action, outcome, details=None, document_id=None):
    connection = get_auth_db()

    try:
        connection.execute("BEGIN IMMEDIATE")

        previous = connection.execute(
            """
            SELECT entry_hash
            FROM audit_logs
            ORDER BY id DESC
            LIMIT 1
            """
        ).fetchone()

        previous_hash = previous["entry_hash"] if previous else None
        created_at = datetime.now(timezone.utc).isoformat()

        audit_data = {
            "actor_id": actor_id,
            "document_id": document_id,
            "action": action,
            "outcome": outcome,
            "details": details,
            "created_at": created_at,
            "previous_hash": previous_hash
        }

        entry_hash = hashlib.sha256(
            json.dumps(
                audit_data,
                sort_keys=True,
                separators=(",", ":")
            ).encode("utf-8")
        ).hexdigest()

        connection.execute(
            """
            INSERT INTO audit_logs (
                actor_id, document_id, action, outcome, details,
                previous_hash, entry_hash, created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                actor_id,
                document_id,
                action,
                outcome,
                json.dumps(details) if details is not None else None,
                previous_hash,
                entry_hash,
                created_at
            )
        )

        connection.commit()

    except Exception:
        connection.rollback()
        raise

    finally:
        connection.close()


# The first audit entries were written before document_id was included in the hash.
# Only these exact historical entries (IDs 1-3, which have no document) may still verify
# with that legacy format. Every other entry must match the current format, so a record
# cannot be "downgraded" to the weaker legacy hash to hide a modification.
LEGACY_AUDIT_HASH_MAX_ID = 3


def verify_audit_chain(connection):
    """Verify the audit hash chain.

    Entries with id <= LEGACY_AUDIT_HASH_MAX_ID and no document_id may match either the
    legacy or the current hash format. All other entries must match the current format.
    This function only reads; it never modifies audit data.
    """
    rows = connection.execute(
        """SELECT id, actor_id, document_id, action, outcome, details,
                  previous_hash, entry_hash, created_at
           FROM audit_logs ORDER BY id ASC"""
    ).fetchall()

    expected_previous = None
    legacy_entries = 0

    for index, row in enumerate(rows, start=1):
        try:
            details = json.loads(row["details"]) if row["details"] else None
        except (TypeError, json.JSONDecodeError):
            return {
                "valid": False,
                "entries_checked": index,
                "first_invalid_id": row["id"]
            }

        common_payload = {
            "actor_id": row["actor_id"],
            "action": row["action"],
            "outcome": row["outcome"],
            "details": details,
            "created_at": row["created_at"],
            "previous_hash": expected_previous,
        }

        old_hash = hashlib.sha256(
            json.dumps(
                common_payload,
                sort_keys=True,
                separators=(",", ":")
            ).encode("utf-8")
        ).hexdigest()

        new_payload = {
            **common_payload,
            "document_id": row["document_id"],
        }

        new_hash = hashlib.sha256(
            json.dumps(
                new_payload,
                sort_keys=True,
                separators=(",", ":")
            ).encode("utf-8")
        ).hexdigest()

        legacy_allowed = (
            row["id"] <= LEGACY_AUDIT_HASH_MAX_ID
            and row["document_id"] is None
        )
        accepted_hashes = (old_hash, new_hash) if legacy_allowed else (new_hash,)

        if (
            row["previous_hash"] != expected_previous
            or row["entry_hash"] not in accepted_hashes
        ):
            return {
                "valid": False,
                "entries_checked": index,
                "first_invalid_id": row["id"]
            }

        if legacy_allowed and row["entry_hash"] == old_hash:
            legacy_entries += 1

        expected_previous = row["entry_hash"]

    return {
        "valid": True,
        "entries_checked": len(rows),
        "first_invalid_id": None,
        "legacy_entries": legacy_entries
    }

def login_required(view):
    @wraps(view)
    def wrapped_view(*args, **kwargs):
        user_id = session.get("user_id")

        if user_id is None:
            return jsonify({"error": "Authentication required"}), 401

        connection = get_auth_db()

        try:
            user = connection.execute(
                "SELECT id, name, email, role FROM users WHERE id = ?",
                (user_id,)
            ).fetchone()
        finally:
            connection.close()

        if user is None:
            session.clear()
            return jsonify({"error": "User account not found"}), 401

        g.current_user = dict(user)

        return view(*args, **kwargs)

    return wrapped_view
def role_required(*allowed_roles):
    def decorator(view):
        @wraps(view)
        @login_required
        def wrapped_view(*args, **kwargs):
            if g.current_user["role"] not in allowed_roles:
                return jsonify({
                    "error": "You do not have permission to access this resource"
                }), 403

            return view(*args, **kwargs)

        return wrapped_view

    return decorator
@auth_bp.route("/admin-check", methods=["GET"])
@role_required("admin")
def admin_check():
    return jsonify({
        "message": "Administrator access granted",
        "role": g.current_user["role"]
    }), 200

@auth_bp.route("/register", methods=["POST"])
def register():
    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return jsonify({"error": "Invalid request data"}), 400

    name = data.get("name")
    email = data.get("email")
    password = data.get("password")

    if not isinstance(name, str) or not isinstance(email, str) or not isinstance(password, str):
        return jsonify({"error": "Name, email and password must be valid text"}), 400

    name = name.strip()
    email = email.strip().lower()

    if not name or not email or not password:
        return jsonify({"error": "All fields are required"}), 400

    if len(name) > 100 or len(email) > 254:
        return jsonify({"error": "Input is too long"}), 400

    if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email):
        return jsonify({"error": "Invalid email address"}), 400

    if len(password) < 8 or len(password) > 128:
        return jsonify({"error": "Password must contain 8 to 128 characters"}), 400

    password_hash = generate_password_hash(password)
    connection = get_auth_db()

    try:
        connection.execute(
            """
            INSERT INTO users (name, email, password_hash, role)
            VALUES (?, ?, ?, ?)
            """,
            (name, email, password_hash, "viewer")
        )
        connection.commit()

        write_auth_audit(
            actor_id=None,
            action="user_registration",
            outcome="success",
            details={"email": email, "role": "viewer"}
        )

        return jsonify({
            "message": "Registration successful",
            "role": "viewer"
        }), 201

    except sqlite3.IntegrityError:
        return jsonify({"error": "Email is already registered"}), 409

    finally:
        connection.close()

@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return jsonify({"error": "Invalid request data"}), 400

    email = data.get("email")
    password = data.get("password")

    if not isinstance(email, str) or not isinstance(password, str):
        return jsonify({"error": "Email and password must be valid text"}), 400

    email = email.strip().lower()

    if not email or not password:
        return jsonify({"error": "Email and password are required"}), 400

    if len(email) > 254 or len(password) > 128:
        return jsonify({"error": "Input is too long"}), 400

    connection = get_auth_db()

    try:
        user = connection.execute(
            """
            SELECT id, name, email, password_hash, role
            FROM users
            WHERE email = ?
            """,
            (email,)
        ).fetchone()
    finally:
        connection.close()

    if user is None or not check_password_hash(
        user["password_hash"], password
    ):
        write_auth_audit(
            actor_id=None,
            action="user_login",
            outcome="denied",
            details={"email": email}
        )

        return jsonify({"error": "Invalid email or password"}), 401
    session.clear()
    session["user_id"] = user["id"]
    session["role"] = user["role"]
    write_auth_audit(
        actor_id=user["id"],
        action="user_login",
        outcome="success",
        details={"email": user["email"]}
    )
    return jsonify({
        "message": "Login successful",
        "user": {
            "id": user["id"],
            "name": user["name"],
            "email": user["email"],
            "role": user["role"]
        }
    }), 200


@auth_bp.route("/logout", methods=["POST"])
@login_required
def logout():
    user_id = g.current_user["id"]

    write_auth_audit(
        actor_id=user_id,
        action="user_logout",
        outcome="success",
        details={"email": g.current_user["email"]}
    )

    session.clear()

    return jsonify({"message": "Logout successful"}), 200

@auth_bp.route("/me", methods=["GET"])
@login_required
def current_user():
    return jsonify({
        "user": g.current_user
    }), 200
