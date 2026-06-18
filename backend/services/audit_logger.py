import json
import uuid
from datetime import datetime, timedelta
from backend.database import get_db


def record_event(actor: str, action: str, resource_type: str,
                 resource_id: str = None, resource_name: str = None,
                 details: dict = None):
    event_id = str(uuid.uuid4())[:12]
    with get_db() as conn:
        conn.execute(
            """INSERT INTO audit_log
               (id, actor, action, resource_type, resource_id, resource_name, details, timestamp)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (event_id, actor, action, resource_type, resource_id,
             resource_name, json.dumps(details) if details else None,
             datetime.utcnow().isoformat())
        )
    return event_id


def list_events(resource_type: str = None, resource_id: str = None,
                actor: str = None, action: str = None,
                hours: int = 168, limit: int = 200):
    cutoff = (datetime.utcnow() - timedelta(hours=hours)).isoformat()
    query = "SELECT * FROM audit_log WHERE timestamp >= ?"
    params = [cutoff]

    if resource_type:
        query += " AND resource_type = ?"
        params.append(resource_type)
    if resource_id:
        query += " AND resource_id = ?"
        params.append(resource_id)
    if actor:
        query += " AND actor = ?"
        params.append(actor)
    if action:
        query += " AND action LIKE ?"
        params.append(f"%{action}%")

    query += " ORDER BY timestamp DESC LIMIT ?"
    params.append(limit)

    with get_db() as conn:
        rows = conn.execute(query, params).fetchall()

    return [
        {
            "id": r["id"],
            "actor": r["actor"],
            "action": r["action"],
            "resource_type": r["resource_type"],
            "resource_id": r["resource_id"],
            "resource_name": r["resource_name"],
            "details": json.loads(r["details"]) if r["details"] else None,
            "timestamp": r["timestamp"],
        }
        for r in rows
    ]


def get_timeline(hours: int = 24):
    cutoff = (datetime.utcnow() - timedelta(hours=hours)).isoformat()
    with get_db() as conn:
        events = conn.execute(
            "SELECT * FROM audit_log WHERE timestamp >= ? ORDER BY timestamp DESC",
            (cutoff,)
        ).fetchall()

        incidents = conn.execute(
            "SELECT id, title, severity, status, started_at FROM incidents WHERE started_at >= ? ORDER BY started_at DESC",
            (cutoff,)
        ).fetchall()

        deploys = conn.execute(
            "SELECT id, service, version, status, timestamp FROM deploy_events WHERE timestamp >= ? ORDER BY timestamp DESC",
            (cutoff,)
        ).fetchall()

    timeline = []
    for e in events:
        timeline.append({
            "type": "config_change",
            "id": e["id"],
            "title": f"{e['actor']} {e['action']} {e['resource_type']}",
            "detail": e["resource_name"] or e["resource_id"],
            "timestamp": e["timestamp"],
        })
    for i in incidents:
        timeline.append({
            "type": "incident",
            "id": i["id"],
            "title": i["title"],
            "detail": f"{i['severity']} — {i['status']}",
            "timestamp": i["started_at"],
        })
    for d in deploys:
        timeline.append({
            "type": "deploy",
            "id": d["id"],
            "title": f"Deploy {d['version']} to {d['service']}",
            "detail": d["status"],
            "timestamp": d["timestamp"],
        })

    timeline.sort(key=lambda x: x["timestamp"], reverse=True)
    return timeline


def get_stats(hours: int = 168):
    cutoff = (datetime.utcnow() - timedelta(hours=hours)).isoformat()
    with get_db() as conn:
        total = conn.execute(
            "SELECT COUNT(*) FROM audit_log WHERE timestamp >= ?", (cutoff,)
        ).fetchone()[0]

        by_type = conn.execute(
            "SELECT resource_type, COUNT(*) as cnt FROM audit_log WHERE timestamp >= ? GROUP BY resource_type ORDER BY cnt DESC",
            (cutoff,)
        ).fetchall()

        by_actor = conn.execute(
            "SELECT actor, COUNT(*) as cnt FROM audit_log WHERE timestamp >= ? GROUP BY actor ORDER BY cnt DESC LIMIT 10",
            (cutoff,)
        ).fetchall()

        by_action = conn.execute(
            "SELECT action, COUNT(*) as cnt FROM audit_log WHERE timestamp >= ? GROUP BY action ORDER BY cnt DESC LIMIT 10",
            (cutoff,)
        ).fetchall()

    return {
        "total_events": total,
        "by_resource_type": {r["resource_type"]: r["cnt"] for r in by_type},
        "by_actor": {r["actor"]: r["cnt"] for r in by_actor},
        "by_action": {r["action"]: r["cnt"] for r in by_action},
    }
