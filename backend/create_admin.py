import re
import sqlite3
from pathlib import Path
from getpass import getpass
from werkzeug.security import generate_password_hash

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "trustvault.db"


def create_admin():
    name = input("Enter administrator name: ").strip()
    email = input("Enter administrator email: ").strip().lower()
    password = getpass("Enter administrator password: ")
    confirm_password = getpass("Confirm administrator password: ")

    if not name or not email or not password:
        print("Error: All fields are required.")
        return

    if len(name) > 100 or len(email) > 254:
        print("Error: Name or email is too long.")
        return

    if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email):
        print("Error: Invalid email address.")
        return

    if len(password) < 8 or len(password) > 128:
        print("Error: Password must contain 8 to 128 characters.")
        return

    if password != confirm_password:
        print("Error: Passwords do not match.")
        return

    if not DB_PATH.exists():
        print("Error: Database not found. Initialize the database first.")
        return

    connection = sqlite3.connect(DB_PATH)

    try:
        connection.execute("PRAGMA foreign_keys = ON")

        admin_count = connection.execute(
            "SELECT COUNT(*) FROM users WHERE role = 'admin'"
        ).fetchone()[0]

        if admin_count > 0:
            print("An administrator account already exists.")
            return

        password_hash = generate_password_hash(password)

        connection.execute(
            """
            INSERT INTO users (name, email, password_hash, role)
            VALUES (?, ?, ?, 'admin')
            """,
            (name, email, password_hash)
        )

        connection.commit()
        print("Administrator account created successfully!")

    except sqlite3.IntegrityError:
        print("Error: This email is already registered.")

    finally:
        connection.close()


if __name__ == "__main__":
    create_admin()