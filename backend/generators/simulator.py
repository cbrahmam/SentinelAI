import asyncio
import json
import math
import random
import time
import uuid
from datetime import datetime, timezone, timedelta
from backend.models.schemas import MetricInput, ParsedLog
from backend.services.metric_store import store_metrics_batch
from backend.services.log_store import store_logs_batch

SERVICE_DEFINITIONS = {
    "api-gateway": {
        "host": "prod-web-01",
        "base_metrics": {
            "cpu_usage": (25, 8), "memory_usage": (45, 5), "request_rate": (350, 50),
            "error_rate": (0.5, 0.3), "p50_latency_ms": (12, 3), "p95_latency_ms": (45, 10),
            "p99_latency_ms": (120, 25), "active_connections": (180, 30),
        },
    },
    "auth-service": {
        "host": "prod-auth-01",
        "base_metrics": {
            "cpu_usage": (20, 5), "memory_usage": (35, 4), "request_rate": (200, 40),
            "error_rate": (0.3, 0.2), "p50_latency_ms": (8, 2), "p95_latency_ms": (25, 8),
            "p99_latency_ms": (60, 15), "active_connections": (90, 15),
            "login_attempts": (50, 15), "token_validations": (180, 30),
        },
    },
    "user-service": {
        "host": "prod-user-01",
        "base_metrics": {
            "cpu_usage": (30, 7), "memory_usage": (50, 6), "request_rate": (250, 45),
            "error_rate": (0.4, 0.2), "p50_latency_ms": (15, 4), "p95_latency_ms": (55, 12),
            "p99_latency_ms": (150, 30), "active_connections": (120, 20),
            "db_query_rate": (300, 50),
        },
    },
    "payment-service": {
        "host": "prod-pay-01",
        "base_metrics": {
            "cpu_usage": (35, 8), "memory_usage": (55, 7), "request_rate": (80, 20),
            "error_rate": (0.2, 0.15), "p50_latency_ms": (25, 5), "p95_latency_ms": (80, 18),
            "p99_latency_ms": (200, 40), "active_connections": (50, 10),
            "transaction_rate": (30, 10), "webhook_latency_ms": (150, 40),
        },
    },
    "notification-service": {
        "host": "prod-notif-01",
        "base_metrics": {
            "cpu_usage": (15, 4), "memory_usage": (30, 5), "request_rate": (100, 25),
            "error_rate": (0.1, 0.1), "p50_latency_ms": (5, 2), "p95_latency_ms": (20, 6),
            "p99_latency_ms": (50, 12), "active_connections": (40, 8),
            "email_send_rate": (20, 8), "push_notification_rate": (15, 6), "queue_depth": (25, 15),
        },
    },
    "postgres-primary": {
        "host": "prod-db-01",
        "base_metrics": {
            "cpu_usage": (40, 10), "memory_usage": (65, 5), "active_connections": (80, 15),
            "query_latency_ms": (3, 1.5), "replication_lag_ms": (5, 3),
            "transactions_per_sec": (500, 80), "cache_hit_ratio": (99.2, 0.3),
            "disk_usage_percent": (55, 0.1),
        },
    },
    "redis-cache": {
        "host": "prod-redis-01",
        "base_metrics": {
            "cpu_usage": (10, 3), "memory_usage": (50, 4), "active_connections": (200, 30),
            "hit_rate": (97.5, 1.0), "evictions_per_sec": (2, 1.5),
            "operations_per_sec": (5000, 800), "used_memory_mb": (512, 20),
        },
    },
    "rabbitmq": {
        "host": "prod-mq-01",
        "base_metrics": {
            "cpu_usage": (20, 5), "memory_usage": (40, 6), "active_connections": (30, 8),
            "queue_depth": (50, 30), "message_rate": (200, 60), "consumer_lag": (5, 4),
            "publish_rate": (210, 65), "ack_rate": (200, 60),
        },
    },
}

