import { useState, useEffect } from 'react'
import {
  LayoutGrid, Plus, Save, Trash2, GripVertical, Settings, X,
  BarChart3, Activity, AlertTriangle, ScrollText, Shield, AlertOctagon, Phone, TrendingUp,
} from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts'
import { format } from 'date-fns'
import useStore from '../stores/useStore'

const WIDGET_ICONS = {
  metric_chart: BarChart3,
  service_status: Activity,
  alert_list: AlertTriangle,
  log_feed: ScrollText,
  slo_gauge: Shield,
  incident_summary: AlertOctagon,
  oncall_widget: Phone,
  prediction_widget: TrendingUp,
}

const SERVICES = [
  'api-gateway', 'auth-service', 'user-service', 'payment-service',
  'notification-service', 'postgres-primary', 'redis-cache', 'rabbitmq',
]
const METRICS = ['cpu_usage', 'memory_usage', 'error_rate', 'p95_latency_ms', 'request_rate', 'queue_depth']

function MetricChartWidget({ config }) {
  const [data, setData] = useState([])
  const fetchMetrics = useStore((s) => s.fetchMetrics)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const raw = await fetchMetrics(config.service || 'api-gateway', config.metric_name || 'cpu_usage', '1h')
      if (!cancelled) {
        setData(raw.slice(-30).map(p => ({
          time: format(new Date(p.timestamp), 'HH:mm'),
          value: p.value,
        })))
      }
    }
    load()
    const interval = setInterval(load, 15000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [config.service, config.metric_name, fetchMetrics])

  return (
    <div className="h-full">
      <p className="text-xs text-gray-400 mb-1">{config.service} / {config.metric_name?.replace(/_/g, ' ')}</p>
      <ResponsiveContainer width="100%" height="85%">
        <LineChart data={data}>
          <XAxis dataKey="time" tick={{ fontSize: 8, fill: '#6B7280' }} tickLine={false} />
          <YAxis tick={{ fontSize: 8, fill: '#6B7280' }} width={30} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={{ background: '#1F2937', border: '1px solid #374151', fontSize: 10 }} />
          <Line type="monotone" dataKey="value" stroke={config.color || '#06B6D4'} strokeWidth={1.5} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

function ServiceStatusWidget({ config }) {
  const services = useStore((s) => s.services)
  const svc = services.find(s => s.name === (config.service || 'api-gateway'))
  if (!svc) return <p className="text-xs text-gray-500">No data</p>
  const isHealthy = svc.status === 'healthy'
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className={`w-2.5 h-2.5 rounded-full ${isHealthy ? 'bg-emerald-400' : 'bg-red-400'}`} />
        <span className="text-sm text-white font-medium">{svc.name}</span>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div><span className="text-gray-500">CPU</span><p className="text-white">{svc.cpu_usage?.toFixed(1)}%</p></div>
        <div><span className="text-gray-500">Memory</span><p className="text-white">{svc.memory_usage?.toFixed(1)}%</p></div>
        <div><span className="text-gray-500">Errors</span><p className="text-white">{svc.error_rate?.toFixed(2)}/s</p></div>
        <div><span className="text-gray-500">P95</span><p className="text-white">{svc.p95_latency_ms?.toFixed(0)}ms</p></div>
      </div>
    </div>
  )
}

function AlertListWidget({ config }) {
  const alerts = useStore((s) => s.alerts)
  const shown = alerts.slice(0, config.limit || 5)
  return (
    <div className="space-y-1.5 overflow-y-auto max-h-full">
      {shown.map((a, i) => (
        <div key={i} className="flex items-center justify-between text-xs">
          <span className="text-gray-300 truncate flex-1">{a.title || a.service}</span>
          <span className={`ml-2 px-1 py-0.5 rounded ${a.severity === 'critical' ? 'bg-red-500/15 text-red-400' : 'bg-amber-500/15 text-amber-400'}`}>
            {a.severity}
          </span>
        </div>
      ))}
      {shown.length === 0 && <p className="text-xs text-gray-500">No active alerts</p>}
    </div>
  )
}

