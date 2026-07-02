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


def _count_by(entries: list[dict], key: str) -> dict:
    counts: dict[str, int] = {}
    for e in entries:
        counts[e.get(key) or "unassigned"] = counts.get(e.get(key) or "unassigned", 0) + 1
    return dict(sorted(counts.items()))


def coverage_stats() -> dict:
    """Ownership coverage and distribution across the catalog."""
    entries = list_entries()
    total = len(entries)
    with_owner = [e for e in entries if e.get("owner")]
    with_oncall = [e for e in entries if e.get("on_call")]
    tier1_no_owner = [e["service"] for e in entries if e.get("tier") == "tier-1" and not e.get("owner")]
    uncataloged = uncataloged_services()

    def pct(n):
        return round(n / total * 100, 1) if total else 0.0

    return {
        "total_cataloged": total,
        "uncataloged": uncataloged,
        "uncataloged_count": len(uncataloged),
        "owner_coverage_pct": pct(len(with_owner)),
        "oncall_coverage_pct": pct(len(with_oncall)),
        "tier1_missing_owner": tier1_no_owner,
        "by_tier": _count_by(entries, "tier"),
        "by_team": _count_by(entries, "team"),
        "by_lifecycle": _count_by(entries, "lifecycle"),
    }
