import { create } from 'zustand'

const API = '/api'

const useStore = create((set, get) => ({
  services: [],
  alerts: [],
  firingAlertCount: 0,
  systemStatus: 'All Systems Operational',
  activeAnomalyCount: 0,
  recentLogs: [],
  simulatorStatus: { running: false },
  timeRange: '1h',
  logsPaused: false,
  logFilter: { service: '', level: '' },

  incidents: [],
  incidentCount: 0,
  currentIncident: null,
  correlations: [],

  setTimeRange: (tr) => set({ timeRange: tr }),
  setLogsPaused: (p) => set({ logsPaused: p }),
  setLogFilter: (f) => set((s) => ({ logFilter: { ...s.logFilter, ...f } })),

  fetchDashboard: async () => {
    try {
      const res = await fetch(`${API}/dashboard`)
      const data = await res.json()
      set({
        services: data.services || [],
        alerts: data.firing_alerts || [],
        firingAlertCount: data.firing_alert_count || 0,
        systemStatus: data.system_status || 'Unknown',
        activeAnomalyCount: data.active_anomaly_count || 0,
      })
    } catch (e) {
      console.error('Dashboard fetch error:', e)
    }
  },

  fetchSimulatorStatus: async () => {
    try {
      const res = await fetch(`${API}/ingest/simulator/status`)
      const data = await res.json()
      set({ simulatorStatus: data })
    } catch (e) {
      console.error('Simulator status error:', e)
    }
  },

  startSimulator: async () => {
    await fetch(`${API}/ingest/simulator/start`, { method: 'POST' })
    get().fetchSimulatorStatus()
  },

  stopSimulator: async () => {
    await fetch(`${API}/ingest/simulator/stop`, { method: 'POST' })
    get().fetchSimulatorStatus()
  },

  injectAnomaly: async (anomalyType, service, durationMinutes = 5) => {
    await fetch(`${API}/ingest/simulator/inject-anomaly`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ anomaly_type: anomalyType, service, duration_minutes: durationMinutes }),
    })
  },

  loadSampleData: async (hours = 2) => {
    await fetch(`${API}/ingest/simulator/load-sample?hours=${hours}`, { method: 'POST' })
  },

  acknowledgeAlert: async (id) => {
    await fetch(`${API}/alerts/${id}/acknowledge`, { method: 'PUT' })
    get().fetchDashboard()
  },

  resolveAlert: async (id) => {
    await fetch(`${API}/alerts/${id}/resolve`, { method: 'PUT' })
    get().fetchDashboard()
  },

  fetchMetrics: async (service, metricName, timeRange) => {
    const trMap = { '15m': 0.25, '1h': 1, '6h': 6, '24h': 24, '7d': 168 }
    const hours = trMap[timeRange] || 1
    const start = new Date(Date.now() - hours * 3600 * 1000).toISOString()
    const agg = hours > 6 ? 'avg_5m' : hours > 1 ? 'avg_1m' : 'raw'
    const res = await fetch(`${API}/metrics?service=${service}&metric_name=${metricName}&start_time=${start}&aggregation=${agg}`)
    const data = await res.json()
    return data.data || []
  },

  fetchLogs: async (params = {}) => {
    const q = new URLSearchParams()
    if (params.service) q.set('service', params.service)
    if (params.level) q.set('level', params.level)
    if (params.limit) q.set('limit', params.limit)
    const res = await fetch(`${API}/logs?${q}`)
    const data = await res.json()
    return data.data || []
  },

  appendLog: (log) => {
    if (get().logsPaused) return
    const filter = get().logFilter
    if (filter.service && log.service !== filter.service) return
    if (filter.level && log.level !== filter.level) return
    set((s) => ({
      recentLogs: [log, ...s.recentLogs].slice(0, 100),
    }))
  },

  appendMetric: (metric) => {},

  fetchIncidents: async (status, severity) => {
    try {
      const q = new URLSearchParams()
      if (status) q.set('status', status)
      if (severity) q.set('severity', severity)
      const res = await fetch(`${API}/incidents?${q}`)
      const data = await res.json()
      set({ incidents: data.incidents || [], incidentCount: data.count || 0 })
    } catch (e) {
      console.error('Incidents fetch error:', e)
    }
  },

  fetchIncident: async (id) => {
    try {
      const res = await fetch(`${API}/incidents/${id}`)
      const data = await res.json()
      set({ currentIncident: data })
      return data
    } catch (e) {
      console.error('Incident fetch error:', e)
      return null
    }
  },

  createIncident: async (title, severity, affectedServices, description) => {
    const res = await fetch(`${API}/incidents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, severity, affected_services: affectedServices, description }),
    })
    const data = await res.json()
    get().fetchIncidents()
    return data
  },

  updateIncidentStatus: async (id, status) => {
    await fetch(`${API}/incidents/${id}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    get().fetchIncident(id)
  },

  resolveIncident: async (id, resolution) => {
    await fetch(`${API}/incidents/${id}/resolve`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resolution }),
    })
    get().fetchIncident(id)
  },

  analyzeIncident: async (id) => {
    const res = await fetch(`${API}/incidents/${id}/analyze`, { method: 'POST' })
    const data = await res.json()
    get().fetchIncident(id)
    return data
  },

  fetchCorrelations: async () => {
    try {
      const res = await fetch(`${API}/correlations`)
      const data = await res.json()
      set({ correlations: data.correlations || [] })
    } catch (e) {
      console.error('Correlations fetch error:', e)
    }
  },

  syntheticChecks: [],

  fetchSyntheticChecks: async () => {
    try {
      const res = await fetch(`${API}/synthetic`)
      const data = await res.json()
      set({ syntheticChecks: data.checks || [] })
    } catch (e) {
      console.error('Synthetic checks fetch error:', e)
    }
  },

  createSyntheticCheck: async (payload) => {
    const res = await fetch(`${API}/synthetic`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    await get().fetchSyntheticChecks()
    return res.json()
  },

  runSyntheticCheck: async (checkId) => {
    const res = await fetch(`${API}/synthetic/${checkId}/run`, { method: 'POST' })
    return res.json()
  },

  toggleSyntheticCheck: async (checkId, enabled) => {
    await fetch(`${API}/synthetic/${checkId}/toggle?enabled=${enabled}`, { method: 'PUT' })
    await get().fetchSyntheticChecks()
  },

  catalogEntries: [],
  catalogFacets: { teams: [], tiers: [], lifecycles: [] },
  catalogStats: null,

  fetchCatalog: async (filters = {}) => {
    try {
      const params = new URLSearchParams(
        Object.entries(filters).filter(([, v]) => v)
      ).toString()
      const res = await fetch(`${API}/catalog${params ? `?${params}` : ''}`)
      const data = await res.json()
      set({ catalogEntries: data.entries || [] })
    } catch (e) {
      console.error('Catalog fetch error:', e)
    }
  },

  fetchCatalogFacets: async () => {
    try {
      const res = await fetch(`${API}/catalog/facets`)
      set({ catalogFacets: await res.json() })
    } catch (e) {
      console.error('Catalog facets error:', e)
    }
  },

  fetchCatalogStats: async () => {
    try {
      const res = await fetch(`${API}/catalog/stats`)
      set({ catalogStats: await res.json() })
    } catch (e) {
      console.error('Catalog stats error:', e)
    }
  },

  saveCatalogEntry: async (payload) => {
    await fetch(`${API}/catalog`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    await Promise.all([get().fetchCatalog(), get().fetchCatalogFacets(), get().fetchCatalogStats()])
  },

  deleteCatalogEntry: async (service) => {
    await fetch(`${API}/catalog/${service}`, { method: 'DELETE' })
    await Promise.all([get().fetchCatalog(), get().fetchCatalogStats()])
  },
}))

export default useStore
