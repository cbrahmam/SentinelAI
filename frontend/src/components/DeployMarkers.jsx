import { useState, useEffect } from 'react'
import { Rocket, GitCommit, User, Clock, CheckCircle, XCircle, Plus, Trash2 } from 'lucide-react'
import { format } from 'date-fns'

const SERVICES = [
  'api-gateway', 'auth-service', 'user-service', 'payment-service',
  'notification-service', 'postgres-primary', 'redis-cache', 'rabbitmq',
]

export default function DeployMarkers() {
  const [deploys, setDeploys] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [filter, setFilter] = useState('')
  const [form, setForm] = useState({
    service: 'api-gateway', version: '', deployer: '', description: '', commit_sha: '', status: 'success',
  })

  const fetchDeploys = async () => {
    const q = filter ? `?service=${filter}` : ''
    const res = await fetch(`/api/deploys${q}`)
    const data = await res.json()
    setDeploys(data.deploys || [])
  }

  useEffect(() => { fetchDeploys() }, [filter])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.version) return
    await fetch('/api/deploys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setShowForm(false)
    setForm({ service: 'api-gateway', version: '', deployer: '', description: '', commit_sha: '', status: 'success' })
    fetchDeploys()
  }

  const handleDelete = async (id) => {
    await fetch(`/api/deploys/${id}`, { method: 'DELETE' })
    fetchDeploys()
  }

  const statusColor = (s) => s === 'success' ? 'text-emerald-400' : s === 'failed' ? 'text-red-400' : 'text-amber-400'
  const StatusIcon = ({ status }) => status === 'success' ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <XCircle className="w-4 h-4 text-red-400" />

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <Rocket className="w-5 h-5 text-cyan-400" /> Deployments
          </h2>
          <span className="text-xs text-gray-500">{deploys.length} events</span>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="bg-gray-800 text-gray-300 text-xs rounded-lg px-3 py-2 border border-gray-700"
          >
            <option value="">All Services</option>
            {SERVICES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-1.5 px-3 py-2 bg-cyan-500/15 text-cyan-400 rounded-lg text-xs font-medium hover:bg-cyan-500/25"
          >
            <Plus className="w-3.5 h-3.5" /> Record Deploy
          </button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-[#111827] border border-gray-700/50 rounded-lg p-4 space-y-3">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Service</label>
              <select value={form.service} onChange={e => setForm({...form, service: e.target.value})}
                className="w-full bg-gray-800 text-white text-xs rounded px-2 py-1.5 border border-gray-700">
                {SERVICES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Version</label>
              <input value={form.version} onChange={e => setForm({...form, version: e.target.value})}
                placeholder="v1.2.3" className="w-full bg-gray-800 text-white text-xs rounded px-2 py-1.5 border border-gray-700" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Deployer</label>
              <input value={form.deployer} onChange={e => setForm({...form, deployer: e.target.value})}
                placeholder="engineer" className="w-full bg-gray-800 text-white text-xs rounded px-2 py-1.5 border border-gray-700" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Commit SHA</label>
              <input value={form.commit_sha} onChange={e => setForm({...form, commit_sha: e.target.value})}
                placeholder="abc1234" className="w-full bg-gray-800 text-white text-xs rounded px-2 py-1.5 border border-gray-700" />
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Description</label>
            <input value={form.description} onChange={e => setForm({...form, description: e.target.value})}
              placeholder="What changed?" className="w-full bg-gray-800 text-white text-xs rounded px-2 py-1.5 border border-gray-700" />
          </div>
          <div className="flex items-center gap-3">
            <select value={form.status} onChange={e => setForm({...form, status: e.target.value})}
              className="bg-gray-800 text-white text-xs rounded px-2 py-1.5 border border-gray-700">
              <option value="success">Success</option>
              <option value="failed">Failed</option>
              <option value="rolling_back">Rolling Back</option>
            </select>
            <button type="submit" className="px-4 py-1.5 bg-cyan-500 text-black text-xs font-medium rounded hover:bg-cyan-400">
              Record
            </button>
          </div>
        </form>
      )}

      <div className="relative">
        <div className="absolute left-6 top-0 bottom-0 w-px bg-gray-700/50" />
        <div className="space-y-1">
          {deploys.map((d) => (
            <div key={d.id} className="relative pl-12 pr-4 py-3 bg-[#111827] border border-gray-700/50 rounded-lg hover:border-gray-600/50 group">
              <div className="absolute left-4 top-4 w-4 h-4 rounded-full bg-gray-800 border-2 border-cyan-500 z-10" />
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-white">{d.service}</span>
                    <span className="px-1.5 py-0.5 bg-cyan-500/15 text-cyan-400 text-xs rounded font-mono">{d.version}</span>
                    <StatusIcon status={d.status} />
                    <span className={`text-xs ${statusColor(d.status)}`}>{d.status}</span>
                  </div>
                  {d.description && <p className="text-xs text-gray-400 mb-1">{d.description}</p>}
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    {d.deployer && (
                      <span className="flex items-center gap-1"><User className="w-3 h-3" />{d.deployer}</span>
                    )}
                    {d.commit_sha && (
                      <span className="flex items-center gap-1"><GitCommit className="w-3 h-3" />{d.commit_sha.slice(0, 7)}</span>
                    )}
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {format(new Date(d.timestamp), 'MMM d, HH:mm:ss')}
                    </span>
                  </div>
                </div>
                <button onClick={() => handleDelete(d.id)} className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
          {deploys.length === 0 && (
            <div className="text-center py-12 text-gray-500 text-sm">
              No deployments recorded yet. Click "Record Deploy" to add one.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
