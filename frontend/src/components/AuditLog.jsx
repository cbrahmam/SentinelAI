import { useState, useEffect } from 'react'
import { ClipboardList, RefreshCw, Filter, Clock, User, Settings, Rocket, AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react'

const RESOURCE_COLORS = {
  alert_rule: 'text-amber-400 bg-amber-500/15',
  oncall_schedule: 'text-cyan-400 bg-cyan-500/15',
  notification_channel: 'text-purple-400 bg-purple-500/15',
  dashboard_layout: 'text-blue-400 bg-blue-500/15',
  deploy: 'text-emerald-400 bg-emerald-500/15',
  threshold: 'text-orange-400 bg-orange-500/15',
  incident: 'text-red-400 bg-red-500/15',
  system: 'text-gray-400 bg-gray-500/15',
}

const TIMELINE_ICONS = {
  config_change: Settings,
  incident: AlertTriangle,
  deploy: Rocket,
}

const TIMELINE_COLORS = {
  config_change: 'text-cyan-400 border-cyan-500/50',
  incident: 'text-red-400 border-red-500/50',
  deploy: 'text-emerald-400 border-emerald-500/50',
}

function TimeAgo({ ts }) {
  const diff = Date.now() - new Date(ts + 'Z').getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return <span className="text-gray-500 text-xs">just now</span>
  if (mins < 60) return <span className="text-gray-500 text-xs">{mins}m ago</span>
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return <span className="text-gray-500 text-xs">{hrs}h ago</span>
  return <span className="text-gray-500 text-xs">{Math.floor(hrs / 24)}d ago</span>
}

export default function AuditLog() {
  const [tab, setTab] = useState('log')
  const [events, setEvents] = useState([])
  const [timeline, setTimeline] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [hours, setHours] = useState(168)
  const [filterType, setFilterType] = useState('')
  const [expandedEvent, setExpandedEvent] = useState(null)

  const fetchLog = async () => {
    setLoading(true)
    try {
      const url = `/api/audit?hours=${hours}&limit=200` + (filterType ? `&resource_type=${filterType}` : '')
      const res = await fetch(url)
      const data = await res.json()
      setEvents(data.events || [])
    } catch {}
    setLoading(false)
  }

  const fetchTimeline = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/audit/timeline?hours=${Math.min(hours, 168)}`)
      const data = await res.json()
      setTimeline(data.timeline || [])
    } catch {}
    setLoading(false)
  }

  const fetchStats = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/audit/stats?hours=${hours}`)
      const data = await res.json()
      setStats(data)
    } catch {}
    setLoading(false)
  }

  useEffect(() => {
    if (tab === 'log') fetchLog()
    else if (tab === 'timeline') fetchTimeline()
    else fetchStats()
  }, [tab, hours, filterType])

  const resourceTypes = [...new Set(events.map(e => e.resource_type))]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-cyan-400" /> Audit Log & Change Tracker
        </h2>
        <div className="flex items-center gap-3">
          <select value={hours} onChange={e => setHours(Number(e.target.value))}
            className="bg-gray-800 text-gray-300 text-xs rounded-lg px-3 py-2 border border-gray-700">
            <option value={24}>Last 24 hours</option>
            <option value={72}>Last 3 days</option>
            <option value={168}>Last 7 days</option>
            <option value={720}>Last 30 days</option>
          </select>
          <button onClick={() => { if (tab === 'log') fetchLog(); else if (tab === 'timeline') fetchTimeline(); else fetchStats() }}
            className="flex items-center gap-1.5 px-3 py-2 bg-gray-800 text-gray-300 rounded-lg text-xs hover:bg-gray-700">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      <div className="flex gap-1 bg-gray-800/50 rounded-lg p-1 w-fit">
        {['log', 'timeline', 'stats'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-md text-xs font-medium transition-colors capitalize ${tab === t ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-gray-200'}`}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'log' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-gray-500" />
            <button onClick={() => setFilterType('')}
              className={`px-2 py-1 rounded text-xs ${!filterType ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-gray-200'}`}>
              All
            </button>
            {resourceTypes.map(rt => (
              <button key={rt} onClick={() => setFilterType(rt)}
                className={`px-2 py-1 rounded text-xs ${filterType === rt ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-gray-200'}`}>
                {rt.replace(/_/g, ' ')}
              </button>
            ))}
          </div>

          {events.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <ClipboardList className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No audit events recorded yet</p>
              <p className="text-xs mt-1">Config changes will appear here automatically</p>
            </div>
          ) : (
            <div className="space-y-1">
              {events.map(e => {
                const colorClass = RESOURCE_COLORS[e.resource_type] || RESOURCE_COLORS.system
                const isExpanded = expandedEvent === e.id
                return (
                  <div key={e.id} className="bg-[#111827] border border-gray-700/50 rounded-lg px-4 py-3">
                    <div className="flex items-center justify-between cursor-pointer"
                      onClick={() => setExpandedEvent(isExpanded ? null : e.id)}>
                      <div className="flex items-center gap-3">
                        {isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-gray-500" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-500" />}
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${colorClass}`}>
                          {e.resource_type.replace(/_/g, ' ')}
                        </span>
                        <span className="text-sm text-white">{e.action}</span>
                        {e.resource_name && (
                          <span className="text-xs text-gray-400">— {e.resource_name}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-gray-400 flex items-center gap-1">
                          <User className="w-3 h-3" /> {e.actor}
                        </span>
                        <TimeAgo ts={e.timestamp} />
                      </div>
                    </div>
                    {isExpanded && e.details && (
                      <div className="mt-3 pt-3 border-t border-gray-700/50">
                        <pre className="text-xs text-gray-400 bg-gray-800/50 rounded p-3 overflow-auto">
                          {JSON.stringify(e.details, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {tab === 'timeline' && (
        <div className="space-y-0">
          {timeline.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No events in this time range</p>
            </div>
          ) : (
            <div className="relative ml-4">
              <div className="absolute left-3 top-0 bottom-0 w-px bg-gray-700" />
              {timeline.map((item, i) => {
                const Icon = TIMELINE_ICONS[item.type] || Settings
                const color = TIMELINE_COLORS[item.type] || 'text-gray-400 border-gray-500/50'
                return (
                  <div key={`${item.type}-${item.id}-${i}`} className="relative flex items-start gap-4 pb-4">
                    <div className={`w-6 h-6 rounded-full border-2 bg-[#0B0F19] flex items-center justify-center z-10 ${color}`}>
                      <Icon className="w-3 h-3" />
                    </div>
                    <div className="flex-1 bg-[#111827] border border-gray-700/50 rounded-lg px-4 py-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-white">{item.title}</span>
                        <TimeAgo ts={item.timestamp} />
                      </div>
                      {item.detail && (
                        <p className="text-xs text-gray-400 mt-0.5">{item.detail}</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {tab === 'stats' && stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-[#111827] border border-gray-700/50 rounded-lg p-4">
            <p className="text-xs text-gray-500 mb-1">Total Events</p>
            <p className="text-2xl font-bold text-white">{stats.total_events}</p>
          </div>

          <div className="bg-[#111827] border border-gray-700/50 rounded-lg p-4">
            <p className="text-xs text-gray-500 mb-2">By Resource Type</p>
            {Object.entries(stats.by_resource_type || {}).map(([k, v]) => (
              <div key={k} className="flex items-center justify-between py-0.5">
                <span className="text-xs text-gray-400">{k.replace(/_/g, ' ')}</span>
                <span className="text-xs font-mono text-white">{v}</span>
              </div>
            ))}
            {Object.keys(stats.by_resource_type || {}).length === 0 && (
              <p className="text-xs text-gray-500">No data</p>
            )}
          </div>

          <div className="bg-[#111827] border border-gray-700/50 rounded-lg p-4">
            <p className="text-xs text-gray-500 mb-2">Top Actors</p>
            {Object.entries(stats.by_actor || {}).map(([k, v]) => (
              <div key={k} className="flex items-center justify-between py-0.5">
                <span className="text-xs text-gray-400">{k}</span>
                <span className="text-xs font-mono text-white">{v}</span>
              </div>
            ))}
            {Object.keys(stats.by_actor || {}).length === 0 && (
              <p className="text-xs text-gray-500">No data</p>
            )}
          </div>

          <div className="bg-[#111827] border border-gray-700/50 rounded-lg p-4">
            <p className="text-xs text-gray-500 mb-2">Top Actions</p>
            {Object.entries(stats.by_action || {}).map(([k, v]) => (
              <div key={k} className="flex items-center justify-between py-0.5">
                <span className="text-xs text-gray-400">{k}</span>
                <span className="text-xs font-mono text-white">{v}</span>
              </div>
            ))}
            {Object.keys(stats.by_action || {}).length === 0 && (
              <p className="text-xs text-gray-500">No data</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
