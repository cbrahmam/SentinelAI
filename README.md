# SentinelAI

**AI-powered infrastructure monitoring that finds problems before your users do.**

## The Problem

Engineers spend hours staring at dashboards, grepping logs, and correlating signals across services during incidents. By the time a human spots the pattern, users have already been impacted. Traditional monitoring tells you something is wrong. It doesn't tell you why.

## The Solution

SentinelAI continuously monitors metrics and logs across your entire infrastructure, detects anomalies using statistical and ML methods, correlates incidents across services, and uses AI to perform root cause analysis and generate runbooks. It's like having a senior SRE watching every dashboard 24/7.

## Features

- **Multi-format log ingestion** — Parses JSON, Python, Apache/Nginx, Syslog, Docker/K8s, and generic formats with auto-detection
- **Time-series metrics** — Collection, storage, and aggregated queries (1m, 5m, 15m, 1h windows)
- **5 anomaly detection methods** — Z-score, Isolation Forest (scikit-learn), Rate of Change, Threshold-based, Seasonal Decomposition
- **AI root cause analysis** — Claude-powered analysis with rule-based fallback for demo without API key
- **Cross-service correlation** — Groups related anomalies across services, maps propagation paths using dependency graph
- **Incident management** — Auto-created from correlated alerts, timeline tracking, status workflow, AI summarization
- **Interactive service map** — D3.js force-directed dependency graph with live status, click-to-drill-down
- **Distributed tracing** — Trace ID-based request flow across services, error pinpointing
- **Log explorer** — Full-text search, multi-filter, log histogram, CSV/JSON export, live streaming
- **Metrics explorer** — Custom multi-series charts, threshold lines, service comparison
- **AI chat** — Ask questions about infrastructure state in natural language
- **Chaos scenarios** — Pre-built incident simulations (DB exhaustion, memory leak, cascade failure)
- **Runbook library** — Curated incident response guides with commands and escalation paths
- **Report generation** — One-click infrastructure summary in Markdown
- **SLO & Error Budgets** — Per-service uptime tracking, error budget bars, configurable windows (1h–30d)
- **Anomaly overlays** — Red shaded regions and dots on metric charts during detected anomalies
- **Toast notifications** — Real-time popups for new alerts and incidents
- **Saved dashboards** — Persist custom metric explorer configurations to SQLite
- **Docker Compose** — One-command setup with nginx reverse proxy
- **Real-time streaming** — Server-Sent Events for live metrics, logs, and alerts with auto-reconnect
- **Built-in simulator** — 8 microservices with realistic metrics, logs, and anomaly injection

## Architecture

```
Data Sources (8 simulated microservices)
    │
    ▼
┌─────────────┐    ┌──────────────┐
│  Ingestion   │───▶│   Storage     │
│  (FastAPI)   │    │  (SQLite WAL) │
└─────────────┘    └──────┬───────┘
                          │
              ┌───────────┴───────────┐
              ▼                       ▼
      ┌──────────────┐      ┌──────────────┐
      │  Metrics DB   │      │   Logs DB     │
      │  (time-series)│      │  (structured) │
      └──────┬───────┘      └──────┬───────┘
              │                       │
              ▼                       ▼
      ┌──────────────────────────────────┐
      │     Anomaly Detection Engine      │
      │  (Z-score, IsoForest, RoC,       │
      │   Threshold, Seasonal)            │
      └──────────────┬───────────────────┘
                     │
              ┌──────┴──────┐
              ▼             ▼
      ┌─────────────┐ ┌──────────┐
      │ Correlator   │ │  Alert   │
      │ (dependency  │ │  Engine  │
      │  graph)      │ │          │
      └──────┬──────┘ └────┬─────┘
              │             │
              ▼             ▼
      ┌──────────────────────────┐
      │   AI Analysis (Claude)    │
      │   + Rule-based fallback   │
      └────────────┬─────────────┘
                   │
                   ▼
      ┌──────────────────────────┐
      │  React Dashboard + SSE    │
      │  (Recharts, D3.js,       │
      │   TailwindCSS)            │
      └──────────────────────────┘
```

