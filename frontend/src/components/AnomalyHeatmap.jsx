import { useState, useEffect } from 'react'
import { Grid3X3, RefreshCw } from 'lucide-react'

function intensityColor(value, max) {
  if (max === 0 || value === 0) return 'bg-gray-800'
  const ratio = value / max
  if (ratio > 0.75) return 'bg-red-500'
  if (ratio > 0.5) return 'bg-orange-500'
  if (ratio > 0.25) return 'bg-amber-500'
  if (ratio > 0) return 'bg-emerald-500/50'
  return 'bg-gray-800'
}

function HeatmapGrid({ data }) {
  if (!data || !data.services) return null

  const { services, buckets, heatmap, max_value } = data

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[600px]">
        <div className="flex">
          <div className="w-36 shrink-0" />
          <div className="flex-1 flex">
            {buckets.map((b, i) => (
              <div key={i} className="flex-1 text-center">
                {i % Math.max(1, Math.floor(buckets.length / 12)) === 0 && (
                  <span className="text-xs text-gray-600">{b}</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {services.map((svc) => (
          <div key={svc} className="flex items-center mb-px group">
            <div className="w-36 shrink-0 pr-2 text-right">
              <span className="text-xs text-gray-400 group-hover:text-white">{svc}</span>
            </div>
            <div className="flex-1 flex gap-px">
              {(heatmap[svc] || []).map((val, i) => (
                <div key={i} className="group/cell relative flex-1">
                  <div className={`h-6 rounded-sm ${intensityColor(val, max_value)} hover:ring-1 hover:ring-white/30 cursor-pointer transition-all`} />
                  {val > 0 && (
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/cell:block z-20">
                      <div className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs whitespace-nowrap shadow-xl">
                        <p className="text-white font-medium">{svc}</p>
                        <p className="text-gray-400">{buckets[i]}</p>
                        <p className="text-amber-400">{val} anomaly signals</p>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}

        <div className="flex items-center gap-4 mt-4 justify-end">
          <span className="text-xs text-gray-500">Intensity:</span>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded-sm bg-gray-800 border border-gray-700" />
            <span className="text-xs text-gray-600">None</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded-sm bg-emerald-500/50" />
            <span className="text-xs text-gray-600">Low</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded-sm bg-amber-500" />
            <span className="text-xs text-gray-600">Medium</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded-sm bg-orange-500" />
            <span className="text-xs text-gray-600">High</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded-sm bg-red-500" />
            <span className="text-xs text-gray-600">Critical</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function AnomalyHeatmap() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [hours, setHours] = useState(24)
  const [bucketMinutes, setBucketMinutes] = useState(60)

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/heatmap?hours=${hours}&bucket_minutes=${bucketMinutes}`)
      const d = await res.json()
      setData(d)
    } catch {}
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [hours, bucketMinutes])

  const totalAnomalies = data ? Object.values(data.heatmap || {}).reduce(
    (sum, row) => sum + row.reduce((s, v) => s + v, 0), 0
  ) : 0

  const noisiest = data ? Object.entries(data.heatmap || {}).sort(
    (a, b) => b[1].reduce((s, v) => s + v, 0) - a[1].reduce((s, v) => s + v, 0)
  )[0] : null

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <Grid3X3 className="w-5 h-5 text-orange-400" /> Anomaly Heatmap
          </h2>
          <span className="text-xs text-gray-500">{totalAnomalies} total signals</span>
        </div>
        <div className="flex items-center gap-3">
          <select value={hours} onChange={e => setHours(Number(e.target.value))}
            className="bg-gray-800 text-gray-300 text-xs rounded-lg px-3 py-2 border border-gray-700">
            <option value={6}>6 hours</option>
            <option value={12}>12 hours</option>
            <option value={24}>24 hours</option>
            <option value={48}>48 hours</option>
            <option value={168}>7 days</option>
          </select>
          <select value={bucketMinutes} onChange={e => setBucketMinutes(Number(e.target.value))}
            className="bg-gray-800 text-gray-300 text-xs rounded-lg px-3 py-2 border border-gray-700">
            <option value={15}>15 min buckets</option>
            <option value={30}>30 min buckets</option>
            <option value={60}>1 hour buckets</option>
          </select>
          <button onClick={fetchData}
            className="flex items-center gap-1.5 px-3 py-2 bg-gray-800 text-gray-300 rounded-lg text-xs hover:bg-gray-700">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      {noisiest && noisiest[1].reduce((s, v) => s + v, 0) > 0 && (
        <div className="flex items-center gap-4">
          <div className="bg-[#111827] border border-gray-700/50 rounded-lg px-4 py-2">
            <p className="text-xs text-gray-500">Noisiest Service</p>
            <p className="text-sm text-amber-400 font-medium">{noisiest[0]}</p>
          </div>
          <div className="bg-[#111827] border border-gray-700/50 rounded-lg px-4 py-2">
            <p className="text-xs text-gray-500">Peak Value</p>
            <p className="text-sm text-red-400 font-medium">{data?.max_value} signals</p>
          </div>
          <div className="bg-[#111827] border border-gray-700/50 rounded-lg px-4 py-2">
            <p className="text-xs text-gray-500">Services Affected</p>
            <p className="text-sm text-cyan-400 font-medium">
              {data ? Object.values(data.heatmap).filter(r => r.some(v => v > 0)).length : 0} / {data?.services?.length || 0}
            </p>
          </div>
        </div>
      )}

      <div className="bg-[#111827] border border-gray-700/50 rounded-lg p-4">
        {loading && !data ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-6 h-6 text-gray-500 animate-spin" />
          </div>
        ) : (
          <HeatmapGrid data={data} />
        )}
      </div>
    </div>
  )
}
