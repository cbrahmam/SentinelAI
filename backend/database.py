import sqlite3
import threading
from contextlib import contextmanager
from datetime import datetime
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

            CREATE TABLE IF NOT EXISTS notification_channels (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                channel_type TEXT NOT NULL,
                config TEXT NOT NULL,
                enabled INTEGER DEFAULT 1,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS notification_log (
                id TEXT PRIMARY KEY,
                channel_id TEXT NOT NULL,
                channel_name TEXT,
                channel_type TEXT,
                event_type TEXT NOT NULL,
                title TEXT NOT NULL,
                message TEXT,
                status TEXT DEFAULT 'delivered',
                sent_at TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_notif_log_time ON notification_log(sent_at);

            CREATE TABLE IF NOT EXISTS dashboard_layouts (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT,
                widgets TEXT NOT NULL,
                layout TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS audit_log (
                id TEXT PRIMARY KEY,
                actor TEXT NOT NULL,
                action TEXT NOT NULL,
                resource_type TEXT NOT NULL,
                resource_id TEXT,
                resource_name TEXT,
                details TEXT,
                timestamp TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_audit_time ON audit_log(timestamp);
            CREATE INDEX IF NOT EXISTS idx_audit_resource ON audit_log(resource_type, resource_id);

            CREATE TABLE IF NOT EXISTS anomaly_fingerprints (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                pattern_signature TEXT NOT NULL,
                services TEXT NOT NULL,
                metrics TEXT NOT NULL,
                description TEXT,
                occurrence_count INTEGER DEFAULT 1,
                avg_duration_minutes REAL,
                last_seen TEXT NOT NULL,
                first_seen TEXT NOT NULL,
                created_at TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_fingerprint_sig ON anomaly_fingerprints(pattern_signature);

            CREATE TABLE IF NOT EXISTS synthetic_checks (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                service TEXT NOT NULL,
                target_url TEXT NOT NULL,
                method TEXT DEFAULT 'GET',
                interval_seconds INTEGER DEFAULT 60,
                timeout_ms INTEGER DEFAULT 3000,
                expected_status INTEGER DEFAULT 200,
                regions TEXT NOT NULL DEFAULT '[]',
                enabled INTEGER DEFAULT 1,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS probe_results (
                id TEXT PRIMARY KEY,
                check_id TEXT NOT NULL,
                region TEXT NOT NULL,
                success INTEGER NOT NULL,
                status_code INTEGER,
                latency_ms REAL,
                error TEXT,
                checked_at TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_probe_check_time ON probe_results(check_id, checked_at);
            CREATE INDEX IF NOT EXISTS idx_probe_region ON probe_results(check_id, region, checked_at);
        """)
        _seed_default_thresholds(conn)
        _seed_default_checks(conn)


def _seed_default_checks(conn: sqlite3.Connection):
    existing = conn.execute("SELECT COUNT(*) FROM synthetic_checks").fetchone()[0]
    if existing > 0:
        return
    regions = '["us-east", "us-west", "eu-west"]'
    now = datetime.utcnow().isoformat()
    defaults = [
        ("check-api-gateway", "API Gateway Health", "api-gateway", "https://api.internal/healthz", regions),
        ("check-auth-service", "Auth Login Endpoint", "auth-service", "https://auth.internal/login", regions),
        ("check-payment-service", "Payment Charge API", "payment-service", "https://pay.internal/v1/charge", regions),
        ("check-user-service", "User Profile API", "user-service", "https://users.internal/profile", regions),
    ]
    conn.executemany(
        """INSERT INTO synthetic_checks
           (id, name, service, target_url, regions, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)""",
        [(i, n, s, u, r, now, now) for (i, n, s, u, r) in defaults],
    )


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
