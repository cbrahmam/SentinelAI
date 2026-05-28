from fastapi import APIRouter, Query
from backend.services.metric_store import query_metrics, get_latest, get_metric_names

router = APIRouter()


@router.get("")
async def get_metrics(
    service: str = Query(...),
    metric_name: str = Query(...),
    start_time: str | None = None,
    end_time: str | None = None,
    aggregation: str = "raw",
    limit: int = 1000,
):
    data = query_metrics(service, metric_name, start_time, end_time, aggregation, limit)
    return {"data": [d.model_dump() for d in data], "count": len(data)}


@router.get("/latest")
async def get_latest_metric(service: str = Query(...), metric_name: str = Query(...)):
    point = get_latest(service, metric_name)
    if point:
        return point.model_dump()
    return {"error": "No data found"}


@router.get("/names")
async def get_metric_names_endpoint(service: str = Query(...)):
    return {"metric_names": get_metric_names(service)}
