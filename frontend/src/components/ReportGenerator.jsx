import { useState } from 'react'
import { FileText, Copy, Check, Download, Loader2 } from 'lucide-react'

export default function ReportGenerator() {
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  const generate = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/chaos/report')
      const data = await res.json()
      setReport(data)
    } catch (e) {
      console.error('Report generation error:', e)
    }
    setLoading(false)
  }

  const copyMarkdown = () => {
    if (report?.markdown) {
      navigator.clipboard.writeText(report.markdown)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const downloadReport = () => {
    if (!report?.markdown) return
    const blob = new Blob([report.markdown], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `sentinel-report-${new Date().toISOString().slice(0, 10)}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <FileText className="w-5 h-5 text-emerald-400" /> Infrastructure Report
        </h2>
        <div className="flex items-center gap-2">
          {report && (
            <>
              <button
                onClick={copyMarkdown}
                className="flex items-center gap-1 px-3 py-1.5 bg-gray-700 text-gray-400 rounded-lg text-xs hover:text-gray-200 transition-colors"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                {copied ? 'Copied!' : 'Copy Markdown'}
              </button>
              <button
                onClick={downloadReport}
                className="flex items-center gap-1 px-3 py-1.5 bg-gray-700 text-gray-400 rounded-lg text-xs hover:text-gray-200 transition-colors"
              >
                <Download className="w-3 h-3" /> Download
              </button>
            </>
          )}
          <button
            onClick={generate}
            disabled={loading}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-500/15 text-emerald-400 rounded-lg text-xs font-medium hover:bg-emerald-500/25 transition-colors disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileText className="w-3 h-3" />}
            {loading ? 'Generating...' : 'Generate Report'}
          </button>
        </div>
      </div>

      {!report ? (
        <div className="bg-[#111827] border border-gray-700/50 rounded-lg p-12 text-center">
          <FileText className="w-8 h-8 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Generate a summary report of your infrastructure status.</p>
          <p className="text-gray-500 text-xs mt-1">Includes incidents, alerts, service health, and recommendations.</p>
        </div>
      ) : (
        <>
          {report.summary && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              {[
                { label: 'Services', value: report.summary.services, color: 'text-cyan-400' },
                { label: 'Degraded', value: report.summary.degraded, color: report.summary.degraded > 0 ? 'text-red-400' : 'text-emerald-400' },
                { label: 'Firing Alerts', value: report.summary.firing_alerts, color: report.summary.firing_alerts > 0 ? 'text-red-400' : 'text-emerald-400' },
                { label: 'Alerts (24h)', value: report.summary.alerts_24h, color: 'text-amber-400' },
                { label: 'Incidents', value: report.summary.active_incidents, color: report.summary.active_incidents > 0 ? 'text-red-400' : 'text-emerald-400' },
                { label: 'Anomalies', value: report.summary.active_anomalies, color: report.summary.active_anomalies > 0 ? 'text-amber-400' : 'text-emerald-400' },
              ].map((s) => (
                <div key={s.label} className="bg-[#111827] border border-gray-700/50 rounded-lg p-3 text-center">
                  <div className={`text-xl font-semibold ${s.color}`}>{s.value}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>
          )}

          <div className="bg-[#111827] border border-gray-700/50 rounded-lg p-5">
            <pre className="text-sm text-gray-300 whitespace-pre-wrap font-mono leading-relaxed">
              {report.markdown}
            </pre>
          </div>
        </>
      )}
    </div>
  )
}
