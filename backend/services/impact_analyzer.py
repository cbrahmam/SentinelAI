from datetime import datetime, timedelta
from backend.database import get_db

DEPENDENCY_GRAPH = {
    "api-gateway": ["auth-service", "user-service", "payment-service"],
    "auth-service": ["postgres-primary", "redis-cache"],
    "user-service": ["postgres-primary", "redis-cache"],
    "payment-service": ["postgres-primary", "rabbitmq"],
    "notification-service": ["rabbitmq", "redis-cache"],
    "postgres-primary": [],
    "redis-cache": [],
    "rabbitmq": [],
}

REVERSE_DEPS = {}
for svc, deps in DEPENDENCY_GRAPH.items():
    for dep in deps:
        REVERSE_DEPS.setdefault(dep, []).append(svc)

SERVICE_USER_IMPACT = {
    "api-gateway": 100,
    "auth-service": 85,
    "user-service": 70,
    "payment-service": 60,
    "notification-service": 30,
    "postgres-primary": 95,
    "redis-cache": 80,
    "rabbitmq": 40,
}

SERVICE_REVENUE_IMPACT = {
    "api-gateway": "critical",
    "auth-service": "high",
    "user-service": "high",
    "payment-service": "critical",
    "notification-service": "low",
    "postgres-primary": "critical",
    "redis-cache": "medium",
    "rabbitmq": "medium",
}


def _get_downstream(service: str, visited: set = None):
    if visited is None:
        visited = set()
    visited.add(service)
    result = []
    for dependent in REVERSE_DEPS.get(service, []):
        if dependent not in visited:
            result.append(dependent)
            result.extend(_get_downstream(dependent, visited))
    return result


def _get_upstream(service: str, visited: set = None):
    if visited is None:
        visited = set()
    visited.add(service)
    result = []
    for dep in DEPENDENCY_GRAPH.get(service, []):
        if dep not in visited:
            result.append(dep)
            result.extend(_get_upstream(dep, visited))
    return result


def _propagation_chain(service: str):
    chain = []
    queue = [(service, 0)]
    visited = {service}
    while queue:
        current, depth = queue.pop(0)
        for dependent in REVERSE_DEPS.get(current, []):
            if dependent not in visited:
                visited.add(dependent)
                chain.append({
                    "service": dependent,
                    "depth": depth + 1,
                    "caused_by": current,
                    "user_impact_pct": SERVICE_USER_IMPACT.get(dependent, 0),
                })
                queue.append((dependent, depth + 1))
    return chain


def analyze_impact(service: str):
    downstream = _get_downstream(service)
    upstream = _get_upstream(service)
    chain = _propagation_chain(service)

    all_affected = list(set([service] + downstream))
    total_user_impact = max(SERVICE_USER_IMPACT.get(s, 0) for s in all_affected)
    revenue_impacts = [SERVICE_REVENUE_IMPACT.get(s, "low") for s in all_affected]
    severity_order = {"critical": 4, "high": 3, "medium": 2, "low": 1}
    worst_revenue = max(revenue_impacts, key=lambda x: severity_order.get(x, 0))

    blast_radius = round(len(all_affected) / len(DEPENDENCY_GRAPH) * 100, 1)

    with get_db() as conn:
        recent_incidents = conn.execute(
            "SELECT id, title, severity, started_at, resolved_at FROM incidents WHERE affected_services LIKE ? ORDER BY started_at DESC LIMIT 5",
            (f"%{service}%",)
        ).fetchall()

    past_incidents = [
        {
            "id": r["id"],
            "title": r["title"],
            "severity": r["severity"],
            "started_at": r["started_at"],
            "resolved_at": r["resolved_at"],
        }
        for r in recent_incidents
    ]

    mttr = None
    if past_incidents:
        durations = []
        for inc in past_incidents:
            if inc["resolved_at"] and inc["started_at"]:
                dur = (datetime.fromisoformat(inc["resolved_at"]) - datetime.fromisoformat(inc["started_at"])).total_seconds() / 60
                durations.append(dur)
        if durations:
            mttr = round(sum(durations) / len(durations), 1)

    recommendations = []
    if blast_radius > 50:
        recommendations.append("High blast radius — consider circuit breakers or fallback paths")
    if len(downstream) > 2:
        recommendations.append(f"{len(downstream)} downstream services affected — add health checks and graceful degradation")
    if worst_revenue == "critical":
        recommendations.append("Critical revenue impact — ensure redundancy and automated failover")
    if not upstream:
        recommendations.append("No upstream dependencies — this is a leaf service, outage originates here")
    if mttr and mttr > 30:
        recommendations.append(f"MTTR is {mttr}min — consider runbook automation to reduce recovery time")

    return {
        "service": service,
        "direct_dependencies": DEPENDENCY_GRAPH.get(service, []),
        "direct_dependents": REVERSE_DEPS.get(service, []),
        "downstream_affected": downstream,
        "upstream_dependencies": upstream,
        "propagation_chain": chain,
        "blast_radius_pct": blast_radius,
        "total_affected_services": len(all_affected),
        "user_impact_pct": total_user_impact,
        "revenue_impact": worst_revenue,
        "mttr_minutes": mttr,
        "past_incidents": past_incidents,
        "recommendations": recommendations,
    }


def compare_impacts():
    results = []
    for svc in DEPENDENCY_GRAPH:
        downstream = _get_downstream(svc)
        all_affected = list(set([svc] + downstream))
        blast_radius = round(len(all_affected) / len(DEPENDENCY_GRAPH) * 100, 1)
        results.append({
            "service": svc,
            "blast_radius_pct": blast_radius,
            "affected_count": len(all_affected),
            "user_impact_pct": SERVICE_USER_IMPACT.get(svc, 0),
            "revenue_impact": SERVICE_REVENUE_IMPACT.get(svc, "low"),
        })
    results.sort(key=lambda x: x["blast_radius_pct"], reverse=True)
    return results
