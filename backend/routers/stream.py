import asyncio
import json
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from backend.generators.simulator import simulator

router = APIRouter()


async def _event_generator(queue: asyncio.Queue, event_type: str | None = None):
    try:
        while True:
            try:
                msg = await asyncio.wait_for(queue.get(), timeout=30)
                if event_type:
                    data = json.loads(msg)
                    if data.get("type") != event_type:
                        continue
                yield f"data: {msg}\n\n"
            except asyncio.TimeoutError:
                yield f": keepalive\n\n"
    except asyncio.CancelledError:
        return
    finally:
        simulator.unsubscribe_sse(queue)


@router.get("/metrics")
async def stream_metrics():
    queue = simulator.subscribe_sse()
    return StreamingResponse(
        _event_generator(queue, "metric"),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no"},
    )


@router.get("/logs")
async def stream_logs():
    queue = simulator.subscribe_sse()
    return StreamingResponse(
        _event_generator(queue, "log"),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no"},
    )


@router.get("/all")
async def stream_all():
    queue = simulator.subscribe_sse()
    return StreamingResponse(
        _event_generator(queue),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no"},
    )
