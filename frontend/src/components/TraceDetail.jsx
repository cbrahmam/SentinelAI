import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, AlertTriangle, Clock } from 'lucide-react'
import { format } from 'date-fns'

const LEVEL_COLORS = {
  debug: 'text-gray-500',
  info: 'text-gray-300',
  warn: 'text-amber-400',
  error: 'text-red-400',
  fatal: 'text-red-300',
}

export default function TraceDetail() {
  const { traceId } = useParams()
  const [trace, setTrace] = useState(null)

  useEffect(() => {
    fetch(`/api/traces/${traceId}`)
      .then(r => r.json())
      .then(d => setTrace(d))
      .catch(console.error)
  }, [traceId])

  if (!trace) {
    return <div className="flex items-center justify-center h-64 text-gray-400">Loading trace...</div>
  }

  const services = [...new Set(trace.spans.map(s => s.service))]

  return (
    <div className="space-y-4">
      <Link to="/logs" className="inline-flex items-center gap-1.5 text-gray-400 hover:text-white text-sm transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Logs
      </Link>

      <div className="bg-[#111827] border border-gray-700/50 rounded-lg p-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-white mb-1">Distributed Trace</h1>
            <span className="text-xs text-gray-500 font-mono">{trace.trace_id}</span>
          </div>
          <div className="flex items-center gap-4 text-xs text-gray-400">
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {trace.total_duration_ms.toFixed(1)}ms</span>
            <span>{trace.spans.length} spans</span>
            <span>{services.length} services</span>
            {trace.error_service && (
              <span className="flex items-center gap-1 text-red-400">
                <AlertTriangle className="w-3 h-3" /> Error in {trace.error_service}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="bg-[#111827] border border-gray-700/50 rounded-lg p-5">
        <h3 className="text-sm font-medium text-gray-300 mb-4">Request Flow</h3>
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          {services.map((svc, i) => (
            <div key={svc} className="flex items-center gap-2">
              {i > 0 && <span className="text-gray-600">-&gt;</span>}
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                svc === trace.error_service
                  ? 'bg-red-500/15 text-red-400 border border-red-500/30'
                  : 'bg-gray-800 text-gray-300 border border-gray-700'
              }`}>
                {svc}
              </span>
            </div>
          ))}
        </div>

        <div className="relative">
          <div className="absolute left-4 top-0 bottom-0 w-px bg-gray-700" />
          <div className="space-y-3">
            {trace.spans.map((span, i) => {
              const isError = span.level === 'error' || span.level === 'fatal'
              let ts = ''
              try { ts = format(new Date(span.timestamp), 'HH:mm:ss.SSS') } catch { ts = span.timestamp }
              return (
                <div key={i} className="relative flex items-start gap-3 pl-1">
                  <div className={`relative z-10 w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                    isError ? 'bg-red-500/15 text-red-400' : 'bg-gray-700/50 text-gray-400'
                  }`}>
                    <span className="text-xs font-mono">{i + 1}</span>
                  </div>
                  <div className="flex-1 bg-gray-800/30 rounded-lg px-3 py-2">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs text-cyan-400 font-medium">{span.service}</span>
                      <span className={`text-xs uppercase font-medium ${LEVEL_COLORS[span.level] || 'text-gray-400'}`}>{span.level}</span>
                      <span className="text-xs text-gray-500">{ts}</span>
                      {span.span_id && <span className="text-xs text-gray-600 font-mono">{span.span_id.slice(0, 8)}</span>}
                    </div>
                    <p className={`text-xs ${isError ? 'text-red-300' : 'text-gray-300'}`}>{span.message}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {trace.root_cause_log && (
          <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
            <h4 className="text-xs font-medium text-red-400 mb-1">Root Cause</h4>
            <p className="text-xs text-red-300">{trace.root_cause_log}</p>
          </div>
        )}
      </div>
    </div>
  )
}
