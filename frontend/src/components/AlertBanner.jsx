import { AlertTriangle, Eye, CheckCircle } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import useStore from '../stores/useStore'

export default function AlertBanner() {
  const { alerts, acknowledgeAlert } = useStore()

  if (!alerts || alerts.length === 0) return null

  return (
    <div className="mx-4 lg:mx-6 mt-3">
      <div className="space-y-2 max-h-36 overflow-y-auto">
        {alerts.slice(0, 5).map((alert) => (
          <div
            key={alert.id}
            className={`flex items-center justify-between px-4 py-2.5 rounded-lg text-sm ${
              alert.severity === 'critical'
                ? 'bg-red-500/10 border border-red-500/30'
                : 'bg-amber-500/10 border border-amber-500/30'
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <AlertTriangle className={`w-4 h-4 shrink-0 ${
                alert.severity === 'critical' ? 'text-red-400' : 'text-amber-400'
              }`} />
              <div className="min-w-0">
                <span className={`font-medium ${
                  alert.severity === 'critical' ? 'text-red-300' : 'text-amber-300'
                }`}>
                  {alert.title}
                </span>
                <span className="text-gray-400 text-xs ml-2">
                  {alert.fired_at ? formatDistanceToNow(new Date(alert.fired_at), { addSuffix: true }) : ''}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 ml-3">
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                alert.severity === 'critical'
                  ? 'bg-red-500/20 text-red-300'
                  : 'bg-amber-500/20 text-amber-300'
              }`}>
                {alert.severity}
              </span>
              {alert.status === 'firing' && (
                <button
                  onClick={() => acknowledgeAlert(alert.id)}
                  className="flex items-center gap-1 px-2 py-1 bg-gray-700 text-gray-300 rounded text-xs hover:bg-gray-600 transition-colors"
                >
                  <CheckCircle className="w-3 h-3" /> Ack
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