## Anomaly Detection Methods

| Method | Algorithm | Best For | How It Works |
|--------|-----------|----------|--------------|
| Z-score | Statistical | CPU, Memory | Flags values >3 standard deviations from rolling mean |
| Isolation Forest | ML (scikit-learn) | Multi-dimensional | Isolates anomalies by random partitioning; outliers need fewer splits |
| Rate of Change | Calculus-based | Latency, Gradual trends | Detects sustained rapid changes over a sliding window |
| Threshold | Rule-based | Error rates, Queue depth | Compares against configured warning/critical thresholds |
| Seasonal | Decomposition | Request rate, Traffic | Separates trend + seasonal + residual; flags large residuals |

## Tech Stack

- **Backend**: Python 3.11+, FastAPI, SQLite (WAL mode), scikit-learn, pandas, numpy
- **AI**: Anthropic Claude API (claude-sonnet-4-20250514) with rule-based fallback
- **Frontend**: React 19, Vite, TailwindCSS, Recharts, D3.js, Zustand, Lucide React
- **Streaming**: Server-Sent Events (SSE) via FastAPI StreamingResponse
- **Routing**: React Router v7

## Getting Started

### Prerequisites

- Python 3.11+
- Node.js 18+
- (Optional) Anthropic API key for AI-powered analysis

### Setup

```bash
# Clone the repository
git clone https://github.com/cbrahmam/SentinelAI.git
cd SentinelAI

# Backend setup
python -m venv venv
source venv/bin/activate
pip install -r backend/requirements.txt

# (Optional) Configure API key
cp .env.example .env
# Edit .env and add your ANTHROPIC_API_KEY

# Frontend setup
cd frontend
npm install
cd ..

# Start the backend (port 8000)
PYTHONPATH=. uvicorn backend.main:app --host 0.0.0.0 --port 8000

# In another terminal, start the frontend (port 5173)
cd frontend
npm run dev
```

Open http://localhost:5173 in your browser.

### Docker (one-command)

```bash
docker compose up --build
```

Open http://localhost:5173. Backend runs on port 8000, frontend on 5173 via nginx.

### Quick Demo

1. Click **Load Demo Data** to populate 2 hours of simulated metrics and logs with embedded anomalies
2. Or click **Start Sim** to run the live simulator with real-time data generation
3. Navigate to **Chaos** to run pre-built incident scenarios
4. Watch SentinelAI detect anomalies, correlate across services, and create incidents
5. Click into incidents to see AI analysis, timelines, and runbooks
6. Use **Ask SentinelAI** (bottom-right) to ask questions about your infrastructure

## Chaos Scenarios

### 1. Database Connection Exhaustion
Postgres connections gradually exhaust over 5 minutes. User-service starts throwing connection timeout errors, api-gateway P95 latency spikes, error rates increase across dependent services. SentinelAI detects, correlates, creates an incident, and identifies postgres-primary as root cause.

### 2. Memory Leak in Payment Service
Payment-service memory climbs steadily. GC pause logs appear, latency gradually increases, then OOM errors start. SentinelAI detects the gradual trend and alerts before it crashes.

### 3. Cascade Failure from Redis
Redis-cache goes down, causing cache miss spikes across all services. Auth-service fails (session store is Redis), api-gateway starts returning 503s. SentinelAI traces the cascade back to Redis through the dependency graph.

## Service Dependency Graph

