import json
import re
from datetime import datetime, timezone
from backend.models.schemas import ParsedLog

_LEVEL_MAP = {
    "debug": "debug", "dbg": "debug",
    "info": "info", "inf": "info", "information": "info",
    "warn": "warn", "warning": "warn", "wrn": "warn",
    "error": "error", "err": "error",
    "fatal": "fatal", "critical": "fatal", "crit": "fatal", "emerg": "fatal",
}

_OTEL_TRACE_RE = re.compile(r'trace[_\-]?id["\s:=]+([a-f0-9]{32})', re.IGNORECASE)
_OTEL_SPAN_RE = re.compile(r'span[_\-]?id["\s:=]+([a-f0-9]{16})', re.IGNORECASE)

_APACHE_RE = re.compile(
    r'^(?P<ip>\S+) \S+ \S+ \[(?P<ts>[^\]]+)\] "(?P<method>\w+) (?P<path>\S+) \S+" (?P<status>\d+) (?P<size>\d+)'
)

_SYSLOG_RE = re.compile(
    r'^(?P<ts>\w{3}\s+\d{1,2} \d{2}:\d{2}:\d{2}) (?P<host>\S+) (?P<service>[^\[:]+)(?:\[(?P<pid>\d+)\])?: (?P<msg>.+)'
)

_PYTHON_RE = re.compile(
    r'^(?P<ts>\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2},\d{3}) - (?P<service>\S+) - (?P<level>\w+) - (?P<msg>.+)'
)

_GENERIC_TS_RE = re.compile(
    r'^\[(?P<ts>\d{4}-\d{2}-\d{2}T[^\]]+)\]\s*\[(?P<level>\w+)\]\s*(?:(?P<service>\S+?):\s*)?(?P<msg>.+)'
)

_DOCKER_RE = re.compile(
    r'^(?P<ts>\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z)\s+(?P<stream>stdout|stderr)\s+(?P<tag>\S+)\s+(?P<msg>.+)'
)


def _normalize_level(raw: str) -> str:
    return _LEVEL_MAP.get(raw.lower().strip(), "info")


def _extract_trace(text: str) -> tuple[str | None, str | None]:
    trace_match = _OTEL_TRACE_RE.search(text)
    span_match = _OTEL_SPAN_RE.search(text)
    return (
        trace_match.group(1) if trace_match else None,
        span_match.group(1) if span_match else None,
    )


def _try_json(line: str, service_hint: str | None) -> ParsedLog | None:
    try:
        data = json.loads(line)
    except (json.JSONDecodeError, ValueError):
        return None
    if not isinstance(data, dict):
        return None

    ts = data.get("timestamp") or data.get("time") or data.get("@timestamp") or datetime.now(timezone.utc).isoformat()
    level = _normalize_level(data.get("level", data.get("severity", "info")))
    service = data.get("service") or data.get("logger") or data.get("app") or service_hint or "unknown"
    message = data.get("message") or data.get("msg") or data.get("text") or str(data)
    trace_id = data.get("trace_id") or data.get("traceId")
    span_id = data.get("span_id") or data.get("spanId")

    structured = {k: v for k, v in data.items() if k not in {"timestamp", "time", "@timestamp", "level", "severity", "service", "logger", "app", "message", "msg", "text"}}

    return ParsedLog(
        timestamp=ts,
        level=level,
        service=service,
        message=message,
        raw_line=line,
        structured_data=structured or None,
        trace_id=trace_id,
        span_id=span_id,
        format_detected="json",
    )


def _try_apache(line: str, service_hint: str | None) -> ParsedLog | None:
    m = _APACHE_RE.match(line)
    if not m:
        return None
    status = int(m.group("status"))
    level = "error" if status >= 500 else ("warn" if status >= 400 else "info")
    try:
        ts = datetime.strptime(m.group("ts"), "%d/%b/%Y:%H:%M:%S %z").isoformat()
    except ValueError:
        ts = datetime.now(timezone.utc).isoformat()

    return ParsedLog(
        timestamp=ts,
        level=level,
        service=service_hint or "nginx",
        message=f'{m.group("method")} {m.group("path")} {m.group("status")} {m.group("size")}',
        raw_line=line,
        structured_data={"ip": m.group("ip"), "method": m.group("method"), "path": m.group("path"), "status": status, "size": int(m.group("size"))},
        format_detected="apache",
    )


