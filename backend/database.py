import sqlite3
import threading
from contextlib import contextmanager
from backend.config import DATABASE_PATH

_local = threading.local()


def _get_connection() -> sqlite3.Connection:
    if not hasattr(_local, "conn") or _local.conn is None:
        conn = sqlite3.connect(str(DATABASE_PATH), check_same_thread=False)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA synchronous=NORMAL")
        conn.execute("PRAGMA foreign_keys=ON")
        _local.conn = conn
    return _local.conn


@contextmanager
def get_db():
    conn = _get_connection()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise


def init_db():
    with get_db() as conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS metrics (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                service TEXT NOT NULL,
                host TEXT,
                metric_name TEXT NOT NULL,
                value REAL NOT NULL,
                unit TEXT,
                tags TEXT,
                timestamp TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_metrics_service_time ON metrics(service, timestamp);
            CREATE INDEX IF NOT EXISTS idx_metrics_name_time ON metrics(metric_name, timestamp);
            CREATE INDEX IF NOT EXISTS idx_metrics_service_name_time ON metrics(service, metric_name, timestamp);

            CREATE TABLE IF NOT EXISTS logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                service TEXT NOT NULL,
                host TEXT,
                level TEXT NOT NULL,
                message TEXT NOT NULL,
                raw_line TEXT,
                structured_data TEXT,
                trace_id TEXT,
                span_id TEXT,
                timestamp TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_logs_service_time ON logs(service, timestamp);
            CREATE INDEX IF NOT EXISTS idx_logs_level ON logs(level);
            CREATE INDEX IF NOT EXISTS idx_logs_trace ON logs(trace_id);
            CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON logs(timestamp);

            CREATE TABLE IF NOT EXISTS alert_thresholds (
                id TEXT PRIMARY KEY,
                service TEXT,
                metric_name TEXT,
                warning_value REAL,
                critical_value REAL,
                comparison TEXT,
                enabled INTEGER DEFAULT 1
            );

            CREATE TABLE IF NOT EXISTS alerts (
                id TEXT PRIMARY KEY,
                service TEXT,
                metric_name TEXT,
                alert_type TEXT,
                severity TEXT,
                title TEXT,
                description TEXT,
                current_value REAL,
                threshold_value REAL,
                status TEXT DEFAULT 'firing',
                ai_analysis TEXT,
                fired_at TEXT,
                acknowledged_at TEXT,
                resolved_at TEXT,
                resolved_by TEXT
            );
            CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status);
            CREATE INDEX IF NOT EXISTS idx_alerts_service ON alerts(service);

            CREATE TABLE IF NOT EXISTS incidents (
                id TEXT PRIMARY KEY,
                title TEXT,
                severity TEXT,
                status TEXT DEFAULT 'investigating',
                summary TEXT,
                root_cause TEXT,
                affected_services TEXT,
                related_alerts TEXT,
                timeline TEXT,
                runbook TEXT,
                resolution TEXT,
                started_at TEXT,
                identified_at TEXT,
                resolved_at TEXT,
                postmortem TEXT
            );
            CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status);

            CREATE TABLE IF NOT EXISTS saved_dashboards (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT,
                config TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS deploy_events (
                id TEXT PRIMARY KEY,
                service TEXT NOT NULL,
                version TEXT NOT NULL,
                environment TEXT DEFAULT 'production',
                deployer TEXT DEFAULT 'system',
                description TEXT,
                commit_sha TEXT,
                status TEXT DEFAULT 'success',
                timestamp TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_deploy_service_time ON deploy_events(service, timestamp);

            CREATE TABLE IF NOT EXISTS alert_rules (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                service TEXT NOT NULL,
                metric_name TEXT NOT NULL,
                condition TEXT NOT NULL,
                threshold REAL NOT NULL,
                severity TEXT DEFAULT 'warning',
                duration_seconds INTEGER DEFAULT 0,
                enabled INTEGER DEFAULT 1,
                notification_channels TEXT DEFAULT '[]',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS oncall_schedules (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                team TEXT NOT NULL,
                members TEXT NOT NULL,
                rotation_type TEXT DEFAULT 'weekly',
                current_index INTEGER DEFAULT 0,
                escalation_minutes INTEGER DEFAULT 15,
                start_date TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS oncall_overrides (
                id TEXT PRIMARY KEY,
                schedule_id TEXT NOT NULL,
                original_member TEXT,
                override_member TEXT NOT NULL,
                start_time TEXT NOT NULL,
                end_time TEXT NOT NULL,
                reason TEXT
            );

            CREATE TABLE IF NOT EXISTS dashboard_layouts (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT,
                widgets TEXT NOT NULL,
                layout TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
        """)
        _seed_default_thresholds(conn)


def _seed_default_thresholds(conn: sqlite3.Connection):
    existing = conn.execute("SELECT COUNT(*) FROM alert_thresholds").fetchone()[0]
    if existing > 0:
        return
    defaults = [
        ("cpu-usage-default", "*", "cpu_usage", 80.0, 95.0, "above"),
        ("memory-usage-default", "*", "memory_usage", 75.0, 90.0, "above"),
        ("error-rate-default", "*", "error_rate", 5.0, 20.0, "above"),
        ("p95-latency-default", "*", "p95_latency_ms", 500.0, 2000.0, "above"),
        ("queue-depth-default", "*", "queue_depth", 1000.0, 5000.0, "above"),
    ]
    conn.executemany(
        "INSERT INTO alert_thresholds (id, service, metric_name, warning_value, critical_value, comparison) VALUES (?, ?, ?, ?, ?, ?)",
        defaults,
    )
