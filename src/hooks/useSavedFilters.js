import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext.jsx'

const BACKEND = import.meta.env.VITE_BACKEND_URL || 'https://blissclub-proxy-production.up.railway.app'

export function useSavedFilters(page) {
  const { token } = useAuth()
  const [saved, setSaved]   = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!token) return
    fetch(`${BACKEND}/filters`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(data => setSaved(Array.isArray(data) ? data.filter(f => f.page === page) : []))
      .catch(() => {})
  }, [token, page])

  const save = useCallback(async (name, filters) => {
    const res  = await fetch(`${BACKEND}/filters`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name, page, filters }),
    })
    const data = await res.json()
    setSaved(s => [data, ...s])
    return data
  }, [token, page])

  const remove = useCallback(async (id) => {
    await fetch(`${BACKEND}/filters/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    setSaved(s => s.filter(f => f.id !== id))
  }, [token])

  return { saved, save, remove, loading }
}
