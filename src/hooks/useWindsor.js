import { useCallback, useState } from 'react'
import { useData } from '../data/store.jsx'
import { parseWindsorPayload } from '../utils/csvParser.js'

const BASE = import.meta.env.VITE_PROXY_URL || ''

export function useWindsor() {
  const { loadData } = useData()
  const [loading, setLoading]   = useState({})
  const [error, setError]       = useState(null)
  const [lastSync, setLastSync] = useState(null)

  const proxyAvailable = !!BASE

  async function fetchEndpoint(path, params = {}) {
    const url = new URL(BASE + path)
    Object.entries(params).forEach(([k, v]) => v && url.searchParams.set(k, v))
    const res = await fetch(url.toString())
    if (!res.ok) throw new Error(`Proxy error ${res.status}: ${await res.text()}`)
    const json = await res.json()
    if (!json.ok) throw new Error(json.error || 'Unknown proxy error')
    return json.data || []
  }

  const syncMeta = useCallback(async (preset = 'this_monthT') => {
    setLoading(l => ({ ...l, meta: true }))
    setError(null)
    try {
      const raw = await fetchEndpoint('/api/meta-daily', { preset })
      const parsed = parseWindsorPayload(raw, 'windsor_meta_ga4')
      loadData(parsed, 'META_DB', true)
      setLastSync(new Date())
    } catch (e) { setError(e.message) }
    finally { setLoading(l => ({ ...l, meta: false })) }
  }, [loadData])

  const syncGoogle = useCallback(async (preset = 'this_monthT') => {
    setLoading(l => ({ ...l, google: true }))
    setError(null)
    try {
      const raw = await fetchEndpoint('/api/google-campaigns', { preset })
      const parsed = parseWindsorPayload(raw, 'windsor_google')
      loadData(parsed, 'GOOGLE_DUMP', true)
      setLastSync(new Date())
    } catch (e) { setError(e.message) }
    finally { setLoading(l => ({ ...l, google: false })) }
  }, [loadData])

  const syncSearchTerms = useCallback(async (preset = 'this_monthT') => {
    setLoading(l => ({ ...l, searchTerms: true }))
    setError(null)
    try {
      const raw = await fetchEndpoint('/api/google-search-terms', { preset })
      const parsed = parseWindsorPayload(raw, 'windsor_search_terms')
      loadData(parsed, 'GOOGLE_SEARCH_TERMS', true)
      setLastSync(new Date())
    } catch (e) { setError(e.message) }
    finally { setLoading(l => ({ ...l, searchTerms: false })) }
  }, [loadData])

  const syncKeywords = useCallback(async (preset = 'this_monthT') => {
    setLoading(l => ({ ...l, keywords: true }))
    setError(null)
    try {
      const raw = await fetchEndpoint('/api/google-keywords', { preset })
      const parsed = parseWindsorPayload(raw, 'windsor_keywords')
      loadData(parsed, 'GOOGLE_KEYWORDS', true)
      setLastSync(new Date())
    } catch (e) { setError(e.message) }
    finally { setLoading(l => ({ ...l, keywords: false })) }
  }, [loadData])

  const syncGA4 = useCallback(async (preset = 'this_monthT') => {
    setLoading(l => ({ ...l, ga4: true }))
    setError(null)
    try {
      const raw = await fetchEndpoint('/api/ga4', { preset })
      const parsed = parseWindsorPayload(raw, 'ga4')
      loadData(parsed, 'GA4_DUMP', true)
      setLastSync(new Date())
    } catch (e) { setError(e.message) }
    finally { setLoading(l => ({ ...l, ga4: false })) }
  }, [loadData])

  const syncAll = useCallback(async (preset = 'this_monthT') => {
    setLoading({ meta: true, google: true, searchTerms: true, keywords: true, ga4: true })
    setError(null)
    try {
      await Promise.all([
        syncMeta(preset),
        syncGoogle(preset),
        syncSearchTerms(preset),
        syncKeywords(preset),
        syncGA4(preset),
      ])
      setLastSync(new Date())
    } catch (e) { setError(e.message) }
    finally { setLoading({}) }
  }, [syncMeta, syncGoogle, syncSearchTerms, syncKeywords, syncGA4])

  const isLoading = Object.values(loading).some(Boolean)

  return {
    loading, isLoading, error, lastSync, proxyAvailable,
    syncAll, syncMeta, syncGoogle, syncSearchTerms, syncKeywords, syncGA4,
  }
}
