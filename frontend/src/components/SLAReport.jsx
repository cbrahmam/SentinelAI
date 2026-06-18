import { useState, useEffect } from 'react'
import { FileCheck, RefreshCw, Download, CheckCircle, XCircle, TrendingUp } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'

function UptimeBar({ pct, target }) {
  const met = pct >= target
  const color = met ? 'bg-emerald-500' : pct >= 99 ? 'bg-amber-500' : 'bg-red-500'
  return (
    <div className="flex items-center gap-2 w-full">
      <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      <span className={`text-xs font-mono w-16 text-right ${met ? 'text-emerald-400' : 'text-red-400'}`}>
        {pct}%
      </span>
    </div>
  )
}

export default function SLAReport() {
  const [report, setReport] = useState(null)
  const [trends, setTrends] = useState([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('weekly')
  const [slaTarget, setSlaTarget] = useState(99.9)
  const [tab, setTab] = useState('report')

  const fetchReport = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/sla-report?period=${period}&sla_target=${slaTarget}`)
      const data = await res.json()
      setReport(data)
    } catch {}
    setLoading(false)
  }

  const fetchTrends = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/sla-report/trends?weeks=12&sla_target=${slaTarget}`)
      const data = await res.json()
      setTrends(data.trends || [])
    } catch {}
    setLoading(false)
  }

  useEffect(() => {
    fetchReport()
    fetchTrends()
  }, [period, slaTarget])

  const handleExport = async () => {
    try {
      const res = await fetch(`/api/sla-report/export?period=${period}&sla_target=${slaTarget}`)
      const text = await res.text()
      const blob = new Blob([text], { type: 'text/markdown' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `sla-report-${period}.md`
      a.click()
      URL.revokeObjectURL(url)
    } catch {}
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white flex items-center gap-2">
          <FileCheck className="w-5 h-5 text-emerald-400" /> SLA Compliance Reports
        </h2>
        <div className="flex items-center gap-3">
          <select value={period} onChange={e => setPeriod(e.target.value)}
            className="bg-gray-800 text-gray-300 text-xs rounded-lg px-3 py-2 border border-gray-700">
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
          <select value={slaTarget} onChange={e => setSlaTarget(Number(e.target.value))}
            className="bg-gray-800 text-gray-300 text-xs rounded-lg px-3 py-2 border border-gray-700">
            <option value={99.99}>99.99%</option>
            <option value={99.95}>99.95%</option>
            <option value={99.9}>99.9%</option>
            <option value={99.5}>99.5%</option>
            <option value={99}>99%</option>
          </select>
          <button onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-2 bg-gray-800 text-gray-300 rounded-lg text-xs hover:bg-gray-700">
            <Download className="w-3.5 h-3.5" /> Export MD
          </button>
          <button onClick={() => { fetchReport(); fetchTrends() }}
            className="flex items-center gap-1.5 px-3 py-2 bg-gray-800 text-gray-300 rounded-lg text-xs hover:bg-gray-700">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      <div className="flex gap-1 bg-gray-800/50 rounded-lg p-1 w-fit">
        {['report', 'trends'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-md text-xs font-medium transition-colors capitalize ${tab === t ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-gray-200'}`}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'report' && report && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className={`bg-[#111827] border rounded-lg p-4 ${report.fleet_status === 'met' ? 'border-emerald-500/30' : 'border-red-500/30'}`}>
              <p className="text-xs text-gray-500 mb-1">Fleet Uptime</p>
              <p className={`text-2xl font-bold ${report.fleet_status === 'met' ? 'text-emerald-400' : 'text-red-400'}`}>
                {report.fleet_uptime}%
              </p>
              <p className="text-xs mt-1 flex items-center gap-1">
                {report.fleet_status === 'met'
                  ? <><CheckCircle className="w-3 h-3 text-emerald-400" /><span className="text-emerald-400">SLA Met</span></>
                  : <><XCircle className="w-3 h-3 text-red-400" /><span className="text-red-400">SLA Breached</span></>}
              </p>
            </div>
            <div className="bg-[#111827] border border-gray-700/50 rounded-lg p-4">
              <p className="text-xs text-gray-500 mb-1">SLA Target</p>
              <p className="text-2xl font-bold text-white">{report.sla_target}%</p>
              <p className="text-xs text-gray-500 mt-1">{report.period} period</p>
            </div>
            <div className="bg-[#111827] border border-gray-700/50 rounded-lg p-4">
              <p className="text-xs text-gray-500 mb-1">Breaches</p>
              <p className={`text-2xl font-bold ${report.total_breaches > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                {report.total_breaches}
              </p>
              <p className="text-xs text-gray-500 mt-1">of {report.services?.length} services</p>
            </div>
            <div className="bg-[#111827] border border-gray-700/50 rounded-lg p-4">
              <p className="text-xs text-gray-500 mb-1">Incidents / Alerts</p>
              <p className="text-2xl font-bold text-white">{report.total_incidents} / {report.total_alerts}</p>
              <p className="text-xs text-gray-500 mt-1">this period</p>
            </div>
          </div>

          <div className="bg-[#111827] border border-gray-700/50 rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-700/50">
              <h3 className="text-sm font-medium text-white">Per-Service Breakdown</h3>
            </div>
            <table className="w-full">
              <thead>
                <tr className="text-xs text-gray-500 border-b border-gray-700/50">
                  <th className="text-left px-4 py-2">Service</th>
                  <th className="text-left px-4 py-2 w-1/3">Uptime</th>
                  <th className="text-center px-4 py-2">Downtime</th>
                  <th className="text-center px-4 py-2">Incidents</th>
                  <th className="text-center px-4 py-2">Alerts</th>
                  <th className="text-center px-4 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {(report.services || []).map(svc => (
                  <tr key={svc.service} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                    <td className="px-4 py-2.5 text-sm text-white">{svc.service}</td>
                    <td className="px-4 py-2.5">
                      <UptimeBar pct={svc.uptime_pct} target={slaTarget} />
                    </td>
                    <td className="px-4 py-2.5 text-center text-xs text-gray-400">{svc.downtime_minutes}m</td>
                    <td className="px-4 py-2.5 text-center text-xs text-gray-400">{svc.incident_count}</td>
                    <td className="px-4 py-2.5 text-center text-xs text-gray-400">{svc.alert_count}</td>
                    <td className="px-4 py-2.5 text-center">
                      {svc.status === 'met'
                        ? <CheckCircle className="w-4 h-4 text-emerald-400 mx-auto" />
                        : <XCircle className="w-4 h-4 text-red-400 mx-auto" />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'trends' && (
        <div className="space-y-4">
          <div className="bg-[#111827] border border-gray-700/50 rounded-lg p-4">
            <h3 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-cyan-400" /> Fleet Uptime Trend (12 weeks)
            </h3>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={trends}>
                <defs>
                  <linearGradient id="uptimeGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06B6D4" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#06B6D4" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="week_end" tick={{ fontSize: 10, fill: '#6B7280' }} />
                <YAxis domain={[98, 100]} tick={{ fontSize: 10, fill: '#6B7280' }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '8px' }}
                  labelStyle={{ color: '#9CA3AF' }}
                />
                <ReferenceLine y={slaTarget} stroke="#EF4444" strokeDasharray="4 4" label={{ value: `SLA ${slaTarget}%`, fill: '#EF4444', fontSize: 10 }} />
                <Area type="monotone" dataKey="fleet_uptime" stroke="#06B6D4" fill="url(#uptimeGrad)" strokeWidth={2} name="Uptime %" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
            {trends.map(w => (
              <div key={w.week_start}
                className={`bg-[#111827] border rounded-lg p-3 ${w.status === 'met' ? 'border-emerald-500/20' : 'border-red-500/20'}`}>
                <p className="text-xs text-gray-500">{w.week_start}</p>
                <p className={`text-lg font-bold ${w.status === 'met' ? 'text-emerald-400' : 'text-red-400'}`}>
                  {w.fleet_uptime}%
                </p>
                {w.breaches > 0 && (
                  <p className="text-xs text-red-400">{w.breaches} breaches</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
