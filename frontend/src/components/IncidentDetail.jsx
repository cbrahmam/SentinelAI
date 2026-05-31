import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  ArrowLeft, AlertOctagon, Clock, CheckCircle2, Search, Eye, Brain,
  ChevronRight, Server, FileText,
} from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'
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

const STATUS_FLOW = ['investigating', 'identified', 'monitoring', 'resolved']

const EVENT_ICONS = {
  created: AlertOctagon,
  anomaly_detected: AlertOctagon,
  propagation: ChevronRight,
  status_change: Clock,
  alert_linked: AlertOctagon,
  ai_analysis: Brain,
  resolved: CheckCircle2,
  postmortem: FileText,
}

const EVENT_COLORS = {
  created: 'text-cyan-400 bg-cyan-500/15',
  anomaly_detected: 'text-red-400 bg-red-500/15',
  propagation: 'text-amber-400 bg-amber-500/15',
  status_change: 'text-blue-400 bg-blue-500/15',
  alert_linked: 'text-amber-400 bg-amber-500/15',
  ai_analysis: 'text-purple-400 bg-purple-500/15',
  resolved: 'text-emerald-400 bg-emerald-500/15',
  postmortem: 'text-purple-400 bg-purple-500/15',
}

export default function IncidentDetail() {
  const { id } = useParams()
  const { currentIncident, fetchIncident, updateIncidentStatus, resolveIncident, analyzeIncident } = useStore()
  const [resolution, setResolution] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [activeTab, setActiveTab] = useState('timeline')

  useEffect(() => {
    fetchIncident(id)
    const interval = setInterval(() => fetchIncident(id), 15000)
    return () => clearInterval(interval)
  }, [id, fetchIncident])

  if (!currentIncident) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">Loading incident...</div>
      </div>
    )
  }

  const inc = currentIncident
  const currentStatusIdx = STATUS_FLOW.indexOf(inc.status)

  const handleStatusChange = (newStatus) => {
    updateIncidentStatus(inc.id, newStatus)
  }

  const handleResolve = () => {
    if (!resolution.trim()) return
    resolveIncident(inc.id, resolution)
    setResolution('')
  }

  const handleAnalyze = async () => {
    setAnalyzing(true)
    await analyzeIncident(inc.id)
    setAnalyzing(false)
  }

  const duration = inc.started_at
    ? formatDistanceToNow(new Date(inc.started_at), { addSuffix: false })
    : '--'

  return (
    <div className="space-y-4">
      <Link to="/incidents" className="inline-flex items-center gap-1.5 text-gray-400 hover:text-white text-sm transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Incidents
      </Link>

      <div className="bg-[#111827] border border-gray-700/50 rounded-lg p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${SEVERITY_COLORS[inc.severity] || SEVERITY_COLORS.P3}`}>
                {inc.severity}
              </span>
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[inc.status] || STATUS_COLORS.investigating}`}>
                {inc.status}
              </span>
              <span className="text-xs text-gray-500">{inc.id}</span>
            </div>
            <h1 className="text-lg font-semibold text-white">{inc.title}</h1>
            <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
              <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Duration: {duration}</span>
              {inc.started_at && (
                <span>Started: {format(new Date(inc.started_at), 'MMM d, HH:mm')}</span>
              )}
              {inc.resolved_at && (
                <span className="text-emerald-400">Resolved: {format(new Date(inc.resolved_at), 'MMM d, HH:mm')}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {inc.status !== 'resolved' && inc.status !== 'postmortem' && (
              <>
                {STATUS_FLOW.slice(currentStatusIdx + 1).filter(s => s !== 'resolved').map((s) => (
                  <button
                    key={s}
                    onClick={() => handleStatusChange(s)}
                    className="px-3 py-1.5 bg-gray-700 text-gray-300 rounded-lg text-xs font-medium hover:bg-gray-600 transition-colors"
                  >
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </button>
                ))}
              </>
            )}
            <button
              onClick={handleAnalyze}
              disabled={analyzing}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-500/15 text-purple-400 rounded-lg text-xs font-medium hover:bg-purple-500/25 transition-colors disabled:opacity-50"
            >
              <Brain className="w-3 h-3" /> {analyzing ? 'Analyzing...' : 'AI Analysis'}
            </button>
          </div>
        </div>

        {inc.affected_services && inc.affected_services.length > 0 && (
          <div className="flex items-center gap-2 pt-3 border-t border-gray-700/50">
            <Server className="w-3.5 h-3.5 text-gray-500" />
            <span className="text-xs text-gray-500">Affected:</span>
            {inc.affected_services.map((svc) => (
              <span key={svc} className="px-2 py-0.5 bg-red-500/10 text-red-400 text-xs rounded border border-red-500/20">
                {svc}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-1 bg-gray-800/50 rounded-lg p-0.5">
        {['timeline', 'analysis', 'resolution'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 px-3 py-2 text-xs font-medium rounded-md transition-colors ${
              activeTab === tab ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {activeTab === 'timeline' && (
        <div className="bg-[#111827] border border-gray-700/50 rounded-lg p-5">
          <h3 className="text-sm font-medium text-gray-300 mb-4">Incident Timeline</h3>
          {(!inc.timeline || inc.timeline.length === 0) ? (
            <p className="text-gray-500 text-sm">No timeline events yet.</p>
          ) : (
            <div className="relative">
              <div className="absolute left-4 top-0 bottom-0 w-px bg-gray-700" />
              <div className="space-y-4">
                {inc.timeline.map((evt, i) => {
                  const Icon = EVENT_ICONS[evt.event_type] || Clock
                  const colorClass = EVENT_COLORS[evt.event_type] || 'text-gray-400 bg-gray-700/50'
                  let ts = ''
                  try {
                    ts = format(new Date(evt.timestamp), 'MMM d, HH:mm:ss')
                  } catch { ts = evt.timestamp }
                  return (
                    <div key={i} className="relative flex items-start gap-3 pl-1">
                      <div className={`relative z-10 w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${colorClass}`}>
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1 pt-0.5">
                        <p className="text-sm text-gray-200">{evt.description}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-gray-500">{ts}</span>
                          {evt.service && (
                            <span className="px-1.5 py-0.5 bg-gray-800 text-gray-400 text-xs rounded">{evt.service}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'analysis' && (
        <div className="bg-[#111827] border border-gray-700/50 rounded-lg p-5">
          <h3 className="text-sm font-medium text-gray-300 mb-4">AI Analysis</h3>
          {!inc.summary && !inc.root_cause ? (
            <div className="text-center py-8">
              <Brain className="w-8 h-8 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">No AI analysis generated yet.</p>
              <button
                onClick={handleAnalyze}
                disabled={analyzing}
                className="mt-3 px-4 py-2 bg-purple-500/15 text-purple-400 rounded-lg text-sm font-medium hover:bg-purple-500/25 transition-colors disabled:opacity-50"
              >
                {analyzing ? 'Analyzing...' : 'Generate Analysis'}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {inc.summary && (
                <div>
                  <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1.5">Summary</h4>
                  <p className="text-sm text-gray-200">{inc.summary}</p>
                </div>
              )}
              {inc.root_cause && (
                <div>
                  <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1.5">Root Cause</h4>
                  <p className="text-sm text-gray-200">{inc.root_cause}</p>
                </div>
              )}
              {inc.runbook && (
                <div>
                  <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1.5">Runbook</h4>
                  <pre className="text-sm text-gray-300 bg-gray-800/50 rounded p-3 whitespace-pre-wrap font-mono text-xs leading-relaxed">
                    {inc.runbook}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === 'resolution' && (
        <div className="bg-[#111827] border border-gray-700/50 rounded-lg p-5">
          <h3 className="text-sm font-medium text-gray-300 mb-4">Resolution</h3>
          {inc.status === 'resolved' || inc.status === 'postmortem' ? (
            <div className="space-y-4">
              {inc.resolution && (
                <div>
                  <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1.5">Resolution Notes</h4>
                  <p className="text-sm text-gray-200">{inc.resolution}</p>
                </div>
              )}
              {inc.postmortem && (
                <div>
                  <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1.5">Post-Mortem</h4>
                  <pre className="text-sm text-gray-300 bg-gray-800/50 rounded p-3 whitespace-pre-wrap font-mono text-xs leading-relaxed">
                    {inc.postmortem}
                  </pre>
                </div>
              )}
            </div>
          ) : (
            <div>
              <label className="block text-xs text-gray-400 mb-2">Resolution Notes</label>
              <textarea
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
                placeholder="Describe how the incident was resolved..."
                rows={4}
                className="w-full bg-gray-800 text-white text-sm rounded px-3 py-2 border border-gray-700 outline-none focus:border-cyan-500 resize-none"
              />
              <button
                onClick={handleResolve}
                disabled={!resolution.trim()}
                className="mt-3 px-4 py-2 bg-emerald-500 text-black text-sm font-medium rounded hover:bg-emerald-400 transition-colors disabled:opacity-50"
              >
                Resolve Incident
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
