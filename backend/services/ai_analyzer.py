import json
from anthropic import Anthropic
from backend.config import ANTHROPIC_API_KEY
from backend.models.schemas import AnomalyReport, LogEntry
from backend.generators.simulator import DEPENDENCIES
from pydantic import BaseModel

client = Anthropic(api_key=ANTHROPIC_API_KEY) if ANTHROPIC_API_KEY else None


class AIAnalysis(BaseModel):
    summary: str
    root_cause: str
    root_cause_confidence: str
    contributing_factors: list[str] = []
    evidence: list[str] = []
    affected_services: list[str] = []
    recommended_actions: list[str] = []
    runbook: str = ""
    severity_assessment: str = "P3_medium"
    estimated_impact: str = ""
    similar_past_incidents: list[str] = []


def _build_prompt(
    anomaly: AnomalyReport,
    related_logs: list[LogEntry],
    service_context: dict,
) -> str:
    anomaly_details = []
    for a in anomaly.anomalies[-10:]:
        anomaly_details.append(
            f"  - {a.timestamp}: value={a.value} (expected={a.expected_value}, "
            f"deviation={a.deviation}, severity={a.severity}, method={a.detection_method})"
        )

    log_lines = []
    for lg in related_logs[-50:]:
        log_lines.append(f"  [{lg.level.upper()}] {lg.timestamp} {lg.service}: {lg.message}")

    deps = DEPENDENCIES.get(anomaly.service, [])
    dependents = [s for s, d in DEPENDENCIES.items() if anomaly.service in d]

    current_metrics_str = ""
    if service_context.get("current_metrics"):
        for name, val in service_context["current_metrics"].items():
            current_metrics_str += f"  - {name}: {val}\n"

    return f"""You are a senior SRE/DevOps engineer analyzing an infrastructure anomaly. Provide a detailed root cause analysis.

## Anomaly Details
- **Service**: {anomaly.service}
- **Metric**: {anomaly.metric_name}
- **Detection Method**: {anomaly.detection_method}
- **Baseline**: mean={anomaly.baseline_mean}, std={anomaly.baseline_std}
- **Anomaly Points** (most recent):
{chr(10).join(anomaly_details)}

## Current Metrics for {anomaly.service}
{current_metrics_str or "  No current metrics available"}

## Recent Error/Warning Logs
{chr(10).join(log_lines) if log_lines else "  No recent error logs"}

## Service Dependencies
- {anomaly.service} depends on: {', '.join(deps) if deps else 'none'}
- Services that depend on {anomaly.service}: {', '.join(dependents) if dependents else 'none'}

## Instructions
Analyze the anomaly and provide your assessment as JSON with these exact fields:
- "summary": 2-3 sentence summary of what's happening
- "root_cause": most likely root cause (be specific)
- "root_cause_confidence": "high", "medium", or "low"
- "contributing_factors": list of other factors that may be involved
- "evidence": list of what data supports your analysis
- "affected_services": list of other services likely impacted
- "recommended_actions": ordered list of what to do (most urgent first)
- "runbook": step-by-step incident response guide (numbered markdown steps)
- "severity_assessment": one of "P1_critical", "P2_high", "P3_medium", "P4_low"
- "estimated_impact": describe user-facing impact
- "similar_past_incidents": list of known patterns this resembles

Respond ONLY with valid JSON, no markdown wrapping."""


def analyze_anomaly(
    anomaly: AnomalyReport,
    related_logs: list[LogEntry],
    service_context: dict,
) -> AIAnalysis:
    if not client:
        return _generate_fallback_analysis(anomaly, related_logs, service_context)

    prompt = _build_prompt(anomaly, related_logs, service_context)

    try:
        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=2000,
            messages=[{"role": "user", "content": prompt}],
        )
        text = response.content[0].text.strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[1].rsplit("```", 1)[0].strip()
        data = json.loads(text)
        return AIAnalysis(**data)
    except Exception as e:
        print(f"AI analysis error: {e}")
        return _generate_fallback_analysis(anomaly, related_logs, service_context)


