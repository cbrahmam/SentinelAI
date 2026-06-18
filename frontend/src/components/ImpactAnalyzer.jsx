import { useState, useEffect } from 'react'
import { Crosshair, RefreshCw, AlertTriangle, ArrowRight, Zap, Users, DollarSign, Clock, Lightbulb } from 'lucide-react'

const SEVERITY_COLORS = {
  critical: 'text-red-400 bg-red-500/15 border-red-500/30',
  high: 'text-orange-400 bg-orange-500/15 border-orange-500/30',
  medium: 'text-amber-400 bg-amber-500/15 border-amber-500/30',
  low: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30',
}

function BlastRadiusRing({ pct }) {
  const size = 100
  const radius = (size - 8) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (pct / 100) * circumference
  const color = pct > 60 ? '#EF4444' : pct > 30 ? '#F59E0B' : '#10B981'

  return (
    <div className="relative">
      <svg width={size} height={size} className="transform -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="#374151" strokeWidth="5" fill="none" />
        <circle cx={size / 2} cy={size / 2} r={radius} stroke={color} strokeWidth="5" fill="none"
          strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
          className="transition-all duration-700" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-bold text-white">{pct}%</span>
        <span className="text-[10px] text-gray-500">blast</span>
      </div>
    </div>
  )
}

