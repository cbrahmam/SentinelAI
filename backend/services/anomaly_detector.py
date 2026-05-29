import numpy as np
import pandas as pd
from collections import defaultdict
from datetime import datetime, timezone, timedelta
from sklearn.ensemble import IsolationForest
from backend.database import get_db
from backend.models.schemas import AnomalyPoint, AnomalyReport
from backend.services.metric_store import query_metrics, get_services, get_metric_names


# ---------------------------------------------------------------------------
# Detection method 1: Z-Score (sudden spikes/drops)
# ---------------------------------------------------------------------------

def detect_zscore(
    values: list[float],
    timestamps: list[str],
    metric_name: str,
    service: str,
    host: str | None = None,
    threshold: float = 3.0,
    window: int = 30,
) -> list[AnomalyPoint]:
    if len(values) < window + 1:
        return []

    arr = np.array(values, dtype=float)
    anomalies = []

    for i in range(window, len(arr)):
        win = arr[max(0, i - window):i]
        mean = np.mean(win)
        std = np.std(win)
        if std < 1e-10:
            continue
        z = abs(arr[i] - mean) / std
        if z > threshold:
            severity = "critical" if z > threshold * 1.5 else "warning"
            anomalies.append(AnomalyPoint(
                timestamp=timestamps[i],
                value=float(arr[i]),
                expected_value=round(float(mean), 2),
                deviation=round(float(z), 2),
                severity=severity,
                detection_method="zscore",
                metric_name=metric_name,
                service=service,
                host=host,
            ))

    return anomalies


# ---------------------------------------------------------------------------
# Detection method 2: Isolation Forest (multivariate)
# ---------------------------------------------------------------------------

def detect_isolation_forest(
    data: pd.DataFrame,
    timestamps: list[str],
    metric_name: str,
    service: str,
    host: str | None = None,
    contamination: float = 0.05,
) -> list[AnomalyPoint]:
    if len(data) < 50:
        return []

    recent = data.tail(1000).copy()
    recent_ts = timestamps[-len(recent):]

    numeric_cols = recent.select_dtypes(include=[np.number]).columns.tolist()
    if not numeric_cols:
        return []

    clean = recent[numeric_cols].dropna()
    if len(clean) < 20:
        return []

    model = IsolationForest(contamination=contamination, random_state=42, n_estimators=100)
    preds = model.fit_predict(clean.values)
    scores = model.decision_function(clean.values)

    anomalies = []
    means = clean.mean()
    stds = clean.std()

    for idx, (pred, score) in enumerate(zip(preds, scores)):
        if pred == -1:
            row_idx = clean.index[idx]
            orig_pos = recent.index.get_loc(row_idx)
            if orig_pos < len(recent_ts):
                primary_col = numeric_cols[0]
                val = float(clean.iloc[idx][primary_col])
                expected = float(means[primary_col])
                std_val = float(stds[primary_col]) if stds[primary_col] > 0 else 1.0
                deviation = abs(val - expected) / std_val
                severity = "critical" if score < -0.3 else "warning"
                anomalies.append(AnomalyPoint(
                    timestamp=recent_ts[orig_pos] if orig_pos < len(recent_ts) else timestamps[-1],
                    value=round(val, 2),
                    expected_value=round(expected, 2),
                    deviation=round(deviation, 2),
                    severity=severity,
                    detection_method="isolation_forest",
                    metric_name=metric_name,
                    service=service,
                    host=host,
                ))

    return anomalies


# ---------------------------------------------------------------------------
# Detection method 3: Rate of Change (gradual trends)
# ---------------------------------------------------------------------------

def detect_rate_of_change(
    values: list[float],
    timestamps: list[str],
    metric_name: str,
    service: str,
    host: str | None = None,
    window: int = 20,
    threshold: float = 0.15,
) -> list[AnomalyPoint]:
    if len(values) < window + 10:
        return []

    arr = np.array(values, dtype=float)
    anomalies = []
    sustained_count = 0
    sustained_start = None
    last_reported = -window

    for i in range(window, len(arr)):
        win = arr[i - window:i + 1]
        baseline_val = abs(np.mean(win[:5]))
        if baseline_val < 1e-6:
            continue
        roc = (win[-1] - win[0]) / baseline_val

        if abs(roc) > threshold:
            sustained_count += 1
            if sustained_start is None:
                sustained_start = i
        else:
            sustained_count = 0
            sustained_start = None

        if sustained_count >= 6 and (i - last_reported) >= window:
            baseline = float(np.mean(arr[max(0, i - window * 2):i - window]))
            severity = "critical" if abs(roc) > threshold * 3 else "warning"
            anomalies.append(AnomalyPoint(
                timestamp=timestamps[i],
                value=round(float(arr[i]), 2),
                expected_value=round(baseline, 2),
                deviation=round(abs(roc), 4),
                severity=severity,
                detection_method="rate_of_change",
                metric_name=metric_name,
                service=service,
                host=host,
            ))
            last_reported = i

    return anomalies


