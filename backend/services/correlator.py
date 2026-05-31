import uuid
from datetime import datetime, timezone, timedelta
from backend.models.schemas import AnomalyReport, AnomalyPoint, CorrelationGroup
from backend.generators.simulator import DEPENDENCIES

REVERSE_DEPS: dict[str, list[str]] = {}
for svc, deps in DEPENDENCIES.items():
    for dep in deps:
        REVERSE_DEPS.setdefault(dep, []).append(svc)


def _find_propagation_path(origin: str, affected: set[str]) -> list[str]:
    path = [origin]
    visited = {origin}
    queue = [origin]
    while queue:
        current = queue.pop(0)
        for dependent in REVERSE_DEPS.get(current, []):
            if dependent in affected and dependent not in visited:
                visited.add(dependent)
                path.append(dependent)
                queue.append(dependent)
    for svc in affected:
        if svc not in visited and svc != origin:
            path.append(svc)
    return path


def _pick_origin(service_anomalies: dict[str, list[AnomalyPoint]]) -> str:
    infra = ["postgres-primary", "redis-cache", "rabbitmq"]
    for svc in infra:
        if svc in service_anomalies:
            return svc

    earliest_service = None
    earliest_time = None
    for svc, anomalies in service_anomalies.items():
        for a in anomalies:
            try:
                t = datetime.fromisoformat(a.timestamp)
            except (ValueError, TypeError):
                continue
            if earliest_time is None or t < earliest_time:
                earliest_time = t
                earliest_service = svc
    return earliest_service or list(service_anomalies.keys())[0]


def correlate_anomalies(
    reports: list[AnomalyReport],
    time_window_minutes: int = 10,
) -> list[CorrelationGroup]:
    active_reports = [r for r in reports if r.anomalies]
    if len(active_reports) < 2:
        return []

    service_anomalies: dict[str, list[AnomalyPoint]] = {}
    all_timestamps = []
    for report in active_reports:
        service_anomalies.setdefault(report.service, []).extend(report.anomalies)
        for a in report.anomalies:
            try:
                all_timestamps.append(datetime.fromisoformat(a.timestamp))
            except (ValueError, TypeError):
                pass

    if not all_timestamps:
        return []

    earliest = min(all_timestamps)
    latest = max(all_timestamps)
    span_seconds = int((latest - earliest).total_seconds())

    if span_seconds > time_window_minutes * 60:
        return _cluster_by_time(active_reports, time_window_minutes)

    origin = _pick_origin(service_anomalies)
    affected = set(service_anomalies.keys())
    affected.discard(origin)
    propagation_path = _find_propagation_path(origin, affected)

    origin_anomaly = service_anomalies[origin][0]
    total = sum(len(v) for v in service_anomalies.values())

    return [CorrelationGroup(
        id=str(uuid.uuid4())[:8],
        origin_service=origin,
        origin_anomaly=origin_anomaly,
        affected_services=sorted(affected),
        propagation_path=propagation_path,
        time_span_seconds=span_seconds,
        total_anomalies=total,
        detected_at=datetime.now(timezone.utc).isoformat(),
    )]


def _cluster_by_time(
    reports: list[AnomalyReport],
    window_minutes: int,
) -> list[CorrelationGroup]:
    timed: list[tuple[datetime, AnomalyReport, AnomalyPoint]] = []
    for r in reports:
        for a in r.anomalies:
            try:
                t = datetime.fromisoformat(a.timestamp)
                timed.append((t, r, a))
            except (ValueError, TypeError):
                continue
    timed.sort(key=lambda x: x[0])

    groups: list[CorrelationGroup] = []
    used = set()
    window = timedelta(minutes=window_minutes)

    for i, (t, r, a) in enumerate(timed):
        if i in used:
            continue
        cluster = [(t, r, a)]
        used.add(i)
        for j in range(i + 1, len(timed)):
            if j in used:
                continue
            if timed[j][0] - t <= window:
                cluster.append(timed[j])
                used.add(j)

        service_anomalies: dict[str, list[AnomalyPoint]] = {}
        for _, cr, ca in cluster:
            service_anomalies.setdefault(cr.service, []).append(ca)

        if len(service_anomalies) < 2:
            continue

        origin = _pick_origin(service_anomalies)
        affected = set(service_anomalies.keys())
        affected.discard(origin)
        propagation_path = _find_propagation_path(origin, affected)
        span = int((cluster[-1][0] - cluster[0][0]).total_seconds())

        groups.append(CorrelationGroup(
            id=str(uuid.uuid4())[:8],
            origin_service=origin,
            origin_anomaly=service_anomalies[origin][0],
            affected_services=sorted(affected),
            propagation_path=propagation_path,
            time_span_seconds=span,
            total_anomalies=sum(len(v) for v in service_anomalies.values()),
            detected_at=datetime.now(timezone.utc).isoformat(),
        ))

    return groups


_latest_correlations: list[CorrelationGroup] = []


def run_correlation(reports: list[AnomalyReport]) -> list[CorrelationGroup]:
    global _latest_correlations
    _latest_correlations = correlate_anomalies(reports)
    return _latest_correlations


def get_latest_correlations() -> list[CorrelationGroup]:
    return list(_latest_correlations)
