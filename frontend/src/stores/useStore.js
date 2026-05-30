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

  appendMetric: (metric) => {
    // Metrics are handled by individual chart components
  },
}))

export default useStore
