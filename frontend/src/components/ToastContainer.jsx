import { useEffect, useState, useCallback } from 'react'
import { AlertTriangle, AlertOctagon, CheckCircle2, Info, X } from 'lucide-react'

const ICONS = {
  alert: AlertTriangle,
  incident: AlertOctagon,
  success: CheckCircle2,
  info: Info,
}

const COLORS = {
  alert: 'bg-red-500/15 border-red-500/30 text-red-300',
  incident: 'bg-amber-500/15 border-amber-500/30 text-amber-300',
  success: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300',
  info: 'bg-cyan-500/15 border-cyan-500/30 text-cyan-300',
}

let _addToast = () => {}

export function toast(type, title, message) {
  _addToast({ type, title, message, id: Date.now() + Math.random() })
}

export default function ToastContainer() {
  const [toasts, setToasts] = useState([])

  _addToast = useCallback((t) => {
    setToasts((prev) => [...prev, t].slice(-5))
    setTimeout(() => {
      setToasts((prev) => prev.filter((x) => x.id !== t.id))
    }, 6000)
  }, [])

  const dismiss = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }

  if (toasts.length === 0) return null

  return (
    <div className="fixed top-16 right-4 z-50 space-y-2 w-80">
      {toasts.map((t) => {
        const Icon = ICONS[t.type] || Info
        const colorClass = COLORS[t.type] || COLORS.info
        return (
          <div
            key={t.id}
            className={`flex items-start gap-3 px-4 py-3 rounded-lg border shadow-xl backdrop-blur-sm animate-slide-in ${colorClass}`}
          >
            <Icon className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{t.title}</p>
              {t.message && <p className="text-xs opacity-70 mt-0.5 truncate">{t.message}</p>}
            </div>
            <button onClick={() => dismiss(t.id)} className="shrink-0 opacity-50 hover:opacity-100 transition-opacity">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
