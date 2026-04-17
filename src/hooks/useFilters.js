import { useState, useMemo } from 'react'
import { subDays, startOfMonth, endOfMonth, subMonths, startOfWeek, endOfWeek } from 'date-fns'

export const PRESET_RANGES = {
  today: () => { const d = new Date(); return { from: d, to: d, label: 'Today' } },
  yesterday: () => { const d = subDays(new Date(), 1); return { from: d, to: d, label: 'Yesterday' } },
  last7: () => ({ from: subDays(new Date(), 6), to: new Date(), label: 'Last 7 days' }),
  last14: () => ({ from: subDays(new Date(), 13), to: new Date(), label: 'Last 14 days' }),
  last30: () => ({ from: subDays(new Date(), 29), to: new Date(), label: 'Last 30 days' }),
  thisWeek: () => ({ from: startOfWeek(new Date(), { weekStartsOn: 1 }), to: new Date(), label: 'This week' }),
  thisMonth: () => ({ from: startOfMonth(new Date()), to: new Date(), label: 'This month' }),
  lastMonth: () => {
    const lm = subMonths(new Date(), 1)
    return { from: startOfMonth(lm), to: endOfMonth(lm), label: 'Last month' }
  },
}

export function useFilters(initialPreset = 'last7') {
  const preset = PRESET_RANGES[initialPreset]()
  const [dateFrom, setDateFrom] = useState(preset.from)
  const [dateTo, setDateTo] = useState(preset.to)
  const [dateLabel, setDateLabel] = useState(preset.label)
  const [cohorts, setCohorts] = useState([])        // [] = all
  const [formats, setFormats] = useState([])
  const [products, setProducts] = useState([])
  const [contentTypes, setContentTypes] = useState([])
  const [saleTag, setSaleTag] = useState('')         // '' | 'BAU' | 'Sale'
  const [campaignTypes, setCampaignTypes] = useState([])
  const [segment, setSegment] = useState('all')     // 'all' | 'women' | 'men'

  function applyPreset(key) {
    const p = PRESET_RANGES[key]()
    setDateFrom(p.from)
    setDateTo(p.to)
    setDateLabel(p.label)
  }

  function filterRows(rows, dateField = 'date') {
    return rows.filter(r => {
      const d = r[dateField] instanceof Date ? r[dateField] : new Date(r[dateField])
      if (isNaN(d)) return false
      const from = new Date(dateFrom); from.setHours(0,0,0,0)
      const to = new Date(dateTo); to.setHours(23,59,59,999)
      if (d < from || d > to) return false
      if (cohorts.length && !cohorts.includes(r.cohort)) return false
      if (formats.length && !formats.includes(r.format)) return false
      if (products.length && !products.includes(r.product)) return false
      if (contentTypes.length && !contentTypes.includes(r.contentType)) return false
      if (saleTag && r.saleTag !== saleTag) return false
      if (campaignTypes.length && !campaignTypes.includes(r.campaignType)) return false
      if (segment === 'women' && r.category && !r.category.toLowerCase().includes('women')) return false
      if (segment === 'men' && r.category && !r.category.toLowerCase().includes('men')) return false
      return true
    })
  }

  // Previous period rows for WoW / MoM delta
  function getPrevRows(rows, dateField = 'date') {
    const span = dateTo - dateFrom
    const prevTo = new Date(dateFrom - 1)
    const prevFrom = new Date(prevTo - span)
    return rows.filter(r => {
      const d = r[dateField] instanceof Date ? r[dateField] : new Date(r[dateField])
      return d >= prevFrom && d <= prevTo
    })
  }

  return {
    dateFrom, dateTo, dateLabel,
    cohorts, formats, products, contentTypes, saleTag, campaignTypes, segment,
    setDateFrom, setDateTo,
    setCohorts, setFormats, setProducts, setContentTypes, setSaleTag, setCampaignTypes, setSegment,
    applyPreset, filterRows, getPrevRows
  }
}
