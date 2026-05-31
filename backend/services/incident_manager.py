import json
import uuid
from datetime import datetime, timezone
from backend.database import get_db
from backend.models.schemas import (
    CorrelationGroup, TimelineEvent, IncidentCreate,
)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _add_timeline_event(
    conn, incident_id: str, event_type: str, description: str,
    service: str | None = None, metadata: dict | None = None,
):
    row = conn.execute(
        "SELECT timeline FROM incidents WHERE id = ?", (incident_id,)
    ).fetchone()
    if not row:
        return
    timeline = json.loads(row["timeline"] or "[]")
    timeline.append({
        "timestamp": _now(),
        "event_type": event_type,
        "description": description,
        "service": service,
        "metadata": metadata,
    })
    conn.execute(
        "UPDATE incidents SET timeline = ? WHERE id = ?",
        (json.dumps(timeline), incident_id),
    )


def create_incident_from_correlation(correlation: CorrelationGroup) -> dict:
    incident_id = f"INC-{str(uuid.uuid4())[:6].upper()}"
    now = _now()

    title = f"Correlated anomaly: {correlation.origin_service} -> {', '.join(correlation.affected_services)}"
    severity = "P2"
    if correlation.total_anomalies > 10 or len(correlation.affected_services) > 3:
        severity = "P1"

    timeline = [
        {
            "timestamp": now,
            "event_type": "created",
            "description": f"Incident auto-created from correlated anomalies across {len(correlation.affected_services) + 1} services",
            "service": None,
            "metadata": {"correlation_id": correlation.id},
        },
        {
            "timestamp": correlation.detected_at,
            "event_type": "anomaly_detected",
            "description": f"Origin anomaly detected on {correlation.origin_service}: {correlation.origin_anomaly.metric_name}={correlation.origin_anomaly.value}",
            "service": correlation.origin_service,
            "metadata": None,
        },
    ]
    for svc in correlation.affected_services:
        timeline.append({
            "timestamp": correlation.detected_at,
            "event_type": "propagation",
            "description": f"Anomaly propagated to {svc}",
            "service": svc,
            "metadata": None,
        })

    affected = [correlation.origin_service] + correlation.affected_services

    with get_db() as conn:
        conn.execute(
            """INSERT INTO incidents
               (id, title, severity, status, affected_services, related_alerts, timeline, started_at)
               VALUES (?, ?, ?, 'investigating', ?, '[]', ?, ?)""",
            (incident_id, title, severity, json.dumps(affected),
             json.dumps(timeline), now),
        )

    return {"id": incident_id, "title": title, "severity": severity}


def create_incident_manual(data: IncidentCreate) -> dict:
    incident_id = f"INC-{str(uuid.uuid4())[:6].upper()}"
    now = _now()

    timeline = [{
        "timestamp": now,
        "event_type": "created",
        "description": data.description or f"Incident created: {data.title}",
        "service": None,
        "metadata": None,
    }]

    with get_db() as conn:
        conn.execute(
            """INSERT INTO incidents
               (id, title, severity, status, affected_services, related_alerts, timeline, started_at)
               VALUES (?, ?, ?, 'investigating', ?, '[]', ?, ?)""",
            (incident_id, data.title, data.severity,
             json.dumps(data.affected_services), json.dumps(timeline), now),
        )

    return {"id": incident_id, "title": data.title, "severity": data.severity}


def list_incidents(
    status: str | None = None,
    severity: str | None = None,
    limit: int = 50,
) -> list[dict]:
    conditions = []
    params: list = []
    if status:
        conditions.append("status = ?")
        params.append(status)
    if severity:
        conditions.append("severity = ?")
        params.append(severity)

    where = (" WHERE " + " AND ".join(conditions)) if conditions else ""
    params.append(limit)

    with get_db() as conn:
        rows = conn.execute(
            f"SELECT * FROM incidents{where} ORDER BY started_at DESC LIMIT ?", params
        ).fetchall()

    return [_parse_incident(r) for r in rows]


