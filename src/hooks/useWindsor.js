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

  const syncAll = useCallback(async () => {
    const results = { success: [], errors: [] }

    // Meta daily
    try {
      const raw    = await fetchEndpoint(`/api/meta-daily`)
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
      if (ga4Rows.length > 0)  loadData(ga4Rows,  'GA4_DUMP', false)
      results.success.push(`Meta (${metaRows.length}) + GA4 (${ga4Rows.length})`)
    } catch (e) { results.errors.push(`Meta: ${e.message}`) }

    // Meta Catalog / DPA — product_id breakdown
    try {
      const raw  = await fetchEndpoint(`/api/meta-catalog`)
      loadData(raw, 'META_CATALOG', true)
      results.success.push(`Catalog (${raw.length})`)
    } catch (e) { results.errors.push(`Catalog: ${e.message}`) }

    // GA4 item-level (joins with Meta catalog via variant_id)
    try {
      const raw = await fetchEndpoint('/api/ga4-items')
      loadData(raw, 'GA4_ITEMS', true)
      results.success.push('GA4 items (' + raw.length + ')')
    } catch (e) { results.errors.push('GA4 items: ' + e.message) }

    // GA4 standalone
    try {
      const data   = await fetchEndpoint(`/api/ga4`)
      const parsed = parseWindsorPayload(data, 'ga4')
      if (parsed.length > 0) loadData(parsed, 'GA4_DUMP', false)
      results.success.push(`GA4 (${parsed.length})`)
    } catch (e) { results.errors.push(`GA4: ${e.message}`) }

    // Google campaigns
    try {
      const data = await fetchEndpoint(`/api/google-campaigns`)
      loadData(parseWindsorPayload(data, 'windsor_google'), 'WINDSOR_GOOGLE_DAILY', true)
      results.success.push('Google campaigns')
    } catch (e) { results.errors.push(`Google: ${e.message}`) }

    // Google search terms
    try {
      const data   = await fetchEndpoint(`/api/google-search-terms`)
      const parsed = parseWindsorPayload(data, 'windsor_search_terms')
      if (parsed.length > 0) loadData(parsed, 'WINDSOR_SEARCH_TERMS', true)
      results.success.push(`Search terms (${parsed.length})`)
    } catch (e) { results.errors.push(`Search terms: ${e.message}`) }

    // Google keywords
    try {
      const data   = await fetchEndpoint(`/api/google-keywords`)
      const parsed = parseWindsorPayload(data, 'windsor_keywords')
      if (parsed.length > 0) loadData(parsed, 'GOOGLE_KEYWORDS', true)
      results.success.push(`Keywords (${parsed.length})`)
    } catch (e) { results.errors.push(`Keywords: ${e.message}`) }

    // Google awareness
    try {
      const data   = await fetchEndpoint(`/api/google-awareness`)
      const parsed = parseWindsorPayload(data, 'windsor_google')
      if (parsed.length > 0) loadData(parsed, 'GOOGLE_AWARENESS', true)
      results.success.push(`Awareness (${parsed.length})`)
    } catch (e) { results.errors.push(`Awareness: ${e.message}`) }

    // Google products
    try {
      const data   = await fetchEndpoint(`/api/google-products`)
      const parsed = parseWindsorPayload(data, 'windsor_google')
      if (parsed.length > 0) loadData(parsed, 'GOOGLE_PRODUCTS', true)
      results.success.push(`Google products (${parsed.length})`)
    } catch (e) { results.errors.push(`Google products: ${e.message}`) }

    // Google demand gen
    try {
      const data   = await fetchEndpoint(`/api/google-demandgen`)
      const parsed = parseWindsorPayload(data, 'windsor_google')
      if (parsed.length > 0) loadData(parsed, 'GOOGLE_DEMANDGEN', true)
      results.success.push(`Demand Gen (${parsed.length})`)
    } catch (e) { results.errors.push(`Demand Gen: ${e.message}`) }

    return results
  }, [fetchEndpoint, loadData])

  return { syncAll }
}