function GenericWidget({ type }) {
  const [data, setData] = useState(null)

  useEffect(() => {
    const endpoints = {
      slo_gauge: '/api/slo',
      incident_summary: '/api/incidents?limit=5',
      oncall_widget: '/api/oncall/current',
      prediction_widget: '/api/predictions',
    }
    const url = endpoints[type]
    if (!url) return
    fetch(url).then(r => r.json()).then(setData).catch(() => {})
  }, [type])

  if (!data) return <p className="text-xs text-gray-500">Loading...</p>

  if (type === 'slo_gauge') {
    const svcs = data.services || []
    return (
      <div className="space-y-1.5 overflow-y-auto max-h-full">
        {svcs.slice(0, 4).map((s, i) => (
          <div key={i} className="flex items-center justify-between text-xs">
            <span className="text-gray-300">{s.service}</span>
            <span className={`font-mono ${s.uptime_percent >= 99 ? 'text-emerald-400' : 'text-amber-400'}`}>
              {s.uptime_percent?.toFixed(2)}%
            </span>
          </div>
        ))}
      </div>
    )
  }

  if (type === 'incident_summary') {
    const incidents = data.incidents || []
    return (
      <div className="space-y-1.5 overflow-y-auto max-h-full">
        <p className="text-xs text-gray-400">{data.count || 0} total incidents</p>
        {incidents.slice(0, 4).map((inc, i) => (
          <div key={i} className="flex items-center justify-between text-xs">
            <span className="text-gray-300 truncate flex-1">{inc.title}</span>
            <span className={`ml-2 px-1 py-0.5 rounded ${inc.status === 'resolved' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'}`}>
              {inc.status}
            </span>
          </div>
        ))}
      </div>
    )
  }

  if (type === 'oncall_widget') {
    const oncalls = data.oncall || []
    return (
      <div className="space-y-1.5">
        {oncalls.map((oc, i) => (
          <div key={i} className="text-xs">
            <p className="text-white font-medium">{oc.member?.name || 'None'}</p>
            <p className="text-gray-500">{oc.schedule_name}</p>
          </div>
        ))}
        {oncalls.length === 0 && <p className="text-xs text-gray-500">No schedules configured</p>}
      </div>
    )
  }

  if (type === 'prediction_widget') {
    const preds = data.predictions || []
    return (
      <div className="space-y-1.5 overflow-y-auto max-h-full">
        {preds.slice(0, 3).map((p, i) => (
          <div key={i} className="text-xs">
            <div className="flex items-center justify-between">
              <span className="text-gray-300">{p.service}/{p.metric_name}</span>
              <span className="text-amber-400 font-mono">{Math.floor(p.seconds_until_breach / 60)}m</span>
            </div>
          </div>
        ))}
        {preds.length === 0 && <p className="text-xs text-gray-500">No predictions</p>}
      </div>
    )
  }

  return null
}

function WidgetRenderer({ widget }) {
  const type = widget.type
  const config = widget.config || {}

  switch (type) {
    case 'metric_chart': return <MetricChartWidget config={config} />
    case 'service_status': return <ServiceStatusWidget config={config} />
    case 'alert_list': return <AlertListWidget config={config} />
    case 'log_feed': return <AlertListWidget config={config} />
    default: return <GenericWidget type={type} />
  }
}

