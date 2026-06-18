from fastapi import APIRouter, Query
from backend.services.audit_logger import list_events, get_timeline, get_stats, record_event

router = APIRouter()


@router.get("")
async def get_audit_log(
    resource_type: str = None,
    resource_id: str = None,
    actor: str = None,
    action: str = None,
    hours: int = Query(168, ge=1, le=720),
    limit: int = Query(200, ge=1, le=1000),
):
    events = list_events(resource_type, resource_id, actor, action, hours, limit)
    return {"events": events, "count": len(events)}


@router.get("/timeline")
async def get_change_timeline(hours: int = Query(24, ge=1, le=168)):
    timeline = get_timeline(hours)
    return {"timeline": timeline, "count": len(timeline)}


@router.get("/stats")
async def get_audit_stats(hours: int = Query(168, ge=1, le=720)):
    return get_stats(hours)


@router.post("")
async def create_audit_event(
    actor: str = "system",
    action: str = "manual_entry",
    resource_type: str = "system",
    resource_id: str = None,
    resource_name: str = None,
):
    event_id = record_event(actor, action, resource_type, resource_id, resource_name)
    return {"id": event_id, "status": "recorded"}
