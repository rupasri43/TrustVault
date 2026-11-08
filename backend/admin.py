
from flask import Blueprint, jsonify, request, g
from pathlib import Path
from flask import current_app
from auth import (
    get_auth_db,
    login_required,
    role_required,
    write_auth_audit,
    verify_audit_chain,
)

admin_bp = Blueprint("admin", __name__, url_prefix="/api/admin")


@admin_bp.route("/audit", methods=["GET"])
@login_required
@role_required("admin")
def get_audit_logs():
    connection = get_auth_db()
    try:
        limit = max(1, min(request.args.get("limit", 50, type=int) or 50, 100))
        before_id = request.args.get("before_id", type=int)
        action = request.args.get("action")
        outcome = request.args.get("outcome")

        query = """
            SELECT a.id, a.actor_id,
                   u.name AS actor_name, u.email AS actor_email,
                   a.document_id, a.action, a.outcome, a.details,
                   a.previous_hash, a.entry_hash, a.created_at
            FROM audit_logs AS a
            LEFT JOIN users AS u ON u.id = a.actor_id
            WHERE 1 = 1
        """
        params = []

        if before_id:
            query += " AND a.id < ?"
            params.append(before_id)
        if action:
            query += " AND a.action = ?"
            params.append(action)
        if outcome in ("success", "denied", "failure"):
            query += " AND a.outcome = ?"
            params.append(outcome)

        query += " ORDER BY a.id DESC LIMIT ?"
        params.append(limit)

        logs = [
            dict(row)
            for row in connection.execute(query, params).fetchall()
        ]

        return jsonify({
            "logs": logs,
            "count": len(logs),
            "limit": limit,
            "next_before_id": logs[-1]["id"] if logs else None
        }), 200
    finally:
        connection.close()


@admin_bp.route("/audit/verify", methods=["GET"])
@login_required
@role_required("admin")
def verify_audit():
    connection = get_auth_db()
    try:
        result = verify_audit_chain(connection)
        return jsonify(result), 200
    finally:
        connection.close()


@admin_bp.route("/stats", methods=["GET"])
@login_required
@role_required("admin")
def get_admin_stats():
    connection = get_auth_db()
    try:
        total_users = connection.execute(
            "SELECT COUNT(*) FROM users"
        ).fetchone()[0]

        total_documents = connection.execute(
            "SELECT COUNT(*) FROM documents"
        ).fetchone()[0]

        active_shares = connection.execute(
            "SELECT COUNT(*) FROM permissions"
        ).fetchone()[0]

        denied_attempts = connection.execute(
            """
            SELECT COUNT(*)
            FROM audit_logs
            WHERE outcome = 'denied'
              AND julianday(created_at) >= julianday('now', '-1 day')
            """
        ).fetchone()[0]

        upload_dir = Path(current_app.config["UPLOAD_FOLDER"])
        storage_used = sum(
            item.stat().st_size for item in upload_dir.iterdir() if item.is_file()
        ) if upload_dir.exists() else 0

        return jsonify({
            "totalUsers": total_users,
            "totalDocuments": total_documents,
            "activeShares": active_shares,
            "deniedAttempts24h": denied_attempts,
            "storageUsedBytes": storage_used
        }), 200
    finally:
        connection.close()


@admin_bp.route("/users", methods=["GET"])
@login_required
@role_required("admin")
def get_admin_users():
    connection = get_auth_db()
    try:
        rows = connection.execute(
            """
            SELECT id, name, email, role
            FROM users
            ORDER BY id ASC
            """
        ).fetchall()

        users = [
            {
                "id": str(row["id"]),
                "name": row["name"],
                "email": row["email"],
                "role": (
                    "administrator" if row["role"] == "admin"
                    else row["role"]
                ),
                "status": "active",
                "lastActive": ""
            }
            for row in rows
        ]

        return jsonify(users), 200
    finally:
        connection.close()


@admin_bp.route("/users/<int:user_id>", methods=["PATCH"])
@login_required
@role_required("admin")
def update_admin_user(user_id):
    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return jsonify({"error": "Invalid request data"}), 400

    role_map = {
        "administrator": "admin",
        "owner": "owner",
        "viewer": "viewer"
    }

    frontend_role = data.get("role")
    if frontend_role not in role_map:
        return jsonify({"error": "Invalid role"}), 400

    new_role = role_map[frontend_role]
    connection = get_auth_db()

    try:
        user = connection.execute(
            "SELECT id, name, email, role FROM users WHERE id = ?",
            (user_id,)
        ).fetchone()

        if user is None:
            return jsonify({"error": "User not found"}), 404

        if user_id == g.current_user["id"] and new_role != "admin":
            return jsonify({
                "error": "You cannot remove your own administrator role"
            }), 400

        old_role = user["role"]

        connection.execute(
            "UPDATE users SET role = ? WHERE id = ?",
            (new_role, user_id)
        )
        connection.commit()

        write_auth_audit(
            actor_id=g.current_user["id"],
            action="role_change",
            outcome="success",
            details={
                "user_id": user_id,
                "email": user["email"],
                "old_role": old_role,
                "new_role": new_role
            }
        )

        return jsonify({
            "id": str(user_id),
            "name": user["name"],
            "email": user["email"],
            "role": frontend_role,
            "status": "active",
            "lastActive": ""
        }), 200
    finally:
        connection.close()
