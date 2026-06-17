import { useState, useEffect } from 'react'
import { CheckCircle, AlertTriangle, XCircle, MinusCircle, RefreshCw, ExternalLink, Clock } from 'lucide-react'
import { format } from 'date-fns'

const STATUS_CONFIG = {
  operational: { icon: CheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-500', label: 'Operational', banner: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' },
  degraded: { icon: MinusCircle, color: 'text-amber-400', bg: 'bg-amber-500', label: 'Degraded Performance', banner: 'bg-amber-500/10 border-amber-500/30 text-amber-400' },
  partial_outage: { icon: AlertTriangle, color: 'text-orange-400', bg: 'bg-orange-500', label: 'Partial Outage', banner: 'bg-orange-500/10 border-orange-500/30 text-orange-400' },
  major_outage: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-500', label: 'Major Outage', banner: 'bg-red-500/10 border-red-500/30 text-red-400' },
}

function UptimeBar({ history }) {
  if (!history || history.length === 0) return null
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-gray-500">30-day uptime</span>
        <span className="text-xs text-gray-400">
          {history.length > 0 ? (history.reduce((s, d) => s + d.uptime_pct, 0) / history.length).toFixed(2) : '100.00'}%
        </span>
      </div>
      <div className="flex gap-px">
        {history.map((day, i) => {
          const color = day.uptime_pct >= 99.9 ? 'bg-emerald-500' :
                        day.uptime_pct >= 99 ? 'bg-amber-500' :
                        day.uptime_pct >= 95 ? 'bg-orange-500' : 'bg-red-500'
          return (
            <div key={i} className="group relative flex-1">
              <div className={`h-8 rounded-sm ${day.data_points === 0 ? 'bg-gray-700' : color} hover:opacity-80 cursor-pointer`} />
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10">
                <div className="bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs whitespace-nowrap shadow-xl">
                  <p className="text-white font-medium">{day.date}</p>
                  <p className="text-gray-400">{day.uptime_pct.toFixed(2)}% uptime</p>
                  {day.incidents > 0 && <p className="text-amber-400">{day.incidents} incident{day.incidents > 1 ? 's' : ''}</p>}
                </div>
              </div>
            </div>
          )
        })}
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-xs text-gray-600">30 days ago</span>
        <span className="text-xs text-gray-600">Today</span>
      </div>
    </div>
  )
}

export default function StatusPage() {
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchStatus = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/status')
      const data = await res.json()
      setStatus(data)
    } catch {}
    setLoading(false)
  }

  useEffect(() => {
    fetchStatus()
    const interval = setInterval(fetchStatus, 30000)
    return () => clearInterval(interval)
  }, [])

  if (!status && loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="w-6 h-6 text-gray-500 animate-spin" />
      </div>
    )
  }

  const overall = STATUS_CONFIG[status?.overall_status] || STATUS_CONFIG.operational
  const OverallIcon = overall.icon

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-white mb-1">SentinelAI Status</h1>
        <p className="text-sm text-gray-500">Real-time system status and uptime</p>
      </div>

      <div className={`border rounded-xl p-6 text-center ${overall.banner}`}>
        <OverallIcon className="w-8 h-8 mx-auto mb-2" />
        <h2 className="text-lg font-semibold">{overall.label}</h2>
        <p className="text-xs opacity-70 mt-1">
          Last updated: {status?.last_updated ? format(new Date(status.last_updated), 'MMM d, HH:mm:ss') : 'Unknown'}
        </p>
      </div>

      {status?.active_incidents?.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-white">Active Incidents</h3>
          {status.active_incidents.map((inc) => (
            <div key={inc.id} className="bg-[#111827] border border-amber-500/30 rounded-lg p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-white">{inc.title}</span>
                <span className={`px-2 py-0.5 text-xs rounded font-medium ${
                  inc.severity === 'P1' ? 'bg-red-500/15 text-red-400' : 'bg-amber-500/15 text-amber-400'
                }`}>{inc.severity}</span>
              </div>
              {inc.summary && <p className="text-xs text-gray-400 mb-1">{inc.summary}</p>}
              <div className="flex items-center gap-3 text-xs text-gray-500">
                <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {inc.status}</span>
                {inc.started_at && <span>{format(new Date(inc.started_at), 'MMM d, HH:mm')}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-2">
        <h3 className="text-sm font-medium text-white">Service Status</h3>
        {(status?.services || []).map((svc) => {
          const cfg = STATUS_CONFIG[svc.status] || STATUS_CONFIG.operational
          const Icon = cfg.icon
          return (
            <div key={svc.service} className="flex items-center justify-between bg-[#111827] border border-gray-700/50 rounded-lg px-4 py-3">
              <div className="flex items-center gap-3">
                <Icon className={`w-4 h-4 ${cfg.color}`} />
                <span className="text-sm text-white">{svc.service}</span>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <span className="text-gray-500">err: {svc.avg_error_rate}/s</span>
                <span className="text-gray-500">p95: {svc.avg_latency_ms}ms</span>
                <span className={`px-2 py-0.5 rounded ${cfg.color} ${cfg.bg}/15`}>{cfg.label}</span>
              </div>
            </div>
          )
        })}
      </div>

      <div className="bg-[#111827] border border-gray-700/50 rounded-lg p-4">
        <UptimeBar history={status?.uptime_history || []} />
      </div>

      <div className="text-center text-xs text-gray-600 pb-8">
        Powered by SentinelAI &middot; Auto-refreshes every 30s
      </div>
    </div>
  )
}