# ---------------------------------------------------------------------------
# Detection method 4: Threshold-based
# ---------------------------------------------------------------------------

def detect_threshold(
    value: float,
    timestamp: str,
    metric_name: str,
    service: str,
    host: str | None = None,
    warning: float | None = None,
    critical: float | None = None,
    comparison: str = "above",
) -> AnomalyPoint | None:
    if warning is None and critical is None:
        return None

    if comparison == "above":
        if critical is not None and value >= critical:
            return AnomalyPoint(
                timestamp=timestamp, value=round(value, 2),
                expected_value=round(critical, 2),
                deviation=round(value - critical, 2),
                severity="critical", detection_method="threshold",
                metric_name=metric_name, service=service, host=host,
            )
        if warning is not None and value >= warning:
            return AnomalyPoint(
                timestamp=timestamp, value=round(value, 2),
                expected_value=round(warning, 2),
                deviation=round(value - warning, 2),
                severity="warning", detection_method="threshold",
                metric_name=metric_name, service=service, host=host,
            )
    elif comparison == "below":
        if critical is not None and value <= critical:
            return AnomalyPoint(
                timestamp=timestamp, value=round(value, 2),
                expected_value=round(critical, 2),
                deviation=round(critical - value, 2),
                severity="critical", detection_method="threshold",
                metric_name=metric_name, service=service, host=host,
            )
        if warning is not None and value <= warning:
            return AnomalyPoint(
                timestamp=timestamp, value=round(value, 2),
                expected_value=round(warning, 2),
                deviation=round(warning - value, 2),
                severity="warning", detection_method="threshold",
                metric_name=metric_name, service=service, host=host,
            )
    return None


# ---------------------------------------------------------------------------
# Detection method 5: Seasonal Decomposition
# ---------------------------------------------------------------------------

def detect_seasonal_anomaly(
    values: list[float],
    timestamps: list[str],
    metric_name: str,
    service: str,
    host: str | None = None,
    period: int = 144,
    threshold_std: float = 3.0,
) -> list[AnomalyPoint]:
    if len(values) < period * 2:
        return []

    arr = np.array(values, dtype=float)

    # Moving average for trend
    kernel = np.ones(period) / period
    trend = np.convolve(arr, kernel, mode="same")

    # Detrended
    detrended = arr - trend

    # Seasonal component: average of detrended values at each position in the cycle
    seasonal = np.zeros(len(arr))
    for i in range(period):
        indices = range(i, len(arr), period)
        seasonal_vals = detrended[list(indices)]
        avg = np.mean(seasonal_vals)
        for idx in indices:
            seasonal[idx] = avg

    # Residual
    residual = arr - trend - seasonal
    res_std = np.std(residual)
    res_mean = np.mean(residual)

    if res_std < 1e-10:
        return []

    anomalies = []
    half = period // 2
    for i in range(half, len(arr) - half):
        z = abs(residual[i] - res_mean) / res_std
        if z > threshold_std:
            expected = float(trend[i] + seasonal[i])
            severity = "critical" if z > threshold_std * 1.5 else "warning"
            anomalies.append(AnomalyPoint(
                timestamp=timestamps[i],
                value=round(float(arr[i]), 2),
                expected_value=round(expected, 2),
                deviation=round(float(z), 2),
                severity=severity,
                detection_method="seasonal",
                metric_name=metric_name,
                service=service,
                host=host,
            ))

    return anomalies


# ---------------------------------------------------------------------------
# Threshold loading from DB
# ---------------------------------------------------------------------------

def get_thresholds_for_metric(service: str, metric_name: str) -> dict | None:
    with get_db() as conn:
        row = conn.execute(
            """SELECT warning_value, critical_value, comparison FROM alert_thresholds
               WHERE (service = ? OR service = '*') AND metric_name = ? AND enabled = 1
               ORDER BY CASE WHEN service = ? THEN 0 ELSE 1 END
               LIMIT 1""",
            (service, metric_name, service),
        ).fetchone()
    if row:
        return {"warning": row["warning_value"], "critical": row["critical_value"], "comparison": row["comparison"]}
    return None


