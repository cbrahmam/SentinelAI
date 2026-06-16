import { useState, useEffect } from 'react'
import { Users, Phone, Plus, Trash2, Shield, ArrowRight, Clock, UserCheck } from 'lucide-react'
import { format } from 'date-fns'

export default function OnCallSchedule() {
  const [schedules, setSchedules] = useState([])
  const [oncalls, setOncalls] = useState([])
  const [escalations, setEscalations] = useState({})
  const [showForm, setShowForm] = useState(false)
  const [memberInputs, setMemberInputs] = useState([{ name: '', email: '', role: 'engineer' }])
  const [form, setForm] = useState({ name: '', team: '', rotation_type: 'weekly', escalation_minutes: 15 })

  const fetchSchedules = async () => {
    const res = await fetch('/api/oncall')
    const data = await res.json()
    setSchedules(data.schedules || [])
  }

  const fetchOncalls = async () => {
    const res = await fetch('/api/oncall/current')
    const data = await res.json()
    setOncalls(data.oncall || [])
  }

  const fetchEscalation = async (scheduleId) => {
    const res = await fetch(`/api/oncall/${scheduleId}/escalation`)
    const data = await res.json()
    setEscalations(prev => ({ ...prev, [scheduleId]: data.chain || [] }))
  }

  useEffect(() => {
    fetchSchedules()
    fetchOncalls()
  }, [])

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!form.name || !form.team) return
    const members = memberInputs.filter(m => m.name)
    if (members.length === 0) return
    await fetch('/api/oncall', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, members, escalation_minutes: Number(form.escalation_minutes) }),
    })
    setShowForm(false)
    setForm({ name: '', team: '', rotation_type: 'weekly', escalation_minutes: 15 })
    setMemberInputs([{ name: '', email: '', role: 'engineer' }])
    fetchSchedules()
    fetchOncalls()
  }

  const handleDelete = async (id) => {
    await fetch(`/api/oncall/${id}`, { method: 'DELETE' })
    fetchSchedules()
    fetchOncalls()
  }

  const addMember = () => setMemberInputs([...memberInputs, { name: '', email: '', role: 'engineer' }])
  const updateMember = (idx, field, val) => {
    const updated = [...memberInputs]
    updated[idx] = { ...updated[idx], [field]: val }
    setMemberInputs(updated)
  }
  const removeMember = (idx) => setMemberInputs(memberInputs.filter((_, i) => i !== idx))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white flex items-center gap-2">
          <Phone className="w-5 h-5 text-emerald-400" /> On-Call Schedules
        </h2>
        <button onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 px-3 py-2 bg-emerald-500/15 text-emerald-400 rounded-lg text-xs font-medium hover:bg-emerald-500/25">
          <Plus className="w-3.5 h-3.5" /> New Schedule
        </button>
      </div>

      {oncalls.length > 0 && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4">
          <h3 className="text-sm font-medium text-emerald-400 mb-3 flex items-center gap-2">
            <UserCheck className="w-4 h-4" /> Currently On-Call
          </h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {oncalls.map((oc, i) => (
              <div key={i} className="bg-[#111827] rounded-lg p-3 border border-gray-700/50">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-white">{oc.member?.name || 'Unknown'}</span>
                  <span className="text-xs text-gray-500">{oc.schedule_name}</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-400">
                  {oc.member?.email && <span>{oc.member.email}</span>}
                  <span className="px-1.5 py-0.5 bg-gray-700 rounded">{oc.source}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showForm && (
        <form onSubmit={handleCreate} className="bg-[#111827] border border-gray-700/50 rounded-lg p-4 space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Schedule Name</label>
              <input value={form.name} onChange={e => setForm({...form, name: e.target.value})}
                placeholder="Primary On-Call" className="w-full bg-gray-800 text-white text-xs rounded px-2 py-1.5 border border-gray-700" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Team</label>
              <input value={form.team} onChange={e => setForm({...form, team: e.target.value})}
                placeholder="Platform" className="w-full bg-gray-800 text-white text-xs rounded px-2 py-1.5 border border-gray-700" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Rotation</label>
              <select value={form.rotation_type} onChange={e => setForm({...form, rotation_type: e.target.value})}
                className="w-full bg-gray-800 text-white text-xs rounded px-2 py-1.5 border border-gray-700">
                <option value="weekly">Weekly</option>
                <option value="daily">Daily</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Escalation (min)</label>
              <input type="number" value={form.escalation_minutes} onChange={e => setForm({...form, escalation_minutes: e.target.value})}
                className="w-full bg-gray-800 text-white text-xs rounded px-2 py-1.5 border border-gray-700" />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-gray-400">Team Members</label>
              <button type="button" onClick={addMember} className="text-xs text-cyan-400 hover:text-cyan-300">+ Add Member</button>
            </div>
            <div className="space-y-2">
              {memberInputs.map((m, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input value={m.name} onChange={e => updateMember(i, 'name', e.target.value)}
                    placeholder="Name" className="flex-1 bg-gray-800 text-white text-xs rounded px-2 py-1.5 border border-gray-700" />
                  <input value={m.email} onChange={e => updateMember(i, 'email', e.target.value)}
                    placeholder="Email" className="flex-1 bg-gray-800 text-white text-xs rounded px-2 py-1.5 border border-gray-700" />
                  <select value={m.role} onChange={e => updateMember(i, 'role', e.target.value)}
                    className="bg-gray-800 text-white text-xs rounded px-2 py-1.5 border border-gray-700">
                    <option value="engineer">Engineer</option>
                    <option value="lead">Lead</option>
                    <option value="manager">Manager</option>
                  </select>
                  {memberInputs.length > 1 && (
                    <button type="button" onClick={() => removeMember(i)} className="text-gray-500 hover:text-red-400">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <button type="submit" className="px-4 py-1.5 bg-emerald-500 text-black text-xs font-medium rounded hover:bg-emerald-400">
            Create Schedule
          </button>
        </form>
      )}

      <div className="space-y-3">
        {schedules.map((s) => (
          <div key={s.id} className="bg-[#111827] border border-gray-700/50 rounded-lg p-4 group">
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-white">{s.name}</span>
                  <span className="px-1.5 py-0.5 bg-gray-700 text-gray-300 text-xs rounded">{s.team}</span>
                  <span className="px-1.5 py-0.5 bg-cyan-500/15 text-cyan-400 text-xs rounded">{s.rotation_type}</span>
                </div>
                <p className="text-xs text-gray-500">
                  {s.members?.length || 0} members &middot; Escalation: {s.escalation_minutes}min
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => fetchEscalation(s.id)}
                  className="text-xs text-gray-400 hover:text-amber-400 flex items-center gap-1">
                  <Shield className="w-3 h-3" /> Escalation
                </button>
                <button onClick={() => handleDelete(s.id)}
                  className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mb-3">
              {(s.members || []).map((m, i) => (
                <div key={i} className="flex items-center gap-1.5 px-2 py-1 bg-gray-800 rounded text-xs">
                  <Users className="w-3 h-3 text-gray-400" />
                  <span className="text-white">{m.name}</span>
                  <span className="text-gray-500">{m.role}</span>
                </div>
              ))}
            </div>

            {escalations[s.id] && (
              <div className="border-t border-gray-700/50 pt-3">
                <h4 className="text-xs text-amber-400 mb-2 flex items-center gap-1">
                  <Shield className="w-3 h-3" /> Escalation Chain
                </h4>
                <div className="flex items-center gap-2 flex-wrap">
                  {escalations[s.id].map((step, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="px-2.5 py-1.5 bg-gray-800 rounded border border-gray-700">
                        <p className="text-xs text-white font-medium">{step.member?.name || 'Unknown'}</p>
                        <p className="text-xs text-gray-500 flex items-center gap-1">
                          <Clock className="w-3 h-3" /> +{step.delay_minutes}m
                        </p>
                      </div>
                      {i < escalations[s.id].length - 1 && <ArrowRight className="w-3 h-3 text-gray-600" />}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
        {schedules.length === 0 && (
          <div className="text-center py-12 text-gray-500 text-sm">
            No on-call schedules configured. Click "New Schedule" to create one.
          </div>
        )}
      </div>
    </div>
  )
}
