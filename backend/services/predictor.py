import numpy as np
from datetime import datetime, timezone, timedelta
from backend.database import get_db


def _get_recent_values(service: str, metric_name: str, hours: float = 2) -> list[dict]:
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=hours)).isoformat()
    with get_db() as conn:
        rows = conn.execute(
            "SELECT value, timestamp FROM metrics WHERE service = ? AND metric_name = ? AND timestamp >= ? ORDER BY timestamp",
            (service, metric_name, cutoff),
        ).fetchall()
    return [{"value": r["value"], "timestamp": r["timestamp"]} for r in rows]


def _linear_forecast(values: list[float], steps_ahead: int = 30) -> list[float]:
    if len(values) < 5:
        return []
    x = np.arange(len(values), dtype=float)
    y = np.array(values, dtype=float)
    coeffs = np.polyfit(x, y, 1)
    slope, intercept = coeffs
    forecasted = []
    for i in range(steps_ahead):
        forecasted.append(float(slope * (len(values) + i) + intercept))
    return forecasted


def predict_threshold_breach(service: str, metric_name: str, threshold: float, comparison: str = "above") -> dict | None:
    recent = _get_recent_values(service, metric_name, hours=2)
    if len(recent) < 10:
        return None

    values = [r["value"] for r in recent]
    current = values[-1]
    avg_interval_seconds = 60

    if comparison == "above" and current >= threshold:
        return None
    if comparison == "below" and current <= threshold:
        return None

    forecast = _linear_forecast(values, steps_ahead=120)
    if not forecast:
        return None

    breach_step = None
    for i, val in enumerate(forecast):
        if comparison == "above" and val >= threshold:
            breach_step = i
            break
        elif comparison == "below" and val <= threshold:
            breach_step = i
            break

    if breach_step is None:
        return None

    seconds_until_breach = breach_step * avg_interval_seconds
    if seconds_until_breach > 14400:
        return None

    breach_time = datetime.now(timezone.utc) + timedelta(seconds=seconds_until_breach)

    x = np.arange(len(values), dtype=float)
    y = np.array(values, dtype=float)
    slope = np.polyfit(x, y, 1)[0]
    trend = "increasing" if slope > 0 else "decreasing"

    return {
        "service": service,
        "metric_name": metric_name,
        "current_value": round(current, 2),
        "threshold": threshold,
        "comparison": comparison,
        "predicted_breach_value": round(forecast[breach_step], 2),
        "seconds_until_breach": seconds_until_breach,
        "breach_time": breach_time.isoformat(),
        "trend": trend,
        "trend_slope": round(float(slope), 4),
        "confidence": min(0.95, max(0.3, len(values) / 200)),
        "data_points_used": len(values),
    }


METRIC_THRESHOLDS = {
    "cpu_usage": {"threshold": 90.0, "comparison": "above"},
    "memory_usage": {"threshold": 85.0, "comparison": "above"},
    "error_rate": {"threshold": 10.0, "comparison": "above"},
    "p95_latency_ms": {"threshold": 1000.0, "comparison": "above"},
    "queue_depth": {"threshold": 3000.0, "comparison": "above"},
}


def get_all_predictions() -> list[dict]:
    from backend.services.metric_store import get_services
    services = get_services()
    predictions = []

    for service in services:
        for metric, config in METRIC_THRESHOLDS.items():
            prediction = predict_threshold_breach(
                service, metric, config["threshold"], config["comparison"]
            )
            if prediction:
                predictions.append(prediction)

    predictions.sort(key=lambda p: p["seconds_until_breach"])
    return predictions


def get_predictions_for_service(service: str) -> list[dict]:
    predictions = []
    for metric, config in METRIC_THRESHOLDS.items():
        prediction = predict_threshold_breach(
            service, metric, config["threshold"], config["comparison"]
        )
        if prediction:
            predictions.append(prediction)
    predictions.sort(key=lambda p: p["seconds_until_breach"])
    return predictions
