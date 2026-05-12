"""
SQLite-backed record store. Drop-in replacement for the in-memory store.
Database file: pipeline.db, created next to this file on first run.
"""
import json
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

DB_PATH = Path(__file__).parent / "pipeline.db"


def _init_db() -> None:
    with _connect() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS records (
                record_id    TEXT PRIMARY KEY,
                filename     TEXT,
                modality     TEXT,
                status       TEXT,
                extracted    TEXT DEFAULT '{}',
                warnings     TEXT DEFAULT '[]',
                errors       TEXT DEFAULT '[]',
                redcap_id    TEXT,
                imported_at  TEXT,
                import_error TEXT,
                created_at   TEXT
            )
        """)


@contextmanager
def _connect():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def _row_to_dict(row) -> dict[str, Any]:
    d = dict(row)
    for field in ("extracted", "warnings", "errors"):
        raw = d.get(field)
        if raw:
            d[field] = json.loads(raw)
        else:
            d[field] = {} if field == "extracted" else []
    return d


_init_db()


def save(record: dict[str, Any]) -> str:
    with _connect() as conn:
        conn.execute(
            """
            INSERT OR REPLACE INTO records
                (record_id, filename, modality, status, extracted, warnings, errors,
                 redcap_id, imported_at, import_error, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                record["record_id"],
                record.get("filename"),
                record.get("modality"),
                record.get("status"),
                json.dumps(record.get("extracted", {})),
                json.dumps(record.get("warnings", [])),
                json.dumps(record.get("errors", [])),
                record.get("redcap_id"),
                record.get("imported_at"),
                record.get("import_error"),
                record.get("created_at", datetime.now(timezone.utc).isoformat()),
            ),
        )
    return record["record_id"]


def get(record_id: str) -> dict[str, Any] | None:
    with _connect() as conn:
        row = conn.execute(
            "SELECT * FROM records WHERE record_id = ?", (record_id,)
        ).fetchone()
    return _row_to_dict(row) if row else None


def all_records() -> list[dict[str, Any]]:
    with _connect() as conn:
        rows = conn.execute(
            "SELECT * FROM records ORDER BY created_at DESC"
        ).fetchall()
    return [_row_to_dict(r) for r in rows]


def by_status(status: str) -> list[dict[str, Any]]:
    with _connect() as conn:
        rows = conn.execute(
            "SELECT * FROM records WHERE status = ? ORDER BY created_at DESC",
            (status,),
        ).fetchall()
    return [_row_to_dict(r) for r in rows]


def update(record_id: str, changes: dict[str, Any]) -> bool:
    rec = get(record_id)
    if not rec:
        return False
    rec.update(changes)
    save(rec)
    return True
