from backend.services.probe_store import get_results


def _percentile(values: list[float], pct: float) -> float | None:
    if not values:
        return None
    ordered = sorted(values)
    k = (len(ordered) - 1) * (pct / 100.0)
    lo = int(k)
    hi = min(lo + 1, len(ordered) - 1)
    frac = k - lo
    return round(ordered[lo] + (ordered[hi] - ordered[lo]) * frac, 1)


def summarize(results: list[dict]) -> dict:
    """Compute uptime %, latency percentiles and counts for a result set."""
    total = len(results)
    successes = [r for r in results if r["success"]]
    latencies = [r["latency_ms"] for r in successes if r["latency_ms"] is not None]
    uptime_pct = round(len(successes) / total * 100, 2) if total else 100.0
    return {
        "checks": total,
        "successes": len(successes),
        "failures": total - len(successes),
        "uptime_pct": uptime_pct,
        "avg_latency_ms": round(sum(latencies) / len(latencies), 1) if latencies else None,
        "p50_latency_ms": _percentile(latencies, 50),
        "p95_latency_ms": _percentile(latencies, 95),
        "p99_latency_ms": _percentile(latencies, 99),
    }


def check_analytics(check_id: str, hours: int = 24) -> dict:
    """Overall + per-region uptime/latency analytics for a check."""
    results = get_results(check_id, hours=hours)
    overall = summarize(results)

    by_region: dict[str, list[dict]] = {}
    for r in results:
        by_region.setdefault(r["region"], []).append(r)

    regions = {region: summarize(rows) for region, rows in by_region.items()}

    last = results[-1] if results else None
    return {
        "check_id": check_id,
        "hours": hours,
        "overall": overall,
        "regions": regions,
        "current_status": "up" if (last and last["success"]) else ("down" if last else "unknown"),
        "last_checked_at": last["checked_at"] if last else None,
    }
