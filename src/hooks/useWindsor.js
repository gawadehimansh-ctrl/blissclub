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

    // Meta + GA4
    try {
      const data = await fetchEndpoint(`/api/meta-daily?preset=${preset}`)
      loadData(parseWindsorPayload(data, 'windsor_meta_ga4'), 'WINDSOR_META_GA4', true)
      results.success.push('Meta + GA4')
    } catch (e) { results.errors.push(`Meta: ${e.message}`) }

    // Google campaigns
    try {
      const data = await fetchEndpoint(`/api/google-campaigns?preset=${preset}`)
      loadData(parseWindsorPayload(data, 'windsor_google'), 'WINDSOR_GOOGLE_DAILY', true)
      results.success.push('Google campaigns')
    } catch (e) { results.errors.push(`Google: ${e.message}`) }

    // Search terms
    try {
      const data = await fetchEndpoint(`/api/google-search-terms?preset=${preset}`)
      loadData(parseWindsorPayload(data, 'windsor_search_terms'), 'WINDSOR_SEARCH_TERMS', true)
      results.success.push('Search terms')
    } catch (e) { results.errors.push(`Search terms: ${e.message}`) }

    // Keywords
    try {
      const data = await fetchEndpoint(`/api/google-keywords?preset=${preset}`)
      loadData(parseWindsorPayload(data, 'windsor_keywords'), 'WINDSOR_KEYWORDS', true)
      results.success.push('Keywords')
    } catch (e) { results.errors.push(`Keywords: ${e.message}`) }

    // Awareness
    try {
      const data = await fetchEndpoint(`/api/google-awareness?preset=${preset}`)
      loadData(parseWindsorPayload(data, 'windsor_awareness'), 'GOOGLE_AWARENESS', true)
      results.success.push('Awareness')
    } catch (e) { results.errors.push(`Awareness: ${e.message}`) }

    return results
  }, [fetchEndpoint, loadData])

  return { syncAll }
}
