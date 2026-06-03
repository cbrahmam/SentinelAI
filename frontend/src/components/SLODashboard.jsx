import { useEffect, useState } from 'react'
import { Shield, Clock, AlertTriangle, CheckCircle2 } from 'lucide-react'

const WINDOW_OPTIONS = [
  { label: '1h', value: 1 },
  { label: '6h', value: 6 },
  { label: '24h', value: 24 },
  { label: '7d', value: 168 },
  { label: '30d', value: 720 },
]

function BudgetBar({ pct, meeting }) {
  const color = pct > 50 ? 'bg-emerald-500' : pct > 20 ? 'bg-amber-500' : 'bg-red-500'
  return (
    <div className="w-full bg-gray-800 rounded-full h-2.5">
      <div
        className={`h-2.5 rounded-full transition-all duration-500 ${color}`}
        style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
      />
    </div>
  )
}

export default function SLODashboard() {
  const [slos, setSlos] = useState([])
  const [window, setWindow] = useState(24)

  useEffect(() => {
    const load = () => {
      fetch(`/api/slo?window_hours=${window}`)
        .then(r => r.json())
        .then(d => setSlos(d.slos || []))
        .catch(console.error)
    }
    load()
    const interval = setInterval(load, 30000)
    return () => clearInterval(interval)
  }, [window])

  const meetingCount = slos.filter(s => s.meeting_slo).length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <Shield className="w-5 h-5 text-cyan-400" /> SLO & Error Budgets
        </h2>
        <div className="flex items-center gap-3">
          {slos.length > 0 && (
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
              meetingCount === slos.length ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'
            }`}>
              {meetingCount}/{slos.length} meeting SLO
            </span>
          )}
          <div className="flex bg-gray-800 rounded-lg p-0.5">
            {WINDOW_OPTIONS.map((w) => (
              <button
                key={w.value}
                onClick={() => setWindow(w.value)}
                className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                  window === w.value ? 'bg-gray-600 text-white' : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                {w.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {slos.length === 0 ? (
        <div className="bg-[#111827] border border-gray-700/50 rounded-lg p-12 text-center">
          <Shield className="w-8 h-8 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">No SLO data available. Load demo data or start the simulator.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {slos.map((slo) => (
            <div
              key={slo.service}
              className={`bg-[#111827] border rounded-lg p-4 ${
                slo.meeting_slo ? 'border-gray-700/50' : 'border-red-500/30'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  {slo.meeting_slo
                    ? <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    : <AlertTriangle className="w-4 h-4 text-red-400" />
                  }
                  <span className="text-sm font-medium text-white">{slo.service}</span>
                </div>
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                  slo.meeting_slo ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'
                }`}>
                  {slo.meeting_slo ? 'Meeting SLO' : 'SLO Breach'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <span className="text-xs text-gray-500">Uptime</span>
                  <div className={`text-lg font-semibold ${
                    slo.current_uptime >= slo.slo_target ? 'text-emerald-400' : 'text-red-400'
                  }`}>
                    {slo.current_uptime.toFixed(2)}%
                  </div>
                  <span className="text-xs text-gray-500">Target: {slo.slo_target}%</span>
                </div>
                <div>
                  <span className="text-xs text-gray-500">Error Budget</span>
                  <div className={`text-lg font-semibold ${
                    slo.error_budget_remaining_pct > 50 ? 'text-emerald-400' :
                    slo.error_budget_remaining_pct > 20 ? 'text-amber-400' : 'text-red-400'
                  }`}>
                    {slo.error_budget_remaining_minutes.toFixed(1)}m
                  </div>
                  <span className="text-xs text-gray-500">of {slo.error_budget_total_minutes.toFixed(1)}m</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-400">Budget remaining</span>
                  <span className={`font-medium ${
                    slo.error_budget_remaining_pct > 50 ? 'text-emerald-400' :
                    slo.error_budget_remaining_pct > 20 ? 'text-amber-400' : 'text-red-400'
                  }`}>
                    {slo.error_budget_remaining_pct.toFixed(1)}%
                  </span>
                </div>
                <BudgetBar pct={slo.error_budget_remaining_pct} meeting={slo.meeting_slo} />
              </div>

              <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                <span>Errors: {slo.error_violations} violations</span>
                <span>Latency: {slo.latency_violations} violations</span>
                <span>{slo.total_data_points} data points</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
