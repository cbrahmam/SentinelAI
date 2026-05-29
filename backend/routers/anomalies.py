from fastapi import APIRouter, Query
from backend.services.monitor import (
    get_active_anomalies,
    get_active_anomalies_for_service,
    get_anomaly_history,
    get_latest_log_anomalies,
    run_detection_now,
)

router = APIRouter()


@router.get("")
async def list_anomalies():
    active = get_active_anomalies()
    return {
        "anomalies": [r.model_dump() for r in active],
        "count": len(active),
    }


@router.get("/history")
async def anomaly_history(start: str | None = None, end: str | None = None):
    history = get_anomaly_history()
    if start:
        history = [h for h in history if h["detected_at"] >= start]
    if end:
        history = [h for h in history if h["detected_at"] <= end]
    return {"history": history, "count": len(history)}


@router.post("/detect-now")
async def detect_now():
    result = await run_detection_now()
    return result


@router.get("/{service}")
async def service_anomalies(service: str):
    active = get_active_anomalies_for_service(service)
    return {
        "service": service,
        "anomalies": [r.model_dump() for r in active],
        "count": len(active),
    }
