from fastapi import APIRouter
from backend.services.impact_analyzer import analyze_impact, compare_impacts

router = APIRouter()


@router.get("")
async def get_impact_comparison():
    return {"services": compare_impacts()}


@router.get("/{service}")
async def get_service_impact(service: str):
    return analyze_impact(service)