def get_incident(incident_id: str) -> dict | None:
    with get_db() as conn:
        row = conn.execute(
            "SELECT * FROM incidents WHERE id = ?", (incident_id,)
        ).fetchone()
    if not row:
        return None
    return _parse_incident(row)


def update_incident_status(incident_id: str, new_status: str) -> bool:
    valid = {"investigating", "identified", "monitoring", "resolved", "postmortem"}
    if new_status not in valid:
        return False

    now = _now()
    with get_db() as conn:
        row = conn.execute(
            "SELECT status FROM incidents WHERE id = ?", (incident_id,)
        ).fetchone()
        if not row:
            return False

        old_status = row["status"]
        updates = {"status": new_status}

        if new_status == "identified":
            updates["identified_at"] = now
        elif new_status == "resolved":
            updates["resolved_at"] = now

        set_clause = ", ".join(f"{k} = ?" for k in updates)
        params = list(updates.values()) + [incident_id]
        conn.execute(f"UPDATE incidents SET {set_clause} WHERE id = ?", params)

        _add_timeline_event(
            conn, incident_id, "status_change",
            f"Status changed from {old_status} to {new_status}",
        )

    return True


def resolve_incident(incident_id: str, resolution: str) -> bool:
    now = _now()
    with get_db() as conn:
        result = conn.execute(
            "UPDATE incidents SET status = 'resolved', resolution = ?, resolved_at = ? WHERE id = ?",
            (resolution, now, incident_id),
        )
        if result.rowcount == 0:
            return False
        _add_timeline_event(
            conn, incident_id, "resolved",
            f"Incident resolved: {resolution}",
        )
    return True


def set_incident_analysis(incident_id: str, analysis: dict):
    with get_db() as conn:
        conn.execute(
            "UPDATE incidents SET summary = ?, root_cause = ?, runbook = ? WHERE id = ?",
            (analysis.get("summary", ""), analysis.get("root_cause", ""),
             analysis.get("runbook", ""), incident_id),
        )
        _add_timeline_event(
            conn, incident_id, "ai_analysis",
            "AI analysis generated",
            metadata={"summary": analysis.get("summary", "")},
        )


def set_incident_postmortem(incident_id: str, postmortem: str):
    with get_db() as conn:
        conn.execute(
            "UPDATE incidents SET postmortem = ?, status = 'postmortem' WHERE id = ?",
            (postmortem, incident_id),
        )
        _add_timeline_event(
            conn, incident_id, "postmortem",
            "Post-mortem report added",
        )


def link_alert_to_incident(incident_id: str, alert_id: str):
    with get_db() as conn:
        row = conn.execute(
            "SELECT related_alerts FROM incidents WHERE id = ?", (incident_id,)
        ).fetchone()
        if not row:
            return
        alerts = json.loads(row["related_alerts"] or "[]")
        if alert_id not in alerts:
            alerts.append(alert_id)
            conn.execute(
                "UPDATE incidents SET related_alerts = ? WHERE id = ?",
                (json.dumps(alerts), incident_id),
            )
            _add_timeline_event(
                conn, incident_id, "alert_linked",
                f"Alert {alert_id} linked to incident",
            )


def get_incident_timeline(incident_id: str) -> list[dict]:
    with get_db() as conn:
        row = conn.execute(
            "SELECT timeline FROM incidents WHERE id = ?", (incident_id,)
        ).fetchone()
    if not row:
        return []
    return json.loads(row["timeline"] or "[]")


def get_active_incident_for_services(services: list[str]) -> dict | None:
    with get_db() as conn:
        rows = conn.execute(
            "SELECT * FROM incidents WHERE status IN ('investigating', 'identified', 'monitoring') ORDER BY started_at DESC"
        ).fetchall()

    for row in rows:
        incident = _parse_incident(row)
        inc_services = set(incident.get("affected_services", []))
        if inc_services.intersection(services):
            return incident
    return None


def _parse_incident(row) -> dict:
    d = dict(row)
    for field in ("affected_services", "related_alerts", "timeline"):
        if d.get(field):
            try:
                d[field] = json.loads(d[field])
            except (json.JSONDecodeError, TypeError):
                d[field] = []
        else:
            d[field] = []
    return d