DEPENDENCIES = {
    "api-gateway": ["auth-service", "user-service", "payment-service"],
    "auth-service": ["postgres-primary", "redis-cache"],
    "user-service": ["postgres-primary", "redis-cache"],
    "payment-service": ["postgres-primary", "rabbitmq"],
    "notification-service": ["rabbitmq", "redis-cache"],
    "postgres-primary": [],
    "redis-cache": [],
    "rabbitmq": [],
}

_NORMAL_LOG_TEMPLATES = {
    "api-gateway": [
        ("info", "GET /api/users 200 {latency}ms"),
        ("info", "POST /api/orders 201 {latency}ms"),
        ("info", "GET /api/products 200 {latency}ms"),
        ("info", "Request processed successfully, client_ip=10.0.{octet}.{octet2}"),
        ("debug", "Rate limiter: {rate}/1000 requests in window"),
    ],
    "auth-service": [
        ("info", "Token validated for user_id={user_id}"),
        ("info", "Login successful for user {user_email}"),
        ("info", "JWT token issued, expires_in=3600s"),
        ("debug", "Session cache hit for session_id={session_id}"),
    ],
    "user-service": [
        ("info", "User profile fetched for user_id={user_id}"),
        ("info", "User preferences updated for user_id={user_id}"),
        ("debug", "DB query executed in {query_time}ms, rows_returned={rows}"),
    ],
    "payment-service": [
        ("info", "Payment processed: amount=${amount}, status=success, txn_id={txn_id}"),
        ("info", "Webhook delivered to merchant, status=200"),
        ("debug", "Idempotency key check passed for txn_id={txn_id}"),
    ],
    "notification-service": [
        ("info", "Email sent to {user_email}, template=order_confirmation"),
        ("info", "Push notification delivered to device_id={device_id}"),
        ("debug", "Queue consumer processed message, queue=notifications, lag={lag}ms"),
    ],
    "postgres-primary": [
        ("info", "Checkpoint complete: wrote {pages} buffers"),
        ("info", "Autovacuum: processing table users"),
        ("debug", "Replication stream connected from standby prod-db-02"),
    ],
    "redis-cache": [
        ("info", "Background saving started"),
        ("info", "RDB: {keys} keys saved to dump.rdb"),
        ("debug", "Client connected from 10.0.{octet}.{octet2}:54321"),
    ],
    "rabbitmq": [
        ("info", "Queue notifications: {depth} messages, {consumers} consumers"),
        ("info", "Connection accepted from payment-service"),
        ("debug", "Message published to exchange=events, routing_key=payment.completed"),
    ],
}

