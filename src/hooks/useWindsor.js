import { useCallback, useState } from 'react'
import { useData } from '../data/store.jsx'
import { parseWindsorPayload } from '../utils/csvParser.js'

const PROXY = import.meta.env.VITE_WINDSOR_PROXY_URL || ''

export function useWindsor() {
  const { loadData } = useData()
  const [syncing, setSyncing]     = useState(false)
  const [syncStatus, setSyncStatus] = useState(null) // null | 'waking' | 'syncing' | 'done' | 'error'

  // Step 1 — wake up Render (free tier sleeps after 15min)
  const wakeProxy = useCallback(async () => {
    if (!PROXY) return false
    try {
      const res = await fetch(`${PROXY}/ping`, { signal: AbortSignal.timeout(15000) })
      return res.ok
    } catch {
      return false
    }
  }, [])

  const fetchEndpoint = useCallback(async (path) => {
    const res = await fetch(`${PROXY}${path}`, { signal: AbortSignal.timeout(60000) })
    if (!res.ok) throw new Error(`${path} → HTTP ${res.status}`)
    const json = await res.json()
    if (!json.ok) throw new Error(json.error || `${path} failed`)
    return json.data || []
  }, [])

  const syncAll = useCallback(async (preset = 'last_30d') => {
    if (!PROXY) return { success: [], errors: ['Proxy URL not configured'] }
    setSyncing(true)
    setSyncStatus('waking')

    // Wake the proxy first (Render cold start can take 10-30s)
    await wakeProxy()
    setSyncStatus('syncing')

    const results = { success: [], errors: [] }

    // ── Meta + GA4 blended ──────────────────────────────────────────────────
    try {
      const raw = await fetchEndpoint(`/api/meta-daily?preset=${preset}`)
      const parsed = parseWindsorPayload(raw, 'windsor_meta_ga4')
      const metaRows = parsed.filter(r =>
        r.datasource === 'facebook' ||
        (!r.datasource && r.spend > 0)
      )
      const ga4Rows = parsed.filter(r =>
        r.datasource === 'googleanalytics4' ||
        (!r.datasource && !r.spend && (r.gaRevenue > 0 || r.sessions > 0))
      )
      if (metaRows.length > 0) loadData(metaRows, 'META_DB', true)
      if (ga4Rows.length > 0)  loadData(ga4Rows,  'GA4_DUMP', false)
      results.success.push(`Meta (${metaRows.length} rows) + GA4 (${ga4Rows.length} rows)`)
    } catch (e) { results.errors.push(`Meta/GA4: ${e.message}`) }

    // ── GA4 standalone ──────────────────────────────────────────────────────
    try {
      const data = await fetchEndpoint(`/api/ga4?preset=${preset}`)
      const parsed = parseWindsorPayload(data, 'ga4')
      if (parsed.length > 0) loadData(parsed, 'GA4_DUMP', false)
      results.success.push(`GA4 standalone (${parsed.length} rows)`)
    } catch (e) { results.errors.push(`GA4: ${e.message}`) }

    // ── Google campaigns ────────────────────────────────────────────────────
    try {
      const data = await fetchEndpoint(`/api/google-campaigns?preset=${preset}`)
      const parsed = parseWindsorPayload(data, 'windsor_google')
      loadData(parsed, 'WINDSOR_GOOGLE_DAILY', true)
      results.success.push(`Google campaigns (${parsed.length} rows)`)
    } catch (e) { results.errors.push(`Google campaigns: ${e.message}`) }

    // ── Search terms ────────────────────────────────────────────────────────
    try {
      const data = await fetchEndpoint(`/api/google-search-terms?preset=${preset}`)
      const parsed = parseWindsorPayload(data, 'windsor_search_terms')
      if (parsed.length > 0) loadData(parsed, 'WINDSOR_SEARCH_TERMS', true)
      results.success.push(`Search terms (${parsed.length} rows)`)
    } catch (e) { results.errors.push(`Search terms: ${e.message}`) }

    // ── Keywords ────────────────────────────────────────────────────────────
    try {
      const data = await fetchEndpoint(`/api/google-keywords?preset=${preset}`)
      const parsed = parseWindsorPayload(data, 'windsor_keywords')
      if (parsed.length > 0) loadData(parsed, 'WINDSOR_KEYWORDS', true)
      results.success.push(`Keywords (${parsed.length} rows)`)
    } catch (e) { results.errors.push(`Keywords: ${e.message}`) }

    // ── Awareness ───────────────────────────────────────────────────────────
    try {
      const data = await fetchEndpoint(`/api/google-awareness?preset=${preset}`)
      const parsed = parseWindsorPayload(data, 'windsor_awareness')
      loadData(parsed, 'GOOGLE_AWARENESS', true)
      results.success.push(`Awareness (${parsed.length} rows)`)
    } catch (e) { results.errors.push(`Awareness: ${e.message}`) }

    setSyncing(false)
    setSyncStatus(results.errors.length === 0 ? 'done' : 'error')
    return results
  }, [fetchEndpoint, loadData, wakeProxy])

  return { syncAll, syncing, syncStatus, proxyUrl: PROXY }
}
