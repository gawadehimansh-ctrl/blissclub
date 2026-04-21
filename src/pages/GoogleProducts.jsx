import React, { useMemo, useState } from 'react'
import { useData } from '../data/store.jsx'
import { useFilters } from '../hooks/useFilters.js'
import FilterBar from '../components/FilterBar.jsx'
import DrillTable from '../components/DrillTable.jsx'
import MetricCard from '../components/MetricCard.jsx'
import { fmtPct, fmtNum, deltaLabel } from '../utils/formatters.js'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

const TIP = { contentStyle: { background: 'var(--bg3)', border: '0.5px solid var(--border2)', fontSize: 12, borderRadius: 6 } }

const COLOR_WORDS = [
  'brown','black','white','blue','green','red','grey','gray','pink','purple',
  'orange','yellow','beige','cream','navy','burgundy','maroon','teal','olive',
  'coral','mint','lilac','peach','mustard','charcoal','nude','ivory','sage',
  'rust','camel','tan','gold','silver','indigo','violet','plum',
]
const FIT_NAMES = ['una','aia','elene','gowri','wahida','baani','naina','prachi','rachel','carrie','bella','bulbull']
const SIZES = ['XS','S','M','L','XL','2XL','3XL','4XL','5XL']

function parseSKU(title = '') {
  if (!title) return { productName: 'Unknown', color: null, size: null, fit: null, height: null }

  const parts = title.split('/').map(p => p.trim())
  let base = parts[0].replace(/ BY Blissclub/gi, '').replace(/ by Blissclub/gi, '').trim()

  let size = null, fit = null, height = null

  for (const part of parts.slice(1)) {
    const p = part.toLowerCase()
    if (p.includes('tall') || p.includes("above 5")) height = 'Tall'
    else if (p.includes('regular') || p.includes('upto 5') || p.includes('up to 5')) height = 'Regular'
    else if (p.includes('petite')) height = 'Petite'

    if (p.includes('-')) {
      const [szRaw, fitRaw = ''] = p.split('-')
      const sz = szRaw.trim().toUpperCase()
      if (SIZES.includes(sz)) size = sz
      const fitFound = FIT_NAMES.find(f => fitRaw.includes(f))
      if (fitFound) fit = fitFound.charAt(0).toUpperCase() + fitFound.slice(1)
    }
  }

  const words = base.split(/\s+/)
  let colorStart = -1
  for (let i = 0; i < words.length; i++) {
    if (COLOR_WORDS.includes(words[i].toLowerCase())) {
      colorStart = Math.max(0, i - 1)
      break
    }
  }

  let color = null
  let productName = base
  if (colorStart >= 0) {
    color = words.slice(colorStart).join(' ')
    productName = words.slice(0, colorStart).join(' ').replace(/[–-]+$/, '').trim()
  }

  productName = productName.replace(/^Blissclub\s+/i, '').trim()

  return { productName: productName || base, color, size, fit, height }
}

function aggProd(rows) {
  const cost  = rows.reduce((s, r) => s + (r.cost || 0), 0)
  const imp   = rows.reduce((s, r) => s + (r.impressions || 0), 0)
  const cl    = rows.reduce((s, r) => s + (r.clicks || 0), 0)
  const conv  = rows.reduce((s, r) => s + (r.conversions || 0), 0)
  const rev   = rows.reduce((s, r) => s + (r.conversionValue || 0), 0)
  return {
    cost, impressions: imp, clicks: cl, conversions: conv, revenue: rev,
    ctr:  imp  > 0 ? cl   / imp  : 0,
    cpc:  cl   > 0 ? cost / cl   : 0,
    roas: cost > 0 ? rev  / cost : 0,
    cpa:  conv > 0 ? cost / conv : 0,
  }
}

const VIEWS = [
  { key: 'product', label: 'By product' },
  { key: 'color',   label: 'By color' },
  { key: 'size',    label: 'By size' },
  { key: 'fit',     label: 'By fit' },
  { key: 'height',  label: 'By height' },
  { key: 'sku',     label: 'By SKU' },
]

