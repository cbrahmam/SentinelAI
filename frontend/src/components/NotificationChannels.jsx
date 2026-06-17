import { useState, useEffect } from 'react'
import { MessageSquare, Mail, Bell, Webhook, Plus, Trash2, ToggleLeft, ToggleRight, Send, CheckCircle, XCircle } from 'lucide-react'
import { format } from 'date-fns'

const TYPE_CONFIG = {
  slack: { icon: MessageSquare, color: 'text-purple-400', bg: 'bg-purple-500/15', label: 'Slack' },
  pagerduty: { icon: Bell, color: 'text-emerald-400', bg: 'bg-emerald-500/15', label: 'PagerDuty' },
  email: { icon: Mail, color: 'text-cyan-400', bg: 'bg-cyan-500/15', label: 'Email' },
  webhook: { icon: Webhook, color: 'text-amber-400', bg: 'bg-amber-500/15', label: 'Webhook' },
}

export default function NotificationChannels() {
  const [channels, setChannels] = useState([])
  const [log, setLog] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [tab, setTab] = useState('channels')
  const [form, setForm] = useState({ name: '', channel_type: 'slack', config: {} })
  const [configInput, setConfigInput] = useState('')

  const fetchChannels = async () => {
    const res = await fetch('/api/notifications/channels')
    const data = await res.json()
    setChannels(data.channels || [])
  }

  const fetchLog = async () => {
    const res = await fetch('/api/notifications/log?limit=50')
    const data = await res.json()
    setLog(data.log || [])
  }

  useEffect(() => { fetchChannels(); fetchLog() }, [])

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!form.name) return
    let config = {}
    if (form.channel_type === 'slack') config = { webhook_url: configInput || 'https://hooks.slack.com/...', channel: '#alerts' }
    else if (form.channel_type === 'pagerduty') config = { integration_key: configInput || 'pd-key-xxx', severity: 'critical' }
    else if (form.channel_type === 'email') config = { recipients: configInput || 'oncall@company.com', subject_prefix: '[SentinelAI]' }
    else if (form.channel_type === 'webhook') config = { url: configInput || 'https://api.example.com/webhook', method: 'POST' }

    await fetch('/api/notifications/channels', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, config }),
    })
    setShowForm(false)
    setForm({ name: '', channel_type: 'slack', config: {} })
    setConfigInput('')
    fetchChannels()
  }

  const handleToggle = async (id) => {
    await fetch(`/api/notifications/channels/${id}/toggle`, { method: 'PUT' })
    fetchChannels()
  }

  const handleTest = async (id) => {
    await fetch(`/api/notifications/channels/${id}/test`, { method: 'POST' })
    fetchLog()
  }

  const handleDelete = async (id) => {
    await fetch(`/api/notifications/channels/${id}`, { method: 'DELETE' })
    fetchChannels()
  }

  const configPlaceholder = {
    slack: 'Webhook URL',
    pagerduty: 'Integration Key',
    email: 'Recipient emails',
    webhook: 'Webhook URL',
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white flex items-center gap-2">
          <Bell className="w-5 h-5 text-indigo-400" /> Notification Channels
        </h2>
        <div className="flex items-center gap-2">
          <div className="flex bg-gray-800 rounded-lg p-0.5">
            <button onClick={() => setTab('channels')}
              className={`px-3 py-1 text-xs rounded-md ${tab === 'channels' ? 'bg-gray-600 text-white' : 'text-gray-400'}`}>
              Channels
            </button>
            <button onClick={() => { setTab('log'); fetchLog() }}
              className={`px-3 py-1 text-xs rounded-md ${tab === 'log' ? 'bg-gray-600 text-white' : 'text-gray-400'}`}>
              Delivery Log
            </button>
          </div>
          {tab === 'channels' && (
            <button onClick={() => setShowForm(!showForm)}
              className="flex items-center gap-1.5 px-3 py-2 bg-indigo-500/15 text-indigo-400 rounded-lg text-xs font-medium hover:bg-indigo-500/25">
              <Plus className="w-3.5 h-3.5" /> Add Channel
            </button>
          )}
        </div>
      </div>

      {tab === 'channels' && (
        <>
          {showForm && (
            <form onSubmit={handleCreate} className="bg-[#111827] border border-gray-700/50 rounded-lg p-4 space-y-3">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Channel Name</label>
                  <input value={form.name} onChange={e => setForm({...form, name: e.target.value})}
                    placeholder="#ops-alerts" className="w-full bg-gray-800 text-white text-xs rounded px-2 py-1.5 border border-gray-700" />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Type</label>
                  <select value={form.channel_type} onChange={e => setForm({...form, channel_type: e.target.value})}
                    className="w-full bg-gray-800 text-white text-xs rounded px-2 py-1.5 border border-gray-700">
                    <option value="slack">Slack</option>
                    <option value="pagerduty">PagerDuty</option>
                    <option value="email">Email</option>
                    <option value="webhook">Webhook</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">{configPlaceholder[form.channel_type]}</label>
                  <input value={configInput} onChange={e => setConfigInput(e.target.value)}
                    placeholder={configPlaceholder[form.channel_type]}
                    className="w-full bg-gray-800 text-white text-xs rounded px-2 py-1.5 border border-gray-700" />
                </div>
                <div className="flex items-end">
                  <button type="submit" className="px-4 py-1.5 bg-indigo-500 text-white text-xs font-medium rounded hover:bg-indigo-400">
                    Create
                  </button>
                </div>
              </div>
            </form>
          )}

          <div className="space-y-2">
            {channels.map((ch) => {
              const cfg = TYPE_CONFIG[ch.channel_type] || TYPE_CONFIG.webhook
              const Icon = cfg.icon
              return (
                <div key={ch.id} className={`flex items-center justify-between bg-[#111827] border rounded-lg px-4 py-3 group ${ch.enabled ? 'border-gray-700/50' : 'border-gray-700/30 opacity-60'}`}>
                  <div className="flex items-center gap-3">
                    <button onClick={() => handleToggle(ch.id)} className="text-gray-400 hover:text-white">
                      {ch.enabled ? <ToggleRight className="w-5 h-5 text-emerald-400" /> : <ToggleLeft className="w-5 h-5" />}
                    </button>
                    <div className={`p-1.5 rounded ${cfg.bg}`}>
                      <Icon className={`w-4 h-4 ${cfg.color}`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white">{ch.name}</span>
                        <span className={`px-1.5 py-0.5 text-xs rounded ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {ch.config?.webhook_url || ch.config?.recipients || ch.config?.integration_key || ch.config?.url || 'Configured'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => handleTest(ch.id)}
                      className="opacity-0 group-hover:opacity-100 flex items-center gap-1 px-2 py-1 text-xs text-cyan-400 hover:bg-cyan-500/10 rounded">
                      <Send className="w-3 h-3" /> Test
                    </button>
                    <button onClick={() => handleDelete(ch.id)}
                      className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )
            })}
            {channels.length === 0 && (
              <div className="text-center py-12 text-gray-500 text-sm">
                No notification channels configured. Add one to receive alerts.
              </div>
            )}
          </div>
        </>
      )}

      {tab === 'log' && (
        <div className="space-y-1">
          {log.map((entry) => {
            const cfg = TYPE_CONFIG[entry.channel_type] || TYPE_CONFIG.webhook
            const Icon = cfg.icon
            return (
              <div key={entry.id} className="flex items-center justify-between bg-[#111827] border border-gray-700/50 rounded-lg px-4 py-2.5">
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${cfg.color}`} />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-white">{entry.title}</span>
                      <span className="px-1.5 py-0.5 text-xs rounded bg-gray-700 text-gray-300">{entry.event_type}</span>
                    </div>
                    <p className="text-xs text-gray-500">{entry.channel_name} &middot; {entry.sent_at ? format(new Date(entry.sent_at), 'MMM d, HH:mm:ss') : ''}</p>
                  </div>
                </div>
                {entry.status === 'delivered' ? (
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-400" />
                )}
              </div>
            )
          })}
          {log.length === 0 && (
            <div className="text-center py-12 text-gray-500 text-sm">
              No notifications sent yet. Configure a channel and trigger an alert.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
