import { useEffect, useRef } from 'react'
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
import ChaosPanel from './components/ChaosPanel'
import RunbookLibrary from './components/RunbookLibrary'
import ReportGenerator from './components/ReportGenerator'
import SLODashboard from './components/SLODashboard'
import AIChatPanel from './components/AIChatPanel'
import ToastContainer, { toast } from './components/ToastContainer'

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
  const prevAlertCount = useRef(0)
  const prevIncidentCount = useRef(0)

  useEffect(() => {
    fetchDashboard()
    fetchSimulatorStatus()
    const interval = setInterval(() => {
      fetchDashboard()
      fetchSimulatorStatus()

      const state = useStore.getState()
      if (state.firingAlertCount > prevAlertCount.current && prevAlertCount.current >= 0) {
        const diff = state.firingAlertCount - prevAlertCount.current
        if (diff > 0 && prevAlertCount.current > 0) {
          toast('alert', `${diff} new alert${diff > 1 ? 's' : ''} firing`, state.alerts?.[0]?.title || '')
        }
      }
      prevAlertCount.current = state.firingAlertCount

      fetch('/api/incidents?limit=1').then(r => r.json()).then(d => {
        const count = d.count || 0
        if (count > prevIncidentCount.current && prevIncidentCount.current > 0) {
          toast('incident', 'New incident created', d.incidents?.[0]?.title || '')
        }
        prevIncidentCount.current = count
      }).catch(() => {})

    }, 10000)
    return () => clearInterval(interval)
  }, [fetchDashboard, fetchSimulatorStatus])

  useEffect(() => {
    let es = null
    let reconnectTimeout = null

    const connect = () => {
      es = new EventSource('/api/stream/all')
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
        reconnectTimeout = setTimeout(connect, 5000)
      }
    }

    connect()
    return () => {
      es?.close()
      clearTimeout(reconnectTimeout)
    }
  }, [appendLog])

  return (
    <div className="min-h-screen bg-[#0B0F19]">
      <TopBar />
      <ToastContainer />
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/map" element={<Page><ServiceMap /></Page>} />
        <Route path="/services/:name" element={<Page><ServiceDetail /></Page>} />
        <Route path="/incidents" element={<Page><IncidentList /></Page>} />
        <Route path="/incidents/:id" element={<Page><IncidentDetail /></Page>} />
        <Route path="/logs" element={<Page><LogExplorer /></Page>} />
        <Route path="/metrics" element={<Page><MetricsExplorer /></Page>} />
        <Route path="/traces/:traceId" element={<Page><TraceDetail /></Page>} />
        <Route path="/chaos" element={<Page><ChaosPanel /></Page>} />
        <Route path="/runbooks" element={<Page><RunbookLibrary /></Page>} />
        <Route path="/report" element={<Page><ReportGenerator /></Page>} />
        <Route path="/slo" element={<Page><SLODashboard /></Page>} />
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
