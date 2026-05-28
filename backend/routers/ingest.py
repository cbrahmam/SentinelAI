from fastapi import APIRouter, UploadFile, File, BackgroundTasks
from backend.models.schemas import MetricBatchInput, LogBatchInput, AnomalyInjectRequest
from backend.services.metric_store import store_metrics_batch
from backend.services.log_store import store_logs_batch
from backend.services.log_parser import parse_log_line
from backend.generators.simulator import simulator

router = APIRouter()


@router.post("/metrics")
async def ingest_metrics(batch: MetricBatchInput):
    store_metrics_batch(batch.metrics)
    return {"ingested": len(batch.metrics)}


@router.post("/logs")
async def ingest_logs(batch: LogBatchInput):
    parsed = [parse_log_line(lg.raw_line, service_hint=lg.service) for lg in batch.logs]
    store_logs_batch(parsed)
    return {"ingested": len(parsed)}


@router.post("/log-file")
async def ingest_log_file(file: UploadFile = File(...), service: str | None = None):
    content = await file.read()
    lines = content.decode("utf-8", errors="replace").splitlines()
    parsed = [parse_log_line(line, service_hint=service) for line in lines if line.strip()]
    store_logs_batch(parsed)
    return {"ingested": len(parsed), "filename": file.filename}


@router.post("/simulator/start")
async def start_simulator():
    await simulator.start()
    return {"status": "started"}


@router.post("/simulator/stop")
async def stop_simulator():
    await simulator.stop()
    return {"status": "stopped"}


@router.get("/simulator/status")
async def simulator_status():
    return simulator.status


@router.post("/simulator/inject-anomaly")
async def inject_anomaly(req: AnomalyInjectRequest):
    simulator.inject_anomaly(req.anomaly_type, req.service, req.duration_minutes)
    return {"status": "injected", "anomaly_type": req.anomaly_type, "service": req.service}


@router.post("/simulator/load-sample")
async def load_sample_data(background_tasks: BackgroundTasks, hours: int = 24):
    background_tasks.add_task(simulator.generate_sample_data, hours)
    return {"status": "generating", "hours": hours, "message": "Sample data generation started in background"}
