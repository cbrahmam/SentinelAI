import { useState, useRef, useEffect } from 'react'
import { MessageCircle, Send, X, Brain, Loader2 } from 'lucide-react'

export default function AIChatPanel() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([
    { role: 'assistant', text: 'Hi! I\'m SentinelAI. Ask me about your infrastructure — service status, alerts, errors, incidents, or anomalies.' },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async () => {
    const q = input.trim()
    if (!q || loading) return
    setInput('')
    setMessages(prev => [...prev, { role: 'user', text: q }])
    setLoading(true)

    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q }),
      })
      const data = await res.json()
      setMessages(prev => [...prev, { role: 'assistant', text: data.answer || 'No response.', context: data.context_summary }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', text: 'Failed to reach SentinelAI. Please try again.' }])
    }
    setLoading(false)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 bg-purple-600 text-white rounded-full shadow-lg hover:bg-purple-500 transition-colors"
      >
        <Brain className="w-5 h-5" />
        <span className="text-sm font-medium">Ask SentinelAI</span>
      </button>
    )
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 w-96 h-[500px] bg-[#111827] border border-gray-700 rounded-xl shadow-2xl flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-purple-400" />
          <span className="text-sm font-medium text-white">Ask SentinelAI</span>
        </div>
        <button onClick={() => setOpen(false)} className="text-gray-500 hover:text-gray-300 transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
              msg.role === 'user'
                ? 'bg-purple-600/20 text-purple-200'
                : 'bg-gray-800 text-gray-200'
            }`}>
              <pre className="whitespace-pre-wrap font-sans">{msg.text}</pre>
              {msg.context && (
                <div className="mt-1 text-xs text-gray-500">{msg.context}</div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-800 rounded-lg px-3 py-2">
              <Loader2 className="w-4 h-4 text-purple-400 animate-spin" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="p-3 border-t border-gray-700">
        <div className="flex items-center gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your infrastructure..."
            className="flex-1 bg-gray-800 text-white text-sm rounded-lg px-3 py-2 border border-gray-700 outline-none focus:border-purple-500"
          />
          <button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className="p-2 bg-purple-600 text-white rounded-lg hover:bg-purple-500 transition-colors disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <div className="mt-2 flex flex-wrap gap-1">
          {['System status?', 'Any active alerts?', 'Recent errors?'].map((q) => (
            <button
              key={q}
              onClick={() => { setInput(q); }}
              className="px-2 py-0.5 bg-gray-800 text-gray-400 text-xs rounded hover:text-gray-200 transition-colors"
            >
              {q}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
