import uuid
from datetime import datetime, timezone
from backend.database import get_db


def record_deploy(
    service: str,
    version: str,
    environment: str = "production",
    deployer: str = "system",
    description: str = "",
    commit_sha: str = "",
    status: str = "success",
) -> dict:
    deploy_id = str(uuid.uuid4())[:8]
    now = datetime.now(timezone.utc).isoformat()
    with get_db() as conn:
        conn.execute(
            """INSERT INTO deploy_events (id, service, version, environment, deployer,
               description, commit_sha, status, timestamp)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (deploy_id, service, version, environment, deployer,
             description, commit_sha, status, now),
        )
    return {
        "id": deploy_id,
        "service": service,
        "version": version,
        "environment": environment,
        "deployer": deployer,
        "description": description,
        "commit_sha": commit_sha,
        "status": status,
        "timestamp": now,
    }


def list_deploys(
    service: str | None = None,
    environment: str | None = None,
    limit: int = 50,
    hours: float | None = None,
) -> list[dict]:
    conditions = []
    params: list = []
    if service:
        conditions.append("service = ?")
        params.append(service)
    if environment:
        conditions.append("environment = ?")
        params.append(environment)
    if hours:
        cutoff = datetime.now(timezone.utc).isoformat()
        from datetime import timedelta
        cutoff = (datetime.now(timezone.utc) - timedelta(hours=hours)).isoformat()
        conditions.append("timestamp >= ?")
        params.append(cutoff)

    where = (" WHERE " + " AND ".join(conditions)) if conditions else ""
    params.append(limit)

    with get_db() as conn:
        rows = conn.execute(
            f"SELECT * FROM deploy_events{where} ORDER BY timestamp DESC LIMIT ?",
            params,
        ).fetchall()
    return [dict(r) for r in rows]


def get_deploy(deploy_id: str) -> dict | None:
    with get_db() as conn:
        row = conn.execute("SELECT * FROM deploy_events WHERE id = ?", (deploy_id,)).fetchone()
    return dict(row) if row else None


def get_deploys_for_chart(service: str, hours: float = 24) -> list[dict]:
    from datetime import timedelta
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=hours)).isoformat()
    with get_db() as conn:
        rows = conn.execute(
            "SELECT id, version, deployer, status, timestamp FROM deploy_events WHERE service = ? AND timestamp >= ? ORDER BY timestamp",
            (service, cutoff),
        ).fetchall()
    return [dict(r) for r in rows]


def delete_deploy(deploy_id: str) -> bool:
    with get_db() as conn:
        result = conn.execute("DELETE FROM deploy_events WHERE id = ?", (deploy_id,))
        return result.rowcount > 0
