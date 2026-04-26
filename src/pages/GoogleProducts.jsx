import React, { useMemo, useState } from 'react'
import DrillTable from '../components/DrillTable.jsx'
import { useData } from '../data/store.jsx'
import { useFilters } from '../hooks/useFilters.js'
import FilterBar from '../components/FilterBar.jsx'
import MetricCard from '../components/MetricCard.jsx'
import { fmtPct, fmtNum, deltaLabel } from '../utils/formatters.js'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

const TIP = { contentStyle: { background: 'var(--bg3)', border: '0.5px solid var(--border2)', fontSize: 12, borderRadius: 6 } }

const COLOR_WORDS = [
  'brown','black','white','blue','green','red','grey','gray','pink','purple',
  'orange','yellow','beige','cream','navy','burgundy','maroon','teal','olive',
  'coral','mint','lilac','peach','mustard','charcoal','nude','ivory','sage',
  'rust','camel','tan','gold','silver','indigo','violet','plum','agate',
  'walnut','wood','granite','cedar','biscotti','oyster','ash','wine','scarlet',
  'bliss','mist','dune','earth','seaweed','midnight','clay','smoke','sand',
]
const FIT_NAMES = ['una','aia','elene','gowri','wahida','baani','naina','prachi','rachel','carrie','bella','bulbull','arya','ol','bhanu','gargi','olivia','baani']
const SIZES = ['XS','S','M','L','XL','2XL','3XL','4XL','5XL']

