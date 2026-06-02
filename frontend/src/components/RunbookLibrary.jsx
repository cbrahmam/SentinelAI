import { useEffect, useState } from 'react'
import { BookOpen, Search, Copy, Check, ChevronDown, ChevronRight, Terminal } from 'lucide-react'

const SEVERITY_COLORS = {
  P1: 'bg-red-500/20 text-red-300',
  P2: 'bg-amber-500/20 text-amber-300',
  P3: 'bg-blue-500/20 text-blue-300',
}

export default function RunbookLibrary() {
  const [runbooks, setRunbooks] = useState([])
  const [expanded, setExpanded] = useState(null)
  const [detail, setDetail] = useState(null)
  const [search, setSearch] = useState('')
  const [copied, setCopied] = useState(null)

  useEffect(() => {
    const q = search ? `?q=${encodeURIComponent(search)}` : ''
    fetch(`/api/chaos/runbooks${q}`).then(r => r.json()).then(d => setRunbooks(d.runbooks || []))
  }, [search])

  const loadDetail = async (id) => {
    if (expanded === id) {
      setExpanded(null)
      setDetail(null)
      return
    }
    const res = await fetch(`/api/chaos/runbooks/${id}`)
    const data = await res.json()
    setDetail(data)
    setExpanded(id)
  }

  const copySteps = (steps) => {
    navigator.clipboard.writeText(steps.join('\n'))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-cyan-400" /> Runbook Library
        </h2>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search runbooks..."
          className="w-full bg-[#111827] text-white text-sm rounded-lg pl-10 pr-4 py-2.5 border border-gray-700/50 outline-none focus:border-cyan-500"
        />
      </div>

      <div className="space-y-2">
        {runbooks.length === 0 ? (
          <div className="bg-[#111827] border border-gray-700/50 rounded-lg p-8 text-center text-gray-400 text-sm">
            No runbooks found.
          </div>
        ) : runbooks.map((rb) => (
          <div key={rb.id} className="bg-[#111827] border border-gray-700/50 rounded-lg overflow-hidden">
            <button
              onClick={() => loadDetail(rb.id)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-800/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                {expanded === rb.id ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
                <span className="text-sm font-medium text-white">{rb.title}</span>
                <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${SEVERITY_COLORS[rb.severity] || 'bg-gray-500/20 text-gray-300'}`}>
                  {rb.severity}
                </span>
                <span className="px-1.5 py-0.5 bg-gray-800 text-gray-400 rounded text-xs">{rb.category}</span>
              </div>
            </button>

            {expanded === rb.id && detail && (
              <div className="px-4 pb-4 border-t border-gray-700/50 pt-3 space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wider">Steps</h4>
                    <button
                      onClick={() => copySteps(detail.steps)}
                      className="flex items-center gap-1 px-2 py-1 bg-gray-800 text-gray-400 rounded text-xs hover:text-gray-200 transition-colors"
                    >
                      {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      {copied ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <div className="space-y-1.5">
                    {detail.steps.map((step, i) => (
                      <p key={i} className="text-sm text-gray-300 leading-relaxed">{step}</p>
                    ))}
                  </div>
                </div>

                {detail.commands && detail.commands.length > 0 && (
                  <div>
                    <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                      <Terminal className="w-3 h-3" /> Useful Commands
                    </h4>
                    <div className="space-y-1">
                      {detail.commands.map((cmd, i) => (
                        <code key={i} className="block text-xs bg-gray-800/50 text-cyan-400 px-3 py-1.5 rounded font-mono">{cmd}</code>
                      ))}
                    </div>
                  </div>
                )}

                {detail.escalation && (
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
                    <h4 className="text-xs font-medium text-amber-400 mb-1">Escalation</h4>
                    <p className="text-xs text-amber-300/80">{detail.escalation}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
