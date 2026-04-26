import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext.jsx'

export default function LoginPage() {
  const { login } = useAuth()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#0a0a0a',
    }}>
      <div style={{ width: 380 }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 40, justifyContent: 'center' }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: 'linear-gradient(135deg, #7F77DD, #a855f7)',
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, padding: 8,
          }}>
            {[0,1,2,3].map(i => <div key={i} style={{ background: 'rgba(255,255,255,0.85)', borderRadius: 2 }} />)}
          </div>
          <span style={{ fontSize: 22, fontWeight: 700, color: '#fff' }}>BlissClub</span>
        </div>

        {/* Card */}
        <div style={{
          background: '#141414', border: '0.5px solid rgba(255,255,255,0.08)',
          borderRadius: 16, padding: '32px 36px',
        }}>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: '#fff', marginBottom: 6 }}>Sign in</h1>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 28 }}>
            BlissClub Marketing Dashboard
          </p>

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 6, fontWeight: 500 }}>
                Email
              </label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="you@blissclub.com" required
                style={{
                  width: '100%', padding: '10px 14px', borderRadius: 8, fontSize: 13,
                  background: 'rgba(255,255,255,0.05)', border: '0.5px solid rgba(255,255,255,0.12)',
                  color: '#fff', outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 6, fontWeight: 500 }}>
                Password
              </label>
              <input
                type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••" required
                style={{
                  width: '100%', padding: '10px 14px', borderRadius: 8, fontSize: 13,
                  background: 'rgba(255,255,255,0.05)', border: '0.5px solid rgba(255,255,255,0.12)',
                  color: '#fff', outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>

            {error && (
              <div style={{
                padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: 12,
                background: 'rgba(239,68,68,0.1)', border: '0.5px solid rgba(239,68,68,0.3)',
                color: '#ef4444',
              }}>{error}</div>
            )}

            <button type="submit" disabled={loading} style={{
              width: '100%', padding: '11px', borderRadius: 8, fontSize: 13, fontWeight: 600,
              background: loading ? 'rgba(127,119,221,0.5)' : '#7F77DD',
              color: '#fff', border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background 0.15s',
            }}>
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', fontSize: 11, color: 'rgba(255,255,255,0.2)', marginTop: 20 }}>
          BlissClub Internal Tool · {new Date().getFullYear()}
        </p>
      </div>
    </div>
  )
}
