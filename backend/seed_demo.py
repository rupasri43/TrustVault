"""Create isolated evaluator accounts and one explicitly shared demo document.

Run after initializing the database. Passwords are entered interactively and are
never written to source files. Do not use real personal accounts or passwords.
"""
import shutil
import os
import sqlite3
import uuid
from getpass import getpass
from pathlib import Path

from werkzeug.security import generate_password_hash

os.environ.setdefault("TRUSTVAULT_SECRET_KEY", "seed-script-only-not-for-serving")

from app import app
from auth import get_auth_db, write_auth_audit

BASE_DIR = Path(__file__).resolve().parent.parent
SAMPLE_FILE = BASE_DIR / "demo" / "TrustVault-Evaluator-Guide.txt"


def prompt_account(role):
    print(f"\nCreate evaluator {role} account")
    name = input("Name: ").strip()
    email = input("Email: ").strip().lower()
    password = getpass("Demo-only password (min 12 characters): ")
    if not name or not email or len(password) < 12:
        raise SystemExit("Name, email and a password of at least 12 characters are required.")
    return name, email, password


def main():
    owner = prompt_account("owner")
    viewer = prompt_account("viewer")
    admin = prompt_account("administrator")
    if len({owner[1], viewer[1], admin[1]}) != 3:
        raise SystemExit("Use three different email addresses.")

    with app.app_context():
        connection = get_auth_db()
        created = {}
        try:
            for account, role in ((owner, "owner"), (viewer, "viewer"), (admin, "admin")):
                name, email, password = account
                existing = connection.execute(
                    "SELECT id, role FROM users WHERE email = ?", (email,)
                ).fetchone()
                if existing:
                    if existing["role"] != role:
                        raise SystemExit(
                                f"{email} already exists with role {existing['role']}; resolve it manually."
                             )
                    created[role] = existing["id"]
                    print(f"Using existing {role} account: {email} (password unchanged)")
                else:
                    cursor = connection.execute(
                        "INSERT INTO users (name,email,password_hash,role) VALUES (?,?,?,?)",
                        (name, email, generate_password_hash(password), role),
                    )
                    created[role] = cursor.lastrowid
            connection.commit()

            existing_doc = connection.execute(
                "SELECT id FROM documents WHERE owner_id = ? AND title = ?",
                (created["owner"], "TrustVault Evaluator Guide"),
            ).fetchone()
            if existing_doc:
                document_id = existing_doc["id"]
                stored = connection.execute(
                    "SELECT stored_filename FROM documents WHERE id = ?", (document_id,)
                ).fetchone()["stored_filename"]
                stored_path = Path(app.config["UPLOAD_FOLDER"]) / stored
                if not stored_path.is_file():
                    shutil.copyfile(SAMPLE_FILE, stored_path)
            else:
                upload_dir = Path(app.config["UPLOAD_FOLDER"])
                upload_dir.mkdir(parents=True, exist_ok=True)
                stored_name = f"{uuid.uuid4().hex}.txt"
                shutil.copyfile(SAMPLE_FILE, upload_dir / stored_name)
                cursor = connection.execute(
                    """INSERT INTO documents
                       (title,description,category,original_filename,stored_filename,owner_id)
                       VALUES (?,?,?,?,?,?)""",
                    (
                        "TrustVault Evaluator Guide",
                        "Non-sensitive sample document for permission testing.",
                        "public",
                        SAMPLE_FILE.name,
                        stored_name,
                        created["owner"],
                    ),
                )
                document_id = cursor.lastrowid
                connection.commit()
                write_auth_audit(created["owner"], "document_upload", "success", {"filename": SAMPLE_FILE.name}, document_id)

            grant = connection.execute(
                "SELECT id FROM permissions WHERE document_id = ? AND user_id = ?",
                (document_id, created["viewer"]),
            ).fetchone()
            connection.execute(
                """INSERT INTO permissions (document_id,user_id,permission,granted_by)
                   VALUES (?,?,?,?)
                   ON CONFLICT(document_id,user_id) DO UPDATE SET permission='read', granted_by=excluded.granted_by""",
                (document_id, created["viewer"], "read", created["owner"]),
            )
            connection.commit()
            if grant is None:
                write_auth_audit(created["owner"], "document_share", "success", {"recipient": viewer[1], "permission": "read"}, document_id)

            print("\nEvaluator demo data is ready.")
            print(f"Owner: {owner[1]}")
            print(f"Viewer: {viewer[1]}")
            print(f"Administrator: {admin[1]}")
            print(f"Demo document ID: {document_id}")
            print("Record the passwords you entered in a secure place and add the evaluator credentials to README only for the isolated demo instance.")
        finally:
            connection.close()


if __name__ == "__main__":
    main()