# ---------------------------------------------------------------------------
# Metric-to-detector mapping
# ---------------------------------------------------------------------------

METRIC_DETECTORS = {
    "cpu_usage": ["zscore", "threshold"],
    "memory_usage": ["zscore", "threshold", "rate_of_change"],
    "error_rate": ["zscore", "threshold"],
    "p50_latency_ms": ["zscore", "rate_of_change"],
    "p95_latency_ms": ["zscore", "rate_of_change"],
    "p99_latency_ms": ["zscore", "rate_of_change"],
    "request_rate": ["seasonal", "zscore"],
    "queue_depth": ["rate_of_change", "threshold"],
    "active_connections": ["zscore", "threshold"],
    "replication_lag_ms": ["zscore", "threshold"],
    "disk_usage_percent": ["rate_of_change", "threshold"],
    "consumer_lag": ["rate_of_change", "threshold"],
}


def _default_detectors() -> list[str]:
    return ["zscore", "threshold"]


# ---------------------------------------------------------------------------
# Unified detection pipeline
# ---------------------------------------------------------------------------

def run_detection_pipeline(
    service: str,
    metric_name: str,
    lookback_hours: int = 6,
) -> AnomalyReport:
    start = (datetime.now(timezone.utc) - timedelta(hours=lookback_hours)).isoformat()
    end = datetime.now(timezone.utc).isoformat()

    data_points = query_metrics(service, metric_name, start_time=start, end_time=end, limit=5000)

    if not data_points:
        return AnomalyReport(
            service=service, metric_name=metric_name, anomalies=[],
            baseline_mean=0, baseline_std=0, detection_method="none",
            time_range=f"{start} to {end}",
        )

    values = [dp.value for dp in data_points]
    timestamps = [dp.timestamp for dp in data_points]
    host = data_points[0].host

    arr = np.array(values, dtype=float)
    baseline_mean = float(np.mean(arr))
    baseline_std = float(np.std(arr))

    detectors = METRIC_DETECTORS.get(metric_name, _default_detectors())
    all_anomalies: list[AnomalyPoint] = []
    methods_used = []

    for method in detectors:
        if method == "zscore":
            results = detect_zscore(values, timestamps, metric_name, service, host)
            if results:
                all_anomalies.extend(results)
                methods_used.append("zscore")

        elif method == "threshold":
            thresholds = get_thresholds_for_metric(service, metric_name)
            if thresholds and values:
                latest_val = values[-1]
                result = detect_threshold(
                    latest_val, timestamps[-1], metric_name, service, host,
                    warning=thresholds["warning"], critical=thresholds["critical"],
                    comparison=thresholds["comparison"],
                )
                if result:
                    all_anomalies.append(result)
                    methods_used.append("threshold")

        elif method == "rate_of_change":
            results = detect_rate_of_change(values, timestamps, metric_name, service, host)
            if results:
                all_anomalies.extend(results)
                methods_used.append("rate_of_change")

        elif method == "seasonal":
            results = detect_seasonal_anomaly(values, timestamps, metric_name, service, host)
            if results:
                all_anomalies.extend(results)
                methods_used.append("seasonal")

        elif method == "isolation_forest":
            df = pd.DataFrame({"value": values})
            results = detect_isolation_forest(df, timestamps, metric_name, service, host)
            if results:
                all_anomalies.extend(results)
                methods_used.append("isolation_forest")

    # Deduplicate: keep the highest-severity anomaly per timestamp
    deduped: dict[str, AnomalyPoint] = {}
    severity_rank = {"critical": 2, "warning": 1}
    for a in all_anomalies:
        key = a.timestamp
        if key not in deduped or severity_rank.get(a.severity, 0) > severity_rank.get(deduped[key].severity, 0):
            deduped[key] = a

    sorted_anomalies = sorted(deduped.values(), key=lambda a: a.timestamp)

    return AnomalyReport(
        service=service,
        metric_name=metric_name,
        anomalies=sorted_anomalies,
        baseline_mean=round(baseline_mean, 2),
        baseline_std=round(baseline_std, 2),
        detection_method="+".join(methods_used) if methods_used else "none",
        time_range=f"{start} to {end}",
    )


# ---------------------------------------------------------------------------
# Run detection for all services and metrics
# ---------------------------------------------------------------------------

def run_full_detection(lookback_hours: int = 6) -> list[AnomalyReport]:
    reports = []
    services = get_services()
    for service in services:
        metric_names = get_metric_names(service)
        for metric_name in metric_names:
            report = run_detection_pipeline(service, metric_name, lookback_hours)
            if report.anomalies:
                reports.append(report)
    return reports
