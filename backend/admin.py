from flask import Blueprint, jsonify, request
from auth import get_auth_db, login_required, role_required

admin_bp = Blueprint("admin", __name__, url_prefix="/api/admin")


@admin_bp.route("/audit", methods=["GET"])
@login_required
@role_required("admin")
def get_audit_logs():
    connection = get_auth_db()

    try:
        limit = request.args.get("limit", 50, type=int)
        limit = max(1, min(limit or 50, 100))

        before_id = request.args.get("before_id", type=int)
        action = request.args.get("action")
        outcome = request.args.get("outcome")

        query = """
            SELECT
                a.id,
                a.actor_id,
                u.name AS actor_name,
                u.email AS actor_email,
                a.document_id,
                a.action,
                a.outcome,
                a.details,
                a.previous_hash,
                a.entry_hash,
                a.created_at
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

        rows = connection.execute(query, params).fetchall()

        logs = [dict(row) for row in rows]

        return jsonify({
            "logs": logs,
            "count": len(logs),
            "limit": limit,
            "next_before_id": logs[-1]["id"] if logs else None
        }), 200

    finally:
        connection.close()