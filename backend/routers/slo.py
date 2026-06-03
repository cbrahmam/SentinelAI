from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from backend.services.slo_tracker import get_slo_status, get_all_slo_status
from backend.services.saved_dashboards import save_dashboard, list_dashboards, get_dashboard, delete_dashboard

router = APIRouter()


@router.get("/slo")
async def api_all_slo(window_hours: int = 24):
    return {"slos": get_all_slo_status(window_hours)}


@router.get("/slo/{service}")
async def api_service_slo(service: str, window_hours: int = 24):
    return get_slo_status(service, window_hours)


class SaveDashboardRequest(BaseModel):
    name: str
    description: str = ""
    config: dict


@router.get("/dashboards")
async def api_list_dashboards():
    return {"dashboards": list_dashboards()}


@router.post("/dashboards")
async def api_save_dashboard(req: SaveDashboardRequest):
    result = save_dashboard(req.name, req.config, req.description)
    return result


@router.get("/dashboards/{dash_id}")
async def api_get_dashboard(dash_id: str):
    d = get_dashboard(dash_id)
    if not d:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    return d


@router.delete("/dashboards/{dash_id}")
async def api_delete_dashboard(dash_id: str):
    if not delete_dashboard(dash_id):
        raise HTTPException(status_code=404, detail="Dashboard not found")
    return {"ok": True}
