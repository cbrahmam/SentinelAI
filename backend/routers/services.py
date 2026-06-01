from fastapi import APIRouter, HTTPException
from backend.services.metric_store import (
    get_services, get_latest_metrics_for_service, get_metric_names, query_metrics,
)
from backend.services.alert_engine import list_alerts
from backend.services.monitor import get_active_anomalies_for_service, get_anomaly_history
from backend.services.service_mapper import get_service_map, get_service_dependencies
from backend.models.schemas import ServiceStatus

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
async def list_all_services():
    services = get_services()
    result = []
    for name in services:
        metrics = get_latest_metrics_for_service(name)
        status = _compute_status(metrics)
        result.append(ServiceStatus(
            name=name,
            status=status,
            cpu_usage=metrics.get("cpu_usage"),
            memory_usage=metrics.get("memory_usage"),
            error_rate=metrics.get("error_rate"),
            p95_latency_ms=metrics.get("p95_latency_ms"),
            request_rate=metrics.get("request_rate"),
        ).model_dump())
    return {"services": result}


@router.get("/service-map")
async def api_service_map():
    return get_service_map()


@router.get("/{name}")
async def get_service_detail(name: str):
    services = get_services()
    if name not in services:
        raise HTTPException(status_code=404, detail="Service not found")

    metrics = get_latest_metrics_for_service(name)
    status = _compute_status(metrics)
    metric_names = get_metric_names(name)
    deps = get_service_dependencies(name)
    alerts = list_alerts(service=name, limit=20)
    anomalies = get_active_anomalies_for_service(name)
    anomaly_hist = [h for h in get_anomaly_history() if h.get("service") == name][-20:]

    return {
        "name": name,
        "status": status,
        "metrics": metrics,
        "metric_names": metric_names,
        "dependencies": deps,
        "alerts": alerts,
        "active_anomalies": [a.model_dump() for a in anomalies],
        "anomaly_history": anomaly_hist,
    }


@router.get("/{name}/metrics")
async def get_service_metrics(name: str):
    metric_names = get_metric_names(name)
    latest = get_latest_metrics_for_service(name)
    return {"service": name, "metric_names": metric_names, "latest": latest}


@router.get("/{name}/dependencies")
async def api_service_dependencies(name: str):
    return get_service_dependencies(name)
