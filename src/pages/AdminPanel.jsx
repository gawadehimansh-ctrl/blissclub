import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext.jsx'

const BACKEND = import.meta.env.VITE_BACKEND_URL || 'https://blissclub-proxy-production.up.railway.app'

function authHeaders(token) {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
}

const CARD = { background: 'var(--bg2)', border: '0.5px solid var(--border)', borderRadius: 10, padding: '20px 24px' }
const TH = { padding: '9px 14px', fontSize: 10, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '0.5px solid var(--border2)', textAlign: 'left', whiteSpace: 'nowrap' }
const TD = { padding: '10px 14px', fontSize: 12, borderBottom: '0.5px solid var(--border)', color: 'var(--text)' }

function RoleBadge({ role }) {
  const isAdmin = role === 'admin'
  return (
    <span style={{
      fontSize: 10, padding: '2px 8px', borderRadius: 20, fontWeight: 600,
      background: isAdmin ? 'rgba(127,119,221,0.15)' : 'rgba(96,165,250,0.12)',
      color: isAdmin ? '#7F77DD' : '#60a5fa',
      border: `0.5px solid ${isAdmin ? 'rgba(127,119,221,0.3)' : 'rgba(96,165,250,0.3)'}`,
    }}>{isAdmin ? 'Admin' : 'Media Buyer'}</span>
  )
}

