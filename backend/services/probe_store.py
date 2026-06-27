import json
import uuid
from datetime import datetime, timedelta
from backend.database import get_db


def _row_to_check(row) -> dict:
    return {
        "id": row["id"],
        "name": row["name"],
        "service": row["service"],
        "target_url": row["target_url"],
        "method": row["method"],
        "interval_seconds": row["interval_seconds"],
        "timeout_ms": row["timeout_ms"],
        "expected_status": row["expected_status"],
        "regions": json.loads(row["regions"] or "[]"),
        "enabled": bool(row["enabled"]),
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def list_checks() -> list[dict]:
    with get_db() as conn:
        rows = conn.execute(
            "SELECT * FROM synthetic_checks ORDER BY created_at ASC"
        ).fetchall()
        return [_row_to_check(r) for r in rows]


def get_check(check_id: str) -> dict | None:
    with get_db() as conn:
        row = conn.execute(
            "SELECT * FROM synthetic_checks WHERE id = ?", (check_id,)
        ).fetchone()
        return _row_to_check(row) if row else None


def create_check(payload) -> dict:
    now = datetime.utcnow().isoformat()
    check_id = f"check-{uuid.uuid4().hex[:8]}"
    with get_db() as conn:
        conn.execute(
            """INSERT INTO synthetic_checks
               (id, name, service, target_url, method, interval_seconds,
                timeout_ms, expected_status, regions, enabled, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)""",
            (
                check_id, payload.name, payload.service, payload.target_url,
                payload.method, payload.interval_seconds, payload.timeout_ms,
                payload.expected_status, json.dumps(payload.regions), now, now,
            ),
        )
    return get_check(check_id)


def toggle_check(check_id: str, enabled: bool) -> dict | None:
    now = datetime.utcnow().isoformat()
    with get_db() as conn:
        conn.execute(
            "UPDATE synthetic_checks SET enabled = ?, updated_at = ? WHERE id = ?",
            (1 if enabled else 0, now, check_id),
        )
    return get_check(check_id)


def record_result(result: dict):
    with get_db() as conn:
        conn.execute(
            """INSERT INTO probe_results
               (id, check_id, region, success, status_code, latency_ms, error, checked_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                f"probe-{uuid.uuid4().hex[:12]}", result["check_id"], result["region"],
                1 if result["success"] else 0, result.get("status_code"),
                result.get("latency_ms"), result.get("error"), result["checked_at"],
            ),
        )


def get_results(check_id: str, hours: int = 24, region: str | None = None) -> list[dict]:
    cutoff = (datetime.utcnow() - timedelta(hours=hours)).isoformat()
    query = "SELECT * FROM probe_results WHERE check_id = ? AND checked_at >= ?"
    params = [check_id, cutoff]
    if region:
        query += " AND region = ?"
        params.append(region)
    query += " ORDER BY checked_at ASC"
    with get_db() as conn:
        rows = conn.execute(query, params).fetchall()
        return [
            {
                "id": r["id"], "check_id": r["check_id"], "region": r["region"],
                "success": bool(r["success"]), "status_code": r["status_code"],
                "latency_ms": r["latency_ms"], "error": r["error"],
                "checked_at": r["checked_at"],
            }
            for r in rows
        ]


def prune_results(max_age_hours: int = 168):
    cutoff = (datetime.utcnow() - timedelta(hours=max_age_hours)).isoformat()
    with get_db() as conn:
        conn.execute("DELETE FROM probe_results WHERE checked_at < ?", (cutoff,))
