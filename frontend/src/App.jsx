import { useEffect } from 'react'
import useStore from './stores/useStore'
import TopBar from './components/TopBar'
import AlertBanner from './components/AlertBanner'
import ServiceGrid from './components/ServiceGrid'
import MetricsCharts from './components/MetricsCharts'
import LogFeed from './components/LogFeed'

function App() {
  const fetchDashboard = useStore((s) => s.fetchDashboard)
  const fetchSimulatorStatus = useStore((s) => s.fetchSimulatorStatus)
  const appendLog = useStore((s) => s.appendLog)

  useEffect(() => {
    fetchDashboard()
    fetchSimulatorStatus()
    const interval = setInterval(() => {
      fetchDashboard()
      fetchSimulatorStatus()
    }, 10000)
    return () => clearInterval(interval)
  }, [fetchDashboard, fetchSimulatorStatus])

  useEffect(() => {
    const es = new EventSource('/api/stream/all')
    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === 'log') {
          appendLog(data)
        }
      } catch {}
    }
    es.onerror = () => {
      es.close()
      setTimeout(() => {
        // reconnect handled by next render cycle
      }, 5000)
    }
    return () => es.close()
  }, [appendLog])

  return (
    <div className="min-h-screen bg-[#0B0F19]">
      <TopBar />
      <AlertBanner />
      <div className="px-4 lg:px-6 pb-6 space-y-6">
        <ServiceGrid />
        <MetricsCharts />
        <LogFeed />
      </div>
    </div>
  )
}

export default App
