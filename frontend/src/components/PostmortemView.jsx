import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { FileText, Copy, Download, ArrowLeft, CheckCircle, AlertTriangle, Clock, Loader2 } from 'lucide-react'

const PRIORITY_COLORS = {
  high: 'bg-red-500/15 text-red-400',
  medium: 'bg-amber-500/15 text-amber-400',
  low: 'bg-cyan-500/15 text-cyan-400',
}

export default function PostmortemView() {
  const { id } = useParams()
  const [postmortem, setPostmortem] = useState(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  const generate = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/postmortem/${id}`, { method: 'POST' })
      const data = await res.json()
      setPostmortem(data)
    } catch {}
    setLoading(false)
  }

  useEffect(() => { generate() }, [id])

  const toMarkdown = () => {
    if (!postmortem) return ''
    let md = `# Postmortem: Incident ${id}\n\n`
    md += `## Executive Summary\n${postmortem.executive_summary || 'N/A'}\n\n`
    md += `## Impact\n${postmortem.impact || 'N/A'}\n\n`
    md += `## Root Cause Analysis\n${postmortem.root_cause_analysis || 'N/A'}\n\n`
    md += `## Timeline\n`
    ;(postmortem.timeline_formatted || []).forEach(t => { md += `- ${t}\n` })
    md += `\n## Resolution\n${postmortem.resolution || 'N/A'}\n\n`
    md += `## Lessons Learned\n`
    ;(postmortem.lessons_learned || []).forEach(l => { md += `- ${l}\n` })
    md += `\n## Action Items\n`
    ;(postmortem.action_items || []).forEach(a => {
      md += `- [${a.status === 'done' ? 'x' : ' '}] **${a.priority?.toUpperCase()}**: ${a.title}\n`
    })
    md += `\n## Prevention Measures\n${postmortem.prevention_measures || 'N/A'}\n`
    return md
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(toMarkdown())
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownload = () => {
    const blob = new Blob([toMarkdown()], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `postmortem-${id}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin mb-3" />
        <p className="text-sm text-gray-400">Generating postmortem analysis...</p>
      </div>
    )
  }

  if (!postmortem) return null

  if (postmortem.error) {
    return (
      <div className="text-center py-20 text-gray-500">
        <AlertTriangle className="w-8 h-8 mx-auto mb-3" />
        <p>{postmortem.error}</p>
        <Link to="/incidents" className="text-cyan-400 text-sm mt-2 inline-block">Back to incidents</Link>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to={`/incidents/${id}`} className="text-gray-400 hover:text-white">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-purple-400" /> Postmortem — {id}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={generate} className="px-3 py-1.5 bg-gray-800 text-gray-300 rounded-lg text-xs hover:bg-gray-700">
            Regenerate
          </button>
          <button onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-500/15 text-purple-400 rounded-lg text-xs font-medium hover:bg-purple-500/25">
            {copied ? <CheckCircle className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
          <button onClick={handleDownload}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-500/15 text-cyan-400 rounded-lg text-xs font-medium hover:bg-cyan-500/25">
            <Download className="w-3.5 h-3.5" /> Download .md
          </button>
        </div>
      </div>

      <Section title="Executive Summary" icon={<FileText className="w-4 h-4 text-purple-400" />}>
        <p className="text-sm text-gray-300 leading-relaxed">{postmortem.executive_summary}</p>
      </Section>

      <Section title="Impact" icon={<AlertTriangle className="w-4 h-4 text-amber-400" />}>
        <p className="text-sm text-gray-300 leading-relaxed">{postmortem.impact}</p>
      </Section>

      <Section title="Root Cause Analysis" icon={<AlertTriangle className="w-4 h-4 text-red-400" />}>
        <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">{postmortem.root_cause_analysis}</p>
      </Section>

      <Section title="Timeline" icon={<Clock className="w-4 h-4 text-cyan-400" />}>
        <div className="space-y-2">
          {(postmortem.timeline_formatted || []).map((entry, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="w-2 h-2 mt-1.5 rounded-full bg-cyan-500 shrink-0" />
              <p className="text-xs text-gray-400 leading-relaxed">{entry}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Resolution" icon={<CheckCircle className="w-4 h-4 text-emerald-400" />}>
        <p className="text-sm text-gray-300 leading-relaxed">{postmortem.resolution}</p>
      </Section>

      <Section title="Lessons Learned">
        <ul className="space-y-2">
          {(postmortem.lessons_learned || []).map((lesson, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
              <span className="text-cyan-400 mt-0.5">&#8226;</span> {lesson}
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Action Items">
        <div className="space-y-2">
          {(postmortem.action_items || []).map((item, i) => (
            <div key={i} className="flex items-center justify-between bg-gray-800/50 rounded-lg px-3 py-2">
              <div className="flex items-center gap-2">
                <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${item.status === 'done' ? 'border-emerald-400 bg-emerald-400/20' : 'border-gray-600'}`}>
                  {item.status === 'done' && <CheckCircle className="w-3 h-3 text-emerald-400" />}
                </span>
                <span className="text-sm text-gray-300">{item.title}</span>
              </div>
              <span className={`px-2 py-0.5 text-xs rounded font-medium ${PRIORITY_COLORS[item.priority] || PRIORITY_COLORS.medium}`}>
                {item.priority}
              </span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Prevention Measures">
        <p className="text-sm text-gray-300 leading-relaxed">{postmortem.prevention_measures}</p>
      </Section>
    </div>
  )
}

function Section({ title, icon, children }) {
  return (
    <div className="bg-[#111827] border border-gray-700/50 rounded-lg p-4">
      <h3 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
        {icon} {title}
      </h3>
      {children}
    </div>
  )
}
