import json
import uuid
from datetime import datetime, timezone
from backend.database import get_db


def save_dashboard(name: str, config: dict, description: str = "") -> dict:
    dash_id = str(uuid.uuid4())[:8]
    now = datetime.now(timezone.utc).isoformat()
    with get_db() as conn:
        conn.execute(
            "INSERT INTO saved_dashboards (id, name, description, config, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
            (dash_id, name, description, json.dumps(config), now, now),
        )
    return {"id": dash_id, "name": name}


def list_dashboards() -> list[dict]:
    with get_db() as conn:
        rows = conn.execute(
            "SELECT id, name, description, created_at, updated_at FROM saved_dashboards ORDER BY updated_at DESC"
        ).fetchall()
    return [dict(r) for r in rows]


def get_dashboard(dash_id: str) -> dict | None:
    with get_db() as conn:
        row = conn.execute("SELECT * FROM saved_dashboards WHERE id = ?", (dash_id,)).fetchone()
    if not row:
        return None
    d = dict(row)
    d["config"] = json.loads(d["config"])
    return d


def delete_dashboard(dash_id: str) -> bool:
    with get_db() as conn:
        result = conn.execute("DELETE FROM saved_dashboards WHERE id = ?", (dash_id,))
        return result.rowcount > 0
