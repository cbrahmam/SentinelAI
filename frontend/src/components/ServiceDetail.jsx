import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  ArrowLeft, Cpu, HardDrive, AlertTriangle, Clock, Activity, Wifi, User, Users, Phone,
} from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { format, formatDistanceToNow } from 'date-fns'
import useStore from '../stores/useStore'

const STATUS_COLORS = {
  healthy: 'bg-emerald-500/20 text-emerald-400',
  warning: 'bg-amber-500/20 text-amber-400',
  critical: 'bg-red-500/20 text-red-400',
}

const CORE_METRICS = [
  { key: 'cpu_usage', label: 'CPU Usage', color: '#10B981', unit: '%', threshold: 80 },
  { key: 'memory_usage', label: 'Memory Usage', color: '#8B5CF6', unit: '%', threshold: 75 },
  { key: 'request_rate', label: 'Request Rate', color: '#06B6D4', unit: 'req/s' },
  { key: 'error_rate', label: 'Error Rate', color: '#EF4444', unit: '/s', threshold: 5 },
  { key: 'p95_latency_ms', label: 'P95 Latency', color: '#F59E0B', unit: 'ms', threshold: 500 },
  { key: 'active_connections', label: 'Connections', color: '#EC4899', unit: '' },
]

function MetricCard({ icon: Icon, label, value, unit, warn }) {
  return (
    <div className={`bg-gray-800/50 rounded-lg p-3 border ${warn ? 'border-amber-500/30' : 'border-gray-700/50'}`}>
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`w-3.5 h-3.5 ${warn ? 'text-amber-400' : 'text-gray-500'}`} />
        <span className="text-xs text-gray-400">{label}</span>
      </div>
      <span className={`text-lg font-semibold ${warn ? 'text-amber-300' : 'text-white'}`}>
        {value != null ? `${Number(value).toFixed(1)}${unit}` : '--'}
      </span>
    </div>
  )
}

function ServiceChart({ service, metricName, color, threshold, unit }) {
  const [data, setData] = useState([])
  const fetchMetrics = useStore((s) => s.fetchMetrics)

  useEffect(() => {
    let cancelled = false
    fetchMetrics(service, metricName, '6h').then((raw) => {
      if (!cancelled) {
        setData(raw.map((p) => ({
          time: format(new Date(p.timestamp), 'HH:mm'),
          value: p.value,
        })))
      }
    })
    const interval = setInterval(() => {
      fetchMetrics(service, metricName, '6h').then((raw) => {
        if (!cancelled) {
          setData(raw.map((p) => ({
            time: format(new Date(p.timestamp), 'HH:mm'),
            value: p.value,
          })))
        }
      })
    }, 30000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [service, metricName, fetchMetrics])

  return (
    <div className="bg-[#111827] border border-gray-700/50 rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-gray-300">{metricName.replace(/_/g, ' ')}</span>
        {unit && <span className="text-xs text-gray-500">{unit}</span>}
      </div>
      <div className="h-32">
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <XAxis dataKey="time" tick={{ fontSize: 9, fill: '#6B7280' }} axisLine={{ stroke: '#374151' }} tickLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 9, fill: '#6B7280' }} axisLine={false} tickLine={false} width={35} />
              <Tooltip contentStyle={{ background: '#1F2937', border: '1px solid #374151', borderRadius: '6px', fontSize: '11px' }} />
              {threshold && <ReferenceLine y={threshold} stroke="#F59E0B" strokeDasharray="4 4" strokeWidth={1} />}
              <Line type="monotone" dataKey="value" stroke={color} strokeWidth={1.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center text-gray-500 text-xs">No data</div>
        )}
      </div>
    </div>
  )
}

