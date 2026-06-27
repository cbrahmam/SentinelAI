from fastapi import APIRouter, HTTPException, Query
from backend.models.schemas import SyntheticCheckCreate
from backend.services.probe_store import list_checks, get_check, create_check, toggle_check, get_results
from backend.services.probe_engine import probe_check
from backend.services.probe_analytics import check_analytics

router = APIRouter()


@router.get("")
async def get_checks():
    return {"checks": list_checks()}


@router.post("")
async def add_check(payload: SyntheticCheckCreate):
    return create_check(payload)


@router.get("/{check_id}")
async def get_single_check(check_id: str):
    check = get_check(check_id)
    if not check:
        raise HTTPException(status_code=404, detail="check not found")
    return check


@router.put("/{check_id}/toggle")
async def toggle(check_id: str, enabled: bool = True):
    check = toggle_check(check_id, enabled)
    if not check:
        raise HTTPException(status_code=404, detail="check not found")
    return check


@router.post("/{check_id}/run")
async def run_now(check_id: str):
    check = get_check(check_id)
    if not check:
        raise HTTPException(status_code=404, detail="check not found")
    results = probe_check(check)
    return {"check_id": check_id, "results": results}


@router.get("/{check_id}/results")
async def results(check_id: str, hours: int = Query(24, ge=1, le=168),
                  region: str | None = None):
    if not get_check(check_id):
        raise HTTPException(status_code=404, detail="check not found")
    return {"check_id": check_id, "results": get_results(check_id, hours=hours, region=region)}


@router.get("/{check_id}/analytics")
async def analytics(check_id: str, hours: int = Query(24, ge=1, le=168)):
    if not get_check(check_id):
        raise HTTPException(status_code=404, detail="check not found")
    return check_analytics(check_id, hours=hours)
