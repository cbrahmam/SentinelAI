import json
from datetime import datetime, timezone
from backend.database import get_db
from backend.config import ANTHROPIC_API_KEY

try:
    from anthropic import Anthropic
    client = Anthropic(api_key=ANTHROPIC_API_KEY) if ANTHROPIC_API_KEY else None
except ImportError:
    client = None


def generate_postmortem(incident_id: str) -> dict:
    incident = _get_incident_data(incident_id)
    if not incident:
        return {"error": "Incident not found"}

    timeline = json.loads(incident.get("timeline") or "[]")
    affected = json.loads(incident.get("affected_services") or "[]")
    related_alerts = json.loads(incident.get("related_alerts") or "[]")

    alert_details = _get_alert_details(related_alerts)
    metric_context = _get_metric_context(affected)

    if client:
        postmortem = _ai_generate(incident, timeline, affected, alert_details, metric_context)
    else:
        postmortem = _fallback_generate(incident, timeline, affected, alert_details)

    with get_db() as conn:
        conn.execute(
            "UPDATE incidents SET postmortem = ? WHERE id = ?",
            (json.dumps(postmortem), incident_id),
        )

    return postmortem


def _get_incident_data(incident_id: str) -> dict | None:
    with get_db() as conn:
        row = conn.execute("SELECT * FROM incidents WHERE id = ?", (incident_id,)).fetchone()
    return dict(row) if row else None


def _get_alert_details(alert_ids: list) -> list[dict]:
    if not alert_ids:
        return []
    with get_db() as conn:
        placeholders = ",".join("?" * len(alert_ids))
        rows = conn.execute(
            f"SELECT id, service, metric_name, severity, title, description, current_value, fired_at FROM alerts WHERE id IN ({placeholders})",
            alert_ids,
        ).fetchall()
    return [dict(r) for r in rows]


def _get_metric_context(services: list[str]) -> dict:
    context = {}
    for svc in services[:5]:
        with get_db() as conn:
            rows = conn.execute(
                "SELECT metric_name, AVG(value) as avg_val, MAX(value) as max_val, MIN(value) as min_val FROM metrics WHERE service = ? GROUP BY metric_name",
                (svc,),
            ).fetchall()
        context[svc] = {r["metric_name"]: {"avg": round(r["avg_val"], 2), "max": round(r["max_val"], 2), "min": round(r["min_val"], 2)} for r in rows}
    return context


def _ai_generate(incident, timeline, affected, alerts, metrics) -> dict:
    timeline_text = "\n".join(
        f"  - [{e.get('timestamp', 'N/A')}] {e.get('event_type', '')}: {e.get('description', '')}"
        for e in timeline[-20:]
    )
    alert_text = "\n".join(
        f"  - [{a.get('severity', '')}] {a.get('title', '')} (value={a.get('current_value', 'N/A')})"
        for a in alerts[:10]
    )

    prompt = f"""Generate a blameless incident postmortem document for the following incident.

## Incident
- **ID**: {incident.get('id')}
- **Title**: {incident.get('title')}
- **Severity**: {incident.get('severity')}
- **Status**: {incident.get('status')}
- **Started**: {incident.get('started_at')}
- **Resolved**: {incident.get('resolved_at', 'Not yet resolved')}
- **Affected Services**: {', '.join(affected)}
- **Root Cause (if identified)**: {incident.get('root_cause', 'Unknown')}
- **Resolution**: {incident.get('resolution', 'N/A')}

## Timeline
{timeline_text or '  No timeline events recorded.'}

## Related Alerts
{alert_text or '  No alerts linked.'}

Generate the postmortem with these sections:
1. Executive Summary (2-3 sentences)
2. Impact (user-facing impact, duration, severity)
3. Root Cause Analysis (detailed, technical)
4. Timeline (formatted from the data)
5. Resolution & Recovery
6. Lessons Learned (3-5 bullet points)
7. Action Items (specific, assigned, with priority)
8. Prevention Measures

Use a blame-free tone. Focus on systems, not individuals.
Return valid JSON with these keys: executive_summary, impact, root_cause_analysis, timeline_formatted, resolution, lessons_learned (array), action_items (array of objects with title, priority, status), prevention_measures."""

    try:
        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=2000,
            messages=[{"role": "user", "content": prompt}],
        )
        text = response.content[0].text
        start = text.find("{")
        end = text.rfind("}") + 1
        if start >= 0 and end > start:
            return json.loads(text[start:end])
    except Exception:
        pass

    return _fallback_generate(incident, timeline, affected, alerts)


def _fallback_generate(incident, timeline, affected, alerts) -> dict:
    title = incident.get("title", "Unknown Incident")
    severity = incident.get("severity", "P3")
    started = incident.get("started_at", "Unknown")
    resolved = incident.get("resolved_at")
    root_cause = incident.get("root_cause", "")
    resolution_text = incident.get("resolution", "")

    duration = "Ongoing"
    if resolved and started and started != "Unknown":
        try:
            s = datetime.fromisoformat(started)
            r = datetime.fromisoformat(resolved)
            mins = int((r - s).total_seconds() / 60)
            duration = f"{mins} minutes"
        except (ValueError, TypeError):
            pass

    timeline_formatted = []
    for e in timeline:
        timeline_formatted.append(
            f"[{e.get('timestamp', 'N/A')}] **{e.get('event_type', '')}**: {e.get('description', '')}"
        )

    alert_summary = []
    for a in alerts:
        alert_summary.append(f"{a.get('severity', 'unknown').upper()}: {a.get('title', '')}")

    return {
        "executive_summary": f"Incident {incident.get('id')} ({title}) affected {len(affected)} service(s) with {severity} severity. {'Resolved in ' + duration if resolved else 'Currently ongoing'}.",
        "impact": f"Severity: {severity}. Affected services: {', '.join(affected) or 'N/A'}. Duration: {duration}. Related alerts: {len(alerts)}.",
        "root_cause_analysis": root_cause or f"Root cause analysis pending. {len(alerts)} alerts were triggered across {len(affected)} services during this incident.",
        "timeline_formatted": timeline_formatted or ["No timeline events recorded."],
        "resolution": resolution_text or "Resolution details not yet documented.",
        "lessons_learned": [
            "Monitoring detected the issue through automated anomaly detection",
            f"Cross-service correlation identified {len(affected)} affected services",
            "Incident response followed standard escalation procedures",
            "Automated alerting triggered within detection interval",
        ],
        "action_items": [
            {"title": "Review and update alert thresholds for affected services", "priority": "high", "status": "open"},
            {"title": "Add runbook for this failure mode", "priority": "medium", "status": "open"},
            {"title": "Improve monitoring coverage for early detection", "priority": "medium", "status": "open"},
        ],
        "prevention_measures": "Implement additional monitoring, update alert thresholds, and review service dependencies to prevent recurrence.",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "alert_summary": alert_summary,
    }
