import re
from collections import Counter, defaultdict
from datetime import datetime, timezone, timedelta
from difflib import SequenceMatcher
from backend.database import get_db
from backend.models.schemas import LogAnomaly, LogAnomalyReport


def _normalize_message(msg: str) -> str:
    """Collapse variable parts of a log message into placeholders for pattern matching."""
    s = re.sub(r'\b[0-9a-f]{8,}\b', '<ID>', msg)
    s = re.sub(r'\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b', '<IP>', s)
    s = re.sub(r'\b\d+\b', '<N>', s)
    s = re.sub(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}', '<EMAIL>', s)
    return s


def _similar(a: str, b: str) -> bool:
    return SequenceMatcher(None, a, b).ratio() > 0.7


def detect_log_anomalies(service: str | None = None, lookback_minutes: int = 30) -> LogAnomalyReport:
    start = (datetime.now(timezone.utc) - timedelta(minutes=lookback_minutes)).isoformat()
    end = datetime.now(timezone.utc).isoformat()
    baseline_start = (datetime.now(timezone.utc) - timedelta(minutes=lookback_minutes * 3)).isoformat()

    conditions = ["timestamp >= ?", "timestamp <= ?"]
    params: list = [start, end]
    if service:
        conditions.append("service = ?")
        params.append(service)

    where = " AND ".join(conditions)
    svc_label = service or "all"

    with get_db() as conn:
        recent_rows = conn.execute(
            f"SELECT level, message, timestamp, service FROM logs WHERE {where} ORDER BY timestamp",
            params,
        ).fetchall()

        baseline_conditions = ["timestamp >= ?", "timestamp < ?"]
        baseline_params: list = [baseline_start, start]
        if service:
            baseline_conditions.append("service = ?")
            baseline_params.append(service)
        baseline_where = " AND ".join(baseline_conditions)

        baseline_rows = conn.execute(
            f"SELECT level, message FROM logs WHERE {baseline_where}",
            baseline_params,
        ).fetchall()

    total_analyzed = len(recent_rows)
    anomalies: list[LogAnomaly] = []

    # --- 1. Error rate spike ---
    recent_errors = [r for r in recent_rows if r["level"] in ("error", "fatal")]
    baseline_errors = [r for r in baseline_rows if r["level"] in ("error", "fatal")]

    recent_error_rate = len(recent_errors) / max(lookback_minutes, 1)
    baseline_error_rate = len(baseline_errors) / max(lookback_minutes * 2, 1)

    if recent_error_rate > 0 and (baseline_error_rate == 0 or recent_error_rate > baseline_error_rate * 3):
        severity = "critical" if recent_error_rate > baseline_error_rate * 5 else "warning"
        sample = [r["message"] for r in recent_errors[:5]]
        timestamps = [r["timestamp"] for r in recent_errors]
        anomalies.append(LogAnomaly(
            anomaly_type="error_spike",
            service=svc_label,
            message_pattern=f"Error rate spike: {recent_error_rate:.1f}/min vs baseline {baseline_error_rate:.1f}/min",
            count=len(recent_errors),
            first_seen=timestamps[0] if timestamps else start,
            last_seen=timestamps[-1] if timestamps else end,
            severity=severity,
            sample_logs=sample,
        ))

    # --- 2. New error patterns ---
    baseline_patterns = set()
    for r in baseline_rows:
        if r["level"] in ("error", "fatal"):
            baseline_patterns.add(_normalize_message(r["message"]))

    recent_error_patterns: dict[str, list] = defaultdict(list)
    for r in recent_errors:
        pattern = _normalize_message(r["message"])
        recent_error_patterns[pattern].append(r)

    for pattern, rows in recent_error_patterns.items():
        is_new = True
        for bp in baseline_patterns:
            if _similar(pattern, bp):
                is_new = False
                break
        if is_new and len(rows) >= 1:
            timestamps_p = [r["timestamp"] for r in rows]
            anomalies.append(LogAnomaly(
                anomaly_type="new_error",
                service=svc_label,
                message_pattern=pattern[:200],
                count=len(rows),
                first_seen=timestamps_p[0],
                last_seen=timestamps_p[-1],
                severity="warning",
                sample_logs=[r["message"] for r in rows[:3]],
            ))

    # --- 3. Repeated errors ---
    error_counter = Counter(_normalize_message(r["message"]) for r in recent_errors)
    for pattern, count in error_counter.most_common(10):
        if count >= 5:
            matching = [r for r in recent_errors if _normalize_message(r["message"]) == pattern]
            timestamps_r = [r["timestamp"] for r in matching]
            severity = "critical" if count >= 20 else "warning"
            anomalies.append(LogAnomaly(
                anomaly_type="repeated_error",
                service=svc_label,
                message_pattern=pattern[:200],
                count=count,
                first_seen=timestamps_r[0] if timestamps_r else start,
                last_seen=timestamps_r[-1] if timestamps_r else end,
                severity=severity,
                sample_logs=[r["message"] for r in matching[:3]],
            ))

    # --- 4. Stack trace clustering ---
    stack_traces: list[dict] = []
    for r in recent_errors:
        msg = r["message"]
        if any(kw in msg.lower() for kw in ["traceback", "exception", "stack", "at ", "panic:", "caused by"]):
            stack_traces.append(dict(r))

    if stack_traces:
        clusters: list[list[dict]] = []
        for st in stack_traces:
            placed = False
            normalized = _normalize_message(st["message"])
            for cluster in clusters:
                if _similar(normalized, _normalize_message(cluster[0]["message"])):
                    cluster.append(st)
                    placed = True
                    break
            if not placed:
                clusters.append([st])

        for cluster in clusters:
            if len(cluster) >= 2:
                timestamps_c = [c["timestamp"] for c in cluster]
                anomalies.append(LogAnomaly(
                    anomaly_type="stack_trace_cluster",
                    service=svc_label,
                    message_pattern=_normalize_message(cluster[0]["message"])[:200],
                    count=len(cluster),
                    first_seen=timestamps_c[0],
                    last_seen=timestamps_c[-1],
                    severity="critical" if len(cluster) >= 5 else "warning",
                    sample_logs=[c["message"] for c in cluster[:3]],
                ))

    # Deduplicate anomalies by type+pattern
    seen = set()
    deduped = []
    for a in anomalies:
        key = (a.anomaly_type, a.message_pattern)
        if key not in seen:
            seen.add(key)
            deduped.append(a)

    return LogAnomalyReport(
        service=svc_label,
        anomalies=deduped,
        lookback_minutes=lookback_minutes,
        total_logs_analyzed=total_analyzed,
    )