export default function DashboardBuilder() {
  const [layouts, setLayouts] = useState([])
  const [currentLayout, setCurrentLayout] = useState(null)
  const [widgets, setWidgets] = useState([])
  const [showWidgetPicker, setShowWidgetPicker] = useState(false)
  const [widgetTypes, setWidgetTypes] = useState([])
  const [layoutName, setLayoutName] = useState('')
  const [editingWidget, setEditingWidget] = useState(null)

  const fetchLayouts = async () => {
    const res = await fetch('/api/layouts')
    const data = await res.json()
    setLayouts(data.layouts || [])
  }

  const fetchWidgetTypes = async () => {
    const res = await fetch('/api/layouts/widget-types')
    const data = await res.json()
    setWidgetTypes(data.types || [])
  }

  useEffect(() => { fetchLayouts(); fetchWidgetTypes() }, [])

  const loadLayout = (layout) => {
    setCurrentLayout(layout)
    setWidgets(layout.widgets || [])
    setLayoutName(layout.name)
  }

  const addWidget = (type) => {
    const id = `w-${Date.now()}`
    const newWidget = {
      id,
      type: type.type,
      title: type.label,
      config: type.type === 'metric_chart' ? { service: 'api-gateway', metric_name: 'cpu_usage', color: '#06B6D4' } :
              type.type === 'service_status' ? { service: 'api-gateway' } :
              type.type === 'alert_list' ? { limit: 5 } : {},
    }
    setWidgets([...widgets, newWidget])
    setShowWidgetPicker(false)
  }

  const removeWidget = (id) => setWidgets(widgets.filter(w => w.id !== id))

  const updateWidgetConfig = (id, key, value) => {
    setWidgets(widgets.map(w => w.id === id ? { ...w, config: { ...w.config, [key]: value } } : w))
  }

  const saveLayout = async () => {
    if (!layoutName) return
    const body = {
      name: layoutName,
      widgets: widgets,
      layout: widgets.map((w, i) => ({ id: w.id, x: (i % 3) * 4, y: Math.floor(i / 3) * 4, w: 4, h: 4 })),
    }
    if (currentLayout) {
      await fetch(`/api/layouts/${currentLayout.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    } else {
      await fetch('/api/layouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    }
    fetchLayouts()
  }

  const deleteLayout = async (id) => {
    await fetch(`/api/layouts/${id}`, { method: 'DELETE' })
    if (currentLayout?.id === id) {
      setCurrentLayout(null)
      setWidgets([])
      setLayoutName('')
    }
    fetchLayouts()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white flex items-center gap-2">
          <LayoutGrid className="w-5 h-5 text-indigo-400" /> Dashboard Builder
        </h2>
        <div className="flex items-center gap-2">
          <input value={layoutName} onChange={e => setLayoutName(e.target.value)}
            placeholder="Dashboard name..." className="bg-gray-800 text-white text-xs rounded-lg px-3 py-2 border border-gray-700 w-48" />
          <button onClick={saveLayout}
            className="flex items-center gap-1.5 px-3 py-2 bg-indigo-500/15 text-indigo-400 rounded-lg text-xs font-medium hover:bg-indigo-500/25">
            <Save className="w-3.5 h-3.5" /> Save
          </button>
          <button onClick={() => setShowWidgetPicker(!showWidgetPicker)}
            className="flex items-center gap-1.5 px-3 py-2 bg-cyan-500/15 text-cyan-400 rounded-lg text-xs font-medium hover:bg-cyan-500/25">
            <Plus className="w-3.5 h-3.5" /> Add Widget
          </button>
        </div>
      </div>

      {layouts.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          <span className="text-xs text-gray-500 shrink-0">Saved:</span>
          {layouts.map(l => (
            <div key={l.id} className="flex items-center gap-1 shrink-0">
              <button onClick={() => loadLayout(l)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium ${currentLayout?.id === l.id ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}>
                {l.name}
              </button>
              <button onClick={() => deleteLayout(l.id)} className="text-gray-600 hover:text-red-400">
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {showWidgetPicker && (
        <div className="bg-[#111827] border border-gray-700/50 rounded-lg p-4">
          <h3 className="text-sm text-gray-300 mb-3">Choose widget type</h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            {widgetTypes.map((wt) => {
              const Icon = WIDGET_ICONS[wt.type] || Activity
              return (
                <button key={wt.type} onClick={() => addWidget(wt)}
                  className="flex items-center gap-2 p-3 bg-gray-800 rounded-lg hover:bg-gray-700 text-left">
                  <Icon className="w-4 h-4 text-cyan-400 shrink-0" />
                  <div>
                    <p className="text-xs text-white font-medium">{wt.label}</p>
                    <p className="text-xs text-gray-500">{wt.description}</p>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {widgets.map((widget) => {
          const Icon = WIDGET_ICONS[widget.type] || Activity
          return (
            <div key={widget.id} className="bg-[#111827] border border-gray-700/50 rounded-lg overflow-hidden group">
              <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700/50 bg-gray-800/50">
                <div className="flex items-center gap-2">
                  <GripVertical className="w-3 h-3 text-gray-600" />
                  <Icon className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="text-xs text-white font-medium">{widget.title}</span>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                  <button onClick={() => setEditingWidget(editingWidget === widget.id ? null : widget.id)}
                    className="text-gray-500 hover:text-cyan-400"><Settings className="w-3 h-3" /></button>
                  <button onClick={() => removeWidget(widget.id)}
                    className="text-gray-500 hover:text-red-400"><Trash2 className="w-3 h-3" /></button>
                </div>
              </div>

              {editingWidget === widget.id && (
                <div className="px-3 py-2 bg-gray-800/30 border-b border-gray-700/30 space-y-2">
                  {(widget.type === 'metric_chart' || widget.type === 'service_status') && (
                    <div className="flex gap-2">
                      <select value={widget.config.service || 'api-gateway'}
                        onChange={e => updateWidgetConfig(widget.id, 'service', e.target.value)}
                        className="flex-1 bg-gray-700 text-white text-xs rounded px-2 py-1 border-none">
                        {SERVICES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                      {widget.type === 'metric_chart' && (
                        <select value={widget.config.metric_name || 'cpu_usage'}
                          onChange={e => updateWidgetConfig(widget.id, 'metric_name', e.target.value)}
                          className="flex-1 bg-gray-700 text-white text-xs rounded px-2 py-1 border-none">
                          {METRICS.map(m => <option key={m} value={m}>{m.replace(/_/g, ' ')}</option>)}
                        </select>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="p-3 h-40">
                <WidgetRenderer widget={widget} />
              </div>
            </div>
          )
        })}
      </div>

      {widgets.length === 0 && (
        <div className="text-center py-20 text-gray-500">
          <LayoutGrid className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Your custom dashboard is empty</p>
          <p className="text-xs mt-1 text-gray-600">Click "Add Widget" to start building, or load a saved layout above</p>
        </div>
      )}
    </div>
  )
}
