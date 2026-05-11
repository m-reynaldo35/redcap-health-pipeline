"""
In-memory record store.
Holds extracted records between Upload → Review → Import.
Replace with a database (SQLite/Postgres) when persistence across restarts is needed.
"""
from typing import Any

_records: dict[str, dict[str, Any]] = {}


def save(record: dict[str, Any]) -> str:
    _records[record["record_id"]] = record
    return record["record_id"]


def get(record_id: str) -> dict[str, Any] | None:
    return _records.get(record_id)


def all_records() -> list[dict[str, Any]]:
    return list(_records.values())


def by_status(status: str) -> list[dict[str, Any]]:
    return [r for r in _records.values() if r.get("status") == status]


def update(record_id: str, changes: dict[str, Any]) -> bool:
    if record_id not in _records:
        return False
    _records[record_id].update(changes)
    return True
