import { useState, useEffect } from 'react'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, ReferenceArea,
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
  const p = payload[0]
  return (
    <div className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-xs shadow-lg">
      <p className="text-gray-400 mb-1">{label}</p>
      <p className="text-white font-medium">{p.value?.toFixed(2)}</p>
      {p.payload?.anomaly && (
        <p className="text-red-400 font-medium mt-0.5">Anomaly detected</p>
      )}
    </div>
  )
}

function MetricChart({ config }) {
  const [data, setData] = useState([])
  const [anomalyRegions, setAnomalyRegions] = useState([])
  const [deployLines, setDeployLines] = useState([])
  const fetchMetrics = useStore((s) => s.fetchMetrics)
  const timeRange = useStore((s) => s.timeRange)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const raw = await fetchMetrics(config.service, config.metric, timeRange)
      if (cancelled) return

      let anomalies = []
      try {
        const res = await fetch(`/api/anomalies/${config.service}`)
        const ad = await res.json()
        anomalies = (ad.anomalies || []).flatMap(r =>
          (r.anomalies || [])
            .filter(a => a.metric_name === config.metric)
            .map(a => a.timestamp)
        )
      } catch {}

      const trMap = { '15m': 0.25, '1h': 1, '6h': 6, '24h': 24, '7d': 168 }
      const hours = trMap[timeRange] || 1
      try {
        const dRes = await fetch(`/api/deploys/chart/${config.service}?hours=${hours}`)
        const dd = await dRes.json()
        if (!cancelled) {
          setDeployLines((dd.deploys || []).map(d => ({
            time: format(new Date(d.timestamp), 'HH:mm'),
            version: d.version,
            status: d.status,
          })))
        }
      } catch {}

      const anomalySet = new Set(anomalies)
      const points = raw.map((p) => {
        const t = format(new Date(p.timestamp), 'HH:mm')
        return {
          time: t,
          value: p.value,
          anomaly: anomalySet.has(p.timestamp) || (config.threshold && p.value > config.threshold * 1.5),
        }
      })
      if (!cancelled) {
        setData(points)
        const regions = []
        let regionStart = null
        for (const p of points) {
          if (p.anomaly && !regionStart) {
            regionStart = p.time
          } else if (!p.anomaly && regionStart) {
            regions.push({ x1: regionStart, x2: p.time })
            regionStart = null
          }
        }
        if (regionStart) {
          regions.push({ x1: regionStart, x2: points[points.length - 1].time })
        }
        setAnomalyRegions(regions)
      }
    }
    load()
    const interval = setInterval(load, 15000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [config.service, config.metric, timeRange, fetchMetrics, config.threshold])

  const hasAnomaly = anomalyRegions.length > 0

  return (
    <div className={`bg-[#111827] border rounded-lg p-4 ${hasAnomaly ? 'border-red-500/30' : 'border-gray-700/50'}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium text-gray-300">{config.title}</h3>
          {hasAnomaly && (
            <span className="px-1.5 py-0.5 bg-red-500/15 text-red-400 text-xs rounded font-medium animate-pulse-dot">
              ANOMALY
            </span>
          )}
        </div>
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
              {anomalyRegions.map((r, i) => (
                <ReferenceArea
                  key={i}
                  x1={r.x1}
                  x2={r.x2}
                  fill="#EF4444"
                  fillOpacity={0.1}
                  stroke="#EF4444"
                  strokeOpacity={0.3}
                />
              ))}
              {deployLines.map((d, i) => (
                <ReferenceLine
                  key={`deploy-${i}`}
                  x={d.time}
                  stroke="#06B6D4"
                  strokeDasharray="3 3"
                  strokeWidth={1.5}
                  label={{ value: `▲ ${d.version}`, position: 'top', fontSize: 9, fill: '#06B6D4' }}
                />
              ))}
              <Line
                type="monotone"
                dataKey="value"
                stroke={config.color}
                strokeWidth={2}
                dot={(props) => {
                  if (props.payload?.anomaly) {
                    return (
                      <circle
                        key={props.key}
                        cx={props.cx}
                        cy={props.cy}
                        r={4}
                        fill="#EF4444"
                        stroke="#EF4444"
                        strokeWidth={2}
                      />
                    )
                  }
                  return null
                }}
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
