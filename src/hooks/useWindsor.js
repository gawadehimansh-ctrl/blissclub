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

  const syncAll = useCallback(async (preset = 'last_90d') => {
    const results = { success: [], errors: [] }

    // Meta + Shopify — split by datasource field
    try {
      const raw = await fetchEndpoint(`/api/meta-daily?preset=${preset}`)
      const parsed = parseWindsorPayload(raw, 'windsor_meta_ga4')
      // datasource field tells us which platform each row is from
      const metaRows = parsed.filter(r =>
        r.datasource === 'facebook' ||
        (r.datasource !== 'googleanalytics4' && r.spend > 0)
      )
      if (metaRows.length > 0) loadData(metaRows, 'META_DB', true)
      results.success.push(`Meta (${metaRows.length})`)
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

    // Google products (Shopping + PMax)
    try {
      const data = await fetchEndpoint(`/api/google-products?preset=${preset}`)
      loadData(parseWindsorPayload(data, 'windsor_products'), 'GOOGLE_PRODUCTS', true)
      results.success.push('Google products')
    } catch (e) { results.errors.push(`Google products: ${e.message}`) }

    // Demand Gen
    try {
      const data = await fetchEndpoint(`/api/google-demandgen?preset=${preset}`)
      loadData(parseWindsorPayload(data, 'windsor_demandgen'), 'GOOGLE_DEMANDGEN', true)
      results.success.push('Demand Gen')
    } catch (e) { results.errors.push(`Demand Gen: ${e.message}`) }

    // Awareness — always pull last 30d for fuller picture
    try {
      const data = await fetchEndpoint(`/api/google-awareness?preset=last_30d`)
      loadData(parseWindsorPayload(data, 'windsor_awareness'), 'GOOGLE_AWARENESS', true)
      results.success.push('Awareness')
    } catch (e) { results.errors.push(`Awareness: ${e.message}`) }

    // Meta catalog (product-level)
    try {
      const data = await fetchEndpoint(`/api/meta-catalog?preset=${preset}`)
      if (data.length > 0) loadData(data, 'META_CATALOG', true)
      results.success.push(`Catalog (${data.length})`)
    } catch (e) { results.errors.push(`Catalog: ${e.message}`) }

    return results
  }, [fetchEndpoint, loadData])

  return { syncAll }
}
