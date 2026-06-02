from fastapi import APIRouter, HTTPException
from backend.services.chaos_scenarios import (
    run_scenario, stop_scenario, get_scenario_status, list_scenarios,
)
from backend.services.runbook_library import list_runbooks, get_runbook, search_runbooks
from backend.services.report_generator import generate_report

router = APIRouter()


@router.get("/scenarios")
async def api_list_scenarios():
    return {"scenarios": list_scenarios()}


@router.post("/scenarios/{scenario_id}/run")
async def api_run_scenario(scenario_id: str):
    result = await run_scenario(scenario_id)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@router.post("/scenarios/stop")
async def api_stop_scenario():
    await stop_scenario()
    return {"status": "stopped"}


@router.get("/scenarios/status")
async def api_scenario_status():
    return get_scenario_status()


@router.get("/runbooks")
async def api_list_runbooks(q: str | None = None):
    if q:
        return {"runbooks": search_runbooks(q)}
    return {"runbooks": list_runbooks()}


@router.get("/runbooks/{runbook_id}")
async def api_get_runbook(runbook_id: str):
    rb = get_runbook(runbook_id)
    if not rb:
        raise HTTPException(status_code=404, detail="Runbook not found")
    return rb


@router.get("/report")
async def api_generate_report():
    return generate_report()
