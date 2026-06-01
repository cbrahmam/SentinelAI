import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { Search, Download, Play, Pause, ChevronDown, ChevronRight, ExternalLink } from 'lucide-react'
import { format } from 'date-fns'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts'

const SERVICES = [
  'api-gateway', 'auth-service', 'user-service', 'payment-service',
  'notification-service', 'postgres-primary', 'redis-cache', 'rabbitmq',
]
const LEVELS = ['debug', 'info', 'warn', 'error', 'fatal']

const LEVEL_COLORS = {
  debug: 'text-gray-500',
  info: 'text-gray-300',
  warn: 'text-amber-400',
  error: 'text-red-400',
  fatal: 'text-red-300 font-bold',
}

const LEVEL_BAR_COLORS = {
  debug: '#6B7280',
  info: '#10B981',
  warn: '#F59E0B',
  error: '#EF4444',
  fatal: '#DC2626',
}

export default function LogExplorer() {
  const [logs, setLogs] = useState([])
  const [histogram, setHistogram] = useState([])
  const [searchText, setSearchText] = useState('')
  const [serviceFilter, setServiceFilter] = useState('')
  const [levelFilter, setLevelFilter] = useState('')
  const [expandedIdx, setExpandedIdx] = useState(null)
  const [live, setLive] = useState(false)
  const esRef = useRef(null)

  const fetchLogs = async () => {
    const q = new URLSearchParams()
    if (serviceFilter) q.set('service', serviceFilter)
    if (levelFilter) q.set('level', levelFilter)
    if (searchText) q.set('search_text', searchText)
    q.set('limit', '200')
    try {
      const res = await fetch(`/api/logs?${q}`)
      const data = await res.json()
      setLogs(data.data || [])
    } catch (e) {
      console.error('Log fetch error:', e)
    }
  }

  const fetchHistogram = async () => {
    const q = new URLSearchParams()
    if (serviceFilter) q.set('service', serviceFilter)
    try {
      const res = await fetch(`/api/logs/counts?${q}`)
      const data = await res.json()
      const bucketMap = {}
      for (const row of (data.data || [])) {
        if (!bucketMap[row.bucket]) bucketMap[row.bucket] = { bucket: row.bucket }
        bucketMap[row.bucket][row.level] = row.count
      }
      setHistogram(Object.values(bucketMap))
    } catch (e) {
      console.error('Histogram fetch error:', e)
    }
  }

  useEffect(() => {
    fetchLogs()
    fetchHistogram()
  }, [serviceFilter, levelFilter])

  const handleSearch = (e) => {
    e.preventDefault()
    fetchLogs()
  }

  useEffect(() => {
    if (live) {
      esRef.current = new EventSource('/api/stream/all')
      esRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          if (data.type === 'log') {
            if (serviceFilter && data.service !== serviceFilter) return
            if (levelFilter && data.level !== levelFilter) return
            setLogs((prev) => [data, ...prev].slice(0, 200))
          }
        } catch {}
      }
      return () => { esRef.current?.close() }
    } else {
      esRef.current?.close()
    }
  }, [live, serviceFilter, levelFilter])

  const handleExport = (fmt) => {
    const content = fmt === 'json'
      ? JSON.stringify(logs, null, 2)
      : [
          'timestamp,service,level,message',
          ...logs.map(l => `${l.timestamp},${l.service},${l.level},"${(l.message || '').replace(/"/g, '""')}"`)
        ].join('\n')

    const blob = new Blob([content], { type: fmt === 'json' ? 'application/json' : 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `logs.${fmt}`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Log Explorer</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setLive(!live)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              live ? 'bg-emerald-500/15 text-emerald-400' : 'bg-gray-700 text-gray-400 hover:text-gray-200'
            }`}
          >
            {live ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
            {live ? 'Live' : 'Paused'}
          </button>
          <button onClick={() => handleExport('csv')} className="flex items-center gap-1 px-3 py-1.5 bg-gray-700 text-gray-400 rounded-lg text-xs hover:text-gray-200 transition-colors">
            <Download className="w-3 h-3" /> CSV
          </button>
          <button onClick={() => handleExport('json')} className="flex items-center gap-1 px-3 py-1.5 bg-gray-700 text-gray-400 rounded-lg text-xs hover:text-gray-200 transition-colors">
            <Download className="w-3 h-3" /> JSON
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <form onSubmit={handleSearch} className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Search logs..."
            className="w-full bg-[#111827] text-white text-sm rounded-lg pl-10 pr-4 py-2.5 border border-gray-700/50 outline-none focus:border-cyan-500"
          />
        </form>
        <select
          value={serviceFilter}
          onChange={(e) => setServiceFilter(e.target.value)}
          className="bg-[#111827] text-gray-300 text-sm rounded-lg px-3 py-2.5 border border-gray-700/50 outline-none"
        >
          <option value="">All Services</option>
          {SERVICES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select
          value={levelFilter}
          onChange={(e) => setLevelFilter(e.target.value)}
          className="bg-[#111827] text-gray-300 text-sm rounded-lg px-3 py-2.5 border border-gray-700/50 outline-none"
        >
          <option value="">All Levels</option>
          {LEVELS.map(l => <option key={l} value={l}>{l.toUpperCase()}</option>)}
        </select>
      </div>

      {histogram.length > 0 && (
        <div className="bg-[#111827] border border-gray-700/50 rounded-lg p-4">
          <h3 className="text-xs font-medium text-gray-400 mb-2">Log Volume</h3>
          <div className="h-24">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={histogram}>
                <XAxis dataKey="bucket" tick={{ fontSize: 8, fill: '#6B7280' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 8, fill: '#6B7280' }} axisLine={false} tickLine={false} width={30} />
                <Tooltip contentStyle={{ background: '#1F2937', border: '1px solid #374151', borderRadius: '6px', fontSize: '10px' }} />
                {LEVELS.map(lvl => (
                  <Bar key={lvl} dataKey={lvl} stackId="a" fill={LEVEL_BAR_COLORS[lvl]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="bg-[#111827] border border-gray-700/50 rounded-lg">
        <div className="px-4 py-2 border-b border-gray-700/50 text-xs text-gray-500">
          {logs.length} logs loaded
        </div>
        <div className="h-[500px] overflow-y-auto font-mono text-xs leading-relaxed">
          {logs.length === 0 ? (
            <div className="text-gray-500 text-center py-12">No logs match the current filters.</div>
          ) : logs.map((log, i) => {
            const expanded = expandedIdx === i
            let ts = ''
            try { ts = format(new Date(log.timestamp), 'HH:mm:ss.SSS') } catch { ts = '--' }
            return (
              <div key={`${log.timestamp}-${i}`}>
                <div
                  onClick={() => setExpandedIdx(expanded ? null : i)}
                  className="flex items-center gap-2 py-1 px-3 hover:bg-gray-800/50 cursor-pointer"
                >
                  {expanded ? <ChevronDown className="w-3 h-3 text-gray-500 shrink-0" /> : <ChevronRight className="w-3 h-3 text-gray-500 shrink-0" />}
                  <span className="text-gray-600 shrink-0 w-20">{ts}</span>
                  <span className="text-cyan-400/70 shrink-0 w-36 truncate">{log.service}</span>
                  <span className={`uppercase shrink-0 w-12 font-medium ${LEVEL_COLORS[log.level] || 'text-gray-400'}`}>{log.level}</span>
                  <span className={`truncate ${LEVEL_COLORS[log.level] || 'text-gray-300'}`}>{log.message}</span>
                </div>
                {expanded && (
                  <div className="bg-gray-800/30 px-8 py-3 border-t border-gray-700/30 space-y-1.5">
                    {log.raw_line && (
                      <div><span className="text-gray-500">Raw: </span><span className="text-gray-300">{log.raw_line}</span></div>
                    )}
                    {log.trace_id && (
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500">Trace: </span>
                        <span className="text-cyan-400">{log.trace_id}</span>
                        <Link to={`/traces/${log.trace_id}`} className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300">
                          <ExternalLink className="w-3 h-3" /> View Trace
                        </Link>
                      </div>
                    )}
                    {log.span_id && (
                      <div><span className="text-gray-500">Span: </span><span className="text-gray-300">{log.span_id}</span></div>
                    )}
                    {log.structured_data && (
                      <div>
                        <span className="text-gray-500">Data: </span>
                        <span className="text-gray-300">{JSON.stringify(log.structured_data)}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
