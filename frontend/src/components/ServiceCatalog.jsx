import { useEffect, useState } from 'react'
import { Boxes, RefreshCw, User, Users, AlertCircle, GitBranch, Search, X, Book, Code2, LayoutDashboard, Phone, ExternalLink, Plus } from 'lucide-react'
import useStore from '../stores/useStore'

const TIER_STYLES = {
  'tier-1': { text: 'text-red-400', bg: 'bg-red-500/15', border: 'border-red-500/30', label: 'Tier 1' },
  'tier-2': { text: 'text-amber-400', bg: 'bg-amber-500/15', border: 'border-amber-500/30', label: 'Tier 2' },
  'tier-3': { text: 'text-sky-400', bg: 'bg-sky-500/15', border: 'border-sky-500/30', label: 'Tier 3' },
}

const STATUS_DOT = {
  healthy: 'bg-emerald-500', warning: 'bg-amber-500', critical: 'bg-red-500', unknown: 'bg-gray-500',
}

const TIERS = ['tier-1', 'tier-2', 'tier-3']
const LIFECYCLES = ['production', 'beta', 'experimental', 'deprecated']

function EditForm({ initial, onSave, onClose }) {
  const editing = Boolean(initial?.service)
  const [form, setForm] = useState({
    service: initial?.service || '', display_name: initial?.display_name || '',
    description: initial?.description || '', team: initial?.team || '', owner: initial?.owner || '',
    tier: initial?.tier || 'tier-3', lifecycle: initial?.lifecycle || 'production',
    on_call: initial?.on_call || '', repo_url: initial?.repo_url || '', docs_url: initial?.docs_url || '',
    dashboard_url: initial?.dashboard_url || '', tags: (initial?.tags || []).join(', '),
  })
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const submit = async () => {
    if (!form.service) return
    setSaving(true)
    await onSave({
      ...form,
      tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
    })
    setSaving(false)
    onClose()
  }

  const field = 'bg-gray-800 text-gray-200 text-xs rounded-lg px-3 py-2 border border-gray-700 w-full'
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60" />
      <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto bg-[#111827] border border-violet-500/30 rounded-lg p-5 space-y-3"
        onClick={(e) => e.stopPropagation()}>
        <h3 className="text-sm font-semibold text-white">{editing ? `Edit ${form.service}` : 'Add service to catalog'}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input className={field} placeholder="service id (e.g. api-gateway)" value={form.service}
            disabled={editing} onChange={(e) => set('service', e.target.value)} />
          <input className={field} placeholder="Display name" value={form.display_name} onChange={(e) => set('display_name', e.target.value)} />
          <input className={`${field} md:col-span-2`} placeholder="Description" value={form.description} onChange={(e) => set('description', e.target.value)} />
          <input className={field} placeholder="Team" value={form.team} onChange={(e) => set('team', e.target.value)} />
          <input className={field} placeholder="Owner (email)" value={form.owner} onChange={(e) => set('owner', e.target.value)} />
          <select className={field} value={form.tier} onChange={(e) => set('tier', e.target.value)}>
            {TIERS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <select className={field} value={form.lifecycle} onChange={(e) => set('lifecycle', e.target.value)}>
            {LIFECYCLES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <input className={field} placeholder="On-call rotation" value={form.on_call} onChange={(e) => set('on_call', e.target.value)} />
          <input className={field} placeholder="Tags (comma-separated)" value={form.tags} onChange={(e) => set('tags', e.target.value)} />
          <input className={field} placeholder="Repo URL" value={form.repo_url} onChange={(e) => set('repo_url', e.target.value)} />
          <input className={field} placeholder="Docs URL" value={form.docs_url} onChange={(e) => set('docs_url', e.target.value)} />
          <input className={`${field} md:col-span-2`} placeholder="Dashboard URL" value={form.dashboard_url} onChange={(e) => set('dashboard_url', e.target.value)} />
        </div>
        <div className="flex items-center justify-end gap-2">
          <button onClick={onClose} className="px-3 py-2 text-xs text-gray-400 hover:text-gray-200">Cancel</button>
          <button onClick={submit} disabled={saving || !form.service}
            className="px-3 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-xs disabled:opacity-50">
            {saving ? 'Saving…' : editing ? 'Save changes' : 'Add service'}
          </button>
        </div>
      </div>
    </div>
  )
}

function LinkRow({ icon: Icon, label, url }) {
  if (!url) return null
  return (
    <a href={url} target="_blank" rel="noreferrer"
      className="flex items-center gap-2 text-xs text-sky-400 hover:text-sky-300">
      <Icon className="w-3.5 h-3.5" /> {label} <ExternalLink className="w-3 h-3 opacity-60" />
    </a>
  )
}

function DetailDrawer({ entry, onClose }) {
  if (!entry) return null
  const tier = TIER_STYLES[entry.tier] || TIER_STYLES['tier-3']
  return (
    <div className="fixed inset-0 z-40 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />
      <div className="relative w-full max-w-md h-full bg-[#0B0F19] border-l border-gray-700 overflow-y-auto p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white">{entry.display_name || entry.service}</h3>
            <p className="text-xs text-gray-500 font-mono">{entry.service}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex flex-wrap gap-2">
          <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${tier.bg} ${tier.text}`}>{tier.label}</span>
          <span className="px-2 py-0.5 rounded text-[11px] bg-gray-700 text-gray-300">{entry.lifecycle}</span>
          <span className={`px-2 py-0.5 rounded text-[11px] ${STATUS_DOT[entry.status] ? 'bg-gray-700 text-gray-300' : ''}`}>
            {entry.status}
          </span>
        </div>

        {entry.description && <p className="text-sm text-gray-300">{entry.description}</p>}

        <div className="space-y-2 border-t border-gray-800 pt-3">
          <div className="flex items-center gap-2 text-sm text-gray-300"><Users className="w-4 h-4 text-gray-500" /> {entry.team || '—'}</div>
          <div className="flex items-center gap-2 text-sm text-gray-300"><User className="w-4 h-4 text-gray-500" /> {entry.owner || 'unowned'}</div>
          <div className="flex items-center gap-2 text-sm text-gray-300"><Phone className="w-4 h-4 text-gray-500" /> {entry.on_call || '—'}</div>
        </div>

        <div className="space-y-2 border-t border-gray-800 pt-3">
          <LinkRow icon={Code2} label="Repository" url={entry.repo_url} />
          <LinkRow icon={Book} label="Docs" url={entry.docs_url} />
          <LinkRow icon={LayoutDashboard} label="Dashboard" url={entry.dashboard_url} />
          {!entry.repo_url && !entry.docs_url && !entry.dashboard_url && (
            <p className="text-xs text-gray-600">No links configured.</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 border-t border-gray-800 pt-3">
          <div>
            <p className="text-[11px] text-gray-500 mb-1">Depends on</p>
            <div className="flex flex-wrap gap-1">
              {(entry.dependencies || []).map((d) => <span key={d} className="text-[11px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-300">{d}</span>)}
              {!(entry.dependencies || []).length && <span className="text-[11px] text-gray-600">none</span>}
            </div>
          </div>
          <div>
            <p className="text-[11px] text-gray-500 mb-1">Depended on by</p>
            <div className="flex flex-wrap gap-1">
              {(entry.dependents || []).map((d) => <span key={d} className="text-[11px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-300">{d}</span>)}
              {!(entry.dependents || []).length && <span className="text-[11px] text-gray-600">none</span>}
            </div>
          </div>
        </div>

        {(entry.tags || []).length > 0 && (
          <div className="flex flex-wrap gap-1 border-t border-gray-800 pt-3">
            {entry.tags.map((t) => <span key={t} className="text-[11px] px-1.5 py-0.5 rounded bg-violet-500/15 text-violet-300">#{t}</span>)}
          </div>
        )}
      </div>
    </div>
  )
}

export default function ServiceCatalog() {
  const entries = useStore((s) => s.catalogEntries)
  const facets = useStore((s) => s.catalogFacets)
  const fetchCatalog = useStore((s) => s.fetchCatalog)
  const fetchFacets = useStore((s) => s.fetchCatalogFacets)
  const fetchStats = useStore((s) => s.fetchCatalogStats)
  const saveEntry = useStore((s) => s.saveCatalogEntry)
  const [filters, setFilters] = useState({ team: '', tier: '', lifecycle: '', q: '' })
  const [selected, setSelected] = useState(null)
  const [editing, setEditing] = useState(null) // null=closed, {}=new, {entry}=edit

  const setFilter = (k, v) => {
    const next = { ...filters, [k]: v }
    setFilters(next)
    fetchCatalog(next)
  }
  const clearFilters = () => {
    setFilters({ team: '', tier: '', lifecycle: '', q: '' })
    fetchCatalog()
  }
  const hasFilters = Object.values(filters).some(Boolean)

  const refresh = () => {
    fetchCatalog(filters)
    fetchFacets()
    fetchStats()
  }

  useEffect(() => { refresh() }, [])

  const select = 'bg-gray-800 text-gray-300 text-xs rounded-lg px-3 py-2 border border-gray-700'

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white flex items-center gap-2">
          <Boxes className="w-5 h-5 text-violet-400" /> Service Catalog
        </h2>
        <div className="flex items-center gap-2">
          <button onClick={() => setEditing({})}
            className="flex items-center gap-1.5 px-3 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-xs">
            <Plus className="w-3.5 h-3.5" /> Add service
          </button>
          <button onClick={refresh}
            className="flex items-center gap-1.5 px-3 py-2 bg-gray-800 text-gray-300 rounded-lg text-xs hover:bg-gray-700">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-gray-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input value={filters.q} onChange={(e) => setFilter('q', e.target.value)} placeholder="Search service or owner"
            className={`${select} pl-8 w-56`} />
        </div>
        <select value={filters.team} onChange={(e) => setFilter('team', e.target.value)} className={select}>
          <option value="">All teams</option>
          {facets.teams.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={filters.tier} onChange={(e) => setFilter('tier', e.target.value)} className={select}>
          <option value="">All tiers</option>
          {facets.tiers.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={filters.lifecycle} onChange={(e) => setFilter('lifecycle', e.target.value)} className={select}>
          <option value="">All lifecycles</option>
          {facets.lifecycles.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        {hasFilters && (
          <button onClick={clearFilters} className="flex items-center gap-1 px-2.5 py-2 text-xs text-gray-400 hover:text-gray-200">
            <X className="w-3.5 h-3.5" /> Clear
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {entries.map((e) => {
          const tier = TIER_STYLES[e.tier] || TIER_STYLES['tier-3']
          return (
            <div key={e.service} onClick={() => setSelected(e)}
              className={`bg-[#111827] border rounded-lg p-4 cursor-pointer transition-colors hover:border-violet-500/40 ${tier.border}`}>
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

      <DetailDrawer entry={selected} onClose={() => setSelected(null)} />
      {editing && <EditForm initial={editing} onSave={saveEntry} onClose={() => setEditing(null)} />}
    </div>
  )
}