_ERROR_LOG_TEMPLATES = {
    "api-gateway": [
        ("error", "POST /api/payments 503 - upstream service unavailable"),
        ("error", "GET /api/users 500 - Internal Server Error, trace_id={trace_id}"),
        ("warn", "Request timeout after 30000ms for /api/reports, trace_id={trace_id}"),
        ("error", "Circuit breaker OPEN for payment-service, failing fast"),
    ],
    "auth-service": [
        ("error", "Login failed: invalid credentials for user {user_email}"),
        ("error", "Token validation failed: expired token, user_id={user_id}"),
        ("warn", "Rate limit exceeded for IP 10.0.{octet}.{octet2}, blocking for 60s"),
        ("error", "Redis connection refused: Cannot connect to redis-cache:6379, trace_id={trace_id}"),
    ],
    "user-service": [
        ("error", "Database query timeout after 5000ms: SELECT * FROM users WHERE id = {user_id}, trace_id={trace_id}"),
        ("error", "Connection pool exhausted: 100/100 connections in use"),
        ("warn", "Slow query detected: {query_time}ms for user lookup"),
        ("error", "Failed to update user profile: deadlock detected, trace_id={trace_id}"),
    ],
    "payment-service": [
        ("error", "Payment declined: insufficient_funds, txn_id={txn_id}, trace_id={trace_id}"),
        ("error", "Webhook delivery failed: connection timeout to merchant endpoint"),
        ("fatal", "CRITICAL: Payment double-charge detected for txn_id={txn_id}, trace_id={trace_id}"),
        ("error", "Message publish failed: RabbitMQ connection lost"),
    ],
    "notification-service": [
        ("error", "Email delivery failed: SMTP connection timeout"),
        ("error", "Push notification failed: invalid device token for device_id={device_id}"),
        ("warn", "Queue depth exceeding threshold: {depth} messages pending"),
    ],
    "postgres-primary": [
        ("error", "FATAL: too many connections for role 'app_user'"),
        ("error", "ERROR: deadlock detected, detail: Process 1234 waits for ShareLock"),
        ("warn", "LOG: replication lag is {lag}ms, threshold is 100ms"),
        ("fatal", "PANIC: could not write to WAL file: No space left on device"),
    ],
    "redis-cache": [
        ("error", "OOM: command not allowed when used memory > maxmemory"),
        ("warn", "Evicting keys: used_memory exceeds maxmemory by {overflow}MB"),
        ("error", "MISCONF: Redis is configured to save RDB snapshots but can't persist to disk"),
    ],
    "rabbitmq": [
        ("error", "Channel exception: queue 'payments' not found"),
        ("warn", "Memory alarm: high watermark reached, blocking publishers"),
        ("error", "Consumer cancelled: connection lost to notification-service"),
    ],
}

ANOMALY_METRIC_EFFECTS = {
    "cpu_spike": {"cpu_usage": lambda base, _: random.uniform(85, 98)},
    "memory_leak": {"memory_usage": lambda base, elapsed_min: min(base + elapsed_min * 1.5, 99)},
    "latency_spike": {
        "p95_latency_ms": lambda base, _: base * random.uniform(5, 10),
        "p99_latency_ms": lambda base, _: base * random.uniform(8, 15),
        "p50_latency_ms": lambda base, _: base * random.uniform(2, 4),
    },
    "error_storm": {"error_rate": lambda base, _: base * random.uniform(10, 25)},
    "connection_exhaustion": {"active_connections": lambda base, _: random.uniform(490, 500)},
    "cascade_failure": {
        "error_rate": lambda base, _: base * random.uniform(8, 15),
        "p95_latency_ms": lambda base, _: base * random.uniform(3, 6),
        "cpu_usage": lambda base, _: min(base + random.uniform(20, 35), 98),
    },
    "disk_full": {"disk_usage_percent": lambda base, elapsed_min: min(base + elapsed_min * 3, 99.5)},
}


