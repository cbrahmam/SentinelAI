import json
import uuid
from datetime import datetime, timezone, timedelta
from backend.database import get_db


def create_schedule(
    name: str,
    team: str,
    members: list[dict],
    rotation_type: str = "weekly",
    escalation_minutes: int = 15,
    start_date: str | None = None,
) -> dict:
    schedule_id = str(uuid.uuid4())[:8]
    now = datetime.now(timezone.utc).isoformat()
    start = start_date or now

    with get_db() as conn:
        conn.execute(
            """INSERT INTO oncall_schedules (id, name, team, members, rotation_type,
               current_index, escalation_minutes, start_date, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?)""",
            (schedule_id, name, team, json.dumps(members), rotation_type,
             escalation_minutes, start, now, now),
        )

    return {
        "id": schedule_id,
        "name": name,
        "team": team,
        "members": members,
        "rotation_type": rotation_type,
        "current_index": 0,
        "escalation_minutes": escalation_minutes,
        "start_date": start,
        "created_at": now,
        "updated_at": now,
    }


def list_schedules() -> list[dict]:
    with get_db() as conn:
        rows = conn.execute("SELECT * FROM oncall_schedules ORDER BY created_at DESC").fetchall()
    results = []
    for r in rows:
        d = dict(r)
        try:
            d["members"] = json.loads(d["members"])
        except (json.JSONDecodeError, TypeError):
            d["members"] = []
        results.append(d)
    return results


def get_schedule(schedule_id: str) -> dict | None:
    with get_db() as conn:
        row = conn.execute("SELECT * FROM oncall_schedules WHERE id = ?", (schedule_id,)).fetchone()
    if not row:
        return None
    d = dict(row)
    try:
        d["members"] = json.loads(d["members"])
    except (json.JSONDecodeError, TypeError):
        d["members"] = []
    return d


def delete_schedule(schedule_id: str) -> bool:
    with get_db() as conn:
        conn.execute("DELETE FROM oncall_overrides WHERE schedule_id = ?", (schedule_id,))
        result = conn.execute("DELETE FROM oncall_schedules WHERE id = ?", (schedule_id,))
        return result.rowcount > 0


def get_current_oncall(schedule_id: str) -> dict | None:
    schedule = get_schedule(schedule_id)
    if not schedule or not schedule["members"]:
        return None

    now = datetime.now(timezone.utc)
    override = _get_active_override(schedule_id, now.isoformat())
    if override:
        return {
            "member": override["override_member"],
            "source": "override",
            "override_reason": override.get("reason", ""),
            "schedule_id": schedule_id,
            "schedule_name": schedule["name"],
        }

    start = datetime.fromisoformat(schedule["start_date"].replace("Z", "+00:00"))
    if schedule["rotation_type"] == "weekly":
        weeks_elapsed = max(0, (now - start).days // 7)
        idx = weeks_elapsed % len(schedule["members"])
    elif schedule["rotation_type"] == "daily":
        days_elapsed = max(0, (now - start).days)
        idx = days_elapsed % len(schedule["members"])
    else:
        idx = schedule["current_index"] % len(schedule["members"])

    member = schedule["members"][idx]
    return {
        "member": member,
        "source": "rotation",
        "rotation_index": idx,
        "schedule_id": schedule_id,
        "schedule_name": schedule["name"],
    }


def get_all_oncall() -> list[dict]:
    schedules = list_schedules()
    results = []
    for s in schedules:
        oncall = get_current_oncall(s["id"])
        if oncall:
            results.append(oncall)
    return results


def create_override(
    schedule_id: str,
    override_member: dict,
    start_time: str,
    end_time: str,
    original_member: str = "",
    reason: str = "",
) -> dict:
    override_id = str(uuid.uuid4())[:8]
    with get_db() as conn:
        conn.execute(
            """INSERT INTO oncall_overrides (id, schedule_id, original_member, override_member,
               start_time, end_time, reason)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (override_id, schedule_id, original_member, json.dumps(override_member),
             start_time, end_time, reason),
        )
    return {
        "id": override_id,
        "schedule_id": schedule_id,
        "override_member": override_member,
        "start_time": start_time,
        "end_time": end_time,
        "reason": reason,
    }


def list_overrides(schedule_id: str) -> list[dict]:
    with get_db() as conn:
        rows = conn.execute(
            "SELECT * FROM oncall_overrides WHERE schedule_id = ? ORDER BY start_time DESC",
            (schedule_id,),
        ).fetchall()
    results = []
    for r in rows:
        d = dict(r)
        try:
            d["override_member"] = json.loads(d["override_member"])
        except (json.JSONDecodeError, TypeError):
            pass
        results.append(d)
    return results


def delete_override(override_id: str) -> bool:
    with get_db() as conn:
        result = conn.execute("DELETE FROM oncall_overrides WHERE id = ?", (override_id,))
        return result.rowcount > 0


def _get_active_override(schedule_id: str, now_iso: str) -> dict | None:
    with get_db() as conn:
        row = conn.execute(
            "SELECT * FROM oncall_overrides WHERE schedule_id = ? AND start_time <= ? AND end_time > ?",
            (schedule_id, now_iso, now_iso),
        ).fetchone()
    if not row:
        return None
    d = dict(row)
    try:
        d["override_member"] = json.loads(d["override_member"])
    except (json.JSONDecodeError, TypeError):
        pass
    return d


def get_escalation_chain(schedule_id: str) -> list[dict]:
    schedule = get_schedule(schedule_id)
    if not schedule or not schedule["members"]:
        return []

    oncall = get_current_oncall(schedule_id)
    if not oncall:
        return []

    chain = [{"level": 1, "member": oncall["member"], "delay_minutes": 0}]
    current_idx = oncall.get("rotation_index", 0)
    members = schedule["members"]
    escalation = schedule["escalation_minutes"]

    for i in range(1, min(3, len(members))):
        next_idx = (current_idx + i) % len(members)
        chain.append({
            "level": i + 1,
            "member": members[next_idx],
            "delay_minutes": escalation * i,
        })

    return chain
