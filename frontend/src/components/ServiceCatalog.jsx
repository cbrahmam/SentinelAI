import { useEffect } from 'react'
import { Boxes, RefreshCw } from 'lucide-react'
import useStore from '../stores/useStore'

export default function ServiceCatalog() {
  const entries = useStore((s) => s.catalogEntries)
  const fetchCatalog = useStore((s) => s.fetchCatalog)
  const fetchFacets = useStore((s) => s.fetchCatalogFacets)
  const fetchStats = useStore((s) => s.fetchCatalogStats)

  const refresh = () => {
    fetchCatalog()
    fetchFacets()
    fetchStats()
  }

  useEffect(() => { refresh() }, [])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white flex items-center gap-2">
          <Boxes className="w-5 h-5 text-violet-400" /> Service Catalog
        </h2>
        <button onClick={refresh}
          className="flex items-center gap-1.5 px-3 py-2 bg-gray-800 text-gray-300 rounded-lg text-xs hover:bg-gray-700">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>
      <p className="text-xs text-gray-500">{entries.length} services cataloged.</p>
    </div>
  )
}
