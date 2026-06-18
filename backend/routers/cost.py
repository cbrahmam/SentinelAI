from fastapi import APIRouter, Query
from backend.services.cost_optimizer import analyze_costs

router = APIRouter()


@router.get("")
async def get_cost_analysis(hours: int = Query(24, ge=1, le=168)):
    return analyze_costs(hours)
