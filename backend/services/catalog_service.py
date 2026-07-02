from backend.services.catalog_store import list_entries, get_entry
from backend.services.metric_store import get_services, get_latest_metrics_for_service
from backend.services.service_mapper import get_service_dependencies
from backend.services.alert_engine import list_alerts

TIER_WEIGHT = {"tier-1": 3, "tier-2": 2, "tier-3": 1}


def _compute_status(metrics: dict) -> str:
    cpu = metrics.get("cpu_usage", 0)
    mem = metrics.get("memory_usage", 0)
    err = metrics.get("error_rate", 0)
    if cpu > 95 or mem > 90 or err > 20:
        return "critical"
    if cpu > 80 or mem > 75 or err > 5:
        return "warning"
    return "healthy"


def enrich(entry: dict) -> dict:
    """Attach live status, firing alert count and dependency info to an entry."""
    service = entry["service"]
    metrics = get_latest_metrics_for_service(service)
    status = _compute_status(metrics) if metrics else "unknown"
    firing = list_alerts(service=service, status="firing")
    deps = get_service_dependencies(service)
    return {
        **entry,
        "status": status,
        "firing_alerts": len(firing),
        "dependencies": deps.get("depends_on", []) if isinstance(deps, dict) else [],
        "dependents": deps.get("depended_by", []) if isinstance(deps, dict) else [],
    }


def enriched_catalog() -> list[dict]:
    return [enrich(e) for e in list_entries()]


def enriched_entry(service: str) -> dict | None:
    entry = get_entry(service)
    return enrich(entry) if entry else None


def uncataloged_services() -> list[str]:
    """Live services that have no catalog entry yet — ownership gaps."""
    cataloged = {e["service"] for e in list_entries()}
    return sorted(s for s in get_services() if s not in cataloged)
