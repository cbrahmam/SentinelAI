import { useState, useEffect } from 'react'
import { DollarSign, RefreshCw, ArrowDown, ArrowUp, Minus, Server, Cpu, HardDrive, TrendingDown } from 'lucide-react'

const CLASS_COLORS = {
  idle: { bg: 'bg-gray-500/15', text: 'text-gray-400', border: 'border-gray-500/30', bar: 'bg-gray-500' },
  over_provisioned: { bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/30', bar: 'bg-amber-500' },
  right_sized: { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30', bar: 'bg-emerald-500' },
  high_utilization: { bg: 'bg-cyan-500/15', text: 'text-cyan-400', border: 'border-cyan-500/30', bar: 'bg-cyan-500' },
  near_capacity: { bg: 'bg-red-500/15', text: 'text-red-400', border: 'border-red-500/30', bar: 'bg-red-500' },
}

function UtilBar({ value, max, label }) {
  const color = value >= 85 ? 'bg-red-500' : value >= 65 ? 'bg-amber-500' : value >= 30 ? 'bg-emerald-500' : 'bg-gray-500'
  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-gray-500">{label}</span>
        <span className="text-[10px] font-mono text-gray-400">{value}% (peak {max}%)</span>
      </div>
      <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${Math.min(value, 100)}%` }} />
      </div>
    </div>
  )
}

export default function CostOptimizer() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [hours, setHours] = useState(24)

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/cost?hours=${hours}`)
      const d = await res.json()
      setData(d)
    } catch {}
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [hours])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-emerald-400" /> Cost & Resource Optimizer
        </h2>
        <div className="flex items-center gap-3">
          <select value={hours} onChange={e => setHours(Number(e.target.value))}
            className="bg-gray-800 text-gray-300 text-xs rounded-lg px-3 py-2 border border-gray-700">
            <option value={6}>Last 6 hours</option>
            <option value={24}>Last 24 hours</option>
            <option value={72}>Last 3 days</option>
            <option value={168}>Last 7 days</option>
          </select>
          <button onClick={fetchData}
            className="flex items-center gap-1.5 px-3 py-2 bg-gray-800 text-gray-300 rounded-lg text-xs hover:bg-gray-700">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      {data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-[#111827] border border-gray-700/50 rounded-lg p-4">
              <p className="text-xs text-gray-500 mb-1">Current Monthly Cost</p>
              <p className="text-2xl font-bold text-white">${data.total_monthly_cost}</p>
            </div>
            <div className="bg-[#111827] border border-emerald-500/30 rounded-lg p-4">
              <p className="text-xs text-gray-500 mb-1">Optimized Cost</p>
              <p className="text-2xl font-bold text-emerald-400">${data.optimized_monthly_cost}</p>
            </div>
            <div className="bg-[#111827] border border-emerald-500/30 rounded-lg p-4">
              <p className="text-xs text-gray-500 mb-1">Potential Savings</p>
              <p className="text-2xl font-bold text-emerald-400 flex items-center gap-1">
                <TrendingDown className="w-5 h-5" /> ${data.potential_savings}
              </p>
              <p className="text-xs text-emerald-400/70 mt-0.5">{data.savings_pct}% reduction</p>
            </div>
            <div className="bg-[#111827] border border-gray-700/50 rounded-lg p-4">
              <p className="text-xs text-gray-500 mb-2">Utilization Breakdown</p>
              <div className="space-y-1">
                {Object.entries(data.summary || {}).map(([key, count]) => {
                  const c = CLASS_COLORS[key] || CLASS_COLORS.right_sized
                  return count > 0 ? (
                    <div key={key} className="flex items-center justify-between">
                      <span className={`text-xs ${c.text}`}>{key.replace(/_/g, ' ')}</span>
                      <span className="text-xs font-mono text-white">{count}</span>
                    </div>
                  ) : null
                })}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {(data.services || []).map(svc => {
              const c = CLASS_COLORS[svc.classification] || CLASS_COLORS.right_sized
              const rec = svc.recommendation
              return (
                <div key={svc.service}
                  className={`bg-[#111827] border rounded-lg p-4 ${c.border}`}>
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-white">{svc.service}</span>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${c.bg} ${c.text}`}>
                          {svc.classification_label}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-500">
                        <span className="flex items-center gap-1"><Server className="w-3 h-3" /> {svc.instance_type}</span>
                        <span className="flex items-center gap-1"><Cpu className="w-3 h-3" /> {svc.vcpus} vCPUs</span>
                        <span className="flex items-center gap-1"><HardDrive className="w-3 h-3" /> {svc.memory_gb} GB RAM</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-white">${svc.monthly_cost}<span className="text-xs text-gray-500 font-normal">/mo</span></p>
                      {rec && rec.action === 'downsize' && (
                        <p className="text-xs text-emerald-400">Save ${rec.monthly_savings}/mo</p>
                      )}
                      {rec && rec.action === 'upsize' && (
                        <p className="text-xs text-amber-400">+${rec.monthly_increase}/mo</p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <UtilBar value={svc.avg_cpu} max={svc.max_cpu} label="CPU Usage" />
                    <UtilBar value={svc.avg_memory} max={svc.max_memory} label="Memory Usage" />
                  </div>

                  {rec ? (
                    <div className={`rounded-lg px-3 py-2 ${rec.action === 'downsize' ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-amber-500/10 border border-amber-500/20'}`}>
                      <div className="flex items-center gap-2">
                        {rec.action === 'downsize'
                          ? <ArrowDown className="w-4 h-4 text-emerald-400" />
                          : <ArrowUp className="w-4 h-4 text-amber-400" />}
                        <span className={`text-xs font-medium ${rec.action === 'downsize' ? 'text-emerald-400' : 'text-amber-400'}`}>
                          {rec.action === 'downsize' ? 'Downsize' : 'Upsize'}: {rec.from_type} → {rec.to_type}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5 ml-6">{rec.reason}</p>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <Minus className="w-3.5 h-3.5" /> {svc.action}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
