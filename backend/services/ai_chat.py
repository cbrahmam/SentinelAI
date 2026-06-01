import json
from anthropic import Anthropic
from backend.config import ANTHROPIC_API_KEY
from backend.services.metric_store import get_services, get_latest_metrics_for_service
from backend.services.log_store import query_logs
from backend.services.alert_engine import list_alerts
from backend.services.monitor import get_active_anomalies
from backend.services.incident_manager import list_incidents
from backend.generators.simulator import DEPENDENCIES

client = Anthropic(api_key=ANTHROPIC_API_KEY) if ANTHROPIC_API_KEY else None


def _build_context() -> str:
    services = get_services()
    service_data = []
    for svc in services:
        metrics = get_latest_metrics_for_service(svc)
        service_data.append(f"  {svc}: " + ", ".join(f"{k}={v:.1f}" for k, v in metrics.items()))

    firing = list_alerts(status="firing", limit=10)
    alert_lines = []
    for a in firing:
        alert_lines.append(f"  [{a['severity']}] {a['title']} (since {a.get('fired_at', 'unknown')})")

    anomalies = get_active_anomalies()
    anomaly_lines = [f"  {a.service}/{a.metric_name}: {len(a.anomalies)} anomalies ({a.detection_method})" for a in anomalies]

    recent_errors = query_logs(level="error", limit=20)
    error_lines = [f"  [{e.service}] {e.timestamp}: {e.message[:100]}" for e in recent_errors]

    incidents = list_incidents(limit=5)
    incident_lines = [f"  [{i['severity']}] {i['title']} - {i['status']}" for i in incidents]

    dep_lines = [f"  {svc} -> {', '.join(deps)}" for svc, deps in DEPENDENCIES.items() if deps]

    return f"""## Current Infrastructure State

### Service Metrics (latest)
{chr(10).join(service_data) if service_data else "  No service data available"}

### Active Alerts ({len(firing)} firing)
{chr(10).join(alert_lines) if alert_lines else "  No active alerts"}

### Active Anomalies ({len(anomalies)})
{chr(10).join(anomaly_lines) if anomaly_lines else "  No active anomalies"}

### Recent Errors (last 20)
{chr(10).join(error_lines) if error_lines else "  No recent errors"}

### Active Incidents
{chr(10).join(incident_lines) if incident_lines else "  No active incidents"}

### Service Dependencies
{chr(10).join(dep_lines)}"""


def ask_ai(question: str) -> dict:
    context = _build_context()

    system_prompt = """You are SentinelAI, an intelligent infrastructure monitoring assistant.
You have access to real-time metrics, logs, alerts, and incident data.
Answer questions about infrastructure state concisely and accurately.
Reference specific data points when available.
If you don't have enough data to answer, say so clearly.
Keep responses focused and under 300 words."""

    user_msg = f"""{context}

## Question
{question}"""

    if not client:
        return _fallback_answer(question, context)

    try:
        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1000,
            system=system_prompt,
            messages=[{"role": "user", "content": user_msg}],
        )
        return {
            "answer": response.content[0].text,
            "context_summary": f"{len(get_services())} services monitored, {len(list_alerts(status='firing'))} firing alerts",
        }
    except Exception as e:
        return _fallback_answer(question, context)


def _fallback_answer(question: str, context: str) -> dict:
    q = question.lower()
    services = get_services()
    firing = list_alerts(status="firing", limit=10)
    anomalies = get_active_anomalies()

    if any(w in q for w in ["status", "health", "how", "overview"]):
        healthy = sum(1 for s in services if _quick_status(s) == "healthy")
        answer = f"Currently monitoring {len(services)} services. {healthy} healthy, {len(services) - healthy} degraded. "
        if firing:
            answer += f"{len(firing)} active alerts: " + "; ".join(a["title"] for a in firing[:3])
        else:
            answer += "No active alerts."
        if anomalies:
            answer += f" {len(anomalies)} active anomalies detected."

    elif any(w in q for w in ["error", "fail", "wrong", "issue", "problem"]):
        errors = query_logs(level="error", limit=10)
        if errors:
            svc_errors = {}
            for e in errors:
                svc_errors.setdefault(e.service, []).append(e.message[:80])
            parts = []
            for svc, msgs in svc_errors.items():
                parts.append(f"{svc}: {len(msgs)} errors - e.g. \"{msgs[0]}\"")
            answer = "Recent errors:\n" + "\n".join(f"- {p}" for p in parts)
        else:
            answer = "No recent errors found in the logs."

    elif any(w in q for w in ["alert", "firing"]):
        if firing:
            answer = f"{len(firing)} active alerts:\n" + "\n".join(
                f"- [{a['severity']}] {a['title']}" for a in firing
            )
        else:
            answer = "No active alerts at this time."

    elif any(w in q for w in ["incident"]):
        incidents = list_incidents(limit=5)
        if incidents:
            answer = f"{len(incidents)} recent incidents:\n" + "\n".join(
                f"- [{i['severity']}] {i['title']} ({i['status']})" for i in incidents
            )
        else:
            answer = "No incidents recorded."

    else:
        for svc in services:
            if svc.replace("-", " ") in q or svc in q:
                metrics = get_latest_metrics_for_service(svc)
                status = _quick_status(svc)
                answer = f"{svc} is {status}. Current metrics: " + ", ".join(
                    f"{k}={v:.1f}" for k, v in metrics.items()
                )
                svc_alerts = [a for a in firing if a.get("service") == svc]
                if svc_alerts:
                    answer += f"\nActive alerts: " + "; ".join(a["title"] for a in svc_alerts)
                break
        else:
            answer = (
                f"I'm monitoring {len(services)} services with {len(firing)} active alerts "
                f"and {len(anomalies)} anomalies. Ask me about specific services, alerts, errors, or incidents."
            )

    return {
        "answer": answer,
        "context_summary": f"{len(services)} services, {len(firing)} alerts, {len(anomalies)} anomalies",
    }


def _quick_status(svc: str) -> str:
    metrics = get_latest_metrics_for_service(svc)
    cpu = metrics.get("cpu_usage", 0)
    mem = metrics.get("memory_usage", 0)
    err = metrics.get("error_rate", 0)
    if cpu > 95 or mem > 90 or err > 20:
        return "critical"
    if cpu > 80 or mem > 75 or err > 5:
        return "degraded"
    return "healthy"
