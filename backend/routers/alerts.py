from fastapi import APIRouter

router = APIRouter()


@router.get("")
async def list_alerts():
    return {"alerts": [], "count": 0}
