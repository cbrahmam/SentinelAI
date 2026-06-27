import { useState, useEffect } from 'react'
import { Radar, RefreshCw, Play, CheckCircle2, XCircle, HelpCircle, Globe, Activity, Plus } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts'
import useStore from '../stores/useStore'

const STATUS_STYLES = {
  up: { icon: CheckCircle2, text: 'text-emerald-400', border: 'border-emerald-500/30', label: 'Operational' },
  down: { icon: XCircle, text: 'text-red-400', border: 'border-red-500/40', label: 'Down' },
  unknown: { icon: HelpCircle, text: 'text-gray-500', border: 'border-gray-700/50', label: 'No data' },
}

const SERVICES = [
  'api-gateway', 'auth-service', 'user-service', 'payment-service',
  'notification-service', 'postgres-primary', 'redis-cache', 'rabbitmq',
]
const ALL_REGIONS = ['us-east', 'us-west', 'eu-west', 'ap-south', 'sa-east']

function CreateCheckForm({ onCreate, onClose }) {
  const [form, setForm] = useState({
    name: '', service: SERVICES[0], target_url: '', method: 'GET',
    interval_seconds: 60, timeout_ms: 3000, expected_status: 200,
    regions: ['us-east', 'us-west', 'eu-west'],
  })
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))
  const toggleRegion = (r) =>
    setForm((f) => ({ ...f, regions: f.regions.includes(r) ? f.regions.filter((x) => x !== r) : [...f.regions, r] }))

  const submit = async () => {
    if (!form.name || !form.target_url || !form.regions.length) return
    setSaving(true)
    await onCreate({ ...form, interval_seconds: Number(form.interval_seconds), timeout_ms: Number(form.timeout_ms), expected_status: Number(form.expected_status) })
    setSaving(false)
    onClose()
  }

  const field = 'bg-gray-800 text-gray-200 text-xs rounded-lg px-3 py-2 border border-gray-700 w-full'
  return (
    <div className="bg-[#111827] border border-sky-500/30 rounded-lg p-4 space-y-3">
      <h3 className="text-sm font-semibold text-white">New synthetic check</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <input className={field} placeholder="Check name" value={form.name} onChange={(e) => set('name', e.target.value)} />
        <select className={field} value={form.service} onChange={(e) => set('service', e.target.value)}>
          {SERVICES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <input className={`${field} md:col-span-2`} placeholder="https://target.internal/healthz" value={form.target_url} onChange={(e) => set('target_url', e.target.value)} />
        <select className={field} value={form.method} onChange={(e) => set('method', e.target.value)}>
          {['GET', 'POST', 'HEAD', 'PUT'].map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <input type="number" className={field} placeholder="Expected status" value={form.expected_status} onChange={(e) => set('expected_status', e.target.value)} />
        <input type="number" className={field} placeholder="Interval (s)" value={form.interval_seconds} onChange={(e) => set('interval_seconds', e.target.value)} />
        <input type="number" className={field} placeholder="Timeout (ms)" value={form.timeout_ms} onChange={(e) => set('timeout_ms', e.target.value)} />
      </div>
      <div>
        <p className="text-[11px] text-gray-500 mb-1">Regions</p>
        <div className="flex flex-wrap gap-2">
          {ALL_REGIONS.map((r) => (
            <button key={r} onClick={() => toggleRegion(r)}
              className={`px-2.5 py-1 rounded-md text-[11px] border transition-colors ${form.regions.includes(r) ? 'bg-sky-500/20 text-sky-300 border-sky-500/40' : 'bg-gray-800 text-gray-400 border-gray-700'}`}>
              {r}
            </button>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2 justify-end">
        <button onClick={onClose} className="px-3 py-2 text-xs text-gray-400 hover:text-gray-200">Cancel</button>
        <button onClick={submit} disabled={saving || !form.name || !form.target_url}
          className="px-3 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs disabled:opacity-50">
          {saving ? 'Creating…' : 'Create check'}
        </button>
      </div>
    </div>
  )
}

function UptimeTimeline({ results }) {
  const recent = results.slice(-80)
  if (!recent.length) {
    return <p className="text-xs text-gray-500">No probes recorded yet.</p>
  }
  return (
    <div className="flex items-end gap-[2px] h-8">
      {recent.map((r) => (
        <div
          key={r.id}
          title={`${r.region} · ${r.success ? 'up' : (r.error || 'down')} · ${r.latency_ms ?? '—'}ms\n${new Date(r.checked_at).toLocaleString()}`}
          className={`flex-1 min-w-[3px] rounded-sm ${r.success ? 'bg-emerald-500/80 h-full' : 'bg-red-500/80 h-full'}`}
        />
      ))}
    </div>
  )
}

function uptimeColor(pct) {
  if (pct >= 99.5) return 'text-emerald-400'
  if (pct >= 97) return 'text-amber-400'
  return 'text-red-400'
}

export default function SyntheticMonitoring() {
  const checks = useStore((s) => s.syntheticChecks)
  const fetchChecks = useStore((s) => s.fetchSyntheticChecks)
  const runCheck = useStore((s) => s.runSyntheticCheck)
  const createCheck = useStore((s) => s.createSyntheticCheck)
  const [showForm, setShowForm] = useState(false)
  const [analytics, setAnalytics] = useState({})
  const [loading, setLoading] = useState(false)
  const [running, setRunning] = useState(null)
  const [selected, setSelected] = useState(null)
  const [results, setResults] = useState([])

  const loadResults = async (id) => {
    try {
      const res = await fetch(`/api/synthetic/${id}/results?hours=24`)
      const d = await res.json()
      setResults(d.results || [])
    } catch { setResults([]) }
  }

  const selectCheck = async (id) => {
    setSelected(id)
    await loadResults(id)
  }

  const loadAnalytics = async (list) => {
    const entries = await Promise.all(
      list.map(async (c) => {
        try {
          const res = await fetch(`/api/synthetic/${c.id}/analytics?hours=24`)
          return [c.id, await res.json()]
        } catch { return [c.id, null] }
      })
    )
    setAnalytics(Object.fromEntries(entries))
  }

  const refresh = async () => {
    setLoading(true)
    await fetchChecks()
    setLoading(false)
  }

  useEffect(() => { refresh() }, [])
  useEffect(() => { if (checks.length) loadAnalytics(checks) }, [checks])

  const handleRun = async (id) => {
    setRunning(id)
    await runCheck(id)
    await loadAnalytics(checks)
    if (selected === id) await loadResults(id)
    setRunning(null)
  }

  const chartData = results
    .filter((r) => r.latency_ms != null)
    .map((r) => ({
      time: new Date(r.checked_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      latency: r.latency_ms,
      region: r.region,
      success: r.success,
    }))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white flex items-center gap-2">
          <Radar className="w-5 h-5 text-sky-400" /> Synthetic Monitoring
        </h2>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowForm((v) => !v)}
            className="flex items-center gap-1.5 px-3 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs">
            <Plus className="w-3.5 h-3.5" /> New check
          </button>
          <button onClick={refresh}
            className="flex items-center gap-1.5 px-3 py-2 bg-gray-800 text-gray-300 rounded-lg text-xs hover:bg-gray-700">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      {showForm && <CreateCheckForm onCreate={createCheck} onClose={() => setShowForm(false)} />}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {checks.map((c) => {
          const a = analytics[c.id]
          const status = a?.current_status || 'unknown'
          const style = STATUS_STYLES[status] || STATUS_STYLES.unknown
          const StatusIcon = style.icon
          const uptime = a?.overall?.uptime_pct
          const p95 = a?.overall?.p95_latency_ms
          return (
            <div key={c.id} onClick={() => selectCheck(c.id)}
              className={`bg-[#111827] border rounded-lg p-4 cursor-pointer transition-colors hover:border-sky-500/40 ${selected === c.id ? 'border-sky-500/60' : style.border}`}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <StatusIcon className={`w-4 h-4 ${style.text}`} />
                    <span className="text-sm font-medium text-white">{c.name}</span>
                    {!c.enabled && <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-700 text-gray-400">paused</span>}
                  </div>
                  <p className="text-xs text-gray-500 font-mono">{c.method} {c.target_url}</p>
                  <div className="flex items-center gap-2 mt-1 text-[10px] text-gray-500">
                    <span className="flex items-center gap-1"><Globe className="w-3 h-3" /> {c.regions.length} regions</span>
                    <span>· {c.service}</span>
                    <span className={style.text}>· {style.label}</span>
                  </div>
                </div>
                <button onClick={(e) => { e.stopPropagation(); handleRun(c.id) }} disabled={running === c.id}
                  className="flex items-center gap-1 px-2 py-1 bg-gray-800 text-gray-300 rounded text-[11px] hover:bg-gray-700 disabled:opacity-50">
                  <Play className={`w-3 h-3 ${running === c.id ? 'animate-pulse' : ''}`} /> Run
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] text-gray-500">Uptime (24h)</p>
                  <p className={`text-lg font-bold ${uptime != null ? uptimeColor(uptime) : 'text-gray-600'}`}>
                    {uptime != null ? `${uptime}%` : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-500">p95 Latency</p>
                  <p className="text-lg font-bold text-white">{p95 != null ? `${p95}ms` : '—'}</p>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {selected && (
        <div className="bg-[#111827] border border-gray-700/50 rounded-lg p-4 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-white mb-2">Uptime timeline</h3>
            <UptimeTimeline results={results} />
            <div className="flex items-center gap-3 mt-1.5 text-[10px] text-gray-500">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-emerald-500/80" /> up</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-red-500/80" /> down</span>
              <span className="ml-auto">oldest → newest</span>
            </div>
          </div>
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Activity className="w-4 h-4 text-sky-400" /> Latency history (24h)
          </h3>
          {chartData.length ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="time" stroke="#6b7280" fontSize={10} minTickGap={40} />
                <YAxis stroke="#6b7280" fontSize={10} unit="ms" width={48} />
                <Tooltip
                  contentStyle={{ background: '#0B0F19', border: '1px solid #374151', borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: '#9ca3af' }}
                />
                <Line type="monotone" dataKey="latency" stroke="#38bdf8" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-xs text-gray-500">No probe results yet — hit Run to collect samples.</p>
          )}

          <div>
            <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
              <Globe className="w-4 h-4 text-sky-400" /> By region
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {Object.entries(analytics[selected]?.regions || {}).map(([region, s]) => (
                <div key={region} className="bg-[#0B0F19] border border-gray-700/50 rounded-lg p-3">
                  <p className="text-xs font-medium text-gray-300 mb-1">{region}</p>
                  <div className="flex items-baseline justify-between">
                    <span className={`text-base font-bold ${uptimeColor(s.uptime_pct)}`}>{s.uptime_pct}%</span>
                    <span className="text-[11px] text-gray-500">{s.p95_latency_ms != null ? `${s.p95_latency_ms}ms p95` : '—'}</span>
                  </div>
                  <p className="text-[10px] text-gray-600 mt-0.5">{s.successes}/{s.checks} ok</p>
                </div>
              ))}
              {!Object.keys(analytics[selected]?.regions || {}).length && (
                <p className="text-xs text-gray-500">No regional data yet.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
