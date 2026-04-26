import { useState, useMemo } from 'react'
import { subDays, startOfMonth, endOfMonth, subMonths } from 'date-fns'

export const PRESET_RANGES = {
  today:     () => { const d = new Date(); return { from: d, to: d, label: 'Today' } },
  yesterday: () => { const d = subDays(new Date(), 1); return { from: d, to: d, label: 'Yesterday' } },
  last7:     () => ({ from: subDays(new Date(), 6),  to: new Date(), label: 'Last 7 days' }),
  last14:    () => ({ from: subDays(new Date(), 13), to: new Date(), label: 'Last 14 days' }),
  last30:    () => ({ from: subDays(new Date(), 29), to: new Date(), label: 'Last 30 days' }),
  last60:    () => ({ from: subDays(new Date(), 59), to: new Date(), label: 'Last 60 days' }),
  last90:    () => ({ from: subDays(new Date(), 89), to: new Date(), label: 'Last 90 days' }),
  last180:   () => ({ from: subDays(new Date(), 179), to: new Date(), label: 'Last 180 days' }),
  thisMonth: () => ({ from: startOfMonth(new Date()), to: new Date(), label: 'This month' }),
  lastMonth: () => {
    const lm = subMonths(new Date(), 1)
    return { from: startOfMonth(lm), to: endOfMonth(lm), label: 'Last month' }
  },
  last3months: () => ({ from: startOfMonth(subMonths(new Date(), 2)), to: new Date(), label: 'Last 3 months' }),
}

const MEN_PRODUCTS = new Set([
  'Men', 'MenCol', 'Men Col',
  'Men_LegendPants', 'Men_LegendJacket', 'Men_POLO', 'Men_CPT',
  'Men LegendPants', 'Men LegendJacket', 'Men POLO', 'Men CPT',
])

function getSegment(row) {
  const prod = (row.product || '').toLowerCase()
  const adset = (row.adsetName || row.adSetName || '').toLowerCase()
  const campaign = (row.campaignName || '').toLowerCase()
  if (
    MEN_PRODUCTS.has(row.product) ||
    prod.includes('men') ||
    adset.includes('men') ||
    campaign.includes('men') ||
    (row.product || '').startsWith('Men')
  ) return 'men'
  return 'women'
}

