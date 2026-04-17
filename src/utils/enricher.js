// Enrich Meta ad rows with GA4 session data
// Matches on adsetName (Meta) = manualTerm (GA4)
// GA4 revenue/orders distributed proportionally by Meta spend within each adset

export function enrichMetaWithGA4(metaRows, ga4Rows) {
  if (!ga4Rows || !ga4Rows.length || !metaRows || !metaRows.length) return metaRows

  // Build GA4 lookup by manualTerm (= adset name) and date
  const ga4Map = {}
  for (const r of ga4Rows) {
    if (!r.manualTerm || r.manualTerm === '(not set)' || r.manualTerm === '(not provided)') continue
    const dateStr = r.date ? new Date(r.date).toISOString().slice(0, 10) : 'all'
    const key = r.manualTerm + '||' + dateStr
    if (!ga4Map[key]) ga4Map[key] = { revenue: 0, transactions: 0, sessions: 0 }
    ga4Map[key].revenue += r.revenue || 0
    ga4Map[key].transactions += r.transactions || 0
    ga4Map[key].sessions += r.sessions || 0
  }

  // Also build a date-agnostic fallback
  const ga4MapAny = {}
  for (const r of ga4Rows) {
    if (!r.manualTerm || r.manualTerm === '(not set)' || r.manualTerm === '(not provided)') continue
    const key = r.manualTerm
    if (!ga4MapAny[key]) ga4MapAny[key] = { revenue: 0, transactions: 0, sessions: 0 }
    ga4MapAny[key].revenue += r.revenue || 0
    ga4MapAny[key].transactions += r.transactions || 0
    ga4MapAny[key].sessions += r.sessions || 0
  }

  // For each adset+date, get total Meta spend to distribute GA4 proportionally
  const metaAdsetSpend = {}
  for (const r of metaRows) {
    const dateStr = r.date ? new Date(r.date).toISOString().slice(0, 10) : 'all'
    const key = r.adsetName + '||' + dateStr
    if (!metaAdsetSpend[key]) metaAdsetSpend[key] = 0
    metaAdsetSpend[key] += r.spend || 0
  }

  // Enrich each Meta row
  return metaRows.map(r => {
    // Skip if already has GA4 data from internal DB dump
    if (r.gaRevenue > 0 || r.gaOrders > 0) return r

    const dateStr = r.date ? new Date(r.date).toISOString().slice(0, 10) : 'all'
    const key = r.adsetName + '||' + dateStr
    const totalAdsetSpend = metaAdsetSpend[key] || 0
    const spendShare = totalAdsetSpend > 0 ? (r.spend || 0) / totalAdsetSpend : 0

    // Try date-specific match first, then fallback to any date
    const ga4 = ga4Map[key] || ga4MapAny[r.adsetName] || null

    if (!ga4) return r

    return {
      ...r,
      gaRevenue: ga4.revenue * spendShare,
      gaOrders: Math.round(ga4.transactions * spendShare),
      sessions: r.sessions || Math.round(ga4.sessions * spendShare),
    }
  })
}
