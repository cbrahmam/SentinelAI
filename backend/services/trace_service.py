from datetime import datetime
from backend.database import get_db
from backend.models.schemas import TraceSpan, TraceView


def get_trace(trace_id: str) -> TraceView | None:
    with get_db() as conn:
        rows = conn.execute(
            "SELECT service, timestamp, level, message, span_id FROM logs WHERE trace_id = ? ORDER BY timestamp ASC",
            (trace_id,),
        ).fetchall()

    if not rows:
        return None

    spans = []
    error_service = None
    root_cause_log = None

    for row in rows:
        span = TraceSpan(
            service=row["service"],
            timestamp=row["timestamp"],
            level=row["level"],
            message=row["message"],
            span_id=row["span_id"],
        )
        spans.append(span)
        if row["level"] in ("error", "fatal") and error_service is None:
            error_service = row["service"]
            root_cause_log = row["message"]

    total_duration = 0.0
    if len(spans) >= 2:
        try:
            first = datetime.fromisoformat(spans[0].timestamp)
            last = datetime.fromisoformat(spans[-1].timestamp)
            total_duration = (last - first).total_seconds() * 1000
        except (ValueError, TypeError):
            pass

    return TraceView(
        trace_id=trace_id,
        spans=spans,
        total_duration_ms=total_duration,
        error_service=error_service,
        root_cause_log=root_cause_log,
    )


def search_traces(
    service: str | None = None,
    has_error: bool = False,
    limit: int = 50,
) -> list[dict]:
    if has_error:
        query = """
            SELECT DISTINCT trace_id FROM logs
            WHERE trace_id IS NOT NULL AND trace_id != '' AND level IN ('error', 'fatal')
        """
        params: list = []
        if service:
            query += " AND service = ?"
            params.append(service)
        query += " ORDER BY timestamp DESC LIMIT ?"
        params.append(limit)
    else:
        query = """
            SELECT DISTINCT trace_id FROM logs
            WHERE trace_id IS NOT NULL AND trace_id != ''
        """
        params = []
        if service:
            query += " AND service = ?"
            params.append(service)
        query += " ORDER BY timestamp DESC LIMIT ?"
        params.append(limit)

    with get_db() as conn:
        rows = conn.execute(query, params).fetchall()

    results = []
    for row in rows:
        tid = row["trace_id"]
        trace = get_trace(tid)
        if trace:
            results.append({
                "trace_id": tid,
                "span_count": len(trace.spans),
                "total_duration_ms": trace.total_duration_ms,
                "services": list(set(s.service for s in trace.spans)),
                "has_error": trace.error_service is not None,
                "error_service": trace.error_service,
            })
    return results