export default function ImpactAnalyzer() {
  const [services, setServices] = useState([])
  const [selected, setSelected] = useState(null)
  const [analysis, setAnalysis] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchComparison = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/impact')
      const data = await res.json()
      setServices(data.services || [])
    } catch {}
    setLoading(false)
  }

  const fetchAnalysis = async (svc) => {
    setSelected(svc)
    setLoading(true)
    try {
      const res = await fetch(`/api/impact/${svc}`)
      const data = await res.json()
      setAnalysis(data)
    } catch {}
    setLoading(false)
  }

  useEffect(() => { fetchComparison() }, [])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white flex items-center gap-2">
          <Crosshair className="w-5 h-5 text-orange-400" /> Dependency Impact Analyzer
        </h2>
        <button onClick={() => { fetchComparison(); setAnalysis(null); setSelected(null) }}
          className="flex items-center gap-1.5 px-3 py-2 bg-gray-800 text-gray-300 rounded-lg text-xs hover:bg-gray-700">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Reset
        </button>
      </div>

      <p className="text-sm text-gray-400">Select a service to simulate: "What if this goes down?"</p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {services.map(svc => {
          const revColor = SEVERITY_COLORS[svc.revenue_impact] || SEVERITY_COLORS.low
          return (
            <button key={svc.service} onClick={() => fetchAnalysis(svc.service)}
              className={`bg-[#111827] border rounded-lg p-4 text-left transition-all hover:border-orange-500/40 ${selected === svc.service ? 'border-orange-500/60 ring-1 ring-orange-500/30' : 'border-gray-700/50'}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-white">{svc.service}</span>
                <Zap className={`w-4 h-4 ${svc.blast_radius_pct > 50 ? 'text-red-400' : svc.blast_radius_pct > 25 ? 'text-amber-400' : 'text-gray-500'}`} />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">Blast radius</span>
                  <span className="text-xs font-mono text-white">{svc.blast_radius_pct}%</span>
                </div>
                <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${svc.blast_radius_pct > 50 ? 'bg-red-500' : svc.blast_radius_pct > 25 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                    style={{ width: `${svc.blast_radius_pct}%` }} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">Affected</span>
                  <span className="text-xs text-gray-400">{svc.affected_count} services</span>
                </div>
                <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${revColor}`}>
                  {svc.revenue_impact} revenue
                </span>
              </div>
            </button>
          )
        })}
      </div>

      {analysis && (
        <div className="space-y-4 border-t border-gray-700/50 pt-4">
          <h3 className="text-lg font-semibold text-white">
            Impact: What if <span className="text-orange-400">{analysis.service}</span> goes down?
          </h3>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="bg-[#111827] border border-gray-700/50 rounded-lg p-4 flex items-center gap-3">
              <BlastRadiusRing pct={analysis.blast_radius_pct} />
              <div>
                <p className="text-xs text-gray-500">Blast Radius</p>
                <p className="text-sm font-bold text-white">{analysis.total_affected_services} services</p>
              </div>
            </div>
            <div className="bg-[#111827] border border-gray-700/50 rounded-lg p-4">
              <div className="flex items-center gap-1.5 mb-1">
                <Users className="w-3.5 h-3.5 text-cyan-400" />
                <p className="text-xs text-gray-500">User Impact</p>
              </div>
              <p className="text-2xl font-bold text-white">{analysis.user_impact_pct}%</p>
            </div>
            <div className="bg-[#111827] border border-gray-700/50 rounded-lg p-4">
              <div className="flex items-center gap-1.5 mb-1">
                <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                <p className="text-xs text-gray-500">Revenue Risk</p>
              </div>
              <span className={`text-lg font-bold px-2 py-0.5 rounded capitalize ${SEVERITY_COLORS[analysis.revenue_impact]}`}>
                {analysis.revenue_impact}
              </span>
            </div>
            <div className="bg-[#111827] border border-gray-700/50 rounded-lg p-4">
              <div className="flex items-center gap-1.5 mb-1">
                <Clock className="w-3.5 h-3.5 text-purple-400" />
                <p className="text-xs text-gray-500">Avg MTTR</p>
              </div>
              <p className="text-2xl font-bold text-white">
                {analysis.mttr_minutes ? `${analysis.mttr_minutes}m` : 'N/A'}
              </p>
            </div>
            <div className="bg-[#111827] border border-gray-700/50 rounded-lg p-4">
              <div className="flex items-center gap-1.5 mb-1">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                <p className="text-xs text-gray-500">Past Incidents</p>
              </div>
              <p className="text-2xl font-bold text-white">{analysis.past_incidents?.length || 0}</p>
            </div>
          </div>

          {analysis.propagation_chain?.length > 0 && (
            <div className="bg-[#111827] border border-gray-700/50 rounded-lg p-4">
              <h4 className="text-sm font-medium text-white mb-3">Failure Propagation Chain</h4>
              <div className="space-y-2">
                {analysis.propagation_chain.map((step, i) => (
                  <div key={i} className="flex items-center gap-2" style={{ paddingLeft: `${step.depth * 24}px` }}>
                    <ArrowRight className="w-3.5 h-3.5 text-orange-400" />
                    <span className="text-sm text-white font-medium">{step.service}</span>
                    <span className="text-xs text-gray-500">via {step.caused_by}</span>
                    <span className="text-xs text-gray-400 ml-auto">{step.user_impact_pct}% users affected</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="bg-[#111827] border border-gray-700/50 rounded-lg p-4">
              <h4 className="text-sm font-medium text-white mb-2">Direct Dependencies (upstream)</h4>
              <div className="flex flex-wrap gap-1.5">
                {(analysis.direct_dependencies || []).map(d => (
                  <span key={d} className="px-2 py-1 bg-cyan-500/15 text-cyan-400 rounded text-xs">{d}</span>
                ))}
                {(analysis.direct_dependencies || []).length === 0 && (
                  <span className="text-xs text-gray-500">None (leaf node)</span>
                )}
              </div>
            </div>
            <div className="bg-[#111827] border border-gray-700/50 rounded-lg p-4">
              <h4 className="text-sm font-medium text-white mb-2">Direct Dependents (downstream)</h4>
              <div className="flex flex-wrap gap-1.5">
                {(analysis.direct_dependents || []).map(d => (
                  <span key={d} className="px-2 py-1 bg-orange-500/15 text-orange-400 rounded text-xs">{d}</span>
                ))}
                {(analysis.direct_dependents || []).length === 0 && (
                  <span className="text-xs text-gray-500">None</span>
                )}
              </div>
            </div>
          </div>

          {analysis.recommendations?.length > 0 && (
            <div className="bg-[#111827] border border-amber-500/20 rounded-lg p-4">
              <h4 className="text-sm font-medium text-amber-400 mb-2 flex items-center gap-1.5">
                <Lightbulb className="w-4 h-4" /> Recommendations
              </h4>
              <ul className="space-y-1.5">
                {analysis.recommendations.map((rec, i) => (
                  <li key={i} className="text-sm text-gray-300 flex items-start gap-2">
                    <span className="text-amber-400 mt-0.5">•</span> {rec}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