// Changed default from 'last7' to 'last30' to match 30-day sync window
export function useFilters(initialPreset = 'last30') {
  const preset = PRESET_RANGES[initialPreset]()
  const [dateFrom, setDateFrom]         = useState(preset.from)
  const [dateTo, setDateTo]             = useState(preset.to)
  const [dateLabel, setDateLabel]       = useState(preset.label)
  const [compFrom, setCompFrom]         = useState(null)
  const [compTo, setCompTo]             = useState(null)
  const [cohorts, setCohorts]           = useState([])
  const [formats, setFormats]           = useState([])
  const [products, setProducts]         = useState([])
  const [contentTypes, setContentTypes] = useState([])
  const [saleTag, setSaleTag]           = useState('')
  const [campaignTypes, setCampaignTypes] = useState([])
  const [segment, setSegment]           = useState('all')
  const [metricFilters, setMetricFilters] = useState([])

  function applyPreset(key) {
    const p = PRESET_RANGES[key]()
    setDateFrom(p.from)
    setDateTo(p.to)
    setDateLabel(p.label)
  }

  function addMetricFilter(filter) {
    setMetricFilters(prev => [...prev, { ...filter, id: Date.now() }])
  }

  function removeMetricFilter(id) {
    setMetricFilters(prev => prev.filter(f => f.id !== id))
  }

  function clearMetricFilters() {
    setMetricFilters([])
  }

  function applyMetricFilter(row, filter) {
    const { metric, op, value } = filter
    const actual = getMetricValue(row, metric)
    if (actual === null || actual === undefined) return true
    switch (op) {
      case 'gt':  return actual > value
      case 'gte': return actual >= value
      case 'lt':  return actual < value
      case 'lte': return actual <= value
      case 'eq':  return actual === value
      default:    return true
    }
  }

  function filterRows(rows, dateField = 'date') {
    if (!rows || !Array.isArray(rows)) return []
    return rows.filter(r => {
      const d = r[dateField] instanceof Date ? r[dateField] : new Date(r[dateField])
      if (!isNaN(d)) {
        const from = new Date(dateFrom); from.setHours(0, 0, 0, 0)
        const to   = new Date(dateTo);   to.setHours(23, 59, 59, 999)
        if (d < from || d > to) return false
      }
      if (cohorts.length && !cohorts.includes(r.cohort)) return false
      if (formats.length && !formats.includes(r.format)) return false
      if (products.length && !products.includes(r.product)) return false
      if (contentTypes.length && !contentTypes.includes(r.contentType)) return false
      if (saleTag && r.saleTag !== saleTag) return false
      if (campaignTypes.length && !campaignTypes.includes(r.campaignType)) return false
      if (segment !== 'all') {
        const rowSeg = getSegment(r)
        if (rowSeg !== segment) return false
      }
      for (const f of metricFilters) {
        if (!applyMetricFilter(r, f)) return false
      }
      return true
    })
  }

  function getPrevRows(rows, dateField = 'date') {
    if (!rows || !Array.isArray(rows)) return []
    const span = dateTo - dateFrom
    const prevTo   = new Date(dateFrom - 1)
    const prevFrom = new Date(prevTo - span)
    return rows.filter(r => {
      const d = r[dateField] instanceof Date ? r[dateField] : new Date(r[dateField])
      return d >= prevFrom && d <= prevTo
    })
  }

  function filterCompRows(rows, dateField = 'date') {
    if (!compFrom || !compTo || !rows || !Array.isArray(rows)) return []
    return rows.filter(r => {
      const d = r[dateField] instanceof Date ? r[dateField] : new Date(r[dateField])
      if (isNaN(d)) return false
      const cf = new Date(compFrom); cf.setHours(0,0,0,0)
      const ct = new Date(compTo);   ct.setHours(23,59,59,999)
      if (d < cf || d > ct) return false
      if (cohorts.length && !cohorts.includes(r.cohort)) return false
      if (formats.length && !formats.includes(r.format)) return false
      if (products.length && !products.includes(r.product)) return false
      if (contentTypes.length && !contentTypes.includes(r.contentType)) return false
      if (saleTag && r.saleTag !== saleTag) return false
      if (campaignTypes.length && !campaignTypes.includes(r.campaignType)) return false
      if (segment !== 'all') { if (getSegment(r) !== segment) return false }
      return true
    })
  }

  return {
    dateFrom, dateTo, dateLabel,
    compFrom, compTo,
    cohorts, formats, products, contentTypes, saleTag, campaignTypes, segment,
    metricFilters,
    setDateFrom, setDateTo,
    setCompFrom, setCompTo,
    setCohorts, setFormats, setProducts, setContentTypes,
    setSaleTag, setCampaignTypes, setSegment,
    applyPreset, filterRows, getPrevRows, filterCompRows,
    addMetricFilter, removeMetricFilter, clearMetricFilters,
  }
}

function getMetricValue(row, metric) {
  switch (metric) {
    case 'roas1dc':    return row.fbRevenue && row.spend ? row.fbRevenue / row.spend : null
    case 'roasGA4':    return row.ga4Revenue && row.spend ? row.ga4Revenue / row.spend : (row.gaRevenue && row.spend ? row.gaRevenue / row.spend : null)
    case 'cpc':        return row.clicks && row.spend ? row.spend / row.clicks : (row.cpc || null)
    case 'ctr':        return row.impressions && row.clicks ? (row.clicks / row.impressions) * 100 : null
    case 'cpm':        return row.impressions && row.spend ? (row.spend / row.impressions) * 1000 : null
    case 'ecr':        return row.sessions && row.gaOrders ? (row.gaOrders / row.sessions) * 100 : null
    case 'cpa':        return row.gaOrders && row.spend ? row.spend / row.gaOrders : null
    case 'spend':      return row.spend || null
    case 'orders':     return row.gaOrders || row.ga4Orders || null
    case 'ga4Revenue': return row.gaRevenue || row.ga4Revenue || null
    default:           return row[metric] || null
  }
}
