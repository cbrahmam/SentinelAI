from fastapi import APIRouter
from backend.services.status_page import get_public_status

router = APIRouter()


@router.get("")
async def public_status():
    return get_public_status()
