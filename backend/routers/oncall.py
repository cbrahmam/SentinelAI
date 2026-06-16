from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional
from backend.services.oncall_manager import (
    create_schedule, list_schedules, get_schedule, delete_schedule,
    get_current_oncall, get_all_oncall, create_override, list_overrides,
    delete_override, get_escalation_chain,
)

router = APIRouter()


class MemberInput(BaseModel):
    name: str
    email: str = ""
    phone: str = ""
    role: str = "engineer"


class ScheduleInput(BaseModel):
    name: str
    team: str
    members: list[MemberInput]
    rotation_type: str = "weekly"
    escalation_minutes: int = 15
    start_date: Optional[str] = None


class OverrideInput(BaseModel):
    override_member: MemberInput
    start_time: str
    end_time: str
    original_member: str = ""
    reason: str = ""


@router.get("")
async def get_schedules():
    schedules = list_schedules()
    return {"schedules": schedules, "count": len(schedules)}


@router.post("")
async def add_schedule(schedule: ScheduleInput):
    members = [m.model_dump() for m in schedule.members]
    result = create_schedule(
        name=schedule.name,
        team=schedule.team,
        members=members,
        rotation_type=schedule.rotation_type,
        escalation_minutes=schedule.escalation_minutes,
        start_date=schedule.start_date,
    )
    return result


@router.get("/current")
async def who_is_oncall():
    oncalls = get_all_oncall()
    return {"oncall": oncalls}


@router.get("/{schedule_id}")
async def get_schedule_detail(schedule_id: str):
    schedule = get_schedule(schedule_id)
    if not schedule:
        return {"error": "Schedule not found"}
    return schedule


@router.delete("/{schedule_id}")
async def remove_schedule(schedule_id: str):
    success = delete_schedule(schedule_id)
    return {"deleted": success}


@router.get("/{schedule_id}/oncall")
async def get_oncall(schedule_id: str):
    oncall = get_current_oncall(schedule_id)
    if not oncall:
        return {"error": "No on-call found"}
    return oncall


@router.get("/{schedule_id}/escalation")
async def get_escalation(schedule_id: str):
    chain = get_escalation_chain(schedule_id)
    return {"chain": chain, "schedule_id": schedule_id}


@router.get("/{schedule_id}/overrides")
async def get_overrides(schedule_id: str):
    overrides = list_overrides(schedule_id)
    return {"overrides": overrides}


@router.post("/{schedule_id}/overrides")
async def add_override(schedule_id: str, override: OverrideInput):
    result = create_override(
        schedule_id=schedule_id,
        override_member=override.override_member.model_dump(),
        start_time=override.start_time,
        end_time=override.end_time,
        original_member=override.original_member,
        reason=override.reason,
    )
    return result


@router.delete("/overrides/{override_id}")
async def remove_override(override_id: str):
    success = delete_override(override_id)
    return {"deleted": success}