function parseSKU(title = '') {
  if (!title) return { productName: 'Unknown', color: null, size: null, fit: null, height: null }
  // Clean up Windsor format
  title = title
    .replace(/^\|+\s*/, '').replace(/\s*\|+$/, '').trim()
    .replace(/\s*BY\s+Blissclub\s*/gi, '').trim()
    .replace(/^Blissclub\s+/i, '').trim()

  const parts = title.split('/').map(p => p.trim())
  let base = parts[0]
  let size = null, fit = null, height = null, color = null

  for (const part of parts.slice(1)) {
    const p = part.toLowerCase()
    if (p.includes('tall') || p.includes("above 5")) height = 'Tall'
    else if (p.includes('regular') || p.includes('upto 5') || p.includes('up to 5')) height = 'Regular'
    else if (p.includes('petite')) height = 'Petite'

    // Parse size-fit: "L-una" or "XS-elene" or "M-aia"
    const dashParts = part.split('-')
    const sz = dashParts[0].trim().toUpperCase()
    if (SIZES.includes(sz)) {
      size = sz
      const fitRaw = dashParts.slice(1).join('-').trim().toLowerCase()
      const fitFound = FIT_NAMES.find(f => fitRaw.startsWith(f))
      if (fitFound) fit = fitFound.charAt(0).toUpperCase() + fitFound.slice(1)
    }
    // Also check for standalone size
    if (!size && SIZES.includes(part.trim().toUpperCase())) size = part.trim().toUpperCase()
  }

  // Extract color from base — find first color word
  const words = base.split(/\s+/)
  let colorStart = -1
  for (let i = 0; i < words.length; i++) {
    if (COLOR_WORDS.includes(words[i].toLowerCase())) {
      colorStart = i
      break
    }
  }

  if (colorStart >= 0) {
    // Color = from colorStart to end of base
    color = words.slice(colorStart).join(' ')
    const productName = words.slice(0, colorStart).join(' ').replace(/[–\-]+$/, '').trim()
    return { productName: productName || base, color, size, fit, height }
  }

  return { productName: base, color: null, size, fit, height }
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

function fmtINR(v) {
  if (!v) return '—'
  if (v >= 10000000) return `₹${(v/10000000).toFixed(2)}Cr`
  if (v >= 100000)   return `₹${(v/100000).toFixed(1)}L`
  if (v >= 1000)     return `₹${(v/1000).toFixed(1)}K`
  return `₹${Math.round(v).toLocaleString('en-IN')}`
}

const TH = { padding: '8px 12px', fontSize: 10, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em', background: 'var(--bg3)', borderBottom: '0.5px solid var(--border2)', whiteSpace: 'nowrap', cursor: 'pointer', userSelect: 'none' }
const TD = { padding: '9px 12px', fontSize: 12, borderBottom: '0.5px solid var(--border)', color: 'var(--text)', whiteSpace: 'nowrap' }
const TDr = { ...TD, textAlign: 'right' }

// ── Drill panel shown when a product row is expanded ──────────────────────────
function DrillPanel({ skus, totalCost }) {
  const [dim, setDim] = useState('color')
  const [sort, setSort] = useState({ col: 'cost', dir: 'desc' })

  const grouped = useMemo(() => {
    const map = {}
    for (const r of skus) {
      const k = r[dim] || 'Unknown'
      if (!map[k]) map[k] = []
      map[k].push(r)
    }
    return Object.values(map).map(rs => ({
      label:    rs[0][dim] || 'Unknown',
      skuCount: [...new Set(rs.map(r => r.productTitle))].length,
      ...aggProd(rs),
    })).sort((a, b) => sort.dir === 'desc' ? b[sort.col] - a[sort.col] : a[sort.col] - b[sort.col])
  }, [skus, dim, sort])

  const DIMS = [
    { key: 'color',  label: 'Color' },
    { key: 'size',   label: 'Size' },
    { key: 'fit',    label: 'Fit' },
    { key: 'height', label: 'Height' },
  ]

  function onSort(col) {
    setSort(s => ({ col, dir: s.col === col && s.dir === 'desc' ? 'asc' : 'desc' }))
  }

  const sortArrow = col => sort.col === col ? (sort.dir === 'desc' ? ' ↓' : ' ↑') : ''

  return (
    <tr>
      <td colSpan={11} style={{ padding: 0, background: 'rgba(127,119,221,0.04)', borderBottom: '1px solid var(--border2)' }}>
        <div style={{ padding: '12px 16px 16px 40px' }}>
          {/* Dim tabs */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 12, alignItems: 'center' }}>
            {DIMS.map(d => (
              <button key={d.key} onClick={() => setDim(d.key)} style={{
                padding: '4px 12px', fontSize: 11, borderRadius: 6, cursor: 'pointer', border: 'none',
                background: dim === d.key ? 'var(--purple)' : 'var(--bg3)',
                color: dim === d.key ? '#fff' : 'var(--text2)',
                fontWeight: dim === d.key ? 600 : 400,
              }}>{d.label}</button>
            ))}
            <span style={{ fontSize: 11, color: 'var(--text3)', marginLeft: 8 }}>{grouped.length} {dim}s</span>
          </div>

          {/* Drill table */}
          <div style={{ overflowX: 'auto', borderRadius: 8, border: '0.5px solid var(--border)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr>
                  {[
                    { key: dim,          label: dim.charAt(0).toUpperCase() + dim.slice(1), align: 'left' },
                    { key: 'skuCount',   label: 'SKUs' },
                    { key: 'cost',       label: 'Spend' },
                    { key: 'mix',        label: 'Mix %', noSort: true },
                    { key: 'impressions',label: 'Impr.' },
                    { key: 'clicks',     label: 'Clicks' },
                    { key: 'ctr',        label: 'CTR' },
                    { key: 'cpc',        label: 'CPC' },
                    { key: 'conversions',label: 'Conv.' },
                    { key: 'revenue',    label: 'Revenue' },
                    { key: 'roas',       label: 'ROAS' },
                  ].map((h, i) => (
                    <th key={h.key}
                      onClick={() => !h.noSort && onSort(h.key)}
                      style={{ ...TH, textAlign: i === 0 ? 'left' : 'right', fontSize: 10,
                        color: sort.col === h.key ? 'var(--text)' : 'var(--text3)',
                        cursor: h.noSort ? 'default' : 'pointer' }}>
                      {h.label}{!h.noSort && sortArrow(h.key)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {grouped.map((r, i) => (
                  <tr key={i}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg3)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <td style={{ ...TD, fontWeight: 500, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.label}</td>
                    <td style={TDr}>{r.skuCount}</td>
                    <td style={TDr}>{fmtINR(r.cost)}</td>
                    <td style={TDr}>{totalCost > 0 ? ((r.cost / totalCost) * 100).toFixed(1) + '%' : '—'}</td>
                    <td style={TDr}>{fmtNum(r.impressions)}</td>
                    <td style={TDr}>{fmtNum(r.clicks)}</td>
                    <td style={{ ...TDr, color: r.ctr >= 0.02 ? 'var(--green)' : r.ctr >= 0.01 ? 'var(--amber)' : 'var(--red)' }}>{fmtPct(r.ctr)}</td>
                    <td style={TDr}>{fmtINR(r.cpc)}</td>
                    <td style={TDr}>{fmtNum(r.conversions, 1)}</td>
                    <td style={{ ...TDr, color: 'var(--green)' }}>{fmtINR(r.revenue)}</td>
                    <td style={{ ...TDr, color: r.roas >= 4 ? 'var(--green)' : r.roas >= 2 ? 'var(--amber)' : 'var(--red)', fontWeight: 600 }}>{r.roas > 0 ? r.roas.toFixed(2) + 'x' : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </td>
    </tr>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function GoogleProducts() {
  const { state }  = useData()
  const filters    = useFilters('last30')
  const { filterRows, getPrevRows } = filters

  const [view, setView]           = useState('products')  // 'products' | 'campaigns'
  const [campaignFilter, setCampaignFilter] = useState('all')
  const [expandedProduct, setExpanded]      = useState(null)
  const [sort, setSort]           = useState({ col: 'cost', dir: 'desc' })
  const [campSort, setCampSort]   = useState({ col: 'cost', dir: 'desc' })

  // ── All rows with parsed SKU ──────────────────────────────────────────────
  const allRows = useMemo(() => {
    return filterRows(state.googleProducts || [], 'date').map(r => ({
      ...r, ...parseSKU(r.productTitle),
    }))
  }, [state.googleProducts, filters])

  const prevAllRows = useMemo(() => {
    return getPrevRows(state.googleProducts || [], 'date').map(r => ({
      ...r, ...parseSKU(r.productTitle),
    }))
  }, [state.googleProducts, filters])

  const campaigns = useMemo(() => [...new Set(allRows.map(r => r.campaignName).filter(Boolean))].sort(), [allRows])

  const rows = useMemo(() =>
    campaignFilter === 'all' ? allRows : allRows.filter(r => r.campaignName === campaignFilter),
    [allRows, campaignFilter])

  const prev = useMemo(() =>
    campaignFilter === 'all' ? prevAllRows : prevAllRows.filter(r => r.campaignName === campaignFilter),
    [prevAllRows, campaignFilter])

  const totals     = useMemo(() => aggProd(rows), [rows])
  const prevTotals = useMemo(() => aggProd(prev), [prev])
  const hasData    = rows.length > 0

  // ── Product grouping ──────────────────────────────────────────────────────
  const byProduct = useMemo(() => {
    const map = {}
    for (const r of rows) {
      const k = r.productName || 'Unknown'
      if (!map[k]) map[k] = []
      map[k].push(r)
    }
    return Object.values(map).map(rs => ({
      productName: rs[0].productName,
      skuCount:    [...new Set(rs.map(r => r.productTitle))].length,
      colorCount:  [...new Set(rs.map(r => r.color).filter(Boolean))].length,
      sizeCount:   [...new Set(rs.map(r => r.size).filter(Boolean))].length,
      skus:        rs,
      ...aggProd(rs),
    }))
  }, [rows])

  const sortedProducts = useMemo(() => {
    return [...byProduct].sort((a, b) =>
      sort.dir === 'desc' ? b[sort.col] - a[sort.col] : a[sort.col] - b[sort.col])
  }, [byProduct, sort])

  // ── Campaign grouping ─────────────────────────────────────────────────────
  const byCampaign = useMemo(() => {
    const map = {}
    for (const r of rows) {
      const k = r.campaignName || 'Unknown'
      if (!map[k]) map[k] = []
      map[k].push(r)
    }
    return Object.values(map).map(rs => ({
      campaignName: rs[0].campaignName,
      productCount: [...new Set(rs.map(r => r.productName))].length,
      skuCount:     [...new Set(rs.map(r => r.productTitle))].length,
      ...aggProd(rs),
    }))
  }, [rows])

  const sortedCampaigns = useMemo(() => {
    return [...byCampaign].sort((a, b) =>
      campSort.dir === 'desc' ? b[campSort.col] - a[campSort.col] : a[campSort.col] - b[campSort.col])
  }, [byCampaign, campSort])

  // ── Chart ─────────────────────────────────────────────────────────────────
  const chartData = sortedProducts.slice(0, 10).map(r => ({
    name: r.productName.length > 22 ? r.productName.slice(0, 22) + '…' : r.productName,
    spend: Math.round(r.cost),
    revenue: Math.round(r.revenue),
  }))

  function onSort(col) {
    setSort(s => ({ col, dir: s.col === col && s.dir === 'desc' ? 'asc' : 'desc' }))
  }

  function onCampSort(col) {
    setCampSort(s => ({ col, dir: s.col === col && s.dir === 'desc' ? 'asc' : 'desc' }))
  }

  const sortArrow = (col, s) => s.col === col ? (s.dir === 'desc' ? ' ↓' : ' ↑') : ''

  return (
    <div style={{ padding: '24px 28px' }}>
      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 2 }}>Google — Product Performance</h1>
        <div style={{ fontSize: 12, color: 'var(--text3)' }}>Shopping & PMax · click any product to drill into color · size · fit · height</div>
      </div>

      <FilterBar filters={filters} showCohort={false} showSaleTag={false} />

      {/* Campaign filter + View toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 500 }}>Campaign</span>
        <select value={campaignFilter} onChange={e => { setCampaignFilter(e.target.value); setExpanded(null) }} style={{
          padding: '5px 10px', fontSize: 12, borderRadius: 6, cursor: 'pointer',
          background: 'var(--bg2)', border: '0.5px solid var(--border2)',
          color: 'var(--text)', outline: 'none', maxWidth: 440,
        }}>
          <option value="all">All campaigns ({campaigns.length})</option>
          {campaigns.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        {campaignFilter !== 'all' && (
          <button onClick={() => { setCampaignFilter('all'); setExpanded(null) }} style={{
            padding: '4px 8px', fontSize: 11, borderRadius: 4, cursor: 'pointer',
            background: 'var(--bg3)', border: '0.5px solid var(--border2)', color: 'var(--text2)',
          }}>✕ Clear</button>
        )}

        {/* View toggle */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
          {[['products','By Product'], ['campaigns','By Campaign']].map(([v, l]) => (
            <button key={v} onClick={() => setView(v)} style={{
              padding: '5px 14px', fontSize: 12, borderRadius: 6, cursor: 'pointer', border: 'none',
              background: view === v ? 'var(--blue)' : 'var(--bg3)',
              color: view === v ? '#fff' : 'var(--text2)',
              fontWeight: view === v ? 500 : 400,
            }}>{l}</button>
          ))}
        </div>
      </div>

      {!hasData && (
        <div style={{ background: 'var(--red-dim)', border: '0.5px solid var(--red-border)', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 12, color: 'var(--red)' }}>
          No product data — sync Windsor from the Upload page
        </div>
      )}

      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0,1fr))', gap: 10, marginBottom: 16 }}>
        {[
          { label: 'Total spend',  val: fmtINR(totals.cost),       delta: deltaLabel(totals.cost, prevTotals.cost) },
          { label: 'Impressions',  val: fmtNum(totals.impressions), delta: deltaLabel(totals.impressions, prevTotals.impressions) },
          { label: 'Clicks',       val: fmtNum(totals.clicks),      delta: deltaLabel(totals.clicks, prevTotals.clicks) },
          { label: 'Revenue',      val: fmtINR(totals.revenue),     delta: deltaLabel(totals.revenue, prevTotals.revenue), accent: 'var(--green)' },
          { label: 'ROAS',         val: totals.roas > 0 ? totals.roas.toFixed(2) + 'x' : '—', delta: deltaLabel(totals.roas, prevTotals.roas), accent: totals.roas >= 4 ? 'var(--green)' : totals.roas >= 2 ? 'var(--amber)' : 'var(--red)' },
        ].map(m => <MetricCard key={m.label} label={m.label} value={m.val} delta={m.delta} accent={m.accent} />)}
      </div>

      {/* Chart */}
      {hasData && view === 'products' && (
        <div style={{ background: 'var(--bg2)', border: '0.5px solid var(--border)', borderRadius: 10, padding: '14px 16px', marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 10, fontWeight: 500 }}>Top 10 products — spend vs revenue</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} layout="vertical" barSize={11} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--text3)' }} axisLine={false} tickLine={false} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fill: 'var(--text3)' }} axisLine={false} tickLine={false} width={190} />
              <Tooltip {...TIP} formatter={v => [`₹${v.toLocaleString('en-IN')}`, '']} />
              <Bar dataKey="spend"   fill="var(--blue)"  name="Spend"   radius={[0,3,3,0]} />
              <Bar dataKey="revenue" fill="var(--green)" name="Revenue" radius={[0,3,3,0]} fillOpacity={0.7} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── BY PRODUCT TABLE ── */}
      {view === 'products' && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{sortedProducts.length} products</div>
            <div style={{ fontSize: 11, color: 'var(--text3)' }}>Click a row → drill into color · size · fit · height</div>
          </div>
          <div style={{ overflowX: 'auto', borderRadius: 8, border: '0.5px solid var(--border)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {[
                    { key: 'productName', label: 'Product',     align: 'left', minW: 220 },
                    { key: 'skuCount',    label: 'SKUs',        align: 'right' },
                    { key: 'colorCount',  label: 'Colors',      align: 'right' },
                    { key: 'sizeCount',   label: 'Sizes',       align: 'right' },
                    { key: 'cost',        label: 'Spend',       align: 'right' },
                    { key: 'impressions', label: 'Impr.',       align: 'right' },
                    { key: 'clicks',      label: 'Clicks',      align: 'right' },
                    { key: 'ctr',         label: 'CTR',         align: 'right' },
                    { key: 'conversions', label: 'Conv.',       align: 'right' },
                    { key: 'revenue',     label: 'Revenue',     align: 'right' },
                    { key: 'roas',        label: 'ROAS',        align: 'right' },
                  ].map(col => (
                    <th key={col.key} onClick={() => onSort(col.key)}
                      style={{ ...TH, textAlign: col.align, minWidth: col.minW,
                        color: sort.col === col.key ? 'var(--text)' : 'var(--text3)' }}>
                      {col.label}{sortArrow(col.key, sort)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedProducts.map((r) => {
                  const isExpanded = expandedProduct === r.productName
                  return (
                    <React.Fragment key={r.productName}>
                      <tr onClick={() => setExpanded(isExpanded ? null : r.productName)}
                        style={{ cursor: 'pointer', background: isExpanded ? 'var(--bg3)' : 'transparent' }}
                        onMouseEnter={e => { if (!isExpanded) e.currentTarget.style.background = 'var(--bg3)' }}
                        onMouseLeave={e => { if (!isExpanded) e.currentTarget.style.background = 'transparent' }}>
                        <td style={{ ...TD, textAlign: 'left', fontWeight: 600 }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 10, color: 'var(--text3)', display: 'inline-block', transform: isExpanded ? 'rotate(90deg)' : 'rotate(0)', transition: 'transform .15s' }}>▶</span>
                            {r.productName}
                          </span>
                        </td>
                        <td style={TDr}>{r.skuCount}</td>
                        <td style={TDr}>{r.colorCount || '—'}</td>
                        <td style={TDr}>{r.sizeCount || '—'}</td>
                        <td style={TDr}>{fmtINR(r.cost)}</td>
                        <td style={TDr}>{fmtNum(r.impressions)}</td>
                        <td style={TDr}>{fmtNum(r.clicks)}</td>
                        <td style={{ ...TDr, color: r.ctr >= 0.02 ? 'var(--green)' : r.ctr >= 0.01 ? 'var(--amber)' : 'var(--red)' }}>{fmtPct(r.ctr)}</td>
                        <td style={TDr}>{fmtNum(r.conversions, 1)}</td>
                        <td style={{ ...TDr, color: 'var(--green)' }}>{fmtINR(r.revenue)}</td>
                        <td style={{ ...TDr, color: r.roas >= 4 ? 'var(--green)' : r.roas >= 2 ? 'var(--amber)' : 'var(--red)', fontWeight: 600 }}>{r.roas > 0 ? r.roas.toFixed(2) + 'x' : '—'}</td>
                      </tr>
                      {isExpanded && <DrillPanel skus={r.skus} totalCost={r.cost} />}
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── BY CAMPAIGN TABLE ── */}
      {view === 'campaigns' && (
        <>
          <div style={{ marginBottom: 8, fontSize: 13, fontWeight: 600 }}>{sortedCampaigns.length} campaigns</div>
          <div style={{ overflowX: 'auto', borderRadius: 8, border: '0.5px solid var(--border)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {[
                    { key: 'campaignName', label: 'Campaign',   align: 'left', minW: 280 },
                    { key: 'productCount', label: 'Products',   align: 'right' },
                    { key: 'skuCount',     label: 'SKUs',       align: 'right' },
                    { key: 'cost',         label: 'Spend',      align: 'right' },
                    { key: 'impressions',  label: 'Impr.',      align: 'right' },
                    { key: 'clicks',       label: 'Clicks',     align: 'right' },
                    { key: 'ctr',          label: 'CTR',        align: 'right' },
                    { key: 'conversions',  label: 'Conv.',      align: 'right' },
                    { key: 'revenue',      label: 'Revenue',    align: 'right' },
                    { key: 'roas',         label: 'ROAS',       align: 'right' },
                    { key: 'cpa',          label: 'CPA',        align: 'right' },
                  ].map(col => (
                    <th key={col.key} onClick={() => onCampSort(col.key)}
                      style={{ ...TH, textAlign: col.align, minWidth: col.minW,
                        color: campSort.col === col.key ? 'var(--text)' : 'var(--text3)' }}>
                      {col.label}{sortArrow(col.key, campSort)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedCampaigns.map((r, i) => (
                  <tr key={i}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg3)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <td style={{ ...TD, textAlign: 'left', fontWeight: 500, maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis' }} title={r.campaignName}>{r.campaignName}</td>
                    <td style={TDr}>{r.productCount}</td>
                    <td style={TDr}>{r.skuCount}</td>
                    <td style={TDr}>{fmtINR(r.cost)}</td>
                    <td style={TDr}>{fmtNum(r.impressions)}</td>
                    <td style={TDr}>{fmtNum(r.clicks)}</td>
                    <td style={{ ...TDr, color: r.ctr >= 0.02 ? 'var(--green)' : r.ctr >= 0.01 ? 'var(--amber)' : 'var(--red)' }}>{fmtPct(r.ctr)}</td>
                    <td style={TDr}>{fmtNum(r.conversions, 1)}</td>
                    <td style={{ ...TDr, color: 'var(--green)' }}>{fmtINR(r.revenue)}</td>
                    <td style={{ ...TDr, color: r.roas >= 4 ? 'var(--green)' : r.roas >= 2 ? 'var(--amber)' : 'var(--red)', fontWeight: 600 }}>{r.roas > 0 ? r.roas.toFixed(2) + 'x' : '—'}</td>
                    <td style={TDr}>{r.cpa > 0 ? fmtINR(r.cpa) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
