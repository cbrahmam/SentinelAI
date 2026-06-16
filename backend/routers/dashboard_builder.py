from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional
from backend.services.dashboard_builder import (
    create_layout, list_layouts, get_layout, update_layout, delete_layout, get_widget_types,
)

router = APIRouter()


class WidgetConfig(BaseModel):
    id: str
    type: str
    title: str = ""
    config: dict = {}


class LayoutPosition(BaseModel):
    id: str
    x: int
    y: int
    w: int
    h: int


class LayoutInput(BaseModel):
    name: str
    description: str = ""
    widgets: list[WidgetConfig] = []
    layout: list[LayoutPosition] = []


class LayoutUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    widgets: Optional[list[WidgetConfig]] = None
    layout: Optional[list[LayoutPosition]] = None


@router.get("/widget-types")
async def available_widgets():
    return {"types": get_widget_types()}


@router.get("")
async def get_layouts():
    layouts = list_layouts()
    return {"layouts": layouts, "count": len(layouts)}


@router.post("")
async def add_layout(layout: LayoutInput):
    widgets = [w.model_dump() for w in layout.widgets]
    positions = [l.model_dump() for l in layout.layout]
    result = create_layout(
        name=layout.name,
        description=layout.description,
        widgets=widgets,
        layout=positions,
    )
    return result


@router.get("/{layout_id}")
async def get_layout_detail(layout_id: str):
    layout = get_layout(layout_id)
    if not layout:
        return {"error": "Layout not found"}
    return layout


@router.put("/{layout_id}")
async def modify_layout(layout_id: str, updates: LayoutUpdate):
    update_dict = {}
    if updates.name is not None:
        update_dict["name"] = updates.name
    if updates.description is not None:
        update_dict["description"] = updates.description
    if updates.widgets is not None:
        update_dict["widgets"] = [w.model_dump() for w in updates.widgets]
    if updates.layout is not None:
        update_dict["layout"] = [l.model_dump() for l in updates.layout]
    result = update_layout(layout_id, update_dict)
    if not result:
        return {"error": "Layout not found"}
    return result


@router.delete("/{layout_id}")
async def remove_layout(layout_id: str):
    success = delete_layout(layout_id)
    return {"deleted": success}
