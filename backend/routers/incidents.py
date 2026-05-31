from fastapi import APIRouter, HTTPException
from backend.models.schemas import IncidentCreate, IncidentStatusUpdate, IncidentResolve
from backend.services.incident_manager import (
    create_incident_manual, list_incidents, get_incident,
    update_incident_status, resolve_incident, set_incident_analysis,
    set_incident_postmortem, get_incident_timeline, link_alert_to_incident,
)
from backend.services.ai_analyzer import analyze_anomaly, _generate_fallback_analysis
from backend.services.log_store import query_logs
from backend.services.metric_store import get_latest_metrics_for_service
from backend.models.schemas import AnomalyReport, AnomalyPoint, LogEntry

router = APIRouter()


@router.get("")
async def api_list_incidents(
    status: str | None = None,
    severity: str | None = None,
    limit: int = 50,
):
    incidents = list_incidents(status=status, severity=severity, limit=limit)
    return {"incidents": incidents, "count": len(incidents)}


@router.post("")
async def api_create_incident(data: IncidentCreate):
    result = create_incident_manual(data)
    return result


@router.get("/{incident_id}")
async def api_get_incident(incident_id: str):
    incident = get_incident(incident_id)
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    return incident


@router.put("/{incident_id}/status")
async def api_update_status(incident_id: str, data: IncidentStatusUpdate):
    success = update_incident_status(incident_id, data.status)
    if not success:
        raise HTTPException(status_code=400, detail="Invalid status transition or incident not found")
    return {"ok": True, "status": data.status}


@router.put("/{incident_id}/resolve")
async def api_resolve_incident(incident_id: str, data: IncidentResolve):
    success = resolve_incident(incident_id, data.resolution)
    if not success:
        raise HTTPException(status_code=404, detail="Incident not found")
    return {"ok": True, "status": "resolved"}


@router.post("/{incident_id}/analyze")
async def api_analyze_incident(incident_id: str):
    incident = get_incident(incident_id)
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")

    affected = incident.get("affected_services", [])
    primary_service = affected[0] if affected else "unknown"

    logs = []
    for svc in affected[:3]:
        svc_logs = query_logs(service=svc, level="error", limit=20)
        logs.extend([LogEntry(**lg) if isinstance(lg, dict) else lg for lg in svc_logs])

    metrics_ctx = {}
    for svc in affected[:3]:
        m = get_latest_metrics_for_service(svc)
        if m:
            metrics_ctx[svc] = {name: val for name, val in m.items()}

    dummy_report = AnomalyReport(
        service=primary_service,
        metric_name="multi_service_incident",
        anomalies=[AnomalyPoint(
            timestamp=incident.get("started_at", ""),
            value=0, expected_value=0, deviation=0,
            severity="critical",
            detection_method="correlation",
            metric_name="multi_service_incident",
            service=primary_service,
        )],
        baseline_mean=0, baseline_std=0,
        detection_method="correlation",
        time_range=f"incident {incident_id}",
    )

    analysis = analyze_anomaly(dummy_report, logs, {"current_metrics": metrics_ctx})
    analysis_dict = analysis.model_dump()
    analysis_dict["affected_services"] = affected
    set_incident_analysis(incident_id, analysis_dict)

    return analysis_dict


@router.get("/{incident_id}/timeline")
async def api_get_timeline(incident_id: str):
    timeline = get_incident_timeline(incident_id)
    return {"timeline": timeline}


@router.post("/{incident_id}/link-alert/{alert_id}")
async def api_link_alert(incident_id: str, alert_id: str):
    link_alert_to_incident(incident_id, alert_id)
    return {"ok": True}


@router.post("/{incident_id}/postmortem")
async def api_set_postmortem(incident_id: str, data: dict):
    postmortem = data.get("postmortem", "")
    if not postmortem:
        raise HTTPException(status_code=400, detail="Postmortem text required")
    set_incident_postmortem(incident_id, postmortem)
    return {"ok": True}
