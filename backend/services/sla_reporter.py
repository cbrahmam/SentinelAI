import json
from datetime import datetime, timedelta
from backend.database import get_db

SERVICES = [
    "api-gateway", "auth-service", "user-service", "payment-service",
    "notification-service", "postgres-primary", "redis-cache", "rabbitmq",
]


def _uptime_for_service(conn, service: str, start: str, end: str):
    total_minutes = max(1, int((datetime.fromisoformat(end) - datetime.fromisoformat(start)).total_seconds() / 60))

    incident_rows = conn.execute(
        """SELECT started_at, resolved_at FROM incidents
           WHERE affected_services LIKE ? AND started_at >= ? AND started_at <= ?""",
        (f"%{service}%", start, end)
    ).fetchall()

    downtime_minutes = 0
    for inc in incident_rows:
        inc_start = datetime.fromisoformat(inc["started_at"])
        inc_end = datetime.fromisoformat(inc["resolved_at"]) if inc["resolved_at"] else datetime.fromisoformat(end)
        duration = (inc_end - inc_start).total_seconds() / 60
        downtime_minutes += duration

    uptime_pct = max(0, (1 - downtime_minutes / total_minutes) * 100)
    return round(uptime_pct, 4), round(downtime_minutes, 1), len(incident_rows)


def _breach_status(uptime_pct: float, sla_target: float):
    if uptime_pct >= sla_target:
        return "met"
    return "breached"


def generate_sla_report(period: str = "weekly", sla_target: float = 99.9):
    now = datetime.utcnow()
    if period == "daily":
        start = (now - timedelta(days=1)).isoformat()
    elif period == "monthly":
        start = (now - timedelta(days=30)).isoformat()
    else:
        start = (now - timedelta(days=7)).isoformat()
    end = now.isoformat()

    with get_db() as conn:
        service_reports = []
        total_uptime = 0
        breaches = 0

        for svc in SERVICES:
            uptime_pct, downtime_min, incident_count = _uptime_for_service(conn, svc, start, end)
            status = _breach_status(uptime_pct, sla_target)
            if status == "breached":
                breaches += 1
            total_uptime += uptime_pct

            alert_count = conn.execute(
                "SELECT COUNT(*) FROM alerts WHERE service = ? AND fired_at >= ? AND fired_at <= ?",
                (svc, start, end)
            ).fetchone()[0]

            service_reports.append({
                "service": svc,
                "uptime_pct": uptime_pct,
                "downtime_minutes": downtime_min,
                "incident_count": incident_count,
                "alert_count": alert_count,
                "sla_target": sla_target,
                "status": status,
            })

        fleet_uptime = round(total_uptime / len(SERVICES), 4) if SERVICES else 0

        total_incidents = conn.execute(
            "SELECT COUNT(*) FROM incidents WHERE started_at >= ? AND started_at <= ?",
            (start, end)
        ).fetchone()[0]

        total_alerts = conn.execute(
            "SELECT COUNT(*) FROM alerts WHERE fired_at >= ? AND fired_at <= ?",
            (start, end)
        ).fetchone()[0]

    return {
        "period": period,
        "start": start,
        "end": end,
        "sla_target": sla_target,
        "fleet_uptime": fleet_uptime,
        "fleet_status": "met" if fleet_uptime >= sla_target else "breached",
        "total_breaches": breaches,
        "total_incidents": total_incidents,
        "total_alerts": total_alerts,
        "services": sorted(service_reports, key=lambda x: x["uptime_pct"]),
    }


def get_sla_trends(weeks: int = 12, sla_target: float = 99.9):
    now = datetime.utcnow()
    trends = []

    with get_db() as conn:
        for i in range(weeks):
            week_end = now - timedelta(weeks=i)
            week_start = week_end - timedelta(weeks=1)
            start_iso = week_start.isoformat()
            end_iso = week_end.isoformat()

            total_uptime = 0
            breach_count = 0
            for svc in SERVICES:
                uptime, _, _ = _uptime_for_service(conn, svc, start_iso, end_iso)
                total_uptime += uptime
                if uptime < sla_target:
                    breach_count += 1

            avg_uptime = round(total_uptime / len(SERVICES), 4) if SERVICES else 0
            trends.append({
                "week_start": start_iso[:10],
                "week_end": end_iso[:10],
                "fleet_uptime": avg_uptime,
                "breaches": breach_count,
                "status": "met" if avg_uptime >= sla_target else "breached",
            })

    trends.reverse()
    return trends


def export_report_markdown(report: dict) -> str:
    lines = [
        f"# SLA Compliance Report",
        f"",
        f"**Period:** {report['period'].capitalize()} ({report['start'][:10]} to {report['end'][:10]})",
        f"**SLA Target:** {report['sla_target']}%",
        f"**Fleet Uptime:** {report['fleet_uptime']}%",
        f"**Status:** {'✅ Met' if report['fleet_status'] == 'met' else '❌ Breached'}",
        f"**Total Breaches:** {report['total_breaches']} services",
        f"**Total Incidents:** {report['total_incidents']}",
        f"**Total Alerts:** {report['total_alerts']}",
        f"",
        f"## Per-Service Breakdown",
        f"",
        f"| Service | Uptime | Downtime | Incidents | Alerts | Status |",
        f"|---------|--------|----------|-----------|--------|--------|",
    ]
    for svc in report["services"]:
        status_icon = "✅" if svc["status"] == "met" else "❌"
        lines.append(
            f"| {svc['service']} | {svc['uptime_pct']}% | {svc['downtime_minutes']}m | "
            f"{svc['incident_count']} | {svc['alert_count']} | {status_icon} {svc['status']} |"
        )

    lines.append("")
    lines.append(f"*Generated at {report['end'][:19]}*")
    return "\n".join(lines)
