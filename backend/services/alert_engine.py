import json
import uuid
from datetime import datetime, timezone, timedelta
from backend.database import get_db
from backend.models.schemas import AnomalyReport, AnomalyPoint
from backend.services.ai_analyzer import AIAnalysis


def create_alert(
    anomaly: AnomalyReport,
    alert_type: str = "anomaly",
) -> dict:
    if not anomaly.anomalies:
        return {}

    worst = max(anomaly.anomalies, key=lambda a: {"critical": 2, "warning": 1}.get(a.severity, 0))
    now = datetime.now(timezone.utc).isoformat()

    with get_db() as conn:
        existing = conn.execute(
            "SELECT id, status FROM alerts WHERE service = ? AND metric_name = ? AND status = 'firing'",
            (anomaly.service, anomaly.metric_name),
        ).fetchone()

        if existing:
            conn.execute(
                "UPDATE alerts SET current_value = ?, severity = ?, description = ? WHERE id = ?",
                (worst.value, worst.severity,
                 f"{anomaly.metric_name} anomaly on {anomaly.service}: value={worst.value} (expected={worst.expected_value})",
                 existing["id"]),
            )
            return {"id": existing["id"], "action": "updated"}

        alert_id = str(uuid.uuid4())[:8]
        title = f"{worst.severity.upper()}: {anomaly.metric_name} anomaly on {anomaly.service}"
        description = (
            f"{anomaly.metric_name} on {anomaly.service} detected by {anomaly.detection_method}. "
            f"Current value: {worst.value}, expected: {worst.expected_value}, deviation: {worst.deviation}"
        )

        conn.execute(
            """INSERT INTO alerts (id, service, metric_name, alert_type, severity, title, description,
               current_value, threshold_value, status, fired_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'firing', ?)""",
            (alert_id, anomaly.service, anomaly.metric_name, alert_type, worst.severity,
             title, description, worst.value, worst.expected_value, now),
        )
        return {"id": alert_id, "action": "created"}


def acknowledge_alert(alert_id: str, user: str = "operator") -> bool:
    now = datetime.now(timezone.utc).isoformat()
    with get_db() as conn:
        result = conn.execute(
            "UPDATE alerts SET status = 'acknowledged', acknowledged_at = ? WHERE id = ? AND status = 'firing'",
            (now, alert_id),
        )
        return result.rowcount > 0


def resolve_alert(alert_id: str, resolved_by: str = "operator") -> bool:
    now = datetime.now(timezone.utc).isoformat()
    with get_db() as conn:
        result = conn.execute(
            "UPDATE alerts SET status = 'resolved', resolved_at = ?, resolved_by = ? WHERE id = ? AND status IN ('firing', 'acknowledged')",
            (now, resolved_by, alert_id),
        )
        return result.rowcount > 0


def set_alert_analysis(alert_id: str, analysis: AIAnalysis):
    with get_db() as conn:
        conn.execute(
            "UPDATE alerts SET ai_analysis = ? WHERE id = ?",
            (analysis.model_dump_json(), alert_id),
        )


def get_alert(alert_id: str) -> dict | None:
    with get_db() as conn:
        row = conn.execute("SELECT * FROM alerts WHERE id = ?", (alert_id,)).fetchone()
    if not row:
        return None
    d = dict(row)
    if d.get("ai_analysis"):
        try:
            d["ai_analysis"] = json.loads(d["ai_analysis"])
        except (json.JSONDecodeError, TypeError):
            pass
    return d


def list_alerts(
    status: str | None = None,
    severity: str | None = None,
    service: str | None = None,
    limit: int = 100,
) -> list[dict]:
    conditions = []
    params: list = []
    if status:
        conditions.append("status = ?")
        params.append(status)
    if severity:
        conditions.append("severity = ?")
        params.append(severity)
    if service:
        conditions.append("service = ?")
        params.append(service)

    where = (" WHERE " + " AND ".join(conditions)) if conditions else ""
    params.append(limit)

    with get_db() as conn:
        rows = conn.execute(
            f"SELECT * FROM alerts{where} ORDER BY fired_at DESC LIMIT ?", params
        ).fetchall()

    results = []
    for r in rows:
        d = dict(r)
        if d.get("ai_analysis"):
            try:
                d["ai_analysis"] = json.loads(d["ai_analysis"])
            except (json.JSONDecodeError, TypeError):
                pass
        results.append(d)
    return results


def auto_resolve_check():
    """Resolve alerts where the underlying anomaly is no longer active."""
    from backend.services.monitor import anomaly_state

    with get_db() as conn:
        firing = conn.execute(
            "SELECT id, service, metric_name, fired_at FROM alerts WHERE status IN ('firing', 'acknowledged')"
        ).fetchall()

    now = datetime.now(timezone.utc)
    resolved_count = 0
    for alert in firing:
        if not anomaly_state.is_anomaly_active(alert["service"], alert["metric_name"]):
            fired = datetime.fromisoformat(alert["fired_at"])
            if (now - fired).total_seconds() > 300:
                resolve_alert(alert["id"], resolved_by="auto")
                resolved_count += 1

    return resolved_count


def get_firing_count() -> int:
    with get_db() as conn:
        row = conn.execute("SELECT COUNT(*) as cnt FROM alerts WHERE status = 'firing'").fetchone()
    return row["cnt"] if row else 0


def get_critical_firing() -> list[dict]:
    with get_db() as conn:
        rows = conn.execute(
            "SELECT * FROM alerts WHERE status = 'firing' AND severity = 'critical' ORDER BY fired_at DESC LIMIT 5"
        ).fetchall()
    return [dict(r) for r in rows]
