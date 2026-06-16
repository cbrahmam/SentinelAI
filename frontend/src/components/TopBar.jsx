import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Activity, AlertTriangle, Play, Square, Zap, AlertOctagon, Network, ScrollText, BarChart3, Flame, BookOpen, FileText, Shield, Rocket, TrendingUp } from 'lucide-react'
import useStore from '../stores/useStore'

const TIME_RANGES = ['15m', '1h', '6h', '24h', '7d']

const ANOMALY_TYPES = [
  { value: 'cpu_spike', label: 'CPU Spike' },
  { value: 'memory_leak', label: 'Memory Leak' },
  { value: 'latency_spike', label: 'Latency Spike' },
  { value: 'error_storm', label: 'Error Storm' },
  { value: 'cascade_failure', label: 'Cascade Failure' },
]

const SERVICES = [
  'api-gateway', 'auth-service', 'user-service', 'payment-service',
  'notification-service', 'postgres-primary', 'redis-cache', 'rabbitmq',
]

export default function TopBar() {
  const {
    systemStatus, firingAlertCount, timeRange, setTimeRange,
    simulatorStatus, startSimulator, stopSimulator, injectAnomaly, loadSampleData,
  } = useStore()
  const location = useLocation()

  const [showInject, setShowInject] = useState(false)
  const [anomalyType, setAnomalyType] = useState('cpu_spike')
  const [anomalyService, setAnomalyService] = useState('api-gateway')

  const isHealthy = systemStatus === 'All Systems Operational'

  const handleInject = () => {
    injectAnomaly(anomalyType, anomalyService)
    setShowInject(false)
  }

  return (
    <div className="border-b border-gray-800 bg-[#111827] sticky top-0 z-50">
      <div className="px-4 lg:px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-cyan-400" />
            <span className="text-lg font-semibold text-white">SentinelAI</span>
          </div>
          <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
            isHealthy ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
          }`}>
            <span className={`w-2 h-2 rounded-full ${isHealthy ? 'bg-emerald-400' : 'bg-red-400 animate-pulse-dot'}`} />
            {systemStatus}
          </div>
          <nav className="flex items-center gap-1 ml-2">
            <Link to="/" className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${location.pathname === '/' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-gray-200'}`}>
              Dashboard
            </Link>
            <Link to="/map" className={`flex items-center gap-1 px-3 py-1 rounded-md text-xs font-medium transition-colors ${location.pathname === '/map' || location.pathname.startsWith('/services/') ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-gray-200'}`}>
              <Network className="w-3 h-3" /> Map
            </Link>
            <Link to="/incidents" className={`flex items-center gap-1 px-3 py-1 rounded-md text-xs font-medium transition-colors ${location.pathname.startsWith('/incidents') ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-gray-200'}`}>
              <AlertOctagon className="w-3 h-3" /> Incidents
            </Link>
            <Link to="/logs" className={`flex items-center gap-1 px-3 py-1 rounded-md text-xs font-medium transition-colors ${location.pathname === '/logs' || location.pathname.startsWith('/traces/') ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-gray-200'}`}>
              <ScrollText className="w-3 h-3" /> Logs
            </Link>
            <Link to="/metrics" className={`flex items-center gap-1 px-3 py-1 rounded-md text-xs font-medium transition-colors ${location.pathname === '/metrics' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-gray-200'}`}>
              <BarChart3 className="w-3 h-3" /> Metrics
            </Link>
            <Link to="/slo" className={`flex items-center gap-1 px-3 py-1 rounded-md text-xs font-medium transition-colors ${location.pathname === '/slo' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-gray-200'}`}>
              <Shield className="w-3 h-3" /> SLO
            </Link>
            <Link to="/predictions" className={`flex items-center gap-1 px-3 py-1 rounded-md text-xs font-medium transition-colors ${location.pathname === '/predictions' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-gray-200'}`}>
              <TrendingUp className="w-3 h-3" /> Predict
            </Link>
            <Link to="/deploys" className={`flex items-center gap-1 px-3 py-1 rounded-md text-xs font-medium transition-colors ${location.pathname === '/deploys' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-gray-200'}`}>
              <Rocket className="w-3 h-3" /> Deploys
            </Link>
            <Link to="/chaos" className={`flex items-center gap-1 px-3 py-1 rounded-md text-xs font-medium transition-colors ${location.pathname === '/chaos' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-gray-200'}`}>
              <Flame className="w-3 h-3" /> Chaos
            </Link>
            <Link to="/runbooks" className={`flex items-center gap-1 px-3 py-1 rounded-md text-xs font-medium transition-colors ${location.pathname === '/runbooks' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-gray-200'}`}>
              <BookOpen className="w-3 h-3" /> Runbooks
            </Link>
            <Link to="/report" className={`flex items-center gap-1 px-3 py-1 rounded-md text-xs font-medium transition-colors ${location.pathname === '/report' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-gray-200'}`}>
              <FileText className="w-3 h-3" /> Report
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {firingAlertCount > 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/15 text-red-400 text-xs font-medium animate-pulse-dot">
              <AlertTriangle className="w-3.5 h-3.5" />
              {firingAlertCount} Alert{firingAlertCount > 1 ? 's' : ''}
            </div>
          )}

          <div className="flex bg-gray-800 rounded-lg p-0.5">
            {TIME_RANGES.map((tr) => (
              <button
                key={tr}
                onClick={() => setTimeRange(tr)}
                className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                  timeRange === tr ? 'bg-gray-600 text-white' : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                {tr}
              </button>
            ))}
          </div>

          {simulatorStatus.running ? (
            <button
              onClick={stopSimulator}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/15 text-red-400 rounded-lg text-xs font-medium hover:bg-red-500/25 transition-colors"
            >
              <Square className="w-3 h-3" /> Stop Sim
            </button>
          ) : (
            <button
              onClick={startSimulator}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/15 text-emerald-400 rounded-lg text-xs font-medium hover:bg-emerald-500/25 transition-colors"
            >
              <Play className="w-3 h-3" /> Start Sim
            </button>
          )}

          {!simulatorStatus.running && (
            <button
              onClick={() => loadSampleData(2)}
              className="px-3 py-1.5 bg-cyan-500/15 text-cyan-400 rounded-lg text-xs font-medium hover:bg-cyan-500/25 transition-colors"
            >
              Load Demo Data
            </button>
          )}

          <div className="relative">
            <button
              onClick={() => setShowInject(!showInject)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/15 text-amber-400 rounded-lg text-xs font-medium hover:bg-amber-500/25 transition-colors"
            >
              <Zap className="w-3 h-3" /> Inject Anomaly
            </button>
            {showInject && (
              <div className="absolute right-0 top-full mt-2 w-64 bg-gray-800 border border-gray-700 rounded-lg p-3 shadow-xl">
                <label className="block text-xs text-gray-400 mb-1">Anomaly Type</label>
                <select
                  value={anomalyType}
                  onChange={(e) => setAnomalyType(e.target.value)}
                  className="w-full bg-gray-700 text-white text-xs rounded px-2 py-1.5 mb-2 border-none outline-none"
                >
                  {ANOMALY_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
                <label className="block text-xs text-gray-400 mb-1">Service</label>
                <select
                  value={anomalyService}
                  onChange={(e) => setAnomalyService(e.target.value)}
                  className="w-full bg-gray-700 text-white text-xs rounded px-2 py-1.5 mb-3 border-none outline-none"
                >
                  {SERVICES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <button
                  onClick={handleInject}
                  className="w-full py-1.5 bg-amber-500 text-black text-xs font-medium rounded hover:bg-amber-400 transition-colors"
                >
                  Inject
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
