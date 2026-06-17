import { useState, useEffect } from 'react'
import { Heart, TrendingUp, TrendingDown, Minus, RefreshCw, AlertTriangle } from 'lucide-react'

function gradeColor(grade) {
  switch (grade) {
    case 'A': return 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30'
    case 'B': return 'text-cyan-400 bg-cyan-500/15 border-cyan-500/30'
    case 'C': return 'text-amber-400 bg-amber-500/15 border-amber-500/30'
    case 'D': return 'text-orange-400 bg-orange-500/15 border-orange-500/30'
    default: return 'text-red-400 bg-red-500/15 border-red-500/30'
  }
}

function scoreColor(score) {
  if (score >= 90) return 'text-emerald-400'
  if (score >= 75) return 'text-cyan-400'
  if (score >= 60) return 'text-amber-400'
  if (score >= 40) return 'text-orange-400'
  return 'text-red-400'
}

function ScoreRing({ score, size = 80 }) {
  const radius = (size - 8) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference
  const color = score >= 90 ? '#10B981' : score >= 75 ? '#06B6D4' : score >= 60 ? '#F59E0B' : score >= 40 ? '#F97316' : '#EF4444'

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={radius} stroke="#374151" strokeWidth="4" fill="none" />
      <circle cx={size / 2} cy={size / 2} r={radius} stroke={color} strokeWidth="4" fill="none"
        strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
        className="transition-all duration-700" />
    </svg>
  )
}

function ComponentBar({ name, score }) {
  const color = score >= 90 ? 'bg-emerald-500' : score >= 75 ? 'bg-cyan-500' : score >= 60 ? 'bg-amber-500' : score >= 40 ? 'bg-orange-500' : 'bg-red-500'
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-400 w-24 truncate">{name.replace(/_/g, ' ')}</span>
      <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className={`text-xs font-mono w-8 text-right ${scoreColor(score)}`}>{score}</span>
    </div>
  )
}

export default function HealthScores() {
  const [scores, setScores] = useState([])
  const [loading, setLoading] = useState(true)
  const [window, setWindow] = useState(1)
  const [expanded, setExpanded] = useState(null)

  const fetchScores = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/health-scores?window_hours=${window}`)
      const data = await res.json()
      setScores(data.scores || [])
    } catch {}
    setLoading(false)
  }

  useEffect(() => { fetchScores() }, [window])

  const avgScore = scores.length > 0 ? Math.round(scores.reduce((s, x) => s + x.score, 0) / scores.length) : 0
  const worstService = scores.length > 0 ? scores[0] : null

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <Heart className="w-5 h-5 text-rose-400" /> Service Health Scores
          </h2>
          <span className="text-xs text-gray-500">{scores.length} services</span>
        </div>
        <div className="flex items-center gap-3">
          <select value={window} onChange={e => setWindow(Number(e.target.value))}
            className="bg-gray-800 text-gray-300 text-xs rounded-lg px-3 py-2 border border-gray-700">
            <option value={1}>Last 1 hour</option>
            <option value={6}>Last 6 hours</option>
            <option value={24}>Last 24 hours</option>
          </select>
          <button onClick={fetchScores}
            className="flex items-center gap-1.5 px-3 py-2 bg-gray-800 text-gray-300 rounded-lg text-xs hover:bg-gray-700">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="bg-[#111827] border border-gray-700/50 rounded-lg px-5 py-3 flex items-center gap-4">
          <div className="relative">
            <ScoreRing score={avgScore} size={60} />
            <span className={`absolute inset-0 flex items-center justify-center text-sm font-bold ${scoreColor(avgScore)}`}>
              {avgScore}
            </span>
          </div>
          <div>
            <p className="text-xs text-gray-500">Fleet Average</p>
            <p className={`text-lg font-bold ${scoreColor(avgScore)}`}>{avgScore}/100</p>
          </div>
        </div>
        {worstService && worstService.score < 80 && (
          <div className="bg-[#111827] border border-amber-500/30 rounded-lg px-5 py-3">
            <p className="text-xs text-gray-500">Needs Attention</p>
            <p className="text-sm text-amber-400 font-medium flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" /> {worstService.service} ({worstService.score})
            </p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {scores.map((s) => {
          const TrendIcon = s.trend_direction === 'up' ? TrendingUp : s.trend_direction === 'down' ? TrendingDown : Minus
          const trendColor = s.trend_direction === 'up' ? 'text-emerald-400' : s.trend_direction === 'down' ? 'text-red-400' : 'text-gray-500'
          const isExpanded = expanded === s.service

          return (
            <div key={s.service}
              onClick={() => setExpanded(isExpanded ? null : s.service)}
              className={`bg-[#111827] border rounded-lg p-4 cursor-pointer transition-all ${gradeColor(s.grade)} hover:border-opacity-60`}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-white">{s.service}</span>
                <span className={`text-2xl font-bold px-2 py-0.5 rounded ${gradeColor(s.grade)}`}>{s.grade}</span>
              </div>

              <div className="flex items-center justify-between mb-3">
                <div className="relative">
                  <ScoreRing score={s.score} size={50} />
                  <span className={`absolute inset-0 flex items-center justify-center text-xs font-bold ${scoreColor(s.score)}`}>
                    {s.score}
                  </span>
                </div>
                <div className="text-right">
                  <div className={`flex items-center gap-1 ${trendColor}`}>
                    <TrendIcon className="w-3.5 h-3.5" />
                    <span className="text-xs font-mono">{s.trend > 0 ? '+' : ''}{s.trend}</span>
                  </div>
                  {s.firing_alerts > 0 && (
                    <p className="text-xs text-red-400 mt-0.5">{s.firing_alerts} alert{s.firing_alerts > 1 ? 's' : ''}</p>
                  )}
                </div>
              </div>

              {isExpanded && (
                <div className="space-y-2 pt-2 border-t border-gray-700/50">
                  {Object.entries(s.component_scores || {}).map(([name, score]) => (
                    <ComponentBar key={name} name={name} score={score} />
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