def _generate_fallback_analysis(
    anomaly: AnomalyReport,
    related_logs: list[LogEntry],
    service_context: dict,
) -> AIAnalysis:
    """Rule-based fallback when Claude API is unavailable."""
    metric = anomaly.metric_name
    service = anomaly.service
    severity = "warning"
    if anomaly.anomalies:
        severity = max(a.severity for a in anomaly.anomalies)

    error_logs = [lg for lg in related_logs if lg.level in ("error", "fatal")]
    error_messages = list(set(lg.message[:100] for lg in error_logs[:5]))

    deps = DEPENDENCIES.get(service, [])
    dependents = [s for s, d in DEPENDENCIES.items() if service in d]

    root_cause_map = {
        "cpu_usage": f"High CPU utilization on {service}, likely due to increased request load or a compute-intensive operation",
        "memory_usage": f"Elevated memory usage on {service}, potentially indicating a memory leak or increased caching demand",
        "error_rate": f"Spike in error rate on {service}, indicating application failures or upstream dependency issues",
        "p95_latency_ms": f"Latency degradation on {service}, possibly caused by resource contention, slow database queries, or downstream service delays",
        "p99_latency_ms": f"Severe tail latency on {service}, indicating resource exhaustion or lock contention under load",
        "active_connections": f"Connection count spike on {service}, potentially approaching connection pool limits",
        "queue_depth": f"Queue backlog building on {service}, consumers may be falling behind or processing is degraded",
        "replication_lag_ms": f"Database replication falling behind on {service}, could lead to stale reads",
        "disk_usage_percent": f"Disk space running low on {service}, risk of service failure if not addressed",
    }

    root_cause = root_cause_map.get(metric, f"Anomalous behavior detected in {metric} on {service}")

    runbook_map = {
        "cpu_usage": f"""1. Check current process list: `top -o cpu` on {service} host
2. Identify top CPU consumers
3. Check if request rate has increased: review request_rate metric
4. If a specific process is consuming CPU, check for runaway loops or expensive operations
5. Consider scaling horizontally if load is legitimate
6. If caused by a deployment, roll back the recent change
7. Monitor for 15 minutes after mitigation""",
        "memory_usage": f"""1. Check current memory allocation: `free -h` on {service} host
2. Review heap dumps if available
3. Check for memory leak patterns: is memory continuously growing?
4. Restart the service if memory is critical (>90%)
5. Check recent deployments for memory-related changes
6. Enable memory profiling for the next occurrence
7. Set up OOM kill alerts if not already configured""",
        "error_rate": f"""1. Check error logs for {service}: review the most common error messages
2. Identify if errors correlate with a specific endpoint or operation
3. Check upstream dependencies: {', '.join(deps) if deps else 'N/A'}
4. Verify database connectivity and health
5. Check for recent deployments or config changes
6. If dependency-related, check the upstream service status
7. Consider circuit-breaking or failover if available""",
        "p95_latency_ms": f"""1. Check database query performance on {service}
2. Review slow query logs
3. Check connection pool utilization
4. Verify downstream service latencies: {', '.join(deps) if deps else 'N/A'}
5. Check for lock contention or deadlocks
6. Review recent deployments for performance regressions
7. Consider adding caching if queries are repeated""",
    }

    runbook = runbook_map.get(metric, f"""1. Review the anomalous metric: {metric} on {service}
2. Check related logs for errors or warnings
3. Verify upstream dependencies: {', '.join(deps) if deps else 'none'}
4. Check downstream impact on: {', '.join(dependents) if dependents else 'none'}
5. Review recent deployments or config changes
6. Escalate if the issue persists after 15 minutes""")

    severity_map = {"critical": "P1_critical", "warning": "P2_high"}
    sev_assessment = severity_map.get(severity, "P3_medium")

    return AIAnalysis(
        summary=f"Anomaly detected in {metric} on {service}. The {anomaly.detection_method} detector flagged {len(anomaly.anomalies)} anomalous data points. "
                f"{'Error logs indicate: ' + error_messages[0] if error_messages else 'No correlated error logs found.'}",
        root_cause=root_cause,
        root_cause_confidence="medium" if error_logs else "low",
        contributing_factors=[
            f"Current {metric} baseline: mean={anomaly.baseline_mean}, std={anomaly.baseline_std}",
            f"{len(error_logs)} error/fatal logs in the analysis window",
        ] + ([f"Dependent services may be affected: {', '.join(dependents)}"] if dependents else []),
        evidence=[
            f"{len(anomaly.anomalies)} anomalous data points detected by {anomaly.detection_method}",
        ] + [f"Error log: {msg}" for msg in error_messages[:3]],
        affected_services=dependents[:5],
        recommended_actions=[
            f"Investigate {metric} on {service} immediately",
            f"Check logs for {service} for error patterns",
        ] + ([f"Verify health of dependencies: {', '.join(deps)}"] if deps else [])
          + [f"Monitor downstream services: {', '.join(dependents)}" if dependents else "Monitor for resolution"],
        runbook=runbook,
        severity_assessment=sev_assessment,
        estimated_impact=f"{'High' if severity == 'critical' else 'Medium'} impact — {service} "
                        f"{'and downstream services ' + ', '.join(dependents) + ' ' if dependents else ''}"
                        f"may be experiencing degraded performance",
        similar_past_incidents=[
            f"Common pattern: {metric} anomaly on infrastructure services",
        ],
    )
