from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.config import CORS_ORIGINS
from backend.database import init_db
from backend.routers import ingest, metrics, logs, services as services_router, stream, alerts, incidents

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