export default function GoogleProducts() {
  const { state } = useData()
  const filters = useFilters('last30')
  const { filterRows, getPrevRows } = filters
  const [campaignFilter, setCampaignFilter] = useState('all')
  const [view, setView] = useState('product')

  const allRows = useMemo(() => {
    return (filterRows(state.googleProducts || [], 'date')).map(r => ({
      ...r,
      ...parseSKU(r.productTitle),
    }))
  }, [state.googleProducts, filters])

  const prevAllRows = useMemo(() => {
    return (getPrevRows(state.googleProducts || [], 'date')).map(r => ({
      ...r,
      ...parseSKU(r.productTitle),
    }))
  }, [state.googleProducts, filters])

  const campaigns = useMemo(() => {
    return [...new Set(allRows.map(r => r.campaignName).filter(Boolean))].sort()
  }, [allRows])

  const rows = useMemo(() => {
    if (campaignFilter === 'all') return allRows
    return allRows.filter(r => r.campaignName === campaignFilter)
  }, [allRows, campaignFilter])

  const prev = useMemo(() => {
    if (campaignFilter === 'all') return prevAllRows
    return prevAllRows.filter(r => r.campaignName === campaignFilter)
  }, [prevAllRows, campaignFilter])

  const totals     = useMemo(() => aggProd(rows), [rows])
  const prevTotals = useMemo(() => aggProd(prev), [prev])
  const hasData    = rows.length > 0

  function groupBy(key) {
    const map = {}
    for (const r of rows) {
      const k = r[key] || 'Unknown'
      if (!map[k]) map[k] = []
      map[k].push(r)
    }
    return Object.values(map).map(rs => ({
      [key]: rs[0][key] || 'Unknown',
      skuCount: key === 'productName' ? [...new Set(rs.map(r => r.productTitle))].length : undefined,
      ...aggProd(rs),
    })).sort((a, b) => b.cost - a.cost)
  }

  const grouped = useMemo(() => groupBy(
    view === 'product' ? 'productName' :
    view === 'color'   ? 'color'       :
    view === 'size'    ? 'size'        :
    view === 'fit'     ? 'fit'         :
    view === 'height'  ? 'height'      : 'productTitle'
  ), [rows, view])

  const dimKey = view === 'product' ? 'productName' :
                 view === 'color'   ? 'color'       :
                 view === 'size'    ? 'size'        :
                 view === 'fit'     ? 'fit'         :
                 view === 'height'  ? 'height'      : 'productTitle'

  const dimLabel = view === 'product' ? 'Product'    :
                   view === 'color'   ? 'Color'      :
                   view === 'size'    ? 'Size'       :
                   view === 'fit'     ? 'Fit'        :
                   view === 'height'  ? 'Height'     : 'SKU / Variant'

  const cols = [
    { key: dimKey,        label: dimLabel,      align: 'left', bold: true },
    ...(view === 'product' ? [{ key: 'skuCount', label: 'SKUs', render: v => v ? fmtNum(v) : '—' }] : []),
    { key: 'cost',        label: 'Spend',        render: v => `₹${Math.round(v).toLocaleString('en-IN')}` },
    { key: 'impressions', label: 'Impressions',  render: fmtNum },
    { key: 'clicks',      label: 'Clicks',       render: fmtNum },
    { key: 'ctr',         label: 'CTR',          render: fmtPct, color: v => v >= 0.02 ? 'var(--green)' : v >= 0.01 ? 'var(--amber)' : 'var(--red)' },
    { key: 'cpc',         label: 'CPC',          render: v => `₹${Math.round(v).toLocaleString('en-IN')}` },
    { key: 'conversions', label: 'Conv.',        render: v => fmtNum(v, 1) },
    { key: 'revenue',     label: 'Revenue',      render: v => `₹${Math.round(v).toLocaleString('en-IN')}`, color: () => 'var(--green)' },
    { key: 'roas',        label: 'ROAS',         render: v => `${v.toFixed(2)}x`, color: v => v >= 4 ? 'var(--green)' : v >= 2 ? 'var(--amber)' : 'var(--red)' },
    { key: 'cpa',         label: 'CPA',          render: v => v > 0 ? `₹${Math.round(v).toLocaleString('en-IN')}` : '—' },
  ]

  const chartData = grouped.slice(0, 10).map(r => ({
    name: String(r[dimKey] || 'Unknown').slice(0, 22) + (String(r[dimKey] || '').length > 22 ? '…' : ''),
    spend:   Math.round(r.cost),
    revenue: Math.round(r.revenue),
  }))

  return (
    <div style={{ padding: '20px 24px' }}>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 18, fontWeight: 600, marginBottom: 2 }}>Google — Product Performance</h1>
        <div style={{ fontSize: 12, color: 'var(--text3)' }}>Shopping & PMax · product, color, size, fit, height breakdown · spend, revenue, ROAS</div>
      </div>

      <FilterBar filters={filters} showCohort={false} showSaleTag={false} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 500 }}>Campaign</span>
        <select value={campaignFilter} onChange={e => setCampaignFilter(e.target.value)} style={{
          padding: '5px 10px', fontSize: 12, borderRadius: 6, cursor: 'pointer',
          background: 'var(--bg2)', border: '0.5px solid var(--border2)',
          color: 'var(--text)', outline: 'none', maxWidth: 440,
        }}>
          <option value="all">All campaigns ({campaigns.length})</option>
          {campaigns.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        {campaignFilter !== 'all' && (
          <button onClick={() => setCampaignFilter('all')} style={{
            padding: '4px 8px', fontSize: 11, borderRadius: 4, cursor: 'pointer',
            background: 'var(--bg3)', border: '0.5px solid var(--border2)', color: 'var(--text2)',
          }}>✕ Clear</button>
        )}
      </div>

      {!hasData && (
        <div style={{ background: 'var(--red-dim)', border: '0.5px solid var(--red-border)', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 12, color: 'var(--red)' }}>
          No product data — sync Windsor from the Upload page
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0,1fr))', gap: 10, marginBottom: 16 }}>
        {[
          { label: 'Total spend',  val: `₹${Math.round(totals.cost).toLocaleString('en-IN')}`,   delta: deltaLabel(totals.cost, prevTotals.cost) },
          { label: 'Impressions',  val: fmtNum(totals.impressions),                               delta: deltaLabel(totals.impressions, prevTotals.impressions) },
          { label: 'Clicks',       val: fmtNum(totals.clicks),                                    delta: deltaLabel(totals.clicks, prevTotals.clicks) },
          { label: 'Revenue',      val: `₹${Math.round(totals.revenue).toLocaleString('en-IN')}`, delta: deltaLabel(totals.revenue, prevTotals.revenue), accent: 'var(--green)' },
          { label: 'ROAS',         val: `${totals.roas.toFixed(2)}x`,                             delta: deltaLabel(totals.roas, prevTotals.roas), accent: totals.roas >= 4 ? 'var(--green)' : totals.roas >= 2 ? 'var(--amber)' : 'var(--red)' },
        ].map(m => <MetricCard key={m.label} label={m.label} value={m.val} delta={m.delta} accent={m.accent} />)}
      </div>

      {hasData && (
        <div style={{ background: 'var(--bg2)', border: '0.5px solid var(--border)', borderRadius: 10, padding: '14px 16px', marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 10, fontWeight: 500 }}>
            Top 10 by spend — {dimLabel.toLowerCase()} view
          </div>
          <ResponsiveContainer width="100%" height={chartData.length > 5 ? 240 : 160}>
            <BarChart data={chartData} layout="vertical" barSize={12} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--text3)' }} axisLine={false} tickLine={false} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fill: 'var(--text3)' }} axisLine={false} tickLine={false} width={180} />
              <Tooltip {...TIP} formatter={v => [`₹${v.toLocaleString('en-IN')}`, '']} />
              <Bar dataKey="spend"   fill="var(--blue)"  name="Spend"   radius={[0,3,3,0]} />
              <Bar dataKey="revenue" fill="var(--green)" name="Revenue" radius={[0,3,3,0]} fillOpacity={0.7} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>{grouped.length} {dimLabel.toLowerCase()}s</div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {VIEWS.map(v => (
            <button key={v.key} onClick={() => setView(v.key)} style={{
              padding: '4px 10px', fontSize: 11, borderRadius: 5, cursor: 'pointer',
              background: view === v.key ? 'var(--blue-dim)' : 'var(--bg3)',
              color: view === v.key ? 'var(--blue)' : 'var(--text2)',
              border: `0.5px solid ${view === v.key ? 'var(--blue-border)' : 'var(--border2)'}`,
              fontWeight: view === v.key ? 500 : 400,
            }}>{v.label}</button>
          ))}
        </div>
      </div>

      <DrillTable columns={cols} data={grouped} defaultSort={{ key: 'cost', dir: 'desc' }} />
    </div>
  )
}
