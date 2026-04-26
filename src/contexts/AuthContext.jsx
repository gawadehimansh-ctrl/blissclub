import { createContext, useContext, useState, useEffect } from 'react'

const AuthContext = createContext(null)

const BACKEND = import.meta.env.VITE_BACKEND_URL || 'https://blissclub-proxy-production.up.railway.app'

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [token, setToken]     = useState(() => localStorage.getItem('bc_token'))
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (token) {
      fetch(`${BACKEND}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(r => r.ok ? r.json() : null)
        .then(u => { setUser(u); setLoading(false) })
        .catch(() => { setToken(null); localStorage.removeItem('bc_token'); setLoading(false) })
    } else {
      setLoading(false)
    }
  }, [token])

  async function login(email, password) {
    const res  = await fetch(`${BACKEND}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Login failed')
    localStorage.setItem('bc_token', data.token)
    setToken(data.token)
    setUser(data.user)
    return data.user
  }

  function logout() {
    localStorage.removeItem('bc_token')
    setToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, BACKEND }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
