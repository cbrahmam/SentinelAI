from datetime import datetime, timezone, timedelta
from backend.database import get_db
from backend.services.metric_store import get_services


SLO_DEFINITIONS = {
    "api-gateway": {"target": 99.9, "error_threshold": 5.0, "latency_threshold": 500},
    "auth-service": {"target": 99.95, "error_threshold": 3.0, "latency_threshold": 200},
    "user-service": {"target": 99.9, "error_threshold": 5.0, "latency_threshold": 300},
    "payment-service": {"target": 99.99, "error_threshold": 1.0, "latency_threshold": 400},
    "notification-service": {"target": 99.5, "error_threshold": 10.0, "latency_threshold": 1000},
    "postgres-primary": {"target": 99.99, "error_threshold": 1.0, "latency_threshold": 50},
    "redis-cache": {"target": 99.99, "error_threshold": 1.0, "latency_threshold": 10},
    "rabbitmq": {"target": 99.9, "error_threshold": 5.0, "latency_threshold": 100},
}

BUDGET_WINDOW_HOURS = 24 * 30


def get_slo_status(service: str, window_hours: int = 24) -> dict:
    slo_def = SLO_DEFINITIONS.get(service, {"target": 99.9, "error_threshold": 5.0, "latency_threshold": 500})
    start = (datetime.now(timezone.utc) - timedelta(hours=window_hours)).isoformat()

    with get_db() as conn:
        total_row = conn.execute(
            "SELECT COUNT(*) as cnt FROM metrics WHERE service = ? AND metric_name = 'error_rate' AND timestamp >= ?",
            (service, start),
        ).fetchone()
        total_points = total_row["cnt"] if total_row else 0

        violation_row = conn.execute(
            "SELECT COUNT(*) as cnt FROM metrics WHERE service = ? AND metric_name = 'error_rate' AND value > ? AND timestamp >= ?",
            (service, slo_def["error_threshold"], start),
        ).fetchone()
        violation_points = violation_row["cnt"] if violation_row else 0

        latency_violation_row = conn.execute(
            "SELECT COUNT(*) as cnt FROM metrics WHERE service = ? AND metric_name = 'p95_latency_ms' AND value > ? AND timestamp >= ?",
            (service, slo_def["latency_threshold"], start),
        ).fetchone()
        latency_violations = latency_violation_row["cnt"] if latency_violation_row else 0

    if total_points == 0:
        uptime = 100.0
    else:
        good_points = total_points - violation_points
        uptime = (good_points / total_points) * 100

    target = slo_def["target"]
    budget_total_minutes = window_hours * 60 * (1 - target / 100)
    budget_used_minutes = window_hours * 60 * (1 - uptime / 100) if uptime < 100 else 0
    budget_remaining_minutes = max(0, budget_total_minutes - budget_used_minutes)
    budget_pct = (budget_remaining_minutes / budget_total_minutes * 100) if budget_total_minutes > 0 else 100

    return {
        "service": service,
        "slo_target": target,
        "current_uptime": round(uptime, 4),
        "meeting_slo": uptime >= target,
        "error_budget_total_minutes": round(budget_total_minutes, 2),
        "error_budget_used_minutes": round(budget_used_minutes, 2),
        "error_budget_remaining_minutes": round(budget_remaining_minutes, 2),
        "error_budget_remaining_pct": round(budget_pct, 2),
        "window_hours": window_hours,
        "total_data_points": total_points,
        "error_violations": violation_points,
        "latency_violations": latency_violations,
        "error_threshold": slo_def["error_threshold"],
        "latency_threshold": slo_def["latency_threshold"],
    }


def get_all_slo_status(window_hours: int = 24) -> list[dict]:
    services = get_services()
    results = []
    for svc in services:
        results.append(get_slo_status(svc, window_hours))
    return results
