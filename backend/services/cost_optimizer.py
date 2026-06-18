from datetime import datetime, timedelta
from backend.database import get_db

SERVICES = [
    "api-gateway", "auth-service", "user-service", "payment-service",
    "notification-service", "postgres-primary", "redis-cache", "rabbitmq",
]

INSTANCE_COSTS = {
    "api-gateway": {"type": "c5.xlarge", "monthly_cost": 124.0, "vcpus": 4, "memory_gb": 8},
    "auth-service": {"type": "c5.large", "monthly_cost": 62.0, "vcpus": 2, "memory_gb": 4},
    "user-service": {"type": "c5.large", "monthly_cost": 62.0, "vcpus": 2, "memory_gb": 4},
    "payment-service": {"type": "c5.xlarge", "monthly_cost": 124.0, "vcpus": 4, "memory_gb": 8},
    "notification-service": {"type": "t3.medium", "monthly_cost": 30.0, "vcpus": 2, "memory_gb": 4},
    "postgres-primary": {"type": "r5.xlarge", "monthly_cost": 182.0, "vcpus": 4, "memory_gb": 32},
    "redis-cache": {"type": "r5.large", "monthly_cost": 91.0, "vcpus": 2, "memory_gb": 16},
    "rabbitmq": {"type": "m5.large", "monthly_cost": 70.0, "vcpus": 2, "memory_gb": 8},
}

RIGHT_SIZE_MAP = {
    "c5.xlarge": {"down": "c5.large", "down_cost": 62.0, "up": "c5.2xlarge", "up_cost": 248.0},
    "c5.large": {"down": "t3.large", "down_cost": 60.0, "up": "c5.xlarge", "up_cost": 124.0},
    "t3.medium": {"down": "t3.small", "down_cost": 15.0, "up": "t3.large", "up_cost": 60.0},
    "r5.xlarge": {"down": "r5.large", "down_cost": 91.0, "up": "r5.2xlarge", "up_cost": 364.0},
    "r5.large": {"down": "t3.large", "down_cost": 60.0, "up": "r5.xlarge", "up_cost": 182.0},
    "m5.large": {"down": "t3.large", "down_cost": 60.0, "up": "m5.xlarge", "up_cost": 140.0},
}


def _get_avg_metrics(conn, service: str, hours: int):
    cutoff = (datetime.utcnow() - timedelta(hours=hours)).isoformat()
    rows = conn.execute(
        """SELECT metric_name, AVG(value) as avg_val, MAX(value) as max_val
           FROM metrics WHERE service = ? AND timestamp >= ?
           AND metric_name IN ('cpu_usage', 'memory_usage')
           GROUP BY metric_name""",
        (service, cutoff)
    ).fetchall()

    result = {}
    for r in rows:
        result[r["metric_name"]] = {
            "avg": round(r["avg_val"], 1),
            "max": round(r["max_val"], 1),
        }
    return result


def _classify_utilization(avg_cpu, avg_mem):
    if avg_cpu < 15 and avg_mem < 25:
        return "idle"
    if avg_cpu < 30 and avg_mem < 40:
        return "over_provisioned"
    if avg_cpu < 70 and avg_mem < 80:
        return "right_sized"
    if avg_cpu < 90 and avg_mem < 90:
        return "high_utilization"
    return "near_capacity"


UTILIZATION_LABELS = {
    "idle": {"label": "Idle", "color": "gray", "action": "Consider terminating or consolidating"},
    "over_provisioned": {"label": "Over-Provisioned", "color": "amber", "action": "Downsize to save cost"},
    "right_sized": {"label": "Right-Sized", "color": "emerald", "action": "No action needed"},
    "high_utilization": {"label": "High Utilization", "color": "cyan", "action": "Monitor closely"},
    "near_capacity": {"label": "Near Capacity", "color": "red", "action": "Upsize to prevent degradation"},
}


def analyze_costs(hours: int = 24):
    with get_db() as conn:
        services_data = []
        total_current_cost = 0
        total_optimized_cost = 0

        for svc in SERVICES:
            info = INSTANCE_COSTS.get(svc, {"type": "unknown", "monthly_cost": 0, "vcpus": 0, "memory_gb": 0})
            metrics = _get_avg_metrics(conn, svc, hours)

            avg_cpu = metrics.get("cpu_usage", {}).get("avg", 50)
            max_cpu = metrics.get("cpu_usage", {}).get("max", 50)
            avg_mem = metrics.get("memory_usage", {}).get("avg", 50)
            max_mem = metrics.get("memory_usage", {}).get("max", 50)

            classification = _classify_utilization(avg_cpu, avg_mem)
            util_info = UTILIZATION_LABELS[classification]

            current_cost = info["monthly_cost"]
            total_current_cost += current_cost

            recommendation = None
            optimized_cost = current_cost
            savings = 0

            size_options = RIGHT_SIZE_MAP.get(info["type"], {})

            if classification in ("idle", "over_provisioned") and "down" in size_options:
                optimized_cost = size_options["down_cost"]
                savings = current_cost - optimized_cost
                recommendation = {
                    "action": "downsize",
                    "from_type": info["type"],
                    "to_type": size_options["down"],
                    "monthly_savings": round(savings, 2),
                    "reason": f"Average CPU {avg_cpu}%, Memory {avg_mem}% — room to downsize",
                }
            elif classification == "near_capacity" and "up" in size_options:
                optimized_cost = size_options["up_cost"]
                savings = current_cost - optimized_cost
                recommendation = {
                    "action": "upsize",
                    "from_type": info["type"],
                    "to_type": size_options["up"],
                    "monthly_increase": round(abs(savings), 2),
                    "reason": f"Average CPU {avg_cpu}%, Memory {avg_mem}% — risk of saturation",
                }

            total_optimized_cost += optimized_cost

            services_data.append({
                "service": svc,
                "instance_type": info["type"],
                "vcpus": info["vcpus"],
                "memory_gb": info["memory_gb"],
                "monthly_cost": current_cost,
                "avg_cpu": avg_cpu,
                "max_cpu": max_cpu,
                "avg_memory": avg_mem,
                "max_memory": max_mem,
                "classification": classification,
                "classification_label": util_info["label"],
                "classification_color": util_info["color"],
                "action": util_info["action"],
                "recommendation": recommendation,
                "optimized_cost": optimized_cost,
            })

    potential_savings = max(0, round(total_current_cost - total_optimized_cost, 2))
    savings_pct = round(potential_savings / total_current_cost * 100, 1) if total_current_cost > 0 else 0

    idle_count = sum(1 for s in services_data if s["classification"] == "idle")
    over_count = sum(1 for s in services_data if s["classification"] == "over_provisioned")
    right_count = sum(1 for s in services_data if s["classification"] == "right_sized")
    high_count = sum(1 for s in services_data if s["classification"] == "high_utilization")
    cap_count = sum(1 for s in services_data if s["classification"] == "near_capacity")

    return {
        "total_monthly_cost": round(total_current_cost, 2),
        "optimized_monthly_cost": round(total_optimized_cost, 2),
        "potential_savings": potential_savings,
        "savings_pct": savings_pct,
        "summary": {
            "idle": idle_count,
            "over_provisioned": over_count,
            "right_sized": right_count,
            "high_utilization": high_count,
            "near_capacity": cap_count,
        },
        "services": services_data,
    }
