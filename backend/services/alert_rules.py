import json
import uuid
from datetime import datetime, timezone, timedelta
from backend.database import get_db


def create_rule(
    name: str,
    service: str,
    metric_name: str,
    condition: str,
    threshold: float,
    severity: str = "warning",
    duration_seconds: int = 0,
    notification_channels: list[str] | None = None,
) -> dict:
    rule_id = str(uuid.uuid4())[:8]
    now = datetime.now(timezone.utc).isoformat()
    channels = json.dumps(notification_channels or [])

    with get_db() as conn:
        conn.execute(
            """INSERT INTO alert_rules (id, name, service, metric_name, condition, threshold,
               severity, duration_seconds, enabled, notification_channels, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)""",
            (rule_id, name, service, metric_name, condition, threshold,
             severity, duration_seconds, channels, now, now),
        )

    return {
        "id": rule_id,
        "name": name,
        "service": service,
        "metric_name": metric_name,
        "condition": condition,
        "threshold": threshold,
        "severity": severity,
        "duration_seconds": duration_seconds,
        "enabled": True,
        "notification_channels": notification_channels or [],
        "created_at": now,
        "updated_at": now,
    }


def list_rules(service: str | None = None, enabled_only: bool = False) -> list[dict]:
    conditions = []
    params: list = []
    if service:
        conditions.append("service = ?")
        params.append(service)
    if enabled_only:
        conditions.append("enabled = 1")

    where = (" WHERE " + " AND ".join(conditions)) if conditions else ""

    with get_db() as conn:
        rows = conn.execute(
            f"SELECT * FROM alert_rules{where} ORDER BY created_at DESC", params
        ).fetchall()

    results = []
    for r in rows:
        d = dict(r)
        d["enabled"] = bool(d["enabled"])
        try:
            d["notification_channels"] = json.loads(d.get("notification_channels", "[]"))
        except (json.JSONDecodeError, TypeError):
            d["notification_channels"] = []
        results.append(d)
    return results


def get_rule(rule_id: str) -> dict | None:
    with get_db() as conn:
        row = conn.execute("SELECT * FROM alert_rules WHERE id = ?", (rule_id,)).fetchone()
    if not row:
        return None
    d = dict(row)
    d["enabled"] = bool(d["enabled"])
    try:
        d["notification_channels"] = json.loads(d.get("notification_channels", "[]"))
    except (json.JSONDecodeError, TypeError):
        d["notification_channels"] = []
    return d


def update_rule(rule_id: str, updates: dict) -> dict | None:
    rule = get_rule(rule_id)
    if not rule:
        return None

    now = datetime.now(timezone.utc).isoformat()
    allowed = {"name", "service", "metric_name", "condition", "threshold",
               "severity", "duration_seconds", "enabled", "notification_channels"}
    sets = []
    params = []
    for key, val in updates.items():
        if key in allowed:
            if key == "notification_channels":
                val = json.dumps(val)
            if key == "enabled":
                val = 1 if val else 0
            sets.append(f"{key} = ?")
            params.append(val)

    if not sets:
        return rule

    sets.append("updated_at = ?")
    params.append(now)
    params.append(rule_id)

    with get_db() as conn:
        conn.execute(f"UPDATE alert_rules SET {', '.join(sets)} WHERE id = ?", params)

    return get_rule(rule_id)


def delete_rule(rule_id: str) -> bool:
    with get_db() as conn:
        result = conn.execute("DELETE FROM alert_rules WHERE id = ?", (rule_id,))
        return result.rowcount > 0


def toggle_rule(rule_id: str) -> dict | None:
    rule = get_rule(rule_id)
    if not rule:
        return None
    new_enabled = not rule["enabled"]
    return update_rule(rule_id, {"enabled": new_enabled})


def evaluate_rules() -> list[dict]:
    rules = list_rules(enabled_only=True)
    if not rules:
        return []

    triggered = []
    for rule in rules:
        value = _get_latest_value(rule["service"], rule["metric_name"])
        if value is None:
            continue

        breached = _check_condition(value, rule["condition"], rule["threshold"])
        if breached:
            triggered.append({
                "rule": rule,
                "current_value": value,
                "breached": True,
            })

    return triggered


def _get_latest_value(service: str, metric_name: str) -> float | None:
    with get_db() as conn:
        row = conn.execute(
            "SELECT value FROM metrics WHERE service = ? AND metric_name = ? ORDER BY timestamp DESC LIMIT 1",
            (service, metric_name),
        ).fetchone()
    return row["value"] if row else None


def _check_condition(value: float, condition: str, threshold: float) -> bool:
    if condition == "above":
        return value > threshold
    elif condition == "below":
        return value < threshold
    elif condition == "equals":
        return abs(value - threshold) < 0.001
    elif condition == "not_equals":
        return abs(value - threshold) >= 0.001
    elif condition == "above_or_equal":
        return value >= threshold
    elif condition == "below_or_equal":
        return value <= threshold
    return False