class Simulator:
    def __init__(self):
        self._running = False
        self._task: asyncio.Task | None = None
        self._start_time: float | None = None
        self._metrics_count = 0
        self._logs_count = 0
        self._active_anomalies: dict[str, dict] = {}
        self._sse_subscribers: list[asyncio.Queue] = []

    @property
    def status(self) -> dict:
        return {
            "running": self._running,
            "uptime_seconds": time.time() - self._start_time if self._start_time else None,
            "services_count": len(SERVICE_DEFINITIONS),
            "metrics_generated": self._metrics_count,
            "logs_generated": self._logs_count,
            "active_anomalies": [f"{v['type']}@{k}" for k, v in self._active_anomalies.items()],
        }

    def subscribe_sse(self) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue(maxsize=500)
        self._sse_subscribers.append(q)
        return q

    def unsubscribe_sse(self, q: asyncio.Queue):
        if q in self._sse_subscribers:
            self._sse_subscribers.remove(q)

    async def _broadcast(self, event_type: str, data: dict):
        msg = json.dumps({"type": event_type, **data})
        dead = []
        for q in self._sse_subscribers:
            try:
                q.put_nowait(msg)
            except asyncio.QueueFull:
                dead.append(q)
        for q in dead:
            self._sse_subscribers.remove(q)

    async def start(self):
        if self._running:
            return
        self._running = True
        self._start_time = time.time()
        self._task = asyncio.create_task(self._run_loop())

    async def stop(self):
        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None

    def inject_anomaly(self, anomaly_type: str, service: str, duration_minutes: int = 5):
        self._active_anomalies[service] = {
            "type": anomaly_type,
            "started_at": time.time(),
            "duration_seconds": duration_minutes * 60,
        }
        if anomaly_type == "cascade_failure":
            dependents = [s for s, deps in DEPENDENCIES.items() if service in deps]
            for dep in dependents:
                self._active_anomalies[dep] = {
                    "type": "cascade_failure",
                    "started_at": time.time() + random.uniform(15, 60),
                    "duration_seconds": duration_minutes * 60,
                    "source": service,
                }

    async def _run_loop(self):
        while self._running:
            try:
                now = datetime.now(timezone.utc)
                self._expire_anomalies()
                metrics = self._generate_metrics(now)
                logs = self._generate_logs(now)
                store_metrics_batch(metrics)
                store_logs_batch(logs)
                self._metrics_count += len(metrics)
                self._logs_count += len(logs)
                for m in metrics:
                    await self._broadcast("metric", {
                        "service": m.service, "metric_name": m.metric_name,
                        "value": m.value, "unit": m.unit, "timestamp": m.timestamp,
                    })
                for lg in logs:
                    await self._broadcast("log", {
                        "service": lg.service, "level": lg.level,
                        "message": lg.message, "timestamp": lg.timestamp,
                        "trace_id": lg.trace_id,
                    })
                await asyncio.sleep(10)
            except asyncio.CancelledError:
                break
            except Exception as e:
                print(f"Simulator error: {e}")
                await asyncio.sleep(5)

    def _expire_anomalies(self):
        now = time.time()
        expired = [s for s, a in self._active_anomalies.items()
                   if now - a["started_at"] > a["duration_seconds"]]
        for s in expired:
            del self._active_anomalies[s]

    def _generate_metrics(self, now: datetime) -> list[MetricInput]:
        metrics = []
        ts = now.isoformat()
        for service, defn in SERVICE_DEFINITIONS.items():
            anomaly = self._active_anomalies.get(service)
            for metric_name, (base_mean, base_std) in defn["base_metrics"].items():
                value = random.gauss(base_mean, base_std)
                if anomaly and time.time() >= anomaly["started_at"]:
                    effects = ANOMALY_METRIC_EFFECTS.get(anomaly["type"], {})
                    if metric_name in effects:
                        elapsed = (time.time() - anomaly["started_at"]) / 60.0
                        value = effects[metric_name](base_mean, elapsed)

                if "usage" in metric_name or "ratio" in metric_name or "hit_rate" in metric_name:
                    value = max(0, min(100, value))
                elif "rate" in metric_name or "connections" in metric_name or "depth" in metric_name:
                    value = max(0, value)
                elif "latency" in metric_name or "lag" in metric_name:
                    value = max(0, value)

                unit = "percent" if "usage" in metric_name or "ratio" in metric_name or "rate" == metric_name[-4:] else \
                       "ms" if "latency" in metric_name or "lag" in metric_name else \
                       "count"

                metrics.append(MetricInput(
                    service=service, host=defn["host"], metric_name=metric_name,
                    value=round(value, 2), unit=unit, timestamp=ts,
                ))
        return metrics

    def _generate_logs(self, now: datetime) -> list[ParsedLog]:
        logs = []
        ts = now.isoformat()
        trace_id = uuid.uuid4().hex

        for service in SERVICE_DEFINITIONS:
            anomaly = self._active_anomalies.get(service)
            templates = _NORMAL_LOG_TEMPLATES.get(service, [])
            error_templates = _ERROR_LOG_TEMPLATES.get(service, [])

            num_normal = random.randint(1, 3)
            for _ in range(num_normal):
                if templates:
                    level, tmpl = random.choice(templates)
                    msg = self._fill_template(tmpl, trace_id)
                    logs.append(ParsedLog(
                        timestamp=ts, level=level, service=service,
                        host=SERVICE_DEFINITIONS[service]["host"],
                        message=msg, raw_line=f"[{ts}] [{level.upper()}] {service}: {msg}",
                        trace_id=trace_id if "trace_id" in tmpl else None,
                        format_detected="simulator",
                    ))

            error_chance = 0.05
            if anomaly and time.time() >= anomaly["started_at"]:
                error_chance = 0.7 if anomaly["type"] in ("error_storm", "cascade_failure") else 0.3

            if random.random() < error_chance and error_templates:
                level, tmpl = random.choice(error_templates)
                msg = self._fill_template(tmpl, trace_id)
                logs.append(ParsedLog(
                    timestamp=ts, level=level, service=service,
                    host=SERVICE_DEFINITIONS[service]["host"],
                    message=msg, raw_line=f"[{ts}] [{level.upper()}] {service}: {msg}",
                    trace_id=trace_id if "trace_id" in tmpl else None,
                    format_detected="simulator",
                ))

            if anomaly and time.time() >= anomaly["started_at"] and anomaly["type"] in ("error_storm", "cascade_failure"):
                for _ in range(random.randint(2, 5)):
                    if error_templates:
                        level, tmpl = random.choice(error_templates)
                        msg = self._fill_template(tmpl, trace_id)
                        logs.append(ParsedLog(
                            timestamp=ts, level=level, service=service,
                            host=SERVICE_DEFINITIONS[service]["host"],
                            message=msg, raw_line=f"[{ts}] [{level.upper()}] {service}: {msg}",
                            trace_id=trace_id if "trace_id" in tmpl else None,
                            format_detected="simulator",
                        ))

        return logs

    def _fill_template(self, tmpl: str, trace_id: str) -> str:
        return tmpl.format(
            latency=random.randint(5, 500),
            octet=random.randint(1, 254),
            octet2=random.randint(1, 254),
            rate=random.randint(100, 900),
            user_id=random.randint(1000, 99999),
            user_email=f"user{random.randint(1, 500)}@example.com",
            session_id=uuid.uuid4().hex[:16],
            query_time=random.randint(1, 200),
            rows=random.randint(1, 100),
            amount=round(random.uniform(9.99, 499.99), 2),
            txn_id=uuid.uuid4().hex[:12],
            device_id=uuid.uuid4().hex[:10],
            lag=random.randint(1, 50),
            depth=random.randint(10, 2000),
            consumers=random.randint(1, 10),
            pages=random.randint(100, 5000),
            keys=random.randint(10000, 500000),
            overflow=random.randint(10, 200),
            trace_id=trace_id,
        )

    def generate_sample_data(self, hours: int = 24) -> dict:
        now = datetime.now(timezone.utc)
        start = now - timedelta(hours=hours)
        total_metrics = 0
        total_logs = 0
        interval_seconds = 10
        total_points = int((hours * 3600) / interval_seconds)

        anomaly_times = [
            (int(total_points * 0.3), "cpu_spike", "api-gateway", 10),
            (int(total_points * 0.55), "memory_leak", "payment-service", 20),
            (int(total_points * 0.8), "cascade_failure", "postgres-primary", 8),
        ]
        anomaly_windows: dict[str, dict] = {}

        batch_metrics: list[MetricInput] = []
        batch_logs: list[ParsedLog] = []
        batch_size = 2000

        for i in range(total_points):
            ts = start + timedelta(seconds=i * interval_seconds)
            ts_str = ts.isoformat()

            for at_point, atype, aservice, aduration in anomaly_times:
                if i == at_point:
                    anomaly_windows[aservice] = {
                        "type": atype, "start_point": i,
                        "end_point": i + int((aduration * 60) / interval_seconds),
                    }
                    if atype == "cascade_failure":
                        dependents = [s for s, deps in DEPENDENCIES.items() if aservice in deps]
                        for dep in dependents:
                            anomaly_windows[dep] = {
                                "type": "cascade_failure",
                                "start_point": i + random.randint(3, 10),
                                "end_point": i + int((aduration * 60) / interval_seconds),
                            }

            expired = [s for s, a in anomaly_windows.items() if i > a["end_point"]]
            for s in expired:
                del anomaly_windows[s]

            trace_id = uuid.uuid4().hex
            for service, defn in SERVICE_DEFINITIONS.items():
                anom = anomaly_windows.get(service)
                for metric_name, (base_mean, base_std) in defn["base_metrics"].items():
                    hour_of_day = ts.hour
                    daily_factor = 1.0 + 0.3 * math.sin(math.pi * (hour_of_day - 6) / 12)
                    if "rate" in metric_name or "connections" in metric_name:
                        base = base_mean * daily_factor
                    else:
                        base = base_mean

                    value = random.gauss(base, base_std)

                    if anom and i >= anom["start_point"]:
                        effects = ANOMALY_METRIC_EFFECTS.get(anom["type"], {})
                        if metric_name in effects:
                            elapsed = (i - anom["start_point"]) * interval_seconds / 60.0
                            value = effects[metric_name](base_mean, elapsed)

                    if "usage" in metric_name or "ratio" in metric_name or "hit_rate" in metric_name:
                        value = max(0, min(100, value))
                    else:
                        value = max(0, value)

                    unit = "percent" if "usage" in metric_name or "ratio" in metric_name else \
                           "ms" if "latency" in metric_name or "lag" in metric_name else "count"

                    batch_metrics.append(MetricInput(
                        service=service, host=defn["host"], metric_name=metric_name,
                        value=round(value, 2), unit=unit, timestamp=ts_str,
                    ))

                if random.random() < 0.3:
                    templates = _NORMAL_LOG_TEMPLATES.get(service, [])
                    if templates:
                        level, tmpl = random.choice(templates)
                        msg = self._fill_template(tmpl, trace_id)
                        batch_logs.append(ParsedLog(
                            timestamp=ts_str, level=level, service=service,
                            host=defn["host"], message=msg,
                            raw_line=f"[{ts_str}] [{level.upper()}] {service}: {msg}",
                            trace_id=trace_id if "trace_id" in tmpl else None,
                            format_detected="simulator",
                        ))

                error_chance = 0.02
                if anom and i >= anom["start_point"]:
                    error_chance = 0.5

                if random.random() < error_chance:
                    templates = _ERROR_LOG_TEMPLATES.get(service, [])
                    if templates:
                        level, tmpl = random.choice(templates)
                        msg = self._fill_template(tmpl, trace_id)
                        batch_logs.append(ParsedLog(
                            timestamp=ts_str, level=level, service=service,
                            host=defn["host"], message=msg,
                            raw_line=f"[{ts_str}] [{level.upper()}] {service}: {msg}",
                            trace_id=trace_id if "trace_id" in tmpl else None,
                            format_detected="simulator",
                        ))

            if len(batch_metrics) >= batch_size:
                store_metrics_batch(batch_metrics)
                total_metrics += len(batch_metrics)
                batch_metrics = []
            if len(batch_logs) >= batch_size:
                store_logs_batch(batch_logs)
                total_logs += len(batch_logs)
                batch_logs = []

        if batch_metrics:
            store_metrics_batch(batch_metrics)
            total_metrics += len(batch_metrics)
        if batch_logs:
            store_logs_batch(batch_logs)
            total_logs += len(batch_logs)

        return {"metrics_generated": total_metrics, "logs_generated": total_logs, "hours": hours}


simulator = Simulator()
