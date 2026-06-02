RUNBOOKS = [
    {
        "id": "high-cpu",
        "title": "High CPU on Application Server",
        "category": "compute",
        "severity": "P2",
        "steps": [
            "1. SSH into the affected host and run `top -o cpu` to identify the top CPU consumers",
            "2. Check if the high CPU is from application processes or system processes",
            "3. Review `request_rate` metric — if traffic spiked, this may be legitimate load",
            "4. Check for runaway threads: `ps -eLf | grep <process> | wc -l`",
            "5. If a recent deployment caused it, prepare to rollback: `kubectl rollout undo deployment/<service>`",
            "6. If load is legitimate, scale horizontally: `kubectl scale deployment/<service> --replicas=<N+1>`",
            "7. Monitor for 15 minutes after mitigation",
        ],
        "commands": [
            "top -o cpu",
            "ps aux --sort=-%cpu | head -20",
            "kubectl top pods -n production",
            "kubectl rollout undo deployment/<service>",
        ],
        "escalation": "If CPU remains >90% after scaling, escalate to platform team and consider traffic shedding.",
    },
    {
        "id": "db-connection-exhaustion",
        "title": "Database Connection Pool Exhaustion",
        "category": "database",
        "severity": "P1",
        "steps": [
            "1. Check current connections: `SELECT count(*) FROM pg_stat_activity;`",
            "2. Identify connection holders: `SELECT pid, usename, application_name, state, query_start FROM pg_stat_activity ORDER BY query_start;`",
            "3. Kill idle-in-transaction connections older than 5 min: `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = 'idle in transaction' AND query_start < now() - interval '5 minutes';`",
            "4. Check application connection pool settings (max_pool_size, idle_timeout)",
            "5. Look for connection leaks: grep for unclosed connections in application logs",
            "6. Increase max_connections temporarily if needed (requires restart)",
            "7. Deploy connection pool fix if a leak is identified",
        ],
        "commands": [
            "SELECT count(*) FROM pg_stat_activity;",
            "SELECT pid, usename, state, query FROM pg_stat_activity WHERE state != 'idle';",
            "SHOW max_connections;",
        ],
        "escalation": "If connections cannot be freed, initiate failover to standby. Page DBA on-call.",
    },
    {
        "id": "memory-leak",
        "title": "Memory Leak Investigation",
        "category": "application",
        "severity": "P2",
        "steps": [
            "1. Confirm memory is continuously growing: check `memory_usage` trend over last 2 hours",
            "2. SSH and check process memory: `ps aux --sort=-%mem | head -10`",
            "3. Check if GC is running excessively: review GC pause logs",
            "4. If memory is critical (>90%), restart the service: `kubectl rollout restart deployment/<service>`",
            "5. Enable heap profiling for the next occurrence",
            "6. Check recent deployments for memory-related changes: `git log --since='24 hours ago' --oneline`",
            "7. If restart resolves temporarily, schedule investigation with dev team",
            "8. Set up OOM kill alerts if not configured",
        ],
        "commands": [
            "free -h",
            "ps aux --sort=-%mem | head -10",
            "kubectl top pods -n production --sort-by=memory",
            "kubectl rollout restart deployment/<service>",
        ],
        "escalation": "If service OOMs repeatedly, escalate to dev team for heap dump analysis.",
    },
    {
        "id": "redis-failover",
        "title": "Redis Failover Procedure",
        "category": "cache",
        "severity": "P1",
        "steps": [
            "1. Confirm Redis is down: `redis-cli -h redis-cache ping`",
            "2. Check Redis logs: `kubectl logs deployment/redis-cache --tail=100`",
            "3. Check if it's an OOM issue: `redis-cli info memory`",
            "4. If data is non-critical (cache only), restart: `kubectl rollout restart deployment/redis-cache`",
            "5. If using Redis Sentinel, verify automatic failover occurred",
            "6. Clear stale connections on application side",
            "7. Monitor cache hit ratio recovery",
            "8. Verify session store recovery if auth-service uses Redis sessions",
        ],
        "commands": [
            "redis-cli -h redis-cache ping",
            "redis-cli -h redis-cache info memory",
            "redis-cli -h redis-cache info replication",
            "kubectl rollout restart deployment/redis-cache",
        ],
        "escalation": "If Redis data is persistent (sessions, queues) and cannot be recovered, escalate to data team.",
    },
    {
        "id": "rabbitmq-backup",
        "title": "RabbitMQ Queue Backup",
        "category": "messaging",
        "severity": "P2",
        "steps": [
            "1. Check queue depth: `rabbitmqctl list_queues name messages consumers`",
            "2. Identify which queues are backed up",
            "3. Check consumer count — are consumers alive? `rabbitmqctl list_consumers`",
            "4. If consumers are down, restart consumer service: `kubectl rollout restart deployment/<consumer>`",
            "5. Check for publisher rate exceeding consumer throughput",
            "6. If queue is too large, consider purging non-critical messages",
            "7. Add more consumer instances to drain the backlog",
            "8. Set up queue TTL and dead-letter exchange if not configured",
        ],
        "commands": [
            "rabbitmqctl list_queues name messages consumers",
            "rabbitmqctl list_consumers",
            "rabbitmqctl purge_queue <queue_name>",
        ],
        "escalation": "If message loss is acceptable, purge and restart. Otherwise, add consumers and wait for drain.",
    },
]


def list_runbooks() -> list[dict]:
    return [{"id": r["id"], "title": r["title"], "category": r["category"], "severity": r["severity"]} for r in RUNBOOKS]


def get_runbook(runbook_id: str) -> dict | None:
    for r in RUNBOOKS:
        if r["id"] == runbook_id:
            return r
    return None


def search_runbooks(query: str) -> list[dict]:
    q = query.lower()
    return [r for r in RUNBOOKS if q in r["title"].lower() or q in r["category"].lower()
            or any(q in step.lower() for step in r["steps"])]
