from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class DataPoint(BaseModel):
    timestamp: str
    value: float
    service: str
    host: Optional[str] = None
    metric_name: str
    unit: str = ""


class MetricInput(BaseModel):
    service: str
    host: Optional[str] = None
    metric_name: str
    value: float
    unit: str = ""
    tags: Optional[dict] = None
    timestamp: Optional[str] = None


class MetricBatchInput(BaseModel):
    metrics: list[MetricInput]


class ParsedLog(BaseModel):
    timestamp: str
    level: str
    service: str
    host: Optional[str] = None
    message: str
    raw_line: str
    structured_data: Optional[dict] = None
    trace_id: Optional[str] = None
    span_id: Optional[str] = None
    format_detected: str = "unknown"


class LogEntry(BaseModel):
    id: Optional[int] = None
    timestamp: str
    level: str
    service: str
    host: Optional[str] = None
    message: str
    raw_line: Optional[str] = None
    structured_data: Optional[dict] = None
    trace_id: Optional[str] = None
    span_id: Optional[str] = None


class LogInput(BaseModel):
    raw_line: str
    service: Optional[str] = None
    host: Optional[str] = None


class LogBatchInput(BaseModel):
    logs: list[LogInput]


class ServiceStatus(BaseModel):
    name: str
    status: str = "healthy"
    cpu_usage: Optional[float] = None
    memory_usage: Optional[float] = None
    error_rate: Optional[float] = None
    p95_latency_ms: Optional[float] = None
    request_rate: Optional[float] = None
    last_seen: Optional[str] = None


class AnomalyInjectRequest(BaseModel):
    anomaly_type: str
    service: str
    duration_minutes: int = 5


class SimulatorStatus(BaseModel):
    running: bool
    uptime_seconds: Optional[float] = None
    services_count: int = 0
    metrics_generated: int = 0
    logs_generated: int = 0
    active_anomalies: list[str] = []


class AnomalyPoint(BaseModel):
    timestamp: str
    value: float
    expected_value: float
    deviation: float
    severity: str
    detection_method: str
    metric_name: str
    service: str
    host: Optional[str] = None


class AnomalyReport(BaseModel):
    service: str
    metric_name: str
    anomalies: list[AnomalyPoint]
    baseline_mean: float
    baseline_std: float
    detection_method: str
    time_range: str


class LogAnomaly(BaseModel):
    anomaly_type: str
    service: str
    message_pattern: str
    count: int
    first_seen: str
    last_seen: str
    severity: str
    sample_logs: list[str] = []


class LogAnomalyReport(BaseModel):
    service: str
    anomalies: list[LogAnomaly]
    lookback_minutes: int
    total_logs_analyzed: int


class ThresholdConfig(BaseModel):
    id: Optional[str] = None
    service: str = "*"
    metric_name: str
    warning_value: float
    critical_value: float
    comparison: str = "above"
    enabled: bool = True


class CorrelationGroup(BaseModel):
    id: str
    origin_service: str
    origin_anomaly: AnomalyPoint
    affected_services: list[str]
    propagation_path: list[str]
    time_span_seconds: int
    total_anomalies: int
    detected_at: str
    ai_analysis: Optional[dict] = None


class TraceSpan(BaseModel):
    service: str
    timestamp: str
    level: str
    message: str
    duration_ms: Optional[float] = None
    span_id: Optional[str] = None


class TraceView(BaseModel):
    trace_id: str
    spans: list[TraceSpan]
    total_duration_ms: float
    error_service: Optional[str] = None
    root_cause_log: Optional[str] = None


class TimelineEvent(BaseModel):
    timestamp: str
    event_type: str
    description: str
    service: Optional[str] = None
    metadata: Optional[dict] = None


class IncidentCreate(BaseModel):
    title: str
    severity: str = "P3"
    affected_services: list[str] = []
    description: Optional[str] = None


class IncidentStatusUpdate(BaseModel):
    status: str


class IncidentResolve(BaseModel):
    resolution: str


class SyntheticCheck(BaseModel):
    id: str
    name: str
    service: str
    target_url: str
    method: str = "GET"
    interval_seconds: int = 60
    timeout_ms: int = 3000
    expected_status: int = 200
    regions: list[str] = []
    enabled: bool = True
    created_at: str
    updated_at: str


class SyntheticCheckCreate(BaseModel):
    name: str
    service: str
    target_url: str = Field(..., description="URL the probe issues requests against")
    method: str = "GET"
    interval_seconds: int = Field(60, ge=10, le=3600)
    timeout_ms: int = Field(3000, ge=100, le=30000)
    expected_status: int = 200
    regions: list[str] = ["us-east", "us-west", "eu-west"]


class ProbeResult(BaseModel):
    id: str
    check_id: str
    region: str
    success: bool
    status_code: Optional[int] = None
    latency_ms: Optional[float] = None
    error: Optional[str] = None
    checked_at: str
