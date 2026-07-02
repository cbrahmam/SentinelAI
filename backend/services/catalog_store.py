import json
from datetime import datetime
from backend.database import get_db

FIELDS = [
    "display_name", "description", "team", "owner", "tier", "lifecycle",
    "on_call", "repo_url", "docs_url", "dashboard_url",
]


def _row_to_entry(row) -> dict:
    return {
        "service": row["service"],
        "display_name": row["display_name"],
        "description": row["description"],
        "team": row["team"],
        "owner": row["owner"],
        "tier": row["tier"],
        "lifecycle": row["lifecycle"],
        "on_call": row["on_call"],
        "repo_url": row["repo_url"],
        "docs_url": row["docs_url"],
        "dashboard_url": row["dashboard_url"],
        "tags": json.loads(row["tags"] or "[]"),
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def list_entries() -> list[dict]:
    with get_db() as conn:
        rows = conn.execute(
            "SELECT * FROM service_catalog ORDER BY tier ASC, service ASC"
        ).fetchall()
        return [_row_to_entry(r) for r in rows]


def get_entry(service: str) -> dict | None:
    with get_db() as conn:
        row = conn.execute(
            "SELECT * FROM service_catalog WHERE service = ?", (service,)
        ).fetchone()
        return _row_to_entry(row) if row else None


def upsert_entry(payload) -> dict:
    now = datetime.utcnow().isoformat()
    values = {f: getattr(payload, f) for f in FIELDS}
    tags = json.dumps(payload.tags or [])
    with get_db() as conn:
        exists = conn.execute(
            "SELECT 1 FROM service_catalog WHERE service = ?", (payload.service,)
        ).fetchone()
        if exists:
            sets = ", ".join(f"{f} = ?" for f in FIELDS)
            conn.execute(
                f"UPDATE service_catalog SET {sets}, tags = ?, updated_at = ? WHERE service = ?",
                (*values.values(), tags, now, payload.service),
            )
        else:
            cols = ", ".join(FIELDS)
            placeholders = ", ".join("?" for _ in FIELDS)
            conn.execute(
                f"""INSERT INTO service_catalog (service, {cols}, tags, created_at, updated_at)
                    VALUES (?, {placeholders}, ?, ?, ?)""",
                (payload.service, *values.values(), tags, now, now),
            )
    return get_entry(payload.service)


def delete_entry(service: str) -> bool:
    with get_db() as conn:
        result = conn.execute(
            "DELETE FROM service_catalog WHERE service = ?", (service,)
        )
        return result.rowcount > 0
