import { useState, useEffect } from 'react'
import { Radar, RefreshCw } from 'lucide-react'
import useStore from '../stores/useStore'

export default function SyntheticMonitoring() {
  const checks = useStore((s) => s.syntheticChecks)
  const fetchChecks = useStore((s) => s.fetchSyntheticChecks)
  const [loading, setLoading] = useState(false)

  const refresh = async () => {
    setLoading(true)
    await fetchChecks()
    setLoading(false)
  }

  useEffect(() => { refresh() }, [])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white flex items-center gap-2">
          <Radar className="w-5 h-5 text-sky-400" /> Synthetic Monitoring
        </h2>
        <button onClick={refresh}
          className="flex items-center gap-1.5 px-3 py-2 bg-gray-800 text-gray-300 rounded-lg text-xs hover:bg-gray-700">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      <p className="text-xs text-gray-500">
        {checks.length} active uptime {checks.length === 1 ? 'probe' : 'probes'} across regions.
      </p>
    </div>
  )
}
