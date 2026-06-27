from fastapi import APIRouter, HTTPException
from backend.models.schemas import SyntheticCheckCreate
from backend.services.probe_store import list_checks, get_check, create_check, toggle_check

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
