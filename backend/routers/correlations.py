from fastapi import APIRouter
from backend.services.correlator import get_latest_correlations

router = APIRouter()


@router.get("")
async def api_get_correlations():
    correlations = get_latest_correlations()
    return {"correlations": [c.model_dump() for c in correlations], "count": len(correlations)}
