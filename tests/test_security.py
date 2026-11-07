
import os
import sys
import sqlite3
import uuid
from pathlib import Path

import pytest
from werkzeug.security import generate_password_hash

# Locate the backend modules.
BACKEND_DIR = Path(__file__).resolve().parents[1] / "backend"
sys.path.insert(0, str(BACKEND_DIR))

os.environ.setdefault("TRUSTVAULT_SECRET_KEY", "test-only-secret-key")
os.environ.setdefault("TRUSTVAULT_DATA_DIR", str(BACKEND_DIR / "test_data"))

from app import create_app
from auth import verify_audit_chain


@pytest.fixture
def setup_app(tmp_path):
    """Create an isolated application and temporary database."""

    app = create_app()

    database = tmp_path / "test_trustvault.db"
    upload_folder = tmp_path / "uploads"
    upload_folder.mkdir()

    app.config.update(
        TESTING=True,
        WTF_CSRF_ENABLED=False,
        DATABASE=str(database),
        UPLOAD_FOLDER=str(upload_folder),
        SECRET_KEY="test-only-secret-key",
    )

    # Initialize the temporary database.
    connection = sqlite3.connect(database)
    schema = BACKEND_DIR / "schema.sql"
    connection.executescript(schema.read_text(encoding="utf-8"))
    connection.commit()

    users = [
        ("Test Owner", "owner@test.com", "owner"),
        ("Test Viewer", "viewer@test.com", "viewer"),
        ("Test Stranger", "stranger@test.com", "viewer"),
        ("Test Admin", "admin@test.com", "admin"),
    ]

    user_ids = {}

    for name, email, role in users:
        cursor = connection.execute(
            """
            INSERT INTO users (name, email, password_hash, role)
            VALUES (?, ?, ?, ?)
            """,
            (name, email, generate_password_hash("TestPassword123!"), role),
        )
        user_ids[email] = cursor.lastrowid

    stored_filename = f"{uuid.uuid4().hex}.txt"
    (upload_folder / stored_filename).write_text(
        "TrustVault security test document",
        encoding="utf-8",
    )

    cursor = connection.execute(
        """
        INSERT INTO documents (
            title, description, category,
            original_filename, stored_filename, owner_id
        )
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (
            "Security Test Document",
            "Temporary test document",
            "confidential",
            "test.txt",
            stored_filename,
            user_ids["owner@test.com"],
        ),
    )

    document_id = cursor.lastrowid
    connection.commit()
    connection.close()

    yield {
        "app": app,
        "client": app.test_client(),
        "users": user_ids,
        "document_id": document_id,
        "database": database,
        "uploads": upload_folder,
    }

def login_as(test_data, email):
    """Create an independent authenticated test session."""
    client = test_data["app"].test_client()

    with client.session_transaction() as session:
        session["user_id"] = test_data["users"][email]

    return client

def test_owner_can_view_own_document(setup_app):
    data = setup_app
    client = login_as(data, "owner@test.com")

    response = client.get(
        f"/api/documents/{data['document_id']}"
    )

    assert response.status_code == 200
    assert response.json["document"]["title"] == "Security Test Document"


def test_stranger_cannot_view_private_document(setup_app):
    data = setup_app
    client = login_as(data, "stranger@test.com")

    response = client.get(
        f"/api/documents/{data['document_id']}"
    )

    assert response.status_code == 404


def test_stranger_cannot_download_private_document(setup_app):
    data = setup_app
    client = login_as(data, "stranger@test.com")

    response = client.get(
        f"/api/documents/{data['document_id']}/download"
    )

    assert response.status_code == 404


def test_owner_can_share_and_revoke_document(setup_app):
    data = setup_app
    document_id = data["document_id"]

    owner = login_as(data, "owner@test.com")

    # Grant read access.
    grant_response = owner.post(
        f"/api/documents/{document_id}/permissions",
        json={
            "email": "viewer@test.com",
            "access": "view",
        },
    )

    assert grant_response.status_code == 201

    permission_id = grant_response.json["id"]

    # Viewer can now read the document.
    viewer = login_as(data, "viewer@test.com")

    view_response = viewer.get(
        f"/api/documents/{document_id}"
    )

    assert view_response.status_code == 200

    # Viewer can download the shared file.
    download_response = viewer.get(
        f"/api/documents/{document_id}/download"
    )

    assert download_response.status_code == 200
    assert download_response.data

    # Owner revokes viewer access.
    revoke_response = owner.delete(
        f"/api/documents/{document_id}/permissions/{permission_id}"
    )

    assert revoke_response.status_code == 200

    # The next request must be denied.
    denied_response = viewer.get(
        f"/api/documents/{document_id}"
    )

    assert denied_response.status_code == 404

    denied_download = viewer.get(
        f"/api/documents/{document_id}/download"
    )

    assert denied_download.status_code == 404


def test_viewer_cannot_upload_documents(setup_app):
    data = setup_app
    viewer = login_as(data, "viewer@test.com")

    response = viewer.post(
        "/api/documents",
        data={
            "title": "Unauthorized upload",
            "category": "public",
        },
    )

    assert response.status_code == 403


def test_denied_access_is_recorded_in_audit(setup_app):
    data = setup_app
    stranger = login_as(data, "stranger@test.com")

    stranger.get(
        f"/api/documents/{data['document_id']}"
    )

    connection = sqlite3.connect(data["database"])
    connection.row_factory = sqlite3.Row

    record = connection.execute(
        """
        SELECT action, outcome, actor_id
        FROM audit_logs
        WHERE action = 'document_view'
        ORDER BY id DESC
        LIMIT 1
        """
    ).fetchone()

    connection.close()

    assert record is not None
    assert record["outcome"] == "denied"
    assert record["actor_id"] == data["users"]["stranger@test.com"]


def test_audit_chain_detects_modified_record(setup_app):
    data = setup_app
    owner = login_as(data, "owner@test.com")

    owner.get(f"/api/documents/{data['document_id']}")

    with data["app"].app_context():
        connection = sqlite3.connect(data["database"])
        connection.row_factory = sqlite3.Row

        # The untouched test database must verify.
        assert verify_audit_chain(connection)["valid"] is True

        # Simulate malicious modification in the test database only.
        connection.execute(
            """
            UPDATE audit_logs
            SET details = ?
            WHERE id = (SELECT MIN(id) FROM audit_logs)
            """,
            ('{"modified": true}',),
        )
        connection.commit()

        result = verify_audit_chain(connection)
        connection.close()

    assert result["valid"] is False
    assert result["first_invalid_id"] == 1
