import uuid
from fastapi import APIRouter, HTTPException
from backend.database import get_db
from backend.models.schemas import ThresholdConfig

router = APIRouter()


@router.get("")
async def list_thresholds():
    with get_db() as conn:
        rows = conn.execute(
            "SELECT id, service, metric_name, warning_value, critical_value, comparison, enabled FROM alert_thresholds ORDER BY metric_name"
        ).fetchall()
    return {"thresholds": [dict(r) for r in rows]}


@router.post("")
async def create_threshold(config: ThresholdConfig):
    tid = config.id or str(uuid.uuid4())[:8]
    with get_db() as conn:
        conn.execute(
            "INSERT INTO alert_thresholds (id, service, metric_name, warning_value, critical_value, comparison, enabled) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (tid, config.service, config.metric_name, config.warning_value, config.critical_value, config.comparison, int(config.enabled)),
        )
    return {"id": tid, "status": "created"}


@router.put("/{threshold_id}")
async def update_threshold(threshold_id: str, config: ThresholdConfig):
    with get_db() as conn:
        existing = conn.execute("SELECT id FROM alert_thresholds WHERE id = ?", (threshold_id,)).fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="Threshold not found")
        conn.execute(
            """UPDATE alert_thresholds SET service = ?, metric_name = ?, warning_value = ?,
               critical_value = ?, comparison = ?, enabled = ? WHERE id = ?""",
            (config.service, config.metric_name, config.warning_value, config.critical_value,
             config.comparison, int(config.enabled), threshold_id),
        )
    return {"id": threshold_id, "status": "updated"}
