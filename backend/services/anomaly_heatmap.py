from datetime import datetime, timezone, timedelta
from backend.database import get_db
from backend.services.metric_store import get_services


def get_heatmap_data(hours: int = 24, bucket_minutes: int = 60) -> dict:
    services = get_services()
    if not services:
        services = [
            "api-gateway", "auth-service", "user-service", "payment-service",
            "notification-service", "postgres-primary", "redis-cache", "rabbitmq",
        ]

    now = datetime.now(timezone.utc)
    start = now - timedelta(hours=hours)
    num_buckets = max(1, (hours * 60) // bucket_minutes)

    buckets = []
    for i in range(num_buckets):
        bucket_start = start + timedelta(minutes=i * bucket_minutes)
        bucket_end = bucket_start + timedelta(minutes=bucket_minutes)
        buckets.append({
            "start": bucket_start.isoformat(),
            "end": bucket_end.isoformat(),
            "label": bucket_start.strftime("%H:%M"),
        })

    heatmap = {}
    for svc in services:
        row_data = []
        for bucket in buckets:
            count = _count_anomaly_indicators(svc, bucket["start"], bucket["end"])
            row_data.append(count)
        heatmap[svc] = row_data

    max_val = max((max(row) for row in heatmap.values() if row), default=1)

    return {
        "services": services,
        "buckets": [b["label"] for b in buckets],
        "bucket_details": buckets,
        "heatmap": heatmap,
        "max_value": max_val,
        "hours": hours,
        "bucket_minutes": bucket_minutes,
    }


def _count_anomaly_indicators(service: str, start_iso: str, end_iso: str) -> int:
    count = 0
    with get_db() as conn:
        alert_row = conn.execute(
            "SELECT COUNT(*) as cnt FROM alerts WHERE service = ? AND fired_at >= ? AND fired_at < ?",
            (service, start_iso, end_iso),
        ).fetchone()
        count += alert_row["cnt"] if alert_row else 0

        error_row = conn.execute(
            "SELECT COUNT(*) as cnt FROM metrics WHERE service = ? AND metric_name = 'error_rate' AND value > 10 AND timestamp >= ? AND timestamp < ?",
            (service, start_iso, end_iso),
        ).fetchone()
        count += error_row["cnt"] if error_row else 0

        error_log_row = conn.execute(
            "SELECT COUNT(*) as cnt FROM logs WHERE service = ? AND level = 'ERROR' AND timestamp >= ? AND timestamp < ?",
            (service, start_iso, end_iso),
        ).fetchone()
        count += min(error_log_row["cnt"] // 5 if error_log_row else 0, 10)

    return count


def get_service_heatmap(service: str, hours: int = 168, bucket_minutes: int = 60) -> dict:
    now = datetime.now(timezone.utc)
    start = now - timedelta(hours=hours)
    num_buckets = max(1, (hours * 60) // bucket_minutes)

    metrics_names = ["cpu_usage", "memory_usage", "error_rate", "p95_latency_ms"]
    heatmap = {}

    for metric in metrics_names:
        row_data = []
        for i in range(num_buckets):
            bucket_start = (start + timedelta(minutes=i * bucket_minutes)).isoformat()
            bucket_end = (start + timedelta(minutes=(i + 1) * bucket_minutes)).isoformat()

            with get_db() as conn:
                row = conn.execute(
                    "SELECT COUNT(*) as cnt FROM metrics WHERE service = ? AND metric_name = ? AND timestamp >= ? AND timestamp < ? AND ("
                    "  (metric_name = 'cpu_usage' AND value > 85) OR"
                    "  (metric_name = 'memory_usage' AND value > 80) OR"
                    "  (metric_name = 'error_rate' AND value > 5) OR"
                    "  (metric_name = 'p95_latency_ms' AND value > 500)"
                    ")",
                    (service, metric, bucket_start, bucket_end),
                ).fetchone()
            row_data.append(row["cnt"] if row else 0)
        heatmap[metric] = row_data

    bucket_labels = []
    for i in range(num_buckets):
        t = start + timedelta(minutes=i * bucket_minutes)
        bucket_labels.append(t.strftime("%m/%d %H:%M"))

    return {
        "service": service,
        "metrics": metrics_names,
        "buckets": bucket_labels,
        "heatmap": heatmap,
        "hours": hours,
        "bucket_minutes": bucket_minutes,
    }
