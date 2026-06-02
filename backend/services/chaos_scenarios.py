import asyncio
from backend.generators.simulator import simulator

SCENARIOS = {
    "db_connection_exhaustion": {
        "title": "Database Connection Exhaustion",
        "description": "Postgres connections gradually exhaust, causing timeouts in user-service and latency spikes in api-gateway.",
        "duration_minutes": 5,
        "steps": [
            {"delay": 0, "action": "inject", "service": "postgres-primary", "type": "connection_exhaustion", "duration": 5},
            {"delay": 30, "action": "inject", "service": "user-service", "type": "error_storm", "duration": 4},
            {"delay": 60, "action": "inject", "service": "api-gateway", "type": "latency_spike", "duration": 3},
            {"delay": 90, "action": "inject", "service": "payment-service", "type": "error_storm", "duration": 3},
        ],
    },
    "memory_leak_payment": {
        "title": "Memory Leak in Payment Service",
        "description": "Payment-service memory climbs steadily, GC pauses appear, latency increases, then OOM errors.",
        "duration_minutes": 5,
        "steps": [
            {"delay": 0, "action": "inject", "service": "payment-service", "type": "memory_leak", "duration": 5},
            {"delay": 90, "action": "inject", "service": "payment-service", "type": "latency_spike", "duration": 3},
            {"delay": 150, "action": "inject", "service": "payment-service", "type": "error_storm", "duration": 2},
        ],
    },
    "redis_cascade": {
        "title": "Cascade Failure from Redis",
        "description": "Redis goes down, causing cache misses across all services. Auth fails, API returns 503s.",
        "duration_minutes": 5,
        "steps": [
            {"delay": 0, "action": "inject", "service": "redis-cache", "type": "cascade_failure", "duration": 5},
        ],
    },
}

_active_scenario: dict | None = None
_scenario_task: asyncio.Task | None = None


async def run_scenario(scenario_id: str) -> dict:
    global _active_scenario, _scenario_task

    if scenario_id not in SCENARIOS:
        return {"error": f"Unknown scenario: {scenario_id}"}

    if _active_scenario:
        return {"error": "A scenario is already running"}

    if not simulator._running:
        await simulator.start()

    scenario = SCENARIOS[scenario_id]
    _active_scenario = {"id": scenario_id, **scenario, "status": "running"}
    _scenario_task = asyncio.create_task(_execute_scenario(scenario_id, scenario))

    return {"status": "started", "scenario": scenario["title"], "duration_minutes": scenario["duration_minutes"]}


async def _execute_scenario(scenario_id: str, scenario: dict):
    global _active_scenario
    try:
        for step in scenario["steps"]:
            await asyncio.sleep(step["delay"])
            if not _active_scenario:
                break
            if step["action"] == "inject":
                simulator.inject_anomaly(step["type"], step["service"], step["duration"])
        remaining = scenario["duration_minutes"] * 60 - (scenario["steps"][-1]["delay"] if scenario["steps"] else 0)
        if remaining > 0:
            await asyncio.sleep(remaining)
    except asyncio.CancelledError:
        pass
    finally:
        _active_scenario = None


async def stop_scenario():
    global _active_scenario, _scenario_task
    _active_scenario = None
    if _scenario_task:
        _scenario_task.cancel()
        try:
            await _scenario_task
        except asyncio.CancelledError:
            pass
        _scenario_task = None


def get_scenario_status() -> dict:
    if _active_scenario:
        return {"running": True, **_active_scenario}
    return {"running": False}


def list_scenarios() -> list[dict]:
    return [
        {"id": k, "title": v["title"], "description": v["description"], "duration_minutes": v["duration_minutes"]}
        for k, v in SCENARIOS.items()
    ]
