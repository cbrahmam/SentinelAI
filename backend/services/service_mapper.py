from backend.generators.simulator import DEPENDENCIES
from backend.services.metric_store import get_services, get_latest_metrics_for_service
from backend.services.alert_engine import list_alerts


def _compute_status(metrics: dict[str, float]) -> str:
    cpu = metrics.get("cpu_usage", 0)
    mem = metrics.get("memory_usage", 0)
    err = metrics.get("error_rate", 0)
    if cpu > 95 or mem > 90 or err > 20:
        return "critical"
    if cpu > 80 or mem > 75 or err > 5:
        return "warning"
    return "healthy"


def get_service_map() -> dict:
    known_services = set(DEPENDENCIES.keys())
    active_services = set(get_services())
    all_services = known_services | active_services

    firing = list_alerts(status="firing")
    alerted_services = {a["service"] for a in firing if a.get("service")}

    nodes = []
    for name in sorted(all_services):
        metrics = get_latest_metrics_for_service(name)
        status = _compute_status(metrics) if metrics else "unknown"
        nodes.append({
            "id": name,
            "status": status,
            "has_alert": name in alerted_services,
            "metrics": {
                "cpu_usage": metrics.get("cpu_usage"),
                "memory_usage": metrics.get("memory_usage"),
                "request_rate": metrics.get("request_rate"),
                "error_rate": metrics.get("error_rate"),
                "p95_latency_ms": metrics.get("p95_latency_ms"),
            },
        })

    edges = []
    for source, deps in DEPENDENCIES.items():
        for target in deps:
            source_metrics = get_latest_metrics_for_service(source)
            error_rate = source_metrics.get("error_rate", 0) if source_metrics else 0
            request_rate = source_metrics.get("request_rate", 0) if source_metrics else 0
            edges.append({
                "source": source,
                "target": target,
                "healthy": error_rate < 5,
                "traffic": request_rate,
            })

    return {"nodes": nodes, "edges": edges}


def get_service_dependencies(service_name: str) -> dict:
    upstream = DEPENDENCIES.get(service_name, [])
    downstream = [s for s, deps in DEPENDENCIES.items() if service_name in deps]
    return {
        "service": service_name,
        "depends_on": upstream,
        "depended_by": downstream,
    }
