from fastapi import APIRouter, Query
from pydantic import BaseModel
from typing import Optional
from backend.services.notification_manager import (
    create_channel, list_channels, delete_channel, toggle_channel,
    send_notification, get_notification_log, test_channel,
)

router = APIRouter()


class ChannelInput(BaseModel):
    name: str
    channel_type: str
    config: dict = {}


class NotifyInput(BaseModel):
    event_type: str
    title: str
    message: str = ""


@router.get("/channels")
async def get_channels():
    channels = list_channels()
    return {"channels": channels, "count": len(channels)}


@router.post("/channels")
async def add_channel(channel: ChannelInput):
    result = create_channel(
        name=channel.name,
        channel_type=channel.channel_type,
        config=channel.config,
    )
    return result


@router.put("/channels/{channel_id}/toggle")
async def toggle(channel_id: str):
    result = toggle_channel(channel_id)
    if not result:
        return {"error": "Channel not found"}
    return result


@router.post("/channels/{channel_id}/test")
async def test(channel_id: str):
    result = test_channel(channel_id)
    if not result:
        return {"error": "Channel not found"}
    return result


@router.delete("/channels/{channel_id}")
async def remove_channel(channel_id: str):
    success = delete_channel(channel_id)
    return {"deleted": success}


@router.post("/send")
async def notify(payload: NotifyInput):
    results = send_notification(payload.event_type, payload.title, payload.message)
    return {"sent": results, "count": len(results)}


@router.get("/log")
async def notification_history(
    limit: int = Query(50, le=200),
    channel_type: Optional[str] = None,
):
    log = get_notification_log(limit=limit, channel_type=channel_type)
    return {"log": log, "count": len(log)}
