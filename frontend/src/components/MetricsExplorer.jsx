import { useState, useEffect } from 'react'
import { Plus, X, BarChart3 } from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, ReferenceLine,
} from 'recharts'
import { format } from 'date-fns'
import useStore from '../stores/useStore'

const COLORS = ['#06B6D4', '#10B981', '#8B5CF6', '#EF4444', '#F59E0B', '#EC4899', '#3B82F6', '#F97316']
const SERVICES = [
  'api-gateway', 'auth-service', 'user-service', 'payment-service',
  'notification-service', 'postgres-primary', 'redis-cache', 'rabbitmq',
]
const TIME_RANGES = ['15m', '1h', '6h', '24h', '7d']

export default function MetricsExplorer() {
  const [series, setSeries] = useState([{ service: 'api-gateway', metric: 'cpu_usage', id: 1 }])
  const [timeRange, setTimeRange] = useState('1h')
  const [threshold, setThreshold] = useState('')
  const [chartData, setChartData] = useState([])
  const [availableMetrics, setAvailableMetrics] = useState({})
  const fetchMetrics = useStore((s) => s.fetchMetrics)
  let nextId = series.length + 1

  useEffect(() => {
    const load = async () => {
      const metricsMap = {}
      for (const svc of SERVICES) {
        try {
          const res = await fetch(`/api/services/${svc}/metrics`)
          const data = await res.json()
          metricsMap[svc] = data.metric_names || []
        } catch {
          metricsMap[svc] = []
        }
      }
      setAvailableMetrics(metricsMap)
    }
    load()
  }, [])

  useEffect(() => {
    const load = async () => {
      const allData = {}
      for (const s of series) {
        const key = `${s.service}/${s.metric}`
        try {
          const raw = await fetchMetrics(s.service, s.metric, timeRange)
          for (const p of raw) {
            const t = format(new Date(p.timestamp), 'HH:mm')
            if (!allData[t]) allData[t] = { time: t }
            allData[t][key] = p.value
          }
        } catch {}
      }
      setChartData(Object.values(allData).sort((a, b) => a.time.localeCompare(b.time)))
    }
    if (series.length > 0) load()
  }, [series, timeRange, fetchMetrics])

  const addSeries = () => {
    setSeries([...series, { service: 'api-gateway', metric: 'cpu_usage', id: ++nextId }])
  }

  const removeSeries = (id) => {
    setSeries(series.filter(s => s.id !== id))
  }

  const updateSeries = (id, field, value) => {
    setSeries(series.map(s => s.id === id ? { ...s, [field]: value } : s))
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Metrics Explorer</h2>
        <div className="flex items-center gap-3">
          <div className="flex bg-gray-800 rounded-lg p-0.5">
            {TIME_RANGES.map((tr) => (
              <button
                key={tr}
                onClick={() => setTimeRange(tr)}
                className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                  timeRange === tr ? 'bg-gray-600 text-white' : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                {tr}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-[#111827] border border-gray-700/50 rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-gray-400">Series</span>
          <button
            onClick={addSeries}
            className="flex items-center gap-1 px-2 py-1 bg-cyan-500/15 text-cyan-400 rounded text-xs hover:bg-cyan-500/25 transition-colors"
          >
            <Plus className="w-3 h-3" /> Add Series
          </button>
        </div>
        {series.map((s, i) => (
          <div key={s.id} className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
            <select
              value={s.service}
              onChange={(e) => updateSeries(s.id, 'service', e.target.value)}
              className="bg-gray-800 text-gray-300 text-xs rounded px-2 py-1.5 border border-gray-700 outline-none"
            >
              {SERVICES.map(svc => <option key={svc} value={svc}>{svc}</option>)}
            </select>
            <select
              value={s.metric}
              onChange={(e) => updateSeries(s.id, 'metric', e.target.value)}
              className="bg-gray-800 text-gray-300 text-xs rounded px-2 py-1.5 border border-gray-700 outline-none flex-1"
            >
              {(availableMetrics[s.service] || ['cpu_usage', 'memory_usage', 'request_rate', 'error_rate', 'p95_latency_ms']).map(m => (
                <option key={m} value={m}>{m.replace(/_/g, ' ')}</option>
              ))}
            </select>
            {series.length > 1 && (
              <button onClick={() => removeSeries(s.id)} className="text-gray-500 hover:text-red-400 transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ))}
        <div className="flex items-center gap-2 pt-2 border-t border-gray-700/50">
          <span className="text-xs text-gray-500">Threshold line:</span>
          <input
            type="number"
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
            placeholder="e.g. 80"
            className="bg-gray-800 text-gray-300 text-xs rounded px-2 py-1.5 border border-gray-700 outline-none w-24"
          />
        </div>
      </div>

      <div className="bg-[#111827] border border-gray-700/50 rounded-lg p-4">
        <div className="h-96">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#6B7280' }} axisLine={{ stroke: '#374151' }} tickLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10, fill: '#6B7280' }} axisLine={false} tickLine={false} width={50} />
                <Tooltip contentStyle={{ background: '#1F2937', border: '1px solid #374151', borderRadius: '6px', fontSize: '11px' }} />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                {threshold && <ReferenceLine y={Number(threshold)} stroke="#F59E0B" strokeDasharray="4 4" label={{ value: threshold, fill: '#F59E0B', fontSize: 10 }} />}
                {series.map((s, i) => (
                  <Line
                    key={s.id}
                    type="monotone"
                    dataKey={`${s.service}/${s.metric}`}
                    name={`${s.service} - ${s.metric}`}
                    stroke={COLORS[i % COLORS.length]}
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-gray-500">
              <BarChart3 className="w-8 h-8 mb-2" />
              <p className="text-sm">Select metrics to visualize</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
