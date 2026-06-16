import { useState, useEffect } from 'react'
import { TrendingUp, Clock, AlertTriangle, Activity, RefreshCw } from 'lucide-react'

function formatCountdown(seconds) {
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return `${h}h ${m}m`
}

function urgencyColor(seconds) {
  if (seconds < 600) return 'text-red-400 bg-red-500/15 border-red-500/30'
  if (seconds < 1800) return 'text-amber-400 bg-amber-500/15 border-amber-500/30'
  return 'text-cyan-400 bg-cyan-500/15 border-cyan-500/30'
}

function urgencyBadge(seconds) {
  if (seconds < 600) return { text: 'CRITICAL', color: 'bg-red-500/20 text-red-400' }
  if (seconds < 1800) return { text: 'WARNING', color: 'bg-amber-500/20 text-amber-400' }
  return { text: 'INFO', color: 'bg-cyan-500/20 text-cyan-400' }
}

function ConfidenceBar({ value }) {
  const pct = Math.round(value * 100)
  const color = pct > 70 ? 'bg-emerald-500' : pct > 40 ? 'bg-amber-500' : 'bg-gray-500'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-400 w-8">{pct}%</span>
    </div>
  )
}

export default function PredictiveAlerts() {
  const [predictions, setPredictions] = useState([])
  const [loading, setLoading] = useState(true)
  const [countdowns, setCountdowns] = useState({})

  const fetchPredictions = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/predictions')
      const data = await res.json()
      setPredictions(data.predictions || [])
      const initial = {}
      ;(data.predictions || []).forEach((p, i) => {
        initial[i] = p.seconds_until_breach
      })
      setCountdowns(initial)
    } catch {}
    setLoading(false)
  }

  useEffect(() => {
    fetchPredictions()
    const interval = setInterval(fetchPredictions, 30000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdowns(prev => {
        const next = { ...prev }
        for (const k in next) {
          if (next[k] > 0) next[k] = next[k] - 1
        }
        return next
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-amber-400" /> Predictive Alerts
          </h2>
          <span className="text-xs text-gray-500">{predictions.length} predictions</span>
        </div>
        <button onClick={fetchPredictions}
          className="flex items-center gap-1.5 px-3 py-2 bg-gray-800 text-gray-300 rounded-lg text-xs hover:bg-gray-700">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {predictions.length === 0 && !loading && (
        <div className="text-center py-16 text-gray-500">
          <Activity className="w-8 h-8 mx-auto mb-3 opacity-50" />
          <p className="text-sm">No predicted threshold breaches detected</p>
          <p className="text-xs mt-1 text-gray-600">All metrics are trending within safe ranges</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {predictions.map((p, i) => {
          const secs = countdowns[i] ?? p.seconds_until_breach
          const badge = urgencyBadge(secs)
          return (
            <div key={`${p.service}-${p.metric_name}-${i}`}
              className={`border rounded-lg p-4 ${urgencyColor(secs)}`}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-white">{p.service}</span>
                    <span className={`px-1.5 py-0.5 text-xs rounded font-medium ${badge.color}`}>{badge.text}</span>
                  </div>
                  <p className="text-xs text-gray-400">{p.metric_name.replace(/_/g, ' ')}</p>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-1 text-lg font-mono font-bold">
                    <Clock className="w-4 h-4" />
                    {formatCountdown(Math.max(0, secs))}
                  </div>
                  <p className="text-xs text-gray-500">until breach</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 mb-3">
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">Current</p>
                  <p className="text-sm font-mono text-white">{p.current_value}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">Threshold</p>
                  <p className="text-sm font-mono text-white">{p.threshold}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">Predicted</p>
                  <p className="text-sm font-mono text-white">{p.predicted_breach_value}</p>
                </div>
              </div>

              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-xs">
                  <span className={`flex items-center gap-1 ${p.trend === 'increasing' ? 'text-red-400' : 'text-emerald-400'}`}>
                    <TrendingUp className={`w-3 h-3 ${p.trend === 'decreasing' ? 'rotate-180' : ''}`} />
                    {p.trend} ({p.trend_slope > 0 ? '+' : ''}{p.trend_slope}/step)
                  </span>
                </div>
                <span className="text-xs text-gray-500">{p.data_points_used} data points</span>
              </div>

              <div>
                <p className="text-xs text-gray-500 mb-1">Confidence</p>
                <ConfidenceBar value={p.confidence} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
