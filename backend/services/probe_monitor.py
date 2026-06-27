import asyncio
from backend.services.probe_store import list_checks, prune_results
from backend.services.probe_engine import probe_check

# How often the synthetic monitor sweeps all enabled checks.
PROBE_INTERVAL_SECONDS = 30

_probe_task: asyncio.Task | None = None
_probe_running = False


async def _run_probe_cycle():
    checks = await asyncio.get_event_loop().run_in_executor(None, list_checks)
    for check in checks:
        if not check["enabled"]:
            continue
        await asyncio.get_event_loop().run_in_executor(None, probe_check, check)
    await asyncio.get_event_loop().run_in_executor(None, prune_results)


async def run_probes_now() -> dict:
    """Force an immediate probe sweep of all enabled checks."""
    await _run_probe_cycle()
    checks = list_checks()
    return {"probed": len([c for c in checks if c["enabled"]])}


async def _probe_loop():
    while _probe_running:
        try:
            await _run_probe_cycle()
        except Exception as e:
            print(f"Probe cycle error: {e}")
        await asyncio.sleep(PROBE_INTERVAL_SECONDS)


async def start_probe_monitor():
    global _probe_task, _probe_running
    if _probe_running:
        return
    _probe_running = True
    _probe_task = asyncio.create_task(_probe_loop())


async def stop_probe_monitor():
    global _probe_task, _probe_running
    _probe_running = False
    if _probe_task:
        _probe_task.cancel()
        try:
            await _probe_task
        except asyncio.CancelledError:
            pass
        _probe_task = None
