from fastapi import APIRouter
from backend.services.metric_store import get_services, get_latest_metrics_for_service
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
async def list_services():
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
