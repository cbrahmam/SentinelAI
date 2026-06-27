import random
import uuid
from datetime import datetime, timezone
from backend.database import get_db
from backend.services.probe_store import record_result, get_results

# Number of consecutive failed probes (across regions) before a probe alert fires.
FAILURE_THRESHOLD = 3

# Baseline added latency per region (ms) to simulate geographic distance.
REGION_LATENCY = {
    "us-east": 12.0,
    "us-west": 38.0,
    "eu-west": 85.0,
    "ap-south": 140.0,
    "sa-east": 120.0,
}


def _recent_service_health(service: str) -> dict:
    """Pull the most recent error_rate and p95 latency for a service.

    These drive how likely a synthetic probe is to fail and how slow it is,
    so probes track the simulated infrastructure rather than being pure noise.
    """
    with get_db() as conn:
        rows = conn.execute(
            """SELECT metric_name, value FROM metrics
               WHERE service = ? AND metric_name IN ('error_rate', 'p95_latency_ms')
               ORDER BY timestamp DESC LIMIT 20""",
            (service,),
        ).fetchall()
    health = {"error_rate": 0.0, "p95_latency_ms": 80.0}
    seen = set()
    for r in rows:
        if r["metric_name"] not in seen:
            health[r["metric_name"]] = r["value"]
            seen.add(r["metric_name"])
        if len(seen) == 2:
            break
    return health


def probe_once(check: dict, region: str) -> dict:
    """Simulate a single HTTP probe of a check from one region."""
    health = _recent_service_health(check["service"])
    error_rate = health["error_rate"]
    base_latency = health["p95_latency_ms"] + REGION_LATENCY.get(region, 50.0)

    # Failure probability scales with the service's current error rate.
    fail_prob = min(0.95, error_rate / 100.0)
    timed_out = base_latency * random.uniform(0.7, 1.6) > check["timeout_ms"]

    checked_at = datetime.now(timezone.utc).isoformat()

    if timed_out:
        return {
            "check_id": check["id"], "region": region, "success": False,
            "status_code": None, "latency_ms": float(check["timeout_ms"]),
            "error": "timeout", "checked_at": checked_at,
        }

    if random.random() < fail_prob:
        status = random.choice([500, 502, 503, 504])
        return {
            "check_id": check["id"], "region": region, "success": False,
            "status_code": status, "latency_ms": round(base_latency * random.uniform(0.8, 1.4), 1),
            "error": f"HTTP {status}", "checked_at": checked_at,
        }

    latency = round(base_latency * random.uniform(0.75, 1.25), 1)
    return {
        "check_id": check["id"], "region": region, "success": True,
        "status_code": check["expected_status"], "latency_ms": latency,
        "error": None, "checked_at": checked_at,
    }


def probe_check(check: dict, persist: bool = True) -> list[dict]:
    """Probe a check from every configured region.

    Returns the list of per-region results. When ``persist`` is set each
    result is also written to the probe_results history table.
    """
    regions = check.get("regions") or ["us-east"]
    results = []
    for region in regions:
        result = probe_once(check, region)
        if persist:
            record_result(result)
        results.append(result)
    if persist:
        evaluate_failures(check)
    return results


def _recent_consecutive_failures(check_id: str) -> int:
    """Count trailing consecutive failed probes in the recent history."""
    recent = get_results(check_id, hours=2)
    streak = 0
    for r in reversed(recent):
        if r["success"]:
            break
        streak += 1
    return streak


def evaluate_failures(check: dict) -> dict | None:
    """Fire a probe alert after FAILURE_THRESHOLD consecutive failures.

    Auto-resolves the firing alert once a probe succeeds again.
    """
    streak = _recent_consecutive_failures(check["id"])
    now = datetime.now(timezone.utc).isoformat()

    with get_db() as conn:
        existing = conn.execute(
            "SELECT id FROM alerts WHERE service = ? AND metric_name = 'synthetic_probe' AND status = 'firing'",
            (check["service"],),
        ).fetchone()

        if streak >= FAILURE_THRESHOLD:
            if existing:
                conn.execute(
                    "UPDATE alerts SET current_value = ? WHERE id = ?",
                    (streak, existing["id"]),
                )
                return {"id": existing["id"], "action": "updated"}
            alert_id = str(uuid.uuid4())[:8]
            title = f"CRITICAL: synthetic probe failing for {check['name']}"
            description = (
                f"Synthetic check '{check['name']}' ({check['target_url']}) has failed "
                f"{streak} consecutive probes across regions."
            )
            conn.execute(
                """INSERT INTO alerts (id, service, metric_name, alert_type, severity, title,
                   description, current_value, threshold_value, status, fired_at)
                   VALUES (?, ?, 'synthetic_probe', 'synthetic', 'critical', ?, ?, ?, ?, 'firing', ?)""",
                (alert_id, check["service"], title, description, streak, FAILURE_THRESHOLD, now),
            )
            return {"id": alert_id, "action": "created"}

        if existing:
            conn.execute(
                "UPDATE alerts SET status = 'resolved', resolved_at = ?, resolved_by = 'synthetic-monitor' WHERE id = ?",
                (now, existing["id"]),
            )
            return {"id": existing["id"], "action": "resolved"}
    return None
