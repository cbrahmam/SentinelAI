import json
import uuid
from datetime import datetime, timezone
from backend.database import get_db


def create_channel(
    name: str,
    channel_type: str,
    config: dict,
) -> dict:
    channel_id = str(uuid.uuid4())[:8]
    now = datetime.now(timezone.utc).isoformat()
    with get_db() as conn:
        conn.execute(
            "INSERT INTO notification_channels (id, name, channel_type, config, enabled, created_at) VALUES (?, ?, ?, ?, 1, ?)",
            (channel_id, name, channel_type, json.dumps(config), now),
        )
    return {
        "id": channel_id,
        "name": name,
        "channel_type": channel_type,
        "config": config,
        "enabled": True,
        "created_at": now,
    }


def list_channels() -> list[dict]:
    with get_db() as conn:
        rows = conn.execute("SELECT * FROM notification_channels ORDER BY created_at DESC").fetchall()
    results = []
    for r in rows:
        d = dict(r)
        d["enabled"] = bool(d["enabled"])
        try:
            d["config"] = json.loads(d["config"])
        except (json.JSONDecodeError, TypeError):
            d["config"] = {}
        results.append(d)
    return results


def delete_channel(channel_id: str) -> bool:
    with get_db() as conn:
        result = conn.execute("DELETE FROM notification_channels WHERE id = ?", (channel_id,))
        return result.rowcount > 0


def toggle_channel(channel_id: str) -> dict | None:
    with get_db() as conn:
        row = conn.execute("SELECT enabled FROM notification_channels WHERE id = ?", (channel_id,)).fetchone()
        if not row:
            return None
        new_val = 0 if row["enabled"] else 1
        conn.execute("UPDATE notification_channels SET enabled = ? WHERE id = ?", (new_val, channel_id))
        updated = conn.execute("SELECT * FROM notification_channels WHERE id = ?", (channel_id,)).fetchone()
    d = dict(updated)
    d["enabled"] = bool(d["enabled"])
    try:
        d["config"] = json.loads(d["config"])
    except (json.JSONDecodeError, TypeError):
        d["config"] = {}
    return d


def send_notification(event_type: str, title: str, message: str = "") -> list[dict]:
    channels = list_channels()
    enabled = [c for c in channels if c["enabled"]]
    results = []

    for ch in enabled:
        log_entry = _simulate_send(ch, event_type, title, message)
        results.append(log_entry)

    return results


def _simulate_send(channel: dict, event_type: str, title: str, message: str) -> dict:
    log_id = str(uuid.uuid4())[:8]
    now = datetime.now(timezone.utc).isoformat()

    status = "delivered"
    if channel["channel_type"] == "slack":
        status = "delivered"
    elif channel["channel_type"] == "pagerduty":
        status = "delivered"
    elif channel["channel_type"] == "email":
        status = "delivered"
    elif channel["channel_type"] == "webhook":
        status = "delivered"

    with get_db() as conn:
        conn.execute(
            "INSERT INTO notification_log (id, channel_id, channel_name, channel_type, event_type, title, message, status, sent_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (log_id, channel["id"], channel["name"], channel["channel_type"],
             event_type, title, message, status, now),
        )

    return {
        "id": log_id,
        "channel_id": channel["id"],
        "channel_name": channel["name"],
        "channel_type": channel["channel_type"],
        "event_type": event_type,
        "title": title,
        "status": status,
        "sent_at": now,
    }


def get_notification_log(limit: int = 50, channel_type: str | None = None) -> list[dict]:
    conditions = []
    params: list = []
    if channel_type:
        conditions.append("channel_type = ?")
        params.append(channel_type)
    where = (" WHERE " + " AND ".join(conditions)) if conditions else ""
    params.append(limit)

    with get_db() as conn:
        rows = conn.execute(
            f"SELECT * FROM notification_log{where} ORDER BY sent_at DESC LIMIT ?",
            params,
        ).fetchall()
    return [dict(r) for r in rows]


def test_channel(channel_id: str) -> dict | None:
    with get_db() as conn:
        row = conn.execute("SELECT * FROM notification_channels WHERE id = ?", (channel_id,)).fetchone()
    if not row:
        return None
    ch = dict(row)
    ch["enabled"] = True
    try:
        ch["config"] = json.loads(ch["config"])
    except (json.JSONDecodeError, TypeError):
        ch["config"] = {}
    return _simulate_send(ch, "test", "Test notification", "This is a test from SentinelAI")