```
api-gateway ──▶ auth-service ──▶ postgres-primary
    │               │                    ▲
    │               └──▶ redis-cache     │
    │                        ▲           │
    ├──▶ user-service ───────┴───────────┘
    │
    └──▶ payment-service ──▶ postgres-primary
                │
                └──▶ rabbitmq ◀── notification-service
                                      │
                                      └──▶ redis-cache
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check |
| `/api/dashboard` | GET | Aggregated dashboard data |
| `/api/services` | GET | List all services with status |
| `/api/services/service-map` | GET | Service dependency map (nodes + edges) |
| `/api/services/{name}` | GET | Service detail with metrics, alerts, anomalies |
| `/api/metrics` | GET | Query metrics with time range and aggregation |
| `/api/logs` | GET | Query logs with filters |
| `/api/logs/counts` | GET | Log volume histogram |
| `/api/alerts` | GET | List alerts |
| `/api/alerts/{id}/analyze` | POST | Trigger AI analysis for an alert |
| `/api/incidents` | GET/POST | List or create incidents |
| `/api/incidents/{id}` | GET | Incident detail with timeline |
| `/api/incidents/{id}/analyze` | POST | AI-powered incident analysis |
| `/api/correlations` | GET | Current cross-service correlations |
| `/api/traces/{trace_id}` | GET | Distributed trace view |
| `/api/ask` | POST | Ask AI about infrastructure |
| `/api/chaos/scenarios` | GET | List chaos scenarios |
| `/api/chaos/scenarios/{id}/run` | POST | Run a chaos scenario |
| `/api/chaos/runbooks` | GET | List runbooks |
| `/api/chaos/report` | GET | Generate infrastructure report |
| `/api/stream/all` | GET (SSE) | Real-time event stream |

## Project Structure

```
SentinelAI/
├── backend/
│   ├── main.py                    # FastAPI app, router registration
│   ├── config.py                  # Configuration
│   ├── database.py                # SQLite with WAL mode
│   ├── models/
│   │   └── schemas.py             # Pydantic models
│   ├── services/
│   │   ├── metric_store.py        # Time-series metrics storage & queries
│   │   ├── log_store.py           # Structured log storage & search
│   │   ├── log_parser.py          # Multi-format log parsing
│   │   ├── anomaly_detector.py    # 5 detection methods
│   │   ├── log_anomaly_detector.py# Log pattern anomaly detection
│   │   ├── monitor.py             # Background detection loop
│   │   ├── alert_engine.py        # Alert lifecycle management
│   │   ├── ai_analyzer.py         # Claude API root cause analysis
│   │   ├── ai_chat.py             # AI chat interface
│   │   ├── correlator.py          # Cross-service anomaly correlation
│   │   ├── incident_manager.py    # Incident CRUD + timeline
│   │   ├── trace_service.py       # Distributed trace views
│   │   ├── service_mapper.py      # Service dependency map data
│   │   ├── chaos_scenarios.py     # Pre-built chaos scenarios
│   │   ├── runbook_library.py     # Curated runbook collection
│   │   └── report_generator.py    # Infrastructure report generation
│   ├── generators/
│   │   └── simulator.py           # 8-service data simulator
│   └── routers/                   # FastAPI route handlers
├── frontend/
│   ├── src/
│   │   ├── App.jsx                # Router & layout
│   │   ├── stores/useStore.js     # Zustand state management
│   │   └── components/
│   │       ├── TopBar.jsx         # Navigation & controls
│   │       ├── AlertBanner.jsx    # Active alert display
│   │       ├── ServiceGrid.jsx    # Service status cards
│   │       ├── MetricsCharts.jsx  # Dashboard metric charts
│   │       ├── LogFeed.jsx        # Live log feed
│   │       ├── ServiceMap.jsx     # D3.js dependency graph
│   │       ├── ServiceDetail.jsx  # Service drill-down
│   │       ├── IncidentList.jsx   # Incident management
│   │       ├── IncidentDetail.jsx # Incident timeline & analysis
│   │       ├── LogExplorer.jsx    # Full log search & export
│   │       ├── MetricsExplorer.jsx# Custom chart builder
│   │       ├── TraceDetail.jsx    # Distributed trace view
│   │       ├── ChaosPanel.jsx     # Chaos scenario controls
│   │       ├── RunbookLibrary.jsx # Runbook browser
│   │       ├── ReportGenerator.jsx# Infrastructure reports
│   │       └── AIChatPanel.jsx    # AI assistant chat
│   └── vite.config.js             # Vite + proxy config
├── .env.example
└── README.md
```

## License

MIT
