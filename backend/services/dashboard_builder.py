import json
import uuid
from datetime import datetime, timezone
from backend.database import get_db


def create_layout(
    name: str,
    description: str = "",
    widgets: list[dict] | None = None,
    layout: list[dict] | None = None,
) -> dict:
    layout_id = str(uuid.uuid4())[:8]
    now = datetime.now(timezone.utc).isoformat()

    with get_db() as conn:
        conn.execute(
            """INSERT INTO dashboard_layouts (id, name, description, widgets, layout, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (layout_id, name, description, json.dumps(widgets or []),
             json.dumps(layout or []), now, now),
        )

    return {
        "id": layout_id,
        "name": name,
        "description": description,
        "widgets": widgets or [],
        "layout": layout or [],
        "created_at": now,
        "updated_at": now,
    }


def list_layouts() -> list[dict]:
    with get_db() as conn:
        rows = conn.execute(
            "SELECT * FROM dashboard_layouts ORDER BY updated_at DESC"
        ).fetchall()
    results = []
    for r in rows:
        d = dict(r)
        try:
            d["widgets"] = json.loads(d["widgets"])
        except (json.JSONDecodeError, TypeError):
            d["widgets"] = []
        try:
            d["layout"] = json.loads(d["layout"])
        except (json.JSONDecodeError, TypeError):
            d["layout"] = []
        results.append(d)
    return results


def get_layout(layout_id: str) -> dict | None:
    with get_db() as conn:
        row = conn.execute(
            "SELECT * FROM dashboard_layouts WHERE id = ?", (layout_id,)
        ).fetchone()
    if not row:
        return None
    d = dict(row)
    try:
        d["widgets"] = json.loads(d["widgets"])
    except (json.JSONDecodeError, TypeError):
        d["widgets"] = []
    try:
        d["layout"] = json.loads(d["layout"])
    except (json.JSONDecodeError, TypeError):
        d["layout"] = []
    return d


def update_layout(layout_id: str, updates: dict) -> dict | None:
    existing = get_layout(layout_id)
    if not existing:
        return None

    now = datetime.now(timezone.utc).isoformat()
    sets = []
    params = []

    if "name" in updates:
        sets.append("name = ?")
        params.append(updates["name"])
    if "description" in updates:
        sets.append("description = ?")
        params.append(updates["description"])
    if "widgets" in updates:
        sets.append("widgets = ?")
        params.append(json.dumps(updates["widgets"]))
    if "layout" in updates:
        sets.append("layout = ?")
        params.append(json.dumps(updates["layout"]))

    if not sets:
        return existing

    sets.append("updated_at = ?")
    params.append(now)
    params.append(layout_id)

    with get_db() as conn:
        conn.execute(
            f"UPDATE dashboard_layouts SET {', '.join(sets)} WHERE id = ?",
            params,
        )

    return get_layout(layout_id)


def delete_layout(layout_id: str) -> bool:
    with get_db() as conn:
        result = conn.execute("DELETE FROM dashboard_layouts WHERE id = ?", (layout_id,))
        return result.rowcount > 0


WIDGET_TYPES = [
    {
        "type": "metric_chart",
        "label": "Metric Chart",
        "description": "Line chart for a single metric",
        "config_schema": {"service": "string", "metric_name": "string", "color": "string"},
    },
    {
        "type": "service_status",
        "label": "Service Status",
        "description": "Service health card with key metrics",
        "config_schema": {"service": "string"},
    },
    {
        "type": "alert_list",
        "label": "Alert List",
        "description": "List of active alerts",
        "config_schema": {"limit": "number", "severity": "string"},
    },
    {
        "type": "log_feed",
        "label": "Log Feed",
        "description": "Live log stream",
        "config_schema": {"service": "string", "level": "string", "limit": "number"},
    },
    {
        "type": "slo_gauge",
        "label": "SLO Gauge",
        "description": "SLO uptime percentage gauge",
        "config_schema": {"service": "string"},
    },
    {
        "type": "incident_summary",
        "label": "Incident Summary",
        "description": "Active incident count and list",
        "config_schema": {"limit": "number"},
    },
    {
        "type": "oncall_widget",
        "label": "Who's On-Call",
        "description": "Current on-call schedule display",
        "config_schema": {},
    },
    {
        "type": "prediction_widget",
        "label": "Predictions",
        "description": "Upcoming threshold breach predictions",
        "config_schema": {"limit": "number"},
    },
]


def get_widget_types() -> list[dict]:
    return WIDGET_TYPES
