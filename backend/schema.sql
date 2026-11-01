PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL
        CHECK (role IN ('admin', 'owner', 'viewer')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL,
    original_filename TEXT NOT NULL,
    stored_filename TEXT NOT NULL UNIQUE,
    owner_id INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS permissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    document_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    permission TEXT NOT NULL
        CHECK (permission IN ('read', 'edit')),
    granted_by INTEGER NOT NULL,
    granted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (document_id, user_id),
    FOREIGN KEY (document_id) REFERENCES documents(id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (granted_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    actor_id INTEGER,
    document_id INTEGER,
    action TEXT NOT NULL,
    outcome TEXT NOT NULL
        CHECK (outcome IN ('success', 'denied', 'failure')),
    details TEXT,
    previous_hash TEXT,
    entry_hash TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (actor_id) REFERENCES users(id),
    FOREIGN KEY (document_id) REFERENCES documents(id)
);