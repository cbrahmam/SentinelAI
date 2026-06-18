import json
import uuid
import hashlib
from datetime import datetime, timedelta
from backend.database import get_db

KNOWN_PATTERNS = {
    "memory_leak": {
        "name": "Memory Leak Pattern",
        "metrics": ["memory_usage"],
        "description": "Steadily rising memory usage over time, typically causing OOM errors and latency spikes",
        "indicators": ["memory_usage > 85", "gradual increase over 30+ minutes"],
    },
    "cpu_saturation": {
        "name": "CPU Saturation",
        "metrics": ["cpu_usage"],
        "description": "CPU usage sustained above 90%, causing increased latency and potential request timeouts",
        "indicators": ["cpu_usage > 90", "p95_latency elevated"],
    },
    "error_storm": {
        "name": "Error Storm",
        "metrics": ["error_rate"],
        "description": "Rapid spike in error rate affecting request success, often from upstream dependency failure",
        "indicators": ["error_rate > 20", "multiple services affected simultaneously"],
    },
    "latency_degradation": {
        "name": "Latency Degradation",
        "metrics": ["p95_latency_ms"],
        "description": "P95 latency climbing gradually, often from connection pool exhaustion or GC pressure",
        "indicators": ["p95_latency > 500ms", "gradual onset over minutes"],
    },
    "cascade_failure": {
        "name": "Cascade Failure",
        "metrics": ["error_rate", "p95_latency_ms"],
        "description": "Failure propagating from one service to its dependents, causing widespread degradation",
        "indicators": ["multiple services error simultaneously", "dependency graph propagation"],
    },
    "connection_exhaustion": {
        "name": "Connection Pool Exhaustion",
        "metrics": ["active_connections", "p95_latency_ms"],
        "description": "Database or cache connection pool fully utilized, blocking new requests",
        "indicators": ["connections near max", "latency spikes", "timeout errors in logs"],
    },
}


def _compute_signature(services: list, metrics: list, alert_type: str = None):
    key = f"{sorted(services)}:{sorted(metrics)}:{alert_type or 'unknown'}"
    return hashlib.md5(key.encode()).hexdigest()[:16]


def _classify_alert(alert: dict):
    metric = alert.get("metric_name", "")
    value = alert.get("current_value", 0)
    threshold = alert.get("threshold_value", 0)

    if "memory" in metric and value > 85:
        return "memory_leak", 0.85
    if "cpu" in metric and value > 90:
        return "cpu_saturation", 0.9
    if "error" in metric and value > 15:
        return "error_storm", 0.8
    if "latency" in metric and value > 500:
        return "latency_degradation", 0.75
    return None, 0


def analyze_recent_anomalies(hours: int = 24):
    cutoff = (datetime.utcnow() - timedelta(hours=hours)).isoformat()

    with get_db() as conn:
        alerts = conn.execute(
            "SELECT * FROM alerts WHERE fired_at >= ? ORDER BY fired_at DESC",
            (cutoff,)
        ).fetchall()

    if not alerts:
        return {"fingerprints": [], "unmatched": 0, "total_alerts": 0}

    groups = {}
    unmatched = 0

    for alert in alerts:
        alert_dict = dict(alert)
        pattern_id, confidence = _classify_alert(alert_dict)

        if pattern_id and pattern_id in KNOWN_PATTERNS:
            service = alert_dict.get("service", "unknown")
            sig = _compute_signature([service], KNOWN_PATTERNS[pattern_id]["metrics"], pattern_id)

            if sig not in groups:
                groups[sig] = {
                    "pattern_id": pattern_id,
                    "pattern": KNOWN_PATTERNS[pattern_id],
                    "services": set(),
                    "alerts": [],
                    "max_confidence": 0,
                    "first_seen": alert_dict["fired_at"],
                    "last_seen": alert_dict["fired_at"],
                }
            g = groups[sig]
            g["services"].add(service)
            g["alerts"].append({
                "id": alert_dict["id"],
                "service": service,
                "metric": alert_dict.get("metric_name"),
                "value": alert_dict.get("current_value"),
                "fired_at": alert_dict["fired_at"],
            })
            g["max_confidence"] = max(g["max_confidence"], confidence)
            if alert_dict["fired_at"] < g["first_seen"]:
                g["first_seen"] = alert_dict["fired_at"]
            if alert_dict["fired_at"] > g["last_seen"]:
                g["last_seen"] = alert_dict["fired_at"]
        else:
            unmatched += 1

    fingerprints = []
    for sig, g in groups.items():
        first = datetime.fromisoformat(g["first_seen"])
        last = datetime.fromisoformat(g["last_seen"])
        duration_min = round((last - first).total_seconds() / 60, 1)

        fingerprints.append({
            "signature": sig,
            "pattern_id": g["pattern_id"],
            "name": g["pattern"]["name"],
            "description": g["pattern"]["description"],
            "indicators": g["pattern"]["indicators"],
            "services": sorted(g["services"]),
            "metrics": g["pattern"]["metrics"],
            "alert_count": len(g["alerts"]),
            "confidence": round(g["max_confidence"] * 100, 1),
            "duration_minutes": duration_min,
            "first_seen": g["first_seen"],
            "last_seen": g["last_seen"],
            "sample_alerts": g["alerts"][:5],
        })

    fingerprints.sort(key=lambda x: x["alert_count"], reverse=True)

    return {
        "fingerprints": fingerprints,
        "unmatched": unmatched,
        "total_alerts": len(alerts),
        "match_rate": round((len(alerts) - unmatched) / len(alerts) * 100, 1) if alerts else 0,
    }


def get_pattern_library():
    return [
        {
            "id": pid,
            "name": p["name"],
            "metrics": p["metrics"],
            "description": p["description"],
            "indicators": p["indicators"],
        }
        for pid, p in KNOWN_PATTERNS.items()
    ]


def match_single_alert(alert_id: str):
    with get_db() as conn:
        alert = conn.execute("SELECT * FROM alerts WHERE id = ?", (alert_id,)).fetchone()

    if not alert:
        return {"match": None, "error": "Alert not found"}

    alert_dict = dict(alert)
    pattern_id, confidence = _classify_alert(alert_dict)

    if pattern_id and pattern_id in KNOWN_PATTERNS:
        pattern = KNOWN_PATTERNS[pattern_id]
        return {
            "match": {
                "pattern_id": pattern_id,
                "name": pattern["name"],
                "description": pattern["description"],
                "confidence": round(confidence * 100, 1),
                "indicators": pattern["indicators"],
            }
        }
    return {"match": None, "message": "No known pattern matched"}