export default function AdminPanel() {
  const { user, token } = useAuth()
  const [tab, setTab]         = useState('users')
  const [users, setUsers]     = useState([])
  const [activity, setActivity] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [newUser, setNewUser] = useState({ name: '', email: '', password: '', role: 'media_buyer' })
  const [addError, setAddError] = useState('')
  const [addLoading, setAddLoading] = useState(false)
  const [pwdModal, setPwdModal] = useState(null) // { id, name }
  const [newPwd, setNewPwd]   = useState('')
  const [pwdError, setPwdError] = useState('')
  const [msg, setMsg]         = useState('')

  // Only admin can access
  if (user?.role !== 'admin') return (
    <div style={{ padding: 40, color: 'var(--text3)' }}>Access denied — admin only.</div>
  )

  useEffect(() => { fetchUsers(); fetchActivity() }, [])

  async function fetchUsers() {
    setLoading(true)
    const res = await fetch(`${BACKEND}/users`, { headers: authHeaders(token) })
    setUsers(await res.json())
    setLoading(false)
  }

  async function fetchActivity() {
    const res = await fetch(`${BACKEND}/activity`, { headers: authHeaders(token) })
    setActivity(await res.json())
  }

  async function addUser() {
    setAddError('')
    if (!newUser.name || !newUser.email || !newUser.password) return setAddError('All fields required')
    setAddLoading(true)
    try {
      const res  = await fetch(`${BACKEND}/users`, { method: 'POST', headers: authHeaders(token), body: JSON.stringify(newUser) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setUsers(u => [...u, data])
      setShowAdd(false)
      setNewUser({ name: '', email: '', password: '', role: 'media_buyer' })
      flash('User created successfully')
    } catch (e) { setAddError(e.message) }
    finally { setAddLoading(false) }
  }

  async function deleteUser(id, name) {
    if (!confirm(`Delete ${name}? This cannot be undone.`)) return
    await fetch(`${BACKEND}/users/${id}`, { method: 'DELETE', headers: authHeaders(token) })
    setUsers(u => u.filter(x => x.id !== id))
    flash('User deleted')
  }

  async function changePassword() {
    setPwdError('')
    if (!newPwd || newPwd.length < 6) return setPwdError('Min 6 characters')
    const res  = await fetch(`${BACKEND}/users/${pwdModal.id}/password`, {
      method: 'PATCH', headers: authHeaders(token), body: JSON.stringify({ password: newPwd })
    })
    if (res.ok) { setPwdModal(null); setNewPwd(''); flash('Password updated') }
    else { const d = await res.json(); setPwdError(d.error) }
  }

  function flash(m) { setMsg(m); setTimeout(() => setMsg(''), 3000) }

  const TAB = (key, label) => (
    <button onClick={() => setTab(key)} style={{
      padding: '7px 16px', fontSize: 13, borderRadius: 6, cursor: 'pointer', border: 'none',
      background: tab === key ? 'var(--purple, #7F77DD)' : 'transparent',
      color: tab === key ? '#fff' : 'var(--text2)',
      fontWeight: tab === key ? 500 : 400,
    }}>{label}</button>
  )

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1100 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Admin Panel</h1>
          <div style={{ fontSize: 13, color: 'var(--text3)' }}>Manage users · view activity · reset passwords</div>
        </div>
        {msg && (
          <div style={{ fontSize: 12, padding: '8px 16px', borderRadius: 8, background: 'rgba(34,197,94,0.12)', color: '#22c55e', border: '0.5px solid rgba(34,197,94,0.3)' }}>
            ✓ {msg}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: 'var(--bg2)', padding: 4, borderRadius: 8, width: 'fit-content', border: '0.5px solid var(--border)' }}>
        {TAB('users', `Users (${users.length})`)}
        {TAB('activity', 'Activity log')}
      </div>

      {/* ── USERS TAB ── */}
      {tab === 'users' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
            <button onClick={() => setShowAdd(s => !s)} style={{
              padding: '8px 18px', fontSize: 12, borderRadius: 8, cursor: 'pointer', border: 'none',
              background: '#7F77DD', color: '#fff', fontWeight: 500,
            }}>+ Add user</button>
          </div>

          {/* Add user form */}
          {showAdd && (
            <div style={{ ...CARD, marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 16 }}>New user</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
                {[
                  { label: 'Name', key: 'name', type: 'text', placeholder: 'Full name' },
                  { label: 'Email', key: 'email', type: 'email', placeholder: 'email@company.com' },
                  { label: 'Password', key: 'password', type: 'password', placeholder: 'Min 6 chars' },
                ].map(f => (
                  <div key={f.key}>
                    <label style={{ display: 'block', fontSize: 11, color: 'var(--text3)', marginBottom: 5 }}>{f.label}</label>
                    <input type={f.type} value={newUser[f.key]} placeholder={f.placeholder}
                      onChange={e => setNewUser(u => ({ ...u, [f.key]: e.target.value }))}
                      style={{ width: '100%', padding: '8px 10px', borderRadius: 6, fontSize: 12, background: 'var(--bg3)', border: '0.5px solid var(--border2)', color: 'var(--text)', outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                ))}
                <div>
                  <label style={{ display: 'block', fontSize: 11, color: 'var(--text3)', marginBottom: 5 }}>Role</label>
                  <select value={newUser.role} onChange={e => setNewUser(u => ({ ...u, role: e.target.value }))}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 6, fontSize: 12, background: 'var(--bg3)', border: '0.5px solid var(--border2)', color: 'var(--text)', outline: 'none' }}>
                    <option value="media_buyer">Media Buyer</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              </div>
              {addError && <div style={{ fontSize: 12, color: '#ef4444', marginBottom: 10 }}>{addError}</div>}
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={addUser} disabled={addLoading} style={{ padding: '7px 20px', fontSize: 12, borderRadius: 6, background: '#7F77DD', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 500 }}>
                  {addLoading ? 'Creating...' : 'Create user'}
                </button>
                <button onClick={() => { setShowAdd(false); setAddError('') }} style={{ padding: '7px 14px', fontSize: 12, borderRadius: 6, background: 'var(--bg3)', color: 'var(--text2)', border: '0.5px solid var(--border2)', cursor: 'pointer' }}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Users table */}
          <div style={{ background: 'var(--bg2)', borderRadius: 10, border: '0.5px solid var(--border)', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--bg3)' }}>
                  <th style={TH}>Name</th>
                  <th style={TH}>Email</th>
                  <th style={TH}>Role</th>
                  <th style={TH}>Joined</th>
                  <th style={{ ...TH, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={5} style={{ ...TD, textAlign: 'center', color: 'var(--text3)', padding: 32 }}>Loading...</td></tr>
                ) : users.map(u => (
                  <tr key={u.id} onMouseEnter={e=>e.currentTarget.style.background='var(--bg3)'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                    <td style={{ ...TD, fontWeight: 500 }}>{u.name} {u.id === user.id && <span style={{ fontSize: 10, color: 'var(--text3)' }}>(you)</span>}</td>
                    <td style={{ ...TD, color: 'var(--text3)' }}>{u.email}</td>
                    <td style={TD}><RoleBadge role={u.role} /></td>
                    <td style={{ ...TD, color: 'var(--text3)' }}>{new Date(u.created_at).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })}</td>
                    <td style={{ ...TD, textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        <button onClick={() => { setPwdModal(u); setNewPwd(''); setPwdError('') }} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 5, cursor: 'pointer', background: 'var(--bg3)', border: '0.5px solid var(--border2)', color: 'var(--text2)' }}>
                          Reset password
                        </button>
                        {u.id !== user.id && (
                          <button onClick={() => deleteUser(u.id, u.name)} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 5, cursor: 'pointer', background: 'rgba(239,68,68,0.08)', border: '0.5px solid rgba(239,68,68,0.2)', color: '#ef4444' }}>
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── ACTIVITY TAB ── */}
      {tab === 'activity' && (
        <div style={{ background: 'var(--bg2)', borderRadius: 10, border: '0.5px solid var(--border)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg3)' }}>
                <th style={TH}>User</th>
                <th style={TH}>Page</th>
                <th style={TH}>Action</th>
                <th style={TH}>Time</th>
              </tr>
            </thead>
            <tbody>
              {activity.length === 0 ? (
                <tr><td colSpan={4} style={{ ...TD, textAlign: 'center', color: 'var(--text3)', padding: 32 }}>No activity yet</td></tr>
              ) : activity.map(a => (
                <tr key={a.id} onMouseEnter={e=>e.currentTarget.style.background='var(--bg3)'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                  <td style={{ ...TD, fontWeight: 500 }}>{a.name}</td>
                  <td style={{ ...TD, color: 'var(--text3)' }}>{a.page}</td>
                  <td style={TD}>
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: 'var(--bg3)', color: 'var(--text2)' }}>{a.action}</span>
                  </td>
                  <td style={{ ...TD, color: 'var(--text3)', fontSize: 11 }}>
                    {new Date(a.created_at).toLocaleString('en-IN', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Password reset modal */}
      {pwdModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--bg2)', borderRadius: 12, padding: '28px 32px', width: 360, border: '0.5px solid var(--border2)' }}>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Reset password</div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 20 }}>for {pwdModal.name}</div>
            <input type="password" value={newPwd} onChange={e => setNewPwd(e.target.value)}
              placeholder="New password (min 6 chars)"
              style={{ width: '100%', padding: '9px 12px', borderRadius: 7, fontSize: 13, background: 'var(--bg3)', border: '0.5px solid var(--border2)', color: 'var(--text)', outline: 'none', boxSizing: 'border-box', marginBottom: 10 }} />
            {pwdError && <div style={{ fontSize: 12, color: '#ef4444', marginBottom: 10 }}>{pwdError}</div>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={changePassword} style={{ flex: 1, padding: '8px', fontSize: 12, borderRadius: 6, background: '#7F77DD', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 500 }}>
                Update password
              </button>
              <button onClick={() => setPwdModal(null)} style={{ padding: '8px 16px', fontSize: 12, borderRadius: 6, background: 'var(--bg3)', color: 'var(--text2)', border: '0.5px solid var(--border2)', cursor: 'pointer' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
