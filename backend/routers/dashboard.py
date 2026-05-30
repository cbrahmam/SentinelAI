from fastapi import APIRouter
from backend.services.metric_store import get_services, get_latest_metrics_for_service
from backend.services.alert_engine import list_alerts, get_firing_count
from backend.services.monitor import get_active_anomalies

router = APIRouter()


def _compute_status(metrics: dict[str, float]) -> str:
    cpu = metrics.get("cpu_usage", 0)
    mem = metrics.get("memory_usage", 0)
    err = metrics.get("error_rate", 0)
    if cpu > 95 or mem > 90 or err > 20:
        return "critical"
    if cpu > 80 or mem > 75 or err > 5:
        return "warning"
    return "healthy"


@router.get("")
async def get_dashboard():
    services = get_services()
    service_statuses = []
    for name in services:
        metrics = get_latest_metrics_for_service(name)
        status = _compute_status(metrics)
        service_statuses.append({
            "name": name,
            "status": status,
            "metrics": metrics,
        })

    firing_alerts = list_alerts(status="firing", limit=20)
    active_anomalies = get_active_anomalies()

    degraded = [s for s in service_statuses if s["status"] != "healthy"]
    system_status = "All Systems Operational" if not degraded else f"{len(degraded)} Service{'s' if len(degraded) > 1 else ''} Degraded"

    return {
        "system_status": system_status,
        "services": service_statuses,
        "firing_alerts": firing_alerts,
        "firing_alert_count": len(firing_alerts),
        "active_anomaly_count": len(active_anomalies),
    }
