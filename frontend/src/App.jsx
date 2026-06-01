import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import useStore from './stores/useStore'
import TopBar from './components/TopBar'
import AlertBanner from './components/AlertBanner'
import ServiceGrid from './components/ServiceGrid'
import MetricsCharts from './components/MetricsCharts'
import LogFeed from './components/LogFeed'
import IncidentList from './components/IncidentList'
import IncidentDetail from './components/IncidentDetail'
import ServiceMap from './components/ServiceMap'
import ServiceDetail from './components/ServiceDetail'
import LogExplorer from './components/LogExplorer'
import MetricsExplorer from './components/MetricsExplorer'
import TraceDetail from './components/TraceDetail'
import AIChatPanel from './components/AIChatPanel'

function Dashboard() {
  return (
    <>
      <AlertBanner />
      <div className="px-4 lg:px-6 pb-6 space-y-6">
        <ServiceGrid />
        <MetricsCharts />
        <LogFeed />
      </div>
    </>
  )
}

function Page({ children }) {
  return <div className="px-4 lg:px-6 py-6">{children}</div>
}

function AppContent() {
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
      setTimeout(() => {}, 5000)
    }
    return () => es.close()
  }, [appendLog])

  return (
    <div className="min-h-screen bg-[#0B0F19]">
      <TopBar />
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/map" element={<Page><ServiceMap /></Page>} />
        <Route path="/services/:name" element={<Page><ServiceDetail /></Page>} />
        <Route path="/incidents" element={<Page><IncidentList /></Page>} />
        <Route path="/incidents/:id" element={<Page><IncidentDetail /></Page>} />
        <Route path="/logs" element={<Page><LogExplorer /></Page>} />
        <Route path="/metrics" element={<Page><MetricsExplorer /></Page>} />
        <Route path="/traces/:traceId" element={<Page><TraceDetail /></Page>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <AIChatPanel />
    </div>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  )
}

export default App
