from fastapi import APIRouter

router = APIRouter()


@router.get("")
async def list_incidents():
    return {"incidents": [], "count": 0}
