import { useState, useEffect } from 'react'
import { Bell, Plus, Trash2, ToggleLeft, ToggleRight, Edit3, Check, X, Play } from 'lucide-react'

const SERVICES = [
  'api-gateway', 'auth-service', 'user-service', 'payment-service',
  'notification-service', 'postgres-primary', 'redis-cache', 'rabbitmq',
]
const METRICS = ['cpu_usage', 'memory_usage', 'error_rate', 'p95_latency_ms', 'request_rate', 'queue_depth']
const CONDITIONS = [
  { value: 'above', label: '>' },
  { value: 'below', label: '<' },
  { value: 'above_or_equal', label: '>=' },
  { value: 'below_or_equal', label: '<=' },
  { value: 'equals', label: '==' },
  { value: 'not_equals', label: '!=' },
]
const SEVERITIES = ['critical', 'warning', 'info']

export default function AlertRules() {
  const [rules, setRules] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [triggered, setTriggered] = useState([])
  const [evaluating, setEvaluating] = useState(false)
  const [form, setForm] = useState({
    name: '', service: 'api-gateway', metric_name: 'cpu_usage',
    condition: 'above', threshold: 80, severity: 'warning', duration_seconds: 0,
  })

  const fetchRules = async () => {
    const res = await fetch('/api/rules')
    const data = await res.json()
    setRules(data.rules || [])
  }

  useEffect(() => { fetchRules() }, [])

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!form.name) return
    await fetch('/api/rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, threshold: Number(form.threshold) }),
    })
    setShowForm(false)
    setForm({ name: '', service: 'api-gateway', metric_name: 'cpu_usage', condition: 'above', threshold: 80, severity: 'warning', duration_seconds: 0 })
    fetchRules()
  }

  const handleToggle = async (id) => {
    await fetch(`/api/rules/${id}/toggle`, { method: 'PUT' })
    fetchRules()
  }

  const handleDelete = async (id) => {
    await fetch(`/api/rules/${id}`, { method: 'DELETE' })
    fetchRules()
  }

  const handleEvaluate = async () => {
    setEvaluating(true)
    const res = await fetch('/api/rules/evaluate')
    const data = await res.json()
    setTriggered(data.triggered || [])
    setEvaluating(false)
  }

  const condLabel = (c) => CONDITIONS.find(x => x.value === c)?.label || c
  const sevColor = (s) => s === 'critical' ? 'text-red-400 bg-red-500/15' : s === 'warning' ? 'text-amber-400 bg-amber-500/15' : 'text-cyan-400 bg-cyan-500/15'

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <Bell className="w-5 h-5 text-purple-400" /> Alert Rules
          </h2>
          <span className="text-xs text-gray-500">{rules.length} rules</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleEvaluate}
            className="flex items-center gap-1.5 px-3 py-2 bg-amber-500/15 text-amber-400 rounded-lg text-xs font-medium hover:bg-amber-500/25">
            <Play className={`w-3.5 h-3.5 ${evaluating ? 'animate-spin' : ''}`} /> Evaluate Now
          </button>
          <button onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-1.5 px-3 py-2 bg-purple-500/15 text-purple-400 rounded-lg text-xs font-medium hover:bg-purple-500/25">
            <Plus className="w-3.5 h-3.5" /> New Rule
          </button>
        </div>
      </div>

      {triggered.length > 0 && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
          <h3 className="text-sm font-medium text-red-400 mb-2">Triggered Rules ({triggered.length})</h3>
          <div className="space-y-2">
            {triggered.map((t, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="text-white">{t.rule.name} — {t.rule.service}/{t.rule.metric_name}</span>
                <span className="text-red-300">value: {t.current_value?.toFixed(2)} {condLabel(t.rule.condition)} {t.rule.threshold}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {showForm && (
        <form onSubmit={handleCreate} className="bg-[#111827] border border-gray-700/50 rounded-lg p-4 space-y-3">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Rule Name</label>
              <input value={form.name} onChange={e => setForm({...form, name: e.target.value})}
                placeholder="High CPU Alert" className="w-full bg-gray-800 text-white text-xs rounded px-2 py-1.5 border border-gray-700" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Service</label>
              <select value={form.service} onChange={e => setForm({...form, service: e.target.value})}
                className="w-full bg-gray-800 text-white text-xs rounded px-2 py-1.5 border border-gray-700">
                {SERVICES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Metric</label>
              <select value={form.metric_name} onChange={e => setForm({...form, metric_name: e.target.value})}
                className="w-full bg-gray-800 text-white text-xs rounded px-2 py-1.5 border border-gray-700">
                {METRICS.map(m => <option key={m} value={m}>{m.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Severity</label>
              <select value={form.severity} onChange={e => setForm({...form, severity: e.target.value})}
                className="w-full bg-gray-800 text-white text-xs rounded px-2 py-1.5 border border-gray-700">
                {SEVERITIES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Condition</label>
              <select value={form.condition} onChange={e => setForm({...form, condition: e.target.value})}
                className="bg-gray-800 text-white text-xs rounded px-2 py-1.5 border border-gray-700">
                {CONDITIONS.map(c => <option key={c.value} value={c.value}>{c.label} ({c.value})</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Threshold</label>
              <input type="number" step="any" value={form.threshold} onChange={e => setForm({...form, threshold: e.target.value})}
                className="w-28 bg-gray-800 text-white text-xs rounded px-2 py-1.5 border border-gray-700" />
            </div>
            <div className="pt-4">
              <button type="submit" className="px-4 py-1.5 bg-purple-500 text-white text-xs font-medium rounded hover:bg-purple-400">
                Create Rule
              </button>
            </div>
          </div>
        </form>
      )}

      <div className="space-y-2">
        {rules.map((rule) => (
          <div key={rule.id} className={`flex items-center justify-between bg-[#111827] border rounded-lg px-4 py-3 group ${rule.enabled ? 'border-gray-700/50' : 'border-gray-700/30 opacity-60'}`}>
            <div className="flex items-center gap-4">
              <button onClick={() => handleToggle(rule.id)} className="text-gray-400 hover:text-white">
                {rule.enabled ? <ToggleRight className="w-5 h-5 text-emerald-400" /> : <ToggleLeft className="w-5 h-5" />}
              </button>
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm font-medium text-white">{rule.name}</span>
                  <span className={`px-1.5 py-0.5 text-xs rounded font-medium ${sevColor(rule.severity)}`}>{rule.severity}</span>
                </div>
                <p className="text-xs text-gray-400">
                  <span className="text-gray-300">{rule.service}</span> / {rule.metric_name.replace(/_/g, ' ')}
                  <span className="mx-1 text-purple-400 font-mono">{condLabel(rule.condition)}</span>
                  <span className="text-white font-mono">{rule.threshold}</span>
                </p>
              </div>
            </div>
            <button onClick={() => handleDelete(rule.id)}
              className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
        {rules.length === 0 && (
          <div className="text-center py-12 text-gray-500 text-sm">
            No alert rules configured. Click "New Rule" to create one.
          </div>
        )}
      </div>
    </div>
  )
}
