from fastapi import APIRouter, Query
from backend.services.fingerprint_engine import analyze_recent_anomalies, get_pattern_library, match_single_alert

router = APIRouter()


@router.get("")
async def get_fingerprints(hours: int = Query(24, ge=1, le=168)):
    return analyze_recent_anomalies(hours)


@router.get("/patterns")
async def list_patterns():
    return {"patterns": get_pattern_library()}


@router.get("/match/{alert_id}")
async def match_alert(alert_id: str):
    return match_single_alert(alert_id)
