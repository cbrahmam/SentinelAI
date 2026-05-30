import { useState, useEffect } from 'react'
import { Cpu, HardDrive, AlertTriangle, Clock } from 'lucide-react'
import { LineChart, Line, ResponsiveContainer } from 'recharts'
import useStore from '../stores/useStore'

const STATUS_COLORS = {
  healthy: { dot: 'bg-emerald-400', border: 'border-gray-700/50', glow: '' },
  warning: { dot: 'bg-amber-400 animate-pulse-dot', border: 'border-amber-500/30', glow: '' },
  critical: { dot: 'bg-red-400 animate-pulse-dot', border: 'animate-pulse-border', glow: '' },
}

function MetricBadge({ icon: Icon, label, value, unit, warn }) {
  return (
    <div className="flex items-center gap-1.5">
      <Icon className={`w-3 h-3 ${warn ? 'text-amber-400' : 'text-gray-500'}`} />
      <span className="text-xs text-gray-400">{label}</span>
      <span className={`text-xs font-medium ${warn ? 'text-amber-300' : 'text-gray-200'}`}>
        {value != null ? `${Number(value).toFixed(1)}${unit}` : '--'}
      </span>
    </div>
  )
}

function SparklineChart({ service, timeRange }) {
  const [data, setData] = useState([])
  const fetchMetrics = useStore((s) => s.fetchMetrics)

  useEffect(() => {
    let cancelled = false
    fetchMetrics(service, 'request_rate', timeRange).then((d) => {
      if (!cancelled) setData(d.map((p) => ({ v: p.value })))
    })
    return () => { cancelled = true }
  }, [service, timeRange, fetchMetrics])

  if (data.length < 2) return <div className="h-8" />

  return (
    <ResponsiveContainer width="100%" height={32}>
      <LineChart data={data}>
        <Line type="monotone" dataKey="v" stroke="#06B6D4" strokeWidth={1.5} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  )
}

export default function ServiceGrid() {
  const services = useStore((s) => s.services)
  const timeRange = useStore((s) => s.timeRange)

  if (!services || services.length === 0) {
    return (
      <div className="bg-[#111827] border border-gray-700/50 rounded-lg p-8 text-center">
        <p className="text-gray-400">No services detected. Start the simulator or load demo data.</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {services.map((svc) => {
        const st = STATUS_COLORS[svc.status] || STATUS_COLORS.healthy
        const m = svc.metrics || {}
        return (
          <div
            key={svc.name}
            className={`bg-[#111827] border ${st.border} rounded-lg p-4 hover:border-gray-600 transition-colors cursor-pointer`}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-white truncate">{svc.name}</span>
              <span className={`w-2.5 h-2.5 rounded-full ${st.dot}`} style={{ boxShadow: svc.status !== 'healthy' ? `0 0 6px ${svc.status === 'critical' ? '#EF4444' : '#F59E0B'}` : 'none' }} />
            </div>
            <div className="grid grid-cols-2 gap-y-1.5 mb-3">
              <MetricBadge icon={Cpu} label="CPU" value={m.cpu_usage} unit="%" warn={m.cpu_usage > 80} />
              <MetricBadge icon={HardDrive} label="Mem" value={m.memory_usage} unit="%" warn={m.memory_usage > 75} />
              <MetricBadge icon={AlertTriangle} label="Err" value={m.error_rate} unit="/s" warn={m.error_rate > 5} />
              <MetricBadge icon={Clock} label="P95" value={m.p95_latency_ms} unit="ms" warn={m.p95_latency_ms > 500} />
            </div>
            <SparklineChart service={svc.name} timeRange={timeRange} />
          </div>
        )
      })}
    </div>
  )
}
