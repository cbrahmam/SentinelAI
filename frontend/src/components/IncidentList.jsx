import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertOctagon, Clock, CheckCircle2, Search, Plus, ArrowRight } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import useStore from '../stores/useStore'

const SEVERITY_COLORS = {
  P1: 'bg-red-500/20 text-red-300 border-red-500/30',
  P2: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  P3: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  P4: 'bg-gray-500/20 text-gray-300 border-gray-500/30',
}

const STATUS_COLORS = {
  investigating: 'bg-red-500/15 text-red-400',
  identified: 'bg-amber-500/15 text-amber-400',
  monitoring: 'bg-blue-500/15 text-blue-400',
  resolved: 'bg-emerald-500/15 text-emerald-400',
  postmortem: 'bg-purple-500/15 text-purple-400',
}

const STATUS_ICONS = {
  investigating: AlertOctagon,
  identified: Search,
  monitoring: Clock,
  resolved: CheckCircle2,
  postmortem: CheckCircle2,
}

export default function IncidentList() {
  const { incidents, fetchIncidents, createIncident } = useStore()
  const [statusFilter, setStatusFilter] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newSeverity, setNewSeverity] = useState('P3')

  useEffect(() => {
    fetchIncidents(statusFilter || undefined)
  }, [fetchIncidents, statusFilter])

  const handleCreate = async () => {
    if (!newTitle.trim()) return
    await createIncident(newTitle, newSeverity, [])
    setNewTitle('')
    setShowCreate(false)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Incidents</h2>
        <div className="flex items-center gap-3">
          <div className="flex bg-gray-800 rounded-lg p-0.5">
            {['', 'investigating', 'identified', 'monitoring', 'resolved'].map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                  statusFilter === s ? 'bg-gray-600 text-white' : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                {s || 'All'}
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-500/15 text-cyan-400 rounded-lg text-xs font-medium hover:bg-cyan-500/25 transition-colors"
          >
            <Plus className="w-3 h-3" /> New Incident
          </button>
        </div>
      </div>

      {showCreate && (
        <div className="bg-[#111827] border border-gray-700/50 rounded-lg p-4">
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label className="block text-xs text-gray-400 mb-1">Title</label>
              <input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Describe the incident..."
                className="w-full bg-gray-800 text-white text-sm rounded px-3 py-2 border border-gray-700 outline-none focus:border-cyan-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Severity</label>
              <select
                value={newSeverity}
                onChange={(e) => setNewSeverity(e.target.value)}
                className="bg-gray-800 text-white text-sm rounded px-3 py-2 border border-gray-700 outline-none"
              >
                <option value="P1">P1 - Critical</option>
                <option value="P2">P2 - High</option>
                <option value="P3">P3 - Medium</option>
                <option value="P4">P4 - Low</option>
              </select>
            </div>
            <button
              onClick={handleCreate}
              className="px-4 py-2 bg-cyan-500 text-black text-sm font-medium rounded hover:bg-cyan-400 transition-colors"
            >
              Create
            </button>
          </div>
        </div>
      )}

      {incidents.length === 0 ? (
        <div className="bg-[#111827] border border-gray-700/50 rounded-lg p-12 text-center">
          <AlertOctagon className="w-8 h-8 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400">No incidents found.</p>
          <p className="text-gray-500 text-sm mt-1">
            Incidents are auto-created when correlated anomalies are detected across services.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {incidents.map((inc) => {
            const StatusIcon = STATUS_ICONS[inc.status] || AlertOctagon
            const duration = inc.started_at
              ? formatDistanceToNow(new Date(inc.started_at), { addSuffix: false })
              : '--'
            return (
              <Link
                key={inc.id}
                to={`/incidents/${inc.id}`}
                className="block bg-[#111827] border border-gray-700/50 rounded-lg p-4 hover:border-gray-600 transition-colors group"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${SEVERITY_COLORS[inc.severity] || SEVERITY_COLORS.P3}`}>
                        {inc.severity}
                      </span>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[inc.status] || STATUS_COLORS.investigating}`}>
                        <StatusIcon className="w-3 h-3" />
                        {inc.status}
                      </span>
                      <span className="text-xs text-gray-500">{inc.id}</span>
                    </div>
                    <h3 className="text-sm font-medium text-white truncate">{inc.title}</h3>
                    <div className="flex items-center gap-4 mt-2">
                      <div className="flex items-center gap-1 text-xs text-gray-400">
                        <Clock className="w-3 h-3" />
                        {duration}
                      </div>
                      {inc.affected_services && inc.affected_services.length > 0 && (
                        <div className="flex items-center gap-1 flex-wrap">
                          {inc.affected_services.map((svc) => (
                            <span key={svc} className="px-1.5 py-0.5 bg-gray-800 text-gray-400 text-xs rounded">
                              {svc}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-gray-600 group-hover:text-gray-400 transition-colors shrink-0 mt-1" />
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
