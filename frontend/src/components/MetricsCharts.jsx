import { useState, useEffect } from 'react'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { format } from 'date-fns'
import useStore from '../stores/useStore'

const CHART_CONFIGS = [
  { title: 'Request Rate', service: 'api-gateway', metric: 'request_rate', color: '#06B6D4', unit: 'req/s' },
  { title: 'Error Rate', service: 'api-gateway', metric: 'error_rate', color: '#EF4444', unit: '/s', threshold: 5 },
  { title: 'P95 Latency', service: 'api-gateway', metric: 'p95_latency_ms', color: '#8B5CF6', unit: 'ms', threshold: 500 },
  { title: 'System CPU', service: 'api-gateway', metric: 'cpu_usage', color: '#10B981', unit: '%', threshold: 80 },
]

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null
  return (
    <div className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-xs shadow-lg">
      <p className="text-gray-400 mb-1">{label}</p>
      <p className="text-white font-medium">{payload[0].value?.toFixed(2)}</p>
    </div>
  )
}

function MetricChart({ config }) {
  const [data, setData] = useState([])
  const fetchMetrics = useStore((s) => s.fetchMetrics)
  const timeRange = useStore((s) => s.timeRange)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const raw = await fetchMetrics(config.service, config.metric, timeRange)
      if (!cancelled) {
        setData(raw.map((p) => ({
          time: format(new Date(p.timestamp), 'HH:mm'),
          value: p.value,
        })))
      }
    }
    load()
    const interval = setInterval(load, 15000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [config.service, config.metric, timeRange, fetchMetrics])

  return (
    <div className="bg-[#111827] border border-gray-700/50 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-gray-300">{config.title}</h3>
        <span className="text-xs text-gray-500">{config.service}</span>
      </div>
      <div className="h-44">
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <XAxis
                dataKey="time"
                tick={{ fontSize: 10, fill: '#6B7280' }}
                axisLine={{ stroke: '#374151' }}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 10, fill: '#6B7280' }}
                axisLine={false}
                tickLine={false}
                width={40}
              />
              <Tooltip content={<CustomTooltip />} />
              {config.threshold && (
                <ReferenceLine
                  y={config.threshold}
                  stroke="#F59E0B"
                  strokeDasharray="4 4"
                  strokeWidth={1}
                />
              )}
              <Line
                type="monotone"
                dataKey="value"
                stroke={config.color}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: config.color }}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center text-gray-500 text-sm">
            No data available
          </div>
        )}
      </div>
    </div>
  )
}

export default function MetricsCharts() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
      {CHART_CONFIGS.map((config) => (
        <MetricChart key={`${config.service}-${config.metric}`} config={config} />
      ))}
    </div>
  )
}