export default function ServiceDetail() {
  const { name } = useParams()
  const [detail, setDetail] = useState(null)
  const [catalog, setCatalog] = useState(null)
  const [logs, setLogs] = useState([])
  const [activeTab, setActiveTab] = useState('metrics')

  useEffect(() => {
    setCatalog(null)
    fetch(`/api/catalog/${name}`)
      .then(r => (r.ok ? r.json() : null))
      .then(setCatalog)
      .catch(() => {})
  }, [name])

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/services/${name}`)
        const data = await res.json()
        setDetail(data)
      } catch (e) {
        console.error('Service detail error:', e)
      }
    }
    load()
    const interval = setInterval(load, 15000)
    return () => clearInterval(interval)
  }, [name])

  useEffect(() => {
    if (activeTab === 'logs') {
      fetch(`/api/logs?service=${name}&limit=100`)
        .then(r => r.json())
        .then(d => setLogs(d.data || []))
    }
  }, [name, activeTab])

  if (!detail) {
    return <div className="flex items-center justify-center h-64 text-gray-400">Loading service...</div>
  }

  const m = detail.metrics || {}

  return (
    <div className="space-y-4">
      <Link to="/map" className="inline-flex items-center gap-1.5 text-gray-400 hover:text-white text-sm transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Service Map
      </Link>

      <div className="bg-[#111827] border border-gray-700/50 rounded-lg p-5">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold text-white">{detail.name}</h1>
          <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[detail.status] || 'bg-gray-500/20 text-gray-400'}`}>
            {detail.status}
          </span>
        </div>
        <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
          <span>Depends on: {detail.dependencies?.depends_on?.join(', ') || 'none'}</span>
          <span>Depended by: {detail.dependencies?.depended_by?.join(', ') || 'none'}</span>
        </div>
        {catalog && (
          <div className="flex flex-wrap items-center gap-4 mt-3 pt-3 border-t border-gray-800 text-xs">
            <span className={`px-2 py-0.5 rounded font-medium ${
              catalog.tier === 'tier-1' ? 'bg-red-500/15 text-red-400' :
              catalog.tier === 'tier-2' ? 'bg-amber-500/15 text-amber-400' : 'bg-sky-500/15 text-sky-400'
            }`}>{catalog.tier}</span>
            <span className="flex items-center gap-1.5 text-gray-300"><Users className="w-3.5 h-3.5 text-gray-500" /> {catalog.team || '—'}</span>
            <span className="flex items-center gap-1.5 text-gray-300"><User className="w-3.5 h-3.5 text-gray-500" /> {catalog.owner || 'unowned'}</span>
            <span className="flex items-center gap-1.5 text-gray-300"><Phone className="w-3.5 h-3.5 text-gray-500" /> {catalog.on_call || '—'}</span>
            <Link to="/catalog" className="text-violet-400 hover:text-violet-300 ml-auto">View in catalog →</Link>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        <MetricCard icon={Cpu} label="CPU" value={m.cpu_usage} unit="%" warn={m.cpu_usage > 80} />
        <MetricCard icon={HardDrive} label="Memory" value={m.memory_usage} unit="%" warn={m.memory_usage > 75} />
        <MetricCard icon={Activity} label="Req Rate" value={m.request_rate} unit="/s" />
        <MetricCard icon={AlertTriangle} label="Error Rate" value={m.error_rate} unit="/s" warn={m.error_rate > 5} />
        <MetricCard icon={Clock} label="P95 Latency" value={m.p95_latency_ms} unit="ms" warn={m.p95_latency_ms > 500} />
        <MetricCard icon={Wifi} label="Connections" value={m.active_connections} unit="" />
      </div>

      <div className="flex gap-1 bg-gray-800/50 rounded-lg p-0.5">
        {['metrics', 'logs', 'alerts', 'anomalies'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 px-3 py-2 text-xs font-medium rounded-md transition-colors ${
              activeTab === tab ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {activeTab === 'metrics' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {(detail.metric_names || []).map((mn) => {
            const cfg = CORE_METRICS.find(c => c.key === mn) || {}
            return (
              <ServiceChart
                key={mn}
                service={name}
                metricName={mn}
                color={cfg.color || '#06B6D4'}
                threshold={cfg.threshold}
                unit={cfg.unit || ''}
              />
            )
          })}
        </div>
      )}

      {activeTab === 'logs' && (
        <div className="bg-[#111827] border border-gray-700/50 rounded-lg p-4">
          <div className="h-96 overflow-y-auto font-mono text-xs leading-relaxed space-y-0.5">
            {logs.length === 0 ? (
              <div className="text-gray-500 text-center py-8">No logs for this service.</div>
            ) : logs.map((log, i) => {
              const levelColors = { debug: 'text-gray-500', info: 'text-gray-300', warn: 'text-amber-400', error: 'text-red-400', fatal: 'text-red-300' }
              let ts = ''
              try { ts = format(new Date(log.timestamp), 'HH:mm:ss') } catch { ts = '--' }
              return (
                <div key={i} className="flex gap-2 py-0.5 hover:bg-gray-800/50 rounded px-1">
                  <span className="text-gray-600 shrink-0">{ts}</span>
                  <span className={`uppercase w-12 shrink-0 font-medium ${levelColors[log.level] || 'text-gray-400'}`}>{log.level}</span>
                  <span className={levelColors[log.level] || 'text-gray-300'}>{log.message}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {activeTab === 'alerts' && (
        <div className="bg-[#111827] border border-gray-700/50 rounded-lg p-4">
          {(!detail.alerts || detail.alerts.length === 0) ? (
            <div className="text-gray-500 text-center py-8 text-sm">No alerts for this service.</div>
          ) : (
            <div className="space-y-2">
              {detail.alerts.map((a) => (
                <div key={a.id} className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm ${
                  a.severity === 'critical' ? 'bg-red-500/10 border border-red-500/30' : 'bg-amber-500/10 border border-amber-500/30'
                }`}>
                  <div className="flex items-center gap-2">
                    <AlertTriangle className={`w-3.5 h-3.5 ${a.severity === 'critical' ? 'text-red-400' : 'text-amber-400'}`} />
                    <span className="text-gray-200 text-xs">{a.title}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-1.5 py-0.5 rounded text-xs ${a.status === 'firing' ? 'bg-red-500/20 text-red-300' : a.status === 'resolved' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-gray-500/20 text-gray-300'}`}>
                      {a.status}
                    </span>
                    <span className="text-xs text-gray-500">{a.fired_at ? formatDistanceToNow(new Date(a.fired_at), { addSuffix: true }) : ''}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'anomalies' && (
        <div className="bg-[#111827] border border-gray-700/50 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-300 mb-3">Anomaly History</h3>
          {(!detail.anomaly_history || detail.anomaly_history.length === 0) ? (
            <div className="text-gray-500 text-center py-8 text-sm">No anomaly history for this service.</div>
          ) : (
            <div className="space-y-1.5">
              {detail.anomaly_history.map((h, i) => (
                <div key={i} className="flex items-center justify-between px-3 py-2 bg-gray-800/50 rounded text-xs">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${h.max_severity === 'critical' ? 'bg-red-400' : 'bg-amber-400'}`} />
                    <span className="text-gray-200">{h.metric_name}</span>
                    <span className="text-gray-500">{h.detection_method}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400">{h.anomaly_count} points</span>
                    <span className="text-gray-500">{h.detected_at ? format(new Date(h.detected_at), 'HH:mm:ss') : ''}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
