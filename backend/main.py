from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.config import CORS_ORIGINS
from backend.database import init_db
from backend.routers import ingest, metrics, logs, services as services_router, stream, alerts, incidents, thresholds, anomalies, dashboard, correlations, traces, ai_chat, chaos, slo, deploys, predictions, alert_rules, oncall, dashboard_builder
from backend.services.monitor import start_monitor, stop_monitor

app = FastAPI(
    title="SentinelAI",
    description="AI Infrastructure Monitoring & Observability Platform",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    init_db()
    await start_monitor()


@app.on_event("shutdown")
async def shutdown():
    await stop_monitor()


@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "sentinel-ai"}


app.include_router(ingest.router, prefix="/api/ingest", tags=["Ingestion"])
app.include_router(metrics.router, prefix="/api/metrics", tags=["Metrics"])
app.include_router(logs.router, prefix="/api/logs", tags=["Logs"])
app.include_router(services_router.router, prefix="/api/services", tags=["Services"])
app.include_router(stream.router, prefix="/api/stream", tags=["Streaming"])
app.include_router(alerts.router, prefix="/api/alerts", tags=["Alerts"])
app.include_router(incidents.router, prefix="/api/incidents", tags=["Incidents"])
app.include_router(thresholds.router, prefix="/api/thresholds", tags=["Thresholds"])
app.include_router(anomalies.router, prefix="/api/anomalies", tags=["Anomalies"])
app.include_router(dashboard.router, prefix="/api/dashboard", tags=["Dashboard"])
app.include_router(correlations.router, prefix="/api/correlations", tags=["Correlations"])
app.include_router(traces.router, prefix="/api/traces", tags=["Traces"])
app.include_router(ai_chat.router, prefix="/api/ask", tags=["AI Chat"])
app.include_router(chaos.router, prefix="/api/chaos", tags=["Chaos & Runbooks"])
app.include_router(slo.router, prefix="/api", tags=["SLO & Dashboards"])
app.include_router(deploys.router, prefix="/api/deploys", tags=["Deployments"])
app.include_router(predictions.router, prefix="/api/predictions", tags=["Predictions"])
app.include_router(alert_rules.router, prefix="/api/rules", tags=["Alert Rules"])
app.include_router(oncall.router, prefix="/api/oncall", tags=["On-Call"])
app.include_router(dashboard_builder.router, prefix="/api/layouts", tags=["Dashboard Builder"])
