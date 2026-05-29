from fastapi import APIRouter, Query
from backend.services.log_store import query_logs, search_logs, get_log_counts
from backend.services.log_anomaly_detector import detect_log_anomalies

router = APIRouter()


@router.get("")
async def get_logs(
    service: str | None = None,
    level: str | None = None,
    search_text: str | None = None,
    start_time: str | None = None,
    end_time: str | None = None,
    limit: int = 200,
):
    logs = query_logs(service, level, search_text, start_time, end_time, limit)
    return {"data": [lg.model_dump() for lg in logs], "count": len(logs)}


@router.get("/search")
async def search(q: str = Query(...), limit: int = 100):
    results = search_logs(q, limit)
    return {"data": [lg.model_dump() for lg in results], "count": len(results)}


@router.get("/counts")
async def log_counts(
    service: str | None = None,
    start_time: str | None = None,
    end_time: str | None = None,
    bucket_minutes: int = 5,
):
    counts = get_log_counts(service, start_time, end_time, bucket_minutes)
    return {"data": counts}


@router.get("/anomalies")
async def log_anomalies(service: str | None = None, lookback_minutes: int = 30):
    report = detect_log_anomalies(service, lookback_minutes)
    return report.model_dump()
