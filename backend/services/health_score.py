from datetime import datetime, timezone, timedelta
from backend.database import get_db
from backend.services.metric_store import get_services


THRESHOLDS = {
    "cpu_usage": {"good": 60, "warn": 80, "bad": 95},
    "memory_usage": {"good": 55, "warn": 75, "bad": 90},
    "error_rate": {"good": 1, "warn": 5, "bad": 20},
    "p95_latency_ms": {"good": 200, "warn": 500, "bad": 2000},
}

WEIGHTS = {
    "cpu_usage": 0.15,
    "memory_usage": 0.15,
    "error_rate": 0.35,
    "p95_latency_ms": 0.20,
    "slo_compliance": 0.15,
}


def _metric_score(metric_name: str, value: float) -> float:
    t = THRESHOLDS.get(metric_name)
    if not t:
        return 80.0
    if value <= t["good"]:
        return 100.0
    elif value <= t["warn"]:
        pct = (value - t["good"]) / (t["warn"] - t["good"])
        return 100 - pct * 30
    elif value <= t["bad"]:
        pct = (value - t["warn"]) / (t["bad"] - t["warn"])
        return 70 - pct * 40
    else:
        return max(0, 30 - (value - t["bad"]) / t["bad"] * 30)


def get_service_health_score(service: str, window_hours: int = 1) -> dict:
    start = (datetime.now(timezone.utc) - timedelta(hours=window_hours)).isoformat()

    metric_values = {}
    with get_db() as conn:
        for metric in THRESHOLDS:
            row = conn.execute(
                "SELECT AVG(value) as avg_val, MAX(value) as max_val FROM metrics WHERE service = ? AND metric_name = ? AND timestamp >= ?",
                (service, metric, start),
            ).fetchone()
            if row and row["avg_val"] is not None:
                metric_values[metric] = {
                    "avg": round(row["avg_val"], 2),
                    "max": round(row["max_val"], 2),
                }

        firing_alerts = conn.execute(
            "SELECT COUNT(*) as cnt FROM alerts WHERE service = ? AND status = 'firing'",
            (service,),
        ).fetchone()["cnt"]

    component_scores = {}
    weighted_total = 0
    weight_sum = 0

    for metric, weight in WEIGHTS.items():
        if metric == "slo_compliance":
            slo_score = max(0, 100 - firing_alerts * 15)
            component_scores["slo_compliance"] = round(slo_score, 1)
            weighted_total += slo_score * weight
            weight_sum += weight
        elif metric in metric_values:
            score = _metric_score(metric, metric_values[metric]["avg"])
            component_scores[metric] = round(score, 1)
            weighted_total += score * weight
            weight_sum += weight

    overall = round(weighted_total / weight_sum, 1) if weight_sum > 0 else 100.0

    prev_start = (datetime.now(timezone.utc) - timedelta(hours=window_hours * 2)).isoformat()
    prev_end = start
    prev_scores = {}
    with get_db() as conn:
        for metric in THRESHOLDS:
            row = conn.execute(
                "SELECT AVG(value) as avg_val FROM metrics WHERE service = ? AND metric_name = ? AND timestamp >= ? AND timestamp < ?",
                (service, metric, prev_start, prev_end),
            ).fetchone()
            if row and row["avg_val"] is not None:
                prev_scores[metric] = _metric_score(metric, row["avg_val"])

    prev_overall = sum(prev_scores.get(m, 100) * WEIGHTS.get(m, 0) for m in WEIGHTS if m != "slo_compliance")
    prev_weight = sum(WEIGHTS.get(m, 0) for m in prev_scores)
    prev_overall = round(prev_overall / prev_weight, 1) if prev_weight > 0 else overall
    trend = round(overall - prev_overall, 1)

    if overall >= 90:
        grade = "A"
    elif overall >= 75:
        grade = "B"
    elif overall >= 60:
        grade = "C"
    elif overall >= 40:
        grade = "D"
    else:
        grade = "F"

    return {
        "service": service,
        "score": overall,
        "grade": grade,
        "trend": trend,
        "trend_direction": "up" if trend > 0.5 else "down" if trend < -0.5 else "stable",
        "component_scores": component_scores,
        "metric_values": metric_values,
        "firing_alerts": firing_alerts,
        "window_hours": window_hours,
    }


def get_all_health_scores(window_hours: int = 1) -> list[dict]:
    services = get_services()
    if not services:
        services = [
            "api-gateway", "auth-service", "user-service", "payment-service",
            "notification-service", "postgres-primary", "redis-cache", "rabbitmq",
        ]
    scores = []
    for svc in services:
        scores.append(get_service_health_score(svc, window_hours))
    scores.sort(key=lambda s: s["score"])
    return scores
