import json
from datetime import datetime, timezone, timedelta
from backend.database import get_db
from backend.models.schemas import LogEntry, ParsedLog


def store_log(parsed: ParsedLog):
    structured_json = json.dumps(parsed.structured_data) if parsed.structured_data else None
    with get_db() as conn:
        conn.execute(
            """INSERT INTO logs (service, host, level, message, raw_line, structured_data, trace_id, span_id, timestamp)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (parsed.service, parsed.host, parsed.level, parsed.message, parsed.raw_line,
             structured_json, parsed.trace_id, parsed.span_id, parsed.timestamp),
        )


def store_logs_batch(logs: list[ParsedLog]):
    rows = []
    for p in logs:
        structured_json = json.dumps(p.structured_data) if p.structured_data else None
        rows.append((p.service, p.host, p.level, p.message, p.raw_line,
                      structured_json, p.trace_id, p.span_id, p.timestamp))
    with get_db() as conn:
        conn.executemany(
            """INSERT INTO logs (service, host, level, message, raw_line, structured_data, trace_id, span_id, timestamp)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            rows,
        )


def query_logs(
    service: str | None = None,
    level: str | None = None,
    search_text: str | None = None,
    start_time: str | None = None,
    end_time: str | None = None,
    limit: int = 200,
) -> list[LogEntry]:
    if not start_time:
        start_time = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
    if not end_time:
        end_time = datetime.now(timezone.utc).isoformat()

    conditions = ["timestamp >= ?", "timestamp <= ?"]
    params: list = [start_time, end_time]

    if service:
        conditions.append("service = ?")
        params.append(service)
    if level:
        conditions.append("level = ?")
        params.append(level)
    if search_text:
        conditions.append("message LIKE ?")
        params.append(f"%{search_text}%")

    params.append(limit)
    where = " AND ".join(conditions)

    with get_db() as conn:
        rows = conn.execute(
            f"""SELECT id, timestamp, level, service, host, message, raw_line, structured_data, trace_id, span_id
                FROM logs WHERE {where} ORDER BY timestamp DESC LIMIT ?""",
            params,
        ).fetchall()

    results = []
    for r in rows:
        d = dict(r)
        if d["structured_data"]:
            try:
                d["structured_data"] = json.loads(d["structured_data"])
            except (json.JSONDecodeError, TypeError):
                d["structured_data"] = None
        results.append(LogEntry(**d))
    return results


def search_logs(query: str, limit: int = 100) -> list[LogEntry]:
    with get_db() as conn:
        rows = conn.execute(
            """SELECT id, timestamp, level, service, host, message, raw_line, structured_data, trace_id, span_id
               FROM logs WHERE message LIKE ? ORDER BY timestamp DESC LIMIT ?""",
            (f"%{query}%", limit),
        ).fetchall()

    results = []
    for r in rows:
        d = dict(r)
        if d["structured_data"]:
            try:
                d["structured_data"] = json.loads(d["structured_data"])
            except (json.JSONDecodeError, TypeError):
                d["structured_data"] = None
        results.append(LogEntry(**d))
    return results


def get_log_counts(
    service: str | None = None,
    start_time: str | None = None,
    end_time: str | None = None,
    bucket_minutes: int = 5,
) -> list[dict]:
    if not start_time:
        start_time = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
    if not end_time:
        end_time = datetime.now(timezone.utc).isoformat()

    conditions = ["timestamp >= ?", "timestamp <= ?"]
    params: list = [start_time, end_time]
    if service:
        conditions.append("service = ?")
        params.append(service)

    where = " AND ".join(conditions)
    bucket_expr = f"strftime('%Y-%m-%dT%H:', timestamp) || printf('%02d', (CAST(strftime('%M', timestamp) AS INTEGER) / {bucket_minutes}) * {bucket_minutes})"

    with get_db() as conn:
        rows = conn.execute(
            f"""SELECT {bucket_expr} as bucket, level, COUNT(*) as count
                FROM logs WHERE {where}
                GROUP BY bucket, level ORDER BY bucket""",
            params,
        ).fetchall()
    return [dict(r) for r in rows]