def _try_syslog(line: str, service_hint: str | None) -> ParsedLog | None:
    m = _SYSLOG_RE.match(line)
    if not m:
        return None
    year = datetime.now().year
    try:
        ts = datetime.strptime(f"{year} {m.group('ts')}", "%Y %b %d %H:%M:%S").replace(tzinfo=timezone.utc).isoformat()
    except ValueError:
        ts = datetime.now(timezone.utc).isoformat()

    msg = m.group("msg")
    level = "error" if any(w in msg.lower() for w in ["error", "fail", "fatal"]) else "info"
    trace_id, span_id = _extract_trace(msg)

    return ParsedLog(
        timestamp=ts,
        level=level,
        service=m.group("service").strip(),
        host=m.group("host"),
        message=msg,
        raw_line=line,
        trace_id=trace_id,
        span_id=span_id,
        format_detected="syslog",
    )


def _try_python(line: str, service_hint: str | None) -> ParsedLog | None:
    m = _PYTHON_RE.match(line)
    if not m:
        return None
    try:
        ts = datetime.strptime(m.group("ts"), "%Y-%m-%d %H:%M:%S,%f").replace(tzinfo=timezone.utc).isoformat()
    except ValueError:
        ts = datetime.now(timezone.utc).isoformat()

    msg = m.group("msg")
    trace_id, span_id = _extract_trace(msg)

    return ParsedLog(
        timestamp=ts,
        level=_normalize_level(m.group("level")),
        service=m.group("service"),
        message=msg,
        raw_line=line,
        trace_id=trace_id,
        span_id=span_id,
        format_detected="python",
    )


def _try_generic(line: str, service_hint: str | None) -> ParsedLog | None:
    m = _GENERIC_TS_RE.match(line)
    if not m:
        return None
    msg = m.group("msg")
    trace_id, span_id = _extract_trace(msg)

    return ParsedLog(
        timestamp=m.group("ts"),
        level=_normalize_level(m.group("level")),
        service=m.group("service") or service_hint or "unknown",
        message=msg,
        raw_line=line,
        trace_id=trace_id,
        span_id=span_id,
        format_detected="generic",
    )


def _try_docker(line: str, service_hint: str | None) -> ParsedLog | None:
    m = _DOCKER_RE.match(line)
    if not m:
        return None
    msg = m.group("msg")
    level = "error" if m.group("stream") == "stderr" else "info"
    if any(w in msg.lower() for w in ["error", "fatal", "panic"]):
        level = "error"
    elif any(w in msg.lower() for w in ["warn", "warning"]):
        level = "warn"
    trace_id, span_id = _extract_trace(msg)

    return ParsedLog(
        timestamp=m.group("ts"),
        level=level,
        service=m.group("tag") if m.group("tag") != "F" else (service_hint or "docker"),
        message=msg,
        raw_line=line,
        trace_id=trace_id,
        span_id=span_id,
        format_detected="docker",
    )


_PARSERS = [_try_json, _try_python, _try_generic, _try_apache, _try_syslog, _try_docker]


def parse_log_line(line: str, service_hint: str | None = None) -> ParsedLog:
    line = line.strip()
    if not line:
        return ParsedLog(
            timestamp=datetime.now(timezone.utc).isoformat(),
            level="debug",
            service=service_hint or "unknown",
            message="",
            raw_line=line,
            format_detected="empty",
        )

    for parser in _PARSERS:
        result = parser(line, service_hint)
        if result:
            if service_hint and result.service == "unknown":
                result.service = service_hint
            return result

    trace_id, span_id = _extract_trace(line)
    level = "info"
    lower = line.lower()
    if any(w in lower for w in ["error", "fatal", "panic", "exception"]):
        level = "error"
    elif any(w in lower for w in ["warn", "warning"]):
        level = "warn"

    return ParsedLog(
        timestamp=datetime.now(timezone.utc).isoformat(),
        level=level,
        service=service_hint or "unknown",
        message=line,
        raw_line=line,
        trace_id=trace_id,
        span_id=span_id,
        format_detected="plaintext",
    )
