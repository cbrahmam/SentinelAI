from fastapi import APIRouter, HTTPException
from backend.services.trace_service import get_trace, search_traces

router = APIRouter()


@router.get("")
async def api_search_traces(
    service: str | None = None,
    has_error: bool = False,
    limit: int = 50,
):
    traces = search_traces(service=service, has_error=has_error, limit=limit)
    return {"traces": traces, "count": len(traces)}


@router.get("/{trace_id}")
async def api_get_trace(trace_id: str):
    trace = get_trace(trace_id)
    if not trace:
        raise HTTPException(status_code=404, detail="Trace not found")
    return trace.model_dump()
