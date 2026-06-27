import random
from datetime import datetime, timezone
from backend.database import get_db
from backend.services.probe_store import record_result

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
    return results
