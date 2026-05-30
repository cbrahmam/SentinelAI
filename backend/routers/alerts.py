from fastapi import APIRouter, HTTPException, Query
from backend.services.alert_engine import (
    list_alerts, get_alert, acknowledge_alert, resolve_alert,
    set_alert_analysis, get_firing_count, auto_resolve_check,
)
from backend.services.ai_analyzer import analyze_anomaly
from backend.services.anomaly_detector import run_detection_pipeline
from backend.services.log_store import query_logs
from backend.services.metric_store import get_latest_metrics_for_service
from datetime import datetime, timezone, timedelta

router = APIRouter()


@router.get("")
async def get_alerts(
    status: str | None = None,
    severity: str | None = None,
    service: str | None = None,
    limit: int = 100,
):
    alerts = list_alerts(status, severity, service, limit)
    return {"alerts": alerts, "count": len(alerts)}


@router.get("/{alert_id}")
async def get_alert_detail(alert_id: str):
    alert = get_alert(alert_id)
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    return alert


@router.put("/{alert_id}/acknowledge")
async def ack_alert(alert_id: str, user: str = "operator"):
    success = acknowledge_alert(alert_id, user)
    if not success:
        raise HTTPException(status_code=404, detail="Alert not found or not in firing state")
    return {"status": "acknowledged"}


@router.put("/{alert_id}/resolve")
async def res_alert(alert_id: str, resolved_by: str = "operator"):
    success = resolve_alert(alert_id, resolved_by)
    if not success:
        raise HTTPException(status_code=404, detail="Alert not found or already resolved")
    return {"status": "resolved"}


@router.post("/{alert_id}/analyze")
async def trigger_analysis(alert_id: str):
    alert = get_alert(alert_id)
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    report = run_detection_pipeline(alert["service"], alert["metric_name"], lookback_hours=6)

    start = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
    logs = query_logs(service=alert["service"], level="error", start_time=start, limit=50)

    current_metrics = get_latest_metrics_for_service(alert["service"])

    analysis = analyze_anomaly(report, logs, {"current_metrics": current_metrics})
    set_alert_analysis(alert_id, analysis)

    return analysis.model_dump()
