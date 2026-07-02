import { useEffect } from 'react'
import { Boxes, RefreshCw, User, Users, AlertCircle, GitBranch } from 'lucide-react'
import useStore from '../stores/useStore'

const TIER_STYLES = {
  'tier-1': { text: 'text-red-400', bg: 'bg-red-500/15', border: 'border-red-500/30', label: 'Tier 1' },
  'tier-2': { text: 'text-amber-400', bg: 'bg-amber-500/15', border: 'border-amber-500/30', label: 'Tier 2' },
  'tier-3': { text: 'text-sky-400', bg: 'bg-sky-500/15', border: 'border-sky-500/30', label: 'Tier 3' },
}

const STATUS_DOT = {
  healthy: 'bg-emerald-500', warning: 'bg-amber-500', critical: 'bg-red-500', unknown: 'bg-gray-500',
}

export default function ServiceCatalog() {
  const entries = useStore((s) => s.catalogEntries)
  const fetchCatalog = useStore((s) => s.fetchCatalog)
  const fetchFacets = useStore((s) => s.fetchCatalogFacets)
  const fetchStats = useStore((s) => s.fetchCatalogStats)

  const refresh = () => {
    fetchCatalog()
    fetchFacets()
    fetchStats()
  }

  useEffect(() => { refresh() }, [])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white flex items-center gap-2">
          <Boxes className="w-5 h-5 text-violet-400" /> Service Catalog
        </h2>
        <button onClick={refresh}
          className="flex items-center gap-1.5 px-3 py-2 bg-gray-800 text-gray-300 rounded-lg text-xs hover:bg-gray-700">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {entries.map((e) => {
          const tier = TIER_STYLES[e.tier] || TIER_STYLES['tier-3']
          return (
            <div key={e.service} className={`bg-[#111827] border rounded-lg p-4 ${tier.border}`}>
              <div className="flex items-start justify-between mb-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${STATUS_DOT[e.status] || STATUS_DOT.unknown}`} />
                    <span className="text-sm font-medium text-white truncate">{e.display_name || e.service}</span>
                  </div>
                  <p className="text-[11px] text-gray-500 font-mono truncate">{e.service}</p>
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${tier.bg} ${tier.text} shrink-0`}>{tier.label}</span>
              </div>

              {e.description && <p className="text-xs text-gray-400 mb-2 line-clamp-2">{e.description}</p>}

              <div className="space-y-1 text-xs">
                <div className="flex items-center gap-1.5 text-gray-400">
                  <Users className="w-3 h-3 text-gray-500" /> {e.team || <span className="text-gray-600">no team</span>}
                </div>
                <div className="flex items-center gap-1.5 text-gray-400">
                  <User className="w-3 h-3 text-gray-500" /> {e.owner || <span className="text-amber-400/80">unowned</span>}
                </div>
                <div className="flex items-center justify-between pt-1">
                  <span className="flex items-center gap-1 text-[11px] text-gray-500">
                    <GitBranch className="w-3 h-3" /> {(e.dependencies || []).length} deps
                  </span>
                  {e.firing_alerts > 0 && (
                    <span className="flex items-center gap-1 text-[11px] text-red-400">
                      <AlertCircle className="w-3 h-3" /> {e.firing_alerts} firing
                    </span>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
