import asyncio
import json
import time
from datetime import datetime, timezone
from backend.services.anomaly_detector import run_full_detection
from backend.services.log_anomaly_detector import detect_log_anomalies
from backend.services.metric_store import get_services
from backend.services.alert_engine import create_alert, auto_resolve_check
from backend.services.correlator import run_correlation
from backend.services.incident_manager import (
    create_incident_from_correlation, get_active_incident_for_services, link_alert_to_incident,
)
from backend.models.schemas import AnomalyReport, LogAnomalyReport
from backend.config import DETECTION_INTERVAL_SECONDS


class AnomalyState:
    """Tracks which anomalies are active and enforces cooldowns."""

    def __init__(self, cooldown_seconds: int = 900):
        self.cooldown_seconds = cooldown_seconds
        self._active: dict[str, dict] = {}
        self._last_alerted: dict[str, float] = {}

    def _key(self, service: str, metric_name: str) -> str:
        return f"{service}:{metric_name}"

    def update(self, report: AnomalyReport) -> tuple[bool, bool]:
        """Returns (is_new_anomaly, should_alert).

        is_new_anomaly: True if this anomaly wasn't previously tracked.
        should_alert: True if we should fire an alert (respects cooldown).
        """
        key = self._key(report.service, report.metric_name)
        now = time.time()

        if not report.anomalies:
            if key in self._active:
                del self._active[key]
            return False, False

        is_new = key not in self._active
        self._active[key] = {
            "report": report,
            "last_seen": now,
            "first_seen": self._active.get(key, {}).get("first_seen", now),
        }

        last_alert_time = self._last_alerted.get(key, 0)
        should_alert = (now - last_alert_time) > self.cooldown_seconds
        if should_alert:
            self._last_alerted[key] = now

        return is_new, should_alert

    def get_active(self) -> list[AnomalyReport]:
        return [entry["report"] for entry in self._active.values()]

    def get_active_for_service(self, service: str) -> list[AnomalyReport]:
        return [
            entry["report"] for key, entry in self._active.items()
            if key.startswith(f"{service}:")
        ]

    def is_anomaly_active(self, service: str, metric_name: str) -> bool:
        return self._key(service, metric_name) in self._active

    def clear_resolved(self, max_age_seconds: int = 300):
        """Remove anomalies that haven't been seen for a while."""
        now = time.time()
        expired = [k for k, v in self._active.items() if now - v["last_seen"] > max_age_seconds]
        for k in expired:
            del self._active[k]


anomaly_state = AnomalyState()

_monitor_task: asyncio.Task | None = None
_monitor_running = False

_latest_metric_reports: list[AnomalyReport] = []
_latest_log_reports: list[LogAnomalyReport] = []
_history: list[dict] = []


def get_active_anomalies() -> list[AnomalyReport]:
    return anomaly_state.get_active()


def get_active_anomalies_for_service(service: str) -> list[AnomalyReport]:
    return anomaly_state.get_active_for_service(service)


def get_anomaly_history() -> list[dict]:
    return list(_history)


def get_latest_log_anomalies() -> list[LogAnomalyReport]:
    return list(_latest_log_reports)


async def _run_detection_cycle():
    global _latest_metric_reports, _latest_log_reports

    reports = await asyncio.get_event_loop().run_in_executor(None, run_full_detection, 6)
    _latest_metric_reports = reports

    for report in reports:
        is_new, should_alert = anomaly_state.update(report)
        if report.anomalies:
            _history.append({
                "service": report.service,
                "metric_name": report.metric_name,
                "anomaly_count": len(report.anomalies),
                "max_severity": max(a.severity for a in report.anomalies),
                "detection_method": report.detection_method,
                "detected_at": datetime.now(timezone.utc).isoformat(),
                "is_new": is_new,
            })
            if should_alert:
                try:
                    alert_result = create_alert(report, alert_type="anomaly")
                    if alert_result.get("id"):
                        active_inc = get_active_incident_for_services([report.service])
                        if active_inc:
                            try:
                                link_alert_to_incident(active_inc["id"], alert_result["id"])
                            except Exception:
                                pass
                except Exception as e:
                    print(f"Alert creation error: {e}")

    if len(_history) > 1000:
        _history[:] = _history[-500:]

    anomaly_state.clear_resolved()

    try:
        auto_resolve_check()
    except Exception as e:
        print(f"Auto-resolve error: {e}")

    try:
        correlations = run_correlation(reports)
        for corr in correlations:
            all_services = [corr.origin_service] + corr.affected_services
            existing = get_active_incident_for_services(all_services)
            if not existing:
                create_incident_from_correlation(corr)
    except Exception as e:
        print(f"Correlation/incident error: {e}")

    services = await asyncio.get_event_loop().run_in_executor(None, get_services)
    log_reports = []
    for svc in services:
        log_report = await asyncio.get_event_loop().run_in_executor(
            None, detect_log_anomalies, svc, 30
        )
        if log_report.anomalies:
            log_reports.append(log_report)
    _latest_log_reports = log_reports


async def start_monitor():
    global _monitor_task, _monitor_running
    if _monitor_running:
        return
    _monitor_running = True
    _monitor_task = asyncio.create_task(_monitor_loop())


async def stop_monitor():
    global _monitor_task, _monitor_running
    _monitor_running = False
    if _monitor_task:
        _monitor_task.cancel()
        try:
            await _monitor_task
        except asyncio.CancelledError:
            pass
        _monitor_task = None


async def _monitor_loop():
    while _monitor_running:
        try:
            await _run_detection_cycle()
        except Exception as e:
            print(f"Monitor cycle error: {e}")
        await asyncio.sleep(DETECTION_INTERVAL_SECONDS)


async def run_detection_now() -> dict:
    """Force an immediate detection run and return summary."""
    await _run_detection_cycle()
    active = anomaly_state.get_active()
    return {
        "metric_anomalies": len(active),
        "log_anomaly_reports": len(_latest_log_reports),
        "services_affected": list(set(r.service for r in active)),
        "detected_at": datetime.now(timezone.utc).isoformat(),
    }
