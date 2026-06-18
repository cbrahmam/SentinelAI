import { useState, useEffect } from 'react'
import { Fingerprint, RefreshCw, ChevronDown, ChevronRight, BookOpen, AlertTriangle, Percent } from 'lucide-react'

const PATTERN_COLORS = {
  memory_leak: 'text-purple-400 bg-purple-500/15 border-purple-500/30',
  cpu_saturation: 'text-red-400 bg-red-500/15 border-red-500/30',
  error_storm: 'text-orange-400 bg-orange-500/15 border-orange-500/30',
  latency_degradation: 'text-amber-400 bg-amber-500/15 border-amber-500/30',
  cascade_failure: 'text-rose-400 bg-rose-500/15 border-rose-500/30',
  connection_exhaustion: 'text-cyan-400 bg-cyan-500/15 border-cyan-500/30',
}

function ConfidenceBar({ value }) {
  const color = value >= 85 ? 'bg-emerald-500' : value >= 70 ? 'bg-cyan-500' : value >= 50 ? 'bg-amber-500' : 'bg-red-500'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs font-mono text-gray-400 w-10 text-right">{value}%</span>
    </div>
  )
}

export default function AnomalyFingerprints() {
  const [data, setData] = useState(null)
  const [patterns, setPatterns] = useState([])
  const [loading, setLoading] = useState(true)
  const [hours, setHours] = useState(24)
  const [expanded, setExpanded] = useState(null)
  const [tab, setTab] = useState('fingerprints')

  const fetchFingerprints = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/fingerprints?hours=${hours}`)
      const d = await res.json()
      setData(d)
    } catch {}
    setLoading(false)
  }

  const fetchPatterns = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/fingerprints/patterns')
      const d = await res.json()
      setPatterns(d.patterns || [])
    } catch {}
    setLoading(false)
  }

  useEffect(() => {
    fetchFingerprints()
    fetchPatterns()
  }, [hours])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white flex items-center gap-2">
          <Fingerprint className="w-5 h-5 text-purple-400" /> Anomaly Fingerprinting
        </h2>
        <div className="flex items-center gap-3">
          <select value={hours} onChange={e => setHours(Number(e.target.value))}
            className="bg-gray-800 text-gray-300 text-xs rounded-lg px-3 py-2 border border-gray-700">
            <option value={6}>Last 6 hours</option>
            <option value={24}>Last 24 hours</option>
            <option value={72}>Last 3 days</option>
            <option value={168}>Last 7 days</option>
          </select>
          <button onClick={fetchFingerprints}
            className="flex items-center gap-1.5 px-3 py-2 bg-gray-800 text-gray-300 rounded-lg text-xs hover:bg-gray-700">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      {data && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-[#111827] border border-gray-700/50 rounded-lg p-4">
            <p className="text-xs text-gray-500 mb-1">Total Alerts</p>
            <p className="text-2xl font-bold text-white">{data.total_alerts}</p>
          </div>
          <div className="bg-[#111827] border border-gray-700/50 rounded-lg p-4">
            <p className="text-xs text-gray-500 mb-1">Patterns Found</p>
            <p className="text-2xl font-bold text-purple-400">{data.fingerprints?.length || 0}</p>
          </div>
          <div className="bg-[#111827] border border-gray-700/50 rounded-lg p-4">
            <p className="text-xs text-gray-500 mb-1">Match Rate</p>
            <p className="text-2xl font-bold text-emerald-400">{data.match_rate}%</p>
          </div>
          <div className="bg-[#111827] border border-gray-700/50 rounded-lg p-4">
            <p className="text-xs text-gray-500 mb-1">Unmatched</p>
            <p className="text-2xl font-bold text-gray-400">{data.unmatched}</p>
          </div>
        </div>
      )}

      <div className="flex gap-1 bg-gray-800/50 rounded-lg p-1 w-fit">
        {['fingerprints', 'patterns'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-md text-xs font-medium transition-colors capitalize ${tab === t ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-gray-200'}`}>
            {t === 'fingerprints' ? 'Detected Patterns' : 'Pattern Library'}
          </button>
        ))}
      </div>

      {tab === 'fingerprints' && (
        <div className="space-y-2">
          {(!data?.fingerprints || data.fingerprints.length === 0) ? (
            <div className="text-center py-12 text-gray-500">
              <Fingerprint className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No anomaly patterns detected in this time range</p>
              <p className="text-xs mt-1">Patterns appear when alerts are triggered</p>
            </div>
          ) : (
            data.fingerprints.map(fp => {
              const colorClass = PATTERN_COLORS[fp.pattern_id] || 'text-gray-400 bg-gray-500/15 border-gray-500/30'
              const isExpanded = expanded === fp.signature

              return (
                <div key={fp.signature}
                  className={`bg-[#111827] border rounded-lg overflow-hidden ${colorClass.split(' ')[2]}`}>
                  <div className="px-4 py-3 cursor-pointer"
                    onClick={() => setExpanded(isExpanded ? null : fp.signature)}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {isExpanded ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${colorClass}`}>
                          {fp.name}
                        </span>
                        <span className="text-sm text-white">{fp.alert_count} alerts across {fp.services.length} service{fp.services.length > 1 ? 's' : ''}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="w-24">
                          <ConfidenceBar value={fp.confidence} />
                        </div>
                        <span className="text-xs text-gray-500">{fp.duration_minutes}m</span>
                      </div>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="px-4 pb-4 space-y-3 border-t border-gray-700/50 pt-3">
                      <p className="text-sm text-gray-300">{fp.description}</p>

                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">Services:</span>
                        {fp.services.map(s => (
                          <span key={s} className="px-2 py-0.5 bg-gray-700/50 text-gray-300 rounded text-xs">{s}</span>
                        ))}
                      </div>

                      <div>
                        <span className="text-xs text-gray-500 block mb-1">Indicators:</span>
                        <ul className="space-y-0.5">
                          {fp.indicators.map((ind, i) => (
                            <li key={i} className="text-xs text-gray-400 flex items-center gap-1.5">
                              <AlertTriangle className="w-3 h-3 text-amber-400" /> {ind}
                            </li>
                          ))}
                        </ul>
                      </div>

                      {fp.sample_alerts?.length > 0 && (
                        <div>
                          <span className="text-xs text-gray-500 block mb-1">Sample Alerts:</span>
                          <div className="space-y-1">
                            {fp.sample_alerts.map(a => (
                              <div key={a.id} className="flex items-center justify-between bg-gray-800/50 rounded px-3 py-1.5">
                                <span className="text-xs text-gray-300">{a.service} — {a.metric}</span>
                                <div className="flex items-center gap-3">
                                  <span className="text-xs font-mono text-white">{a.value?.toFixed(1)}</span>
                                  <span className="text-xs text-gray-500">{new Date(a.fired_at + 'Z').toLocaleTimeString()}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span>First: {new Date(fp.first_seen + 'Z').toLocaleString()}</span>
                        <span>Last: {new Date(fp.last_seen + 'Z').toLocaleString()}</span>
                      </div>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}

      {tab === 'patterns' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {patterns.map(p => {
            const colorClass = PATTERN_COLORS[p.id] || 'text-gray-400 bg-gray-500/15 border-gray-500/30'
            return (
              <div key={p.id} className={`bg-[#111827] border rounded-lg p-4 ${colorClass.split(' ')[2]}`}>
                <div className="flex items-center gap-2 mb-2">
                  <BookOpen className={`w-4 h-4 ${colorClass.split(' ')[0]}`} />
                  <h4 className="text-sm font-medium text-white">{p.name}</h4>
                </div>
                <p className="text-xs text-gray-400 mb-3">{p.description}</p>
                <div className="flex flex-wrap gap-1 mb-2">
                  {p.metrics.map(m => (
                    <span key={m} className="px-1.5 py-0.5 bg-gray-700/50 text-gray-300 rounded text-[10px]">{m}</span>
                  ))}
                </div>
                <div className="space-y-0.5">
                  {p.indicators.map((ind, i) => (
                    <p key={i} className="text-[11px] text-gray-500 flex items-center gap-1">
                      <Percent className="w-2.5 h-2.5" /> {ind}
                    </p>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
