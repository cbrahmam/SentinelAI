import json
import uuid
from datetime import datetime, timezone, timedelta
from backend.database import get_db
from backend.services.metric_store import get_services


def get_public_status() -> dict:
    services = get_services()
    service_statuses = []
    overall = "operational"

    for svc in services:
        status = _compute_service_status(svc)
        service_statuses.append(status)
        if status["status"] == "major_outage":
            overall = "major_outage"
        elif status["status"] == "partial_outage" and overall != "major_outage":
            overall = "partial_outage"
        elif status["status"] == "degraded" and overall == "operational":
            overall = "degraded"

    active_incidents = _get_active_public_incidents()
    uptime_history = _get_uptime_history(services)

    return {
        "overall_status": overall,
        "services": service_statuses,
        "active_incidents": active_incidents,
        "uptime_history": uptime_history,
        "last_updated": datetime.now(timezone.utc).isoformat(),
    }


def _compute_service_status(service: str) -> dict:
    now = datetime.now(timezone.utc)
    one_hour_ago = (now - timedelta(hours=1)).isoformat()

    with get_db() as conn:
        error_row = conn.execute(
            "SELECT AVG(value) as avg_val FROM metrics WHERE service = ? AND metric_name = 'error_rate' AND timestamp >= ?",
            (service, one_hour_ago),
        ).fetchone()
        avg_error = error_row["avg_val"] if error_row and error_row["avg_val"] is not None else 0

        latency_row = conn.execute(
            "SELECT AVG(value) as avg_val FROM metrics WHERE service = ? AND metric_name = 'p95_latency_ms' AND timestamp >= ?",
            (service, one_hour_ago),
        ).fetchone()
        avg_latency = latency_row["avg_val"] if latency_row and latency_row["avg_val"] is not None else 0

        firing_count = conn.execute(
            "SELECT COUNT(*) as cnt FROM alerts WHERE service = ? AND status = 'firing'",
            (service,),
        ).fetchone()["cnt"]

    if avg_error > 20 or firing_count >= 3:
        status = "major_outage"
    elif avg_error > 5 or firing_count >= 1:
        status = "partial_outage"
    elif avg_error > 2 or avg_latency > 1000:
        status = "degraded"
    else:
        status = "operational"

    return {
        "service": service,
        "status": status,
        "avg_error_rate": round(avg_error, 2),
        "avg_latency_ms": round(avg_latency, 1),
        "firing_alerts": firing_count,
    }


def _get_active_public_incidents() -> list[dict]:
    with get_db() as conn:
        rows = conn.execute(
            "SELECT id, title, severity, status, summary, affected_services, started_at FROM incidents WHERE status != 'resolved' ORDER BY started_at DESC LIMIT 10"
        ).fetchall()

    results = []
    for r in rows:
        d = dict(r)
        try:
            d["affected_services"] = json.loads(d["affected_services"]) if d["affected_services"] else []
        except (json.JSONDecodeError, TypeError):
            d["affected_services"] = []
        results.append(d)
    return results


def _get_uptime_history(services: list[str], days: int = 30) -> list[dict]:
    history = []
    now = datetime.now(timezone.utc)

    for day_offset in range(days):
        day_start = (now - timedelta(days=day_offset + 1)).isoformat()
        day_end = (now - timedelta(days=day_offset)).isoformat()

        with get_db() as conn:
            total = conn.execute(
                "SELECT COUNT(*) as cnt FROM metrics WHERE metric_name = 'error_rate' AND timestamp >= ? AND timestamp < ?",
                (day_start, day_end),
            ).fetchone()["cnt"]

            violations = conn.execute(
                "SELECT COUNT(*) as cnt FROM metrics WHERE metric_name = 'error_rate' AND value > 10 AND timestamp >= ? AND timestamp < ?",
                (day_start, day_end),
            ).fetchone()["cnt"]

            incident_count = conn.execute(
                "SELECT COUNT(*) as cnt FROM incidents WHERE started_at >= ? AND started_at < ?",
                (day_start, day_end),
            ).fetchone()["cnt"]

        uptime = ((total - violations) / total * 100) if total > 0 else 100.0

        history.append({
            "date": (now - timedelta(days=day_offset + 1)).strftime("%Y-%m-%d"),
            "uptime_pct": round(uptime, 2),
            "incidents": incident_count,
            "data_points": total,
        })

    history.reverse()
    return history
