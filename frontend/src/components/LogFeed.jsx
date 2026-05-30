import { useEffect, useRef } from 'react'
import { Pause, Play, Search } from 'lucide-react'
import { format } from 'date-fns'
import useStore from '../stores/useStore'

const SERVICES = [
  '', 'api-gateway', 'auth-service', 'user-service', 'payment-service',
  'notification-service', 'postgres-primary', 'redis-cache', 'rabbitmq',
]
const LEVELS = ['', 'debug', 'info', 'warn', 'error', 'fatal']

const LEVEL_CLASS = {
  debug: 'log-debug',
  info: 'log-info',
  warn: 'log-warn',
  error: 'log-error',
  fatal: 'log-fatal',
}

export default function LogFeed() {
  const { recentLogs, logsPaused, setLogsPaused, logFilter, setLogFilter, fetchLogs } = useStore()
  const containerRef = useRef(null)

  useEffect(() => {
    fetchLogs({ limit: 100 }).then((logs) => {
      useStore.setState({ recentLogs: logs })
    })
  }, [fetchLogs])

  return (
    <div className="bg-[#111827] border border-gray-700/50 rounded-lg">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700/50">
        <h3 className="text-sm font-medium text-gray-300">Live Log Feed</h3>
        <div className="flex items-center gap-2">
          <select
            value={logFilter.service}
            onChange={(e) => setLogFilter({ service: e.target.value })}
            className="bg-gray-800 text-gray-300 text-xs rounded px-2 py-1 border-none outline-none"
          >
            {SERVICES.map((s) => (
              <option key={s} value={s}>{s || 'All Services'}</option>
            ))}
          </select>
          <select
            value={logFilter.level}
            onChange={(e) => setLogFilter({ level: e.target.value })}
            className="bg-gray-800 text-gray-300 text-xs rounded px-2 py-1 border-none outline-none"
          >
            {LEVELS.map((l) => (
              <option key={l} value={l}>{l || 'All Levels'}</option>
            ))}
          </select>
          <button
            onClick={() => setLogsPaused(!logsPaused)}
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
              logsPaused
                ? 'bg-amber-500/15 text-amber-400'
                : 'bg-gray-700 text-gray-400 hover:text-gray-200'
            }`}
          >
            {logsPaused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
            {logsPaused ? 'Resume' : 'Pause'}
          </button>
        </div>
      </div>
      <div
        ref={containerRef}
        className="h-64 overflow-y-auto p-3 font-mono text-xs leading-relaxed"
      >
        {recentLogs.length === 0 ? (
          <div className="h-full flex items-center justify-center text-gray-500">
            No logs yet. Start the simulator to see live logs.
          </div>
        ) : (
          recentLogs.map((log, i) => {
            const levelClass = LEVEL_CLASS[log.level] || 'log-info'
            let ts = ''
            try {
              ts = format(new Date(log.timestamp), 'HH:mm:ss')
            } catch { ts = '--:--:--' }
            return (
              <div key={`${log.timestamp}-${i}`} className="flex gap-2 py-0.5 hover:bg-gray-800/50 rounded px-1">
                <span className="text-gray-600 shrink-0">{ts}</span>
                <span className={`uppercase w-12 shrink-0 font-medium ${levelClass}`}>
                  {log.level}
                </span>
                <span className="text-cyan-400/70 w-36 shrink-0 truncate">{log.service}</span>
                <span className={levelClass}>{log.message}</span>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
