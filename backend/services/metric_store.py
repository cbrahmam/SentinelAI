import json
from datetime import datetime, timezone, timedelta
from backend.database import get_db
from backend.models.schemas import DataPoint, MetricInput


def store_metric(m: MetricInput):
    ts = m.timestamp or datetime.now(timezone.utc).isoformat()
    tags_json = json.dumps(m.tags) if m.tags else None
    with get_db() as conn:
        conn.execute(
            "INSERT INTO metrics (service, host, metric_name, value, unit, tags, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (m.service, m.host, m.metric_name, m.value, m.unit, tags_json, ts),
        )


def store_metrics_batch(metrics: list[MetricInput]):
    rows = []
    now = datetime.now(timezone.utc).isoformat()
    for m in metrics:
        ts = m.timestamp or now
        tags_json = json.dumps(m.tags) if m.tags else None
        rows.append((m.service, m.host, m.metric_name, m.value, m.unit, tags_json, ts))
    with get_db() as conn:
        conn.executemany(
            "INSERT INTO metrics (service, host, metric_name, value, unit, tags, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)",
            rows,
        )


def query_metrics(
    service: str,
    metric_name: str,
    start_time: str | None = None,
    end_time: str | None = None,
    aggregation: str = "raw",
    limit: int = 1000,
) -> list[DataPoint]:
    if not start_time:
        start_time = (datetime.now(timezone.utc) - timedelta(hours=6)).isoformat()
    if not end_time:
        end_time = datetime.now(timezone.utc).isoformat()

    agg_formats = {
        "avg_1m": "%Y-%m-%dT%H:%M",
        "avg_5m": "%Y-%m-%dT%H:%M",
        "avg_15m": "%Y-%m-%dT%H:%M",
        "avg_1h": "%Y-%m-%dT%H",
    }

    if aggregation == "raw":
        with get_db() as conn:
            rows = conn.execute(
                """SELECT timestamp, value, service, host, metric_name, unit
                   FROM metrics
                   WHERE service = ? AND metric_name = ? AND timestamp >= ? AND timestamp <= ?
                   ORDER BY timestamp
                   LIMIT ?""",
                (service, metric_name, start_time, end_time, limit),
            ).fetchall()
        return [DataPoint(**dict(r)) for r in rows]

    fmt = agg_formats.get(aggregation, "%Y-%m-%dT%H:%M")

    if aggregation == "avg_5m":
        group_expr = "strftime('%Y-%m-%dT%H:', timestamp) || printf('%02d', (CAST(strftime('%M', timestamp) AS INTEGER) / 5) * 5)"
    elif aggregation == "avg_15m":
        group_expr = "strftime('%Y-%m-%dT%H:', timestamp) || printf('%02d', (CAST(strftime('%M', timestamp) AS INTEGER) / 15) * 15)"
    elif aggregation == "avg_1h":
        group_expr = f"strftime('{fmt}', timestamp)"
    else:
        group_expr = f"strftime('{fmt}', timestamp)"

    with get_db() as conn:
        rows = conn.execute(
            f"""SELECT {group_expr} as timestamp, AVG(value) as value, service, NULL as host, metric_name, unit
                FROM metrics
                WHERE service = ? AND metric_name = ? AND timestamp >= ? AND timestamp <= ?
                GROUP BY {group_expr}, service, metric_name, unit
                ORDER BY timestamp
                LIMIT ?""",
            (service, metric_name, start_time, end_time, limit),
        ).fetchall()
    return [DataPoint(**dict(r)) for r in rows]


def get_latest(service: str, metric_name: str) -> DataPoint | None:
    with get_db() as conn:
        row = conn.execute(
            """SELECT timestamp, value, service, host, metric_name, unit
               FROM metrics
               WHERE service = ? AND metric_name = ?
               ORDER BY timestamp DESC
               LIMIT 1""",
            (service, metric_name),
        ).fetchone()
    if row:
        return DataPoint(**dict(row))
    return None


def get_services() -> list[str]:
    with get_db() as conn:
        rows = conn.execute("SELECT DISTINCT service FROM metrics ORDER BY service").fetchall()
    return [r["service"] for r in rows]


def get_metric_names(service: str) -> list[str]:
    with get_db() as conn:
        rows = conn.execute(
            "SELECT DISTINCT metric_name FROM metrics WHERE service = ? ORDER BY metric_name",
            (service,),
        ).fetchall()
    return [r["metric_name"] for r in rows]


def get_latest_metrics_for_service(service: str) -> dict[str, float]:
    with get_db() as conn:
        rows = conn.execute(
            """SELECT metric_name, value FROM metrics
               WHERE service = ? AND id IN (
                   SELECT MAX(id) FROM metrics WHERE service = ? GROUP BY metric_name
               )""",
            (service, service),
        ).fetchall()
    return {r["metric_name"]: r["value"] for r in rows}
