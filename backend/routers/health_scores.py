from fastapi import APIRouter, Query
from backend.services.health_score import get_all_health_scores, get_service_health_score

router = APIRouter()


@router.get("")
async def all_scores(window_hours: int = Query(1, ge=1, le=168)):
    scores = get_all_health_scores(window_hours)
    return {"scores": scores, "count": len(scores)}


@router.get("/{service}")
async def service_score(service: str, window_hours: int = Query(1, ge=1, le=168)):
    score = get_service_health_score(service, window_hours)
    return score
