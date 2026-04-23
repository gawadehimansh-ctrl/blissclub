// All core metric calculations for BlissClub dashboard

export function calcROAS(revenue, spend) {
  if (!spend || spend === 0) return 0
  return revenue / spend
}

export function calcCAC(spend, orders) {
  if (!orders || orders === 0) return 0
  return spend / orders
}

export function calcCPM(spend, impressions) {
  if (!impressions || impressions === 0) return 0
  return (spend / impressions) * 1000
}

export function calcCTR(clicks, impressions) {
  if (!impressions || impressions === 0) return 0
  return clicks / impressions
}

export function calcCVR(orders, sessions) {
  if (!sessions || sessions === 0) return 0
  return orders / sessions
}

export function calcAOV(revenue, orders) {
  if (!orders || orders === 0) return 0
  return revenue / orders
}

export function calcHookRate(threeSecViews, impressions) {
  if (!impressions || impressions === 0) return 0
  return threeSecViews / impressions
}

export function calcHoldRate(thruPlays, threeSecViews) {
  if (!threeSecViews || threeSecViews === 0) return 0
  return thruPlays / threeSecViews
}

// 1DC vs GA4 gap — how much Meta is over-reporting
export function calcROASGap(metaReported, ga4Tracked) {
  if (!ga4Tracked || ga4Tracked === 0) return null
  return ((metaReported - ga4Tracked) / ga4Tracked) * 100
}

// Blended ROAS: GA4 revenue / total paid spend (configurable channels)
export function calcBlendedROAS({ ga4Revenue, metaSpend = 0, googleSpend = 0, clmSpend = 0, retentionSpend = 0 }) {
  const totalSpend = metaSpend + googleSpend + clmSpend + retentionSpend
  if (totalSpend === 0) return 0
  return ga4Revenue / totalSpend
}

// Blended CAC: total spend / GA4 orders
export function calcBlendedCAC({ totalSpend, ga4Orders }) {
  if (!ga4Orders || ga4Orders === 0) return 0
  return totalSpend / ga4Orders
}

// Aggregate rows - sum numeric fields, recompute derived metrics
export function aggregateRows(rows, fields = {}) {
  const sums = {}
  const numFields = fields.sum || ['spend', 'impressions', 'clicks', 'sessions', 'fbOrders', 'fbRevenue', 'gaOrders', 'gaRevenue', 'transactions', 'revenue', 'cost', 'reach']

  for (const f of numFields) {
    sums[f] = rows.reduce((acc, r) => acc + (Number(r[f]) || 0), 0)
  }

  // Recompute rates from sums
  sums.roas1dc = calcROAS(sums.fbRevenue, sums.spend)
  sums.roasGA4 = calcROAS(sums.gaRevenue, sums.spend)
  sums.roasGap = calcROASGap(sums.roas1dc, sums.roasGA4)
  sums.ctr = calcCTR(sums.clicks, sums.impressions)
  sums.cpm = calcCPM(sums.spend, sums.impressions)
  sums.cpc = sums.clicks > 0 ? sums.spend / sums.clicks : 0
  sums.cvr = calcCVR(sums.gaOrders, sums.sessions)
  sums.aov = calcAOV(sums.gaRevenue, sums.gaOrders)
  sums.cpa = calcCAC(sums.spend, sums.gaOrders)
  sums.ecr = sums.sessions > 0 ? sums.gaOrders / sums.sessions : 0

  return sums
}

// WoW / MoM delta helpers
export function getPeriodRows(rows, dateField, startDate, endDate) {
  return rows.filter(r => {
    const d = new Date(r[dateField])
    return d >= startDate && d <= endDate
  })
}
