"""Make a verified backup of the TrustVault database and uploads, OUTSIDE the project.

Usage (from the project root, any OS):

    python tools/backup_trustvault.py
    python tools/backup_trustvault.py --data-dir backend --dest D:/TrustVaultBackups

It only READS the originals:
  * the database is copied with SQLite's online-backup API (safe while the server runs);
  * uploaded files are copied byte-for-byte;
  * then the copies are re-opened and compared with the originals (row counts, SHA-256 of
    every upload, SQLite integrity_check, audit-chain head and a digest of every audit row).

A MANIFEST.json is written next to the backup. The script exits with code 1 if anything
does not match. It never deletes, overwrites or modifies the original files.
"""

import argparse
import hashlib
import json
import shutil
import sqlite3
import sys
from datetime import datetime
from pathlib import Path

TABLES = ["users", "documents", "permissions", "audit_logs"]


def sha256_file(path):
    digest = hashlib.sha256()
    with open(path, "rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def describe_db(path):
    connection = sqlite3.connect(f"file:{Path(path).as_posix()}?mode=ro", uri=True)
    try:
        info = {t: connection.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0] for t in TABLES}
        info["integrity_check"] = connection.execute("PRAGMA integrity_check").fetchone()[0]
        head = connection.execute(
            "SELECT entry_hash FROM audit_logs ORDER BY id DESC LIMIT 1"
        ).fetchone()
        info["audit_chain_head"] = head[0] if head else None
        rows = connection.execute("SELECT * FROM audit_logs ORDER BY id").fetchall()
        info["audit_table_digest"] = hashlib.sha256(json.dumps(rows).encode()).hexdigest()
        return info
    finally:
        connection.close()


def main():
    project_root = Path(__file__).resolve().parents[1]
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawTextHelpFormatter)
    parser.add_argument("--data-dir", default=str(project_root / "backend"),
                        help="folder holding trustvault.db and private_uploads/ (default: backend)")
    parser.add_argument("--dest", default=str(Path.home() / "TrustVault_backups"),
                        help="parent folder for the backup (must be outside the project)")
    args = parser.parse_args()

    data_dir = Path(args.data_dir).resolve()
    database = data_dir / "trustvault.db"
    uploads = data_dir / "private_uploads"
    if not database.is_file():
        sys.exit(f"ERROR: database not found: {database}")

    destination_root = Path(args.dest).resolve()
    if project_root in (destination_root, *destination_root.parents):
        sys.exit("ERROR: the backup folder must be OUTSIDE the project folder.")

    target = destination_root / datetime.now().strftime("trustvault_backup_%Y%m%d_%H%M%S")
    (target / "private_uploads").mkdir(parents=True, exist_ok=False)

    # 1) database: online backup (consistent even if the server is writing)
    source = sqlite3.connect(f"file:{database.as_posix()}?mode=ro", uri=True)
    copy = sqlite3.connect(target / "trustvault.db")
    source.backup(copy)
    copy.close()
    source.close()

    # 2) uploads: byte-for-byte
    upload_files = sorted(p for p in uploads.glob("*") if p.is_file()) if uploads.is_dir() else []
    for path in upload_files:
        shutil.copy2(path, target / "private_uploads" / path.name)

    # 3) verify copies against originals
    original = describe_db(database)
    backup = describe_db(target / "trustvault.db")
    problems = []
    if original != backup:
        problems.append("database copy differs from original (the server may have written during "
                        "the backup; run it again)")
    if backup["integrity_check"] != "ok":
        problems.append("SQLite integrity_check on the backup is not 'ok'")

    upload_report = {}
    for path in upload_files:
        original_sum = sha256_file(path)
        backup_sum = sha256_file(target / "private_uploads" / path.name)
        upload_report[path.name] = {"sha256": original_sum, "backup_sha256": backup_sum,
                                    "bytes": path.stat().st_size}
        if original_sum != backup_sum:
            problems.append(f"upload checksum mismatch: {path.name}")

    manifest = {
        "created_at": datetime.now().isoformat(timespec="seconds"),
        "source_database": str(database),
        "original": original,
        "backup": backup,
        "uploads": upload_report,
        "verified": not problems,
        "problems": problems,
    }
    (target / "MANIFEST.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")

    print(f"Backup folder : {target}")
    print(f"Row counts    : { {t: backup[t] for t in TABLES} }")
    print(f"Uploads       : {len(upload_report)} file(s)")
    print(f"integrity     : {backup['integrity_check']}")
    if problems:
        print("VERIFICATION FAILED:")
        for problem in problems:
            print(f"  - {problem}")
        sys.exit(1)
    print("VERIFIED: backup matches the original.")


if __name__ == "__main__":
    main()
