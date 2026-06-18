from fastapi import APIRouter, Query
from fastapi.responses import PlainTextResponse
from backend.services.sla_reporter import generate_sla_report, get_sla_trends, export_report_markdown

router = APIRouter()


@router.get("")
async def get_sla_report(
    period: str = Query("weekly", regex="^(daily|weekly|monthly)$"),
    sla_target: float = Query(99.9, ge=90.0, le=100.0),
):
    report = generate_sla_report(period, sla_target)
    return report


@router.get("/trends")
async def get_trends(
    weeks: int = Query(12, ge=1, le=52),
    sla_target: float = Query(99.9, ge=90.0, le=100.0),
):
    trends = get_sla_trends(weeks, sla_target)
    return {"trends": trends, "sla_target": sla_target}


@router.get("/export")
async def export_markdown(
    period: str = Query("weekly", regex="^(daily|weekly|monthly)$"),
    sla_target: float = Query(99.9, ge=90.0, le=100.0),
):
    report = generate_sla_report(period, sla_target)
    md = export_report_markdown(report)
    return PlainTextResponse(md, media_type="text/markdown")
