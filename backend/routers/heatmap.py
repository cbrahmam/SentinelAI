from fastapi import APIRouter, Query
from backend.services.anomaly_heatmap import get_heatmap_data, get_service_heatmap

router = APIRouter()


@router.get("")
async def heatmap(hours: int = Query(24, le=168), bucket_minutes: int = Query(60, ge=15)):
    data = get_heatmap_data(hours=hours, bucket_minutes=bucket_minutes)
    return data


@router.get("/{service}")
async def service_heatmap(service: str, hours: int = Query(168, le=720), bucket_minutes: int = Query(60, ge=15)):
    data = get_service_heatmap(service, hours=hours, bucket_minutes=bucket_minutes)
    return data
