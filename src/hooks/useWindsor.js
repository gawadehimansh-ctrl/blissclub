import { useCallback } from 'react'
import { useData } from '../data/store.jsx'
import { parseWindsorPayload } from '../utils/csvParser.js'

const PROXY = import.meta.env.VITE_WINDSOR_PROXY_URL || ''

export function useWindsor() {
  const { loadData } = useData()

  const fetchEndpoint = useCallback(async (path) => {
    const res = await fetch(`${PROXY}${path}`)
    if (!res.ok) throw new Error(`${path} failed: ${res.status}`)
    const json = await res.json()
    return json.data || []
  }, [])

  const syncAll = useCallback(async (preset = 'last_30d') => {
    const results = { success: [], errors: [] }

    // Meta + GA4 — split by datasource field
    try {
      const raw = await fetchEndpoint(`/api/meta-daily?preset=${preset}`)
      const parsed = parseWindsorPayload(raw, 'windsor_meta_ga4')
      const metaRows = parsed.filter(r =>
        r.datasource === 'facebook' ||
        (r.datasource !== 'googleanalytics4' && r.spend > 0)
      )
      const ga4Rows = parsed.filter(r =>
        r.datasource === 'googleanalytics4' ||
        (r.datasource !== 'facebook' && !r.spend && (r.gaRevenue > 0 || r.sessions > 0))
      )
      if (metaRows.length > 0) loadData(metaRows, 'META_DB', true)
      if (ga4Rows.length > 0)  loadData(ga4Rows, 'GA4_DUMP', false)
      results.success.push(`Meta (${metaRows.length}) + GA4 (${ga4Rows.length})`)
    } catch (e) { results.errors.push(`Meta: ${e.message}`) }

    // GA4 standalone
    try {
      const data = await fetchEndpoint(`/api/ga4?preset=${preset}`)
      const parsed = parseWindsorPayload(data, 'ga4')
      if (parsed.length > 0) loadData(parsed, 'GA4_DUMP', false)
      results.success.push(`GA4 (${parsed.length})`)
    } catch (e) { results.errors.push(`GA4: ${e.message}`) }

    // Google campaigns
    try {
      const data = await fetchEndpoint(`/api/google-campaigns?preset=${preset}`)
      loadData(parseWindsorPayload(data, 'windsor_google'), 'WINDSOR_GOOGLE_DAILY', true)
      results.success.push('Google campaigns')
    } catch (e) { results.errors.push(`Google: ${e.message}`) }

    // Search terms
    try {
      const data = await fetchEndpoint(`/api/google-search-terms?preset=${preset}`)
      const parsedSt = parseWindsorPayload(data, 'windsor_search_terms')
      console.log('SearchTerms raw rows:', data?.length, 'parsed:', parsedSt?.length, 'sample:', data?.[0])
      if (parsedSt.length > 0) loadData(parsedSt, 'WINDSOR_SEARCH_TERMS', true)
      results.success.push('Search terms')
    } catch (e) { results.errors.push(`Search terms: ${e.message}`) }

    // Keywords
    try {
      const data = await fetchEndpoint(`/api/google-keywords?preset=${preset}`)
      const parsedKw = parseWindsorPayload(data, 'windsor_keywords')
      console.log('Keywords raw rows:', data?.length, 'parsed:', parsedKw?.length, 'sample:', data?.[0])
      if (parsedKw.length > 0) loadData(parsedKw, 'WINDSOR_KEYWORDS', true)
      results.success.push('Keywords')
    } catch (e) { results.errors.push(`Keywords: ${e.message}`) }

    // Awareness — always pull last 30d for fuller picture
    try {
      const data = await fetchEndpoint(`/api/google-awareness?preset=last_30d`)
      loadData(parseWindsorPayload(data, 'windsor_awareness'), 'GOOGLE_AWARENESS', true)
      results.success.push('Awareness')
    } catch (e) { results.errors.push(`Awareness: ${e.message}`) }

    return results
  }, [fetchEndpoint, loadData])

  return { syncAll }
}
