import { useEffect, useState } from 'react'
import { Flame, Play, Square, Clock, AlertTriangle } from 'lucide-react'

export default function ChaosPanel() {
  const [scenarios, setScenarios] = useState([])
  const [status, setStatus] = useState({ running: false })
  const [loading, setLoading] = useState(null)

  useEffect(() => {
    fetch('/api/chaos/scenarios').then(r => r.json()).then(d => setScenarios(d.scenarios || []))
    const poll = setInterval(() => {
      fetch('/api/chaos/scenarios/status').then(r => r.json()).then(d => setStatus(d))
    }, 5000)
    return () => clearInterval(poll)
  }, [])

  const runScenario = async (id) => {
    setLoading(id)
    await fetch(`/api/chaos/scenarios/${id}/run`, { method: 'POST' })
    setLoading(null)
    fetch('/api/chaos/scenarios/status').then(r => r.json()).then(d => setStatus(d))
  }

  const stopScenario = async () => {
    await fetch('/api/chaos/scenarios/stop', { method: 'POST' })
    setStatus({ running: false })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <Flame className="w-5 h-5 text-orange-400" /> Chaos Scenarios
        </h2>
        {status.running && (
          <button
            onClick={stopScenario}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/15 text-red-400 rounded-lg text-xs font-medium hover:bg-red-500/25 transition-colors"
          >
            <Square className="w-3 h-3" /> Stop Scenario
          </button>
        )}
      </div>

      {status.running && (
        <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-4 h-4 text-orange-400 animate-pulse" />
            <span className="text-sm font-medium text-orange-300">Scenario Running: {status.title}</span>
          </div>
          <p className="text-xs text-orange-400/70">{status.description}</p>
          <div className="flex items-center gap-1 mt-2 text-xs text-orange-400/50">
            <Clock className="w-3 h-3" /> Duration: {status.duration_minutes} minutes
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {scenarios.map((s) => (
          <div key={s.id} className="bg-[#111827] border border-gray-700/50 rounded-lg p-4 hover:border-gray-600 transition-colors">
            <h3 className="text-sm font-medium text-white mb-2">{s.title}</h3>
            <p className="text-xs text-gray-400 mb-3 leading-relaxed">{s.description}</p>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500 flex items-center gap-1">
                <Clock className="w-3 h-3" /> {s.duration_minutes} min
              </span>
              <button
                onClick={() => runScenario(s.id)}
                disabled={status.running || loading === s.id}
                className="flex items-center gap-1 px-3 py-1.5 bg-orange-500/15 text-orange-400 rounded text-xs font-medium hover:bg-orange-500/25 transition-colors disabled:opacity-50"
              >
                <Play className="w-3 h-3" /> {loading === s.id ? 'Starting...' : 'Run'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
