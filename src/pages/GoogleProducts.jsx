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
]
const FIT_NAMES = ['una','aia','elene','gowri','wahida','baani','naina','prachi','rachel','carrie','bella','bulbull','arya']
const SIZES = ['XS','S','M','L','XL','2XL','3XL','4XL','5XL']

function parseSKU(title = '') {
  if (!title) return { productName: 'Unknown', color: null, size: null, fit: null, height: null }
  const parts = title.split('/').map(p => p.trim())
  let base = parts[0].replace(/ BY Blissclub/gi, '').trim()
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
    productName = words.slice(0, colorStart).join(' ').replace(/[–\-]+$/, '').trim()
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

function fmtINR(v) {
  if (!v) return '—'
  return `₹${Math.round(v).toLocaleString('en-IN')}`
}

const DRILL_DIMS = [
  { key: 'color',  label: 'Color' },
  { key: 'size',   label: 'Size' },
  { key: 'fit',    label: 'Fit' },
  { key: 'height', label: 'Height' },
]

function DrillRows({ skus, totalCost }) {
  const [dim, setDim] = useState('color')

  const grouped = useMemo(() => {
    const map = {}
    for (const r of skus) {
      const k = r[dim] || 'Unknown'
      if (!map[k]) map[k] = []
      map[k].push(r)
    }
    return Object.values(map).map(rs => ({
      label: rs[0][dim] || 'Unknown',
      skuCount: [...new Set(rs.map(r => r.productTitle))].length,
      ...aggProd(rs),
    })).sort((a, b) => b.cost - a.cost)
  }, [skus, dim])

  return (
    <tr>
      <td colSpan={10} style={{ padding: 0, background: 'var(--bg3)' }}>
        <div style={{ padding: '10px 16px 14px 48px' }}>
          {/* Dim switcher */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
            {DRILL_DIMS.map(d => (
              <button key={d.key} onClick={() => setDim(d.key)} style={{
                padding: '3px 10px', fontSize: 11, borderRadius: 4, cursor: 'pointer',
                background: dim === d.key ? 'var(--blue-dim)' : 'var(--bg4)',
                color: dim === d.key ? 'var(--blue)' : 'var(--text2)',
                border: `0.5px solid ${dim === d.key ? 'var(--blue-border)' : 'var(--border2)'}`,
                fontWeight: dim === d.key ? 500 : 400,
              }}>{d.label}</button>
            ))}
            <span style={{ fontSize: 11, color: 'var(--text3)', alignSelf: 'center', marginLeft: 8 }}>
              {grouped.length} {dim}s
            </span>
          </div>

          {/* Drill table */}
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '0.5px solid var(--border2)' }}>
                {[dim === 'color' ? 'Color' : dim === 'size' ? 'Size' : dim === 'fit' ? 'Fit' : 'Height',
                  'SKUs', 'Spend', 'Mix', 'Impressions', 'Clicks', 'CTR', 'CPC', 'Revenue', 'ROAS'
                ].map((h, i) => (
                  <th key={h} style={{
                    padding: '5px 10px', fontSize: 10, fontWeight: 600,
                    color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em',
                    textAlign: i === 0 ? 'left' : 'right', whiteSpace: 'nowrap',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {grouped.map((r, i) => (
                <tr key={i}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg4)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={{ padding: '6px 10px', fontWeight: 500, color: 'var(--text)', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.label}</td>
                  <td style={dtd()}>{r.skuCount}</td>
                  <td style={dtd()}>{fmtINR(r.cost)}</td>
                  <td style={dtd()}>{totalCost > 0 ? `${((r.cost / totalCost) * 100).toFixed(1)}%` : '—'}</td>
                  <td style={dtd()}>{fmtNum(r.impressions)}</td>
                  <td style={dtd()}>{fmtNum(r.clicks)}</td>
                  <td style={{ ...dtd(), color: r.ctr >= 0.02 ? 'var(--green)' : r.ctr >= 0.01 ? 'var(--amber)' : 'var(--red)' }}>{fmtPct(r.ctr)}</td>
                  <td style={dtd()}>{fmtINR(r.cpc)}</td>
                  <td style={{ ...dtd(), color: 'var(--green)' }}>{fmtINR(r.revenue)}</td>
                  <td style={{ ...dtd(), color: r.roas >= 4 ? 'var(--green)' : r.roas >= 2 ? 'var(--amber)' : 'var(--red)', fontWeight: 500 }}>{r.roas.toFixed(2)}x</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </td>
    </tr>
  )
}

function dtd() {
  return { padding: '6px 10px', textAlign: 'right', color: 'var(--text)', borderBottom: 'none' }
}

export default function GoogleProducts() {
  const { state } = useData()
  const filters = useFilters('last30')
  const { filterRows, getPrevRows } = filters
  const [campaignFilter, setCampaignFilter] = useState('all')
  const [expandedProduct, setExpandedProduct] = useState(null)
  const [activeTab, setActiveTab] = useState('products') // 'products' | 'cohort'
  const [sortKey, setSortKey] = useState('cost')
  const [sortDir, setSortDir] = useState('desc')

  const allRows = useMemo(() => {
    return (filterRows(state.googleProducts || [], 'date')).map(r => ({
      ...r, ...parseSKU(r.productTitle),
    }))
  }, [state.googleProducts, filters])

  const prevAllRows = useMemo(() => {
    return (getPrevRows(state.googleProducts || [], 'date')).map(r => ({
      ...r, ...parseSKU(r.productTitle),
    }))
  }, [state.googleProducts, filters])

  const campaigns = useMemo(() => [...new Set(allRows.map(r => r.campaignName).filter(Boolean))].sort(), [allRows])

  // Search terms for cohort view
  const allSearchTerms = useMemo(() => {
    const stRows = filterRows(state.googleSearchTerms || [], 'date')
    return campaignFilter === 'all' ? stRows : stRows.filter(r => r.campaignName === campaignFilter)
  }, [state.googleSearchTerms, filters, campaignFilter])

  // Cohort: for each campaign, products + search terms side by side
  const cohortData = useMemo(() => {
    const campNames = campaignFilter === 'all'
      ? [...new Set([...rows.map(r => r.campaignName), ...allSearchTerms.map(r => r.campaignName)].filter(Boolean))].sort()
      : [campaignFilter]

    return campNames.map(camp => {
      const campProducts = rows.filter(r => r.campaignName === camp)
      const campTerms    = allSearchTerms.filter(r => r.campaignName === camp)
      const prodAgg      = aggProd(campProducts)
      const termSpend    = campTerms.reduce((s,r) => s+(r.cost||0), 0)
      const termClicks   = campTerms.reduce((s,r) => s+(r.clicks||0), 0)
      const termConv     = campTerms.reduce((s,r) => s+(r.transactions||0), 0)
      const termRev      = campTerms.reduce((s,r) => s+(r.revenue||0), 0)

      // Top products by spend
      const topProds = Object.values(campProducts.reduce((map, r) => {
        const k = r.productName || 'Unknown'
        if (!map[k]) map[k] = []
        map[k].push(r)
        return map
      }, {})).map(rs => ({ name: rs[0].productName, ...aggProd(rs) }))
        .sort((a,b) => b.cost - a.cost).slice(0, 5)

      // Top search terms by spend
      const topTerms = Object.values(campTerms.reduce((map, r) => {
        const k = r.term || 'Unknown'
        if (!map[k]) map[k] = []
        map[k].push(r)
        return map
      }, {})).map(rs => ({
        term: rs[0].term,
        cost: rs.reduce((s,r)=>s+(r.cost||0),0),
        clicks: rs.reduce((s,r)=>s+(r.clicks||0),0),
        conversions: rs.reduce((s,r)=>s+(r.transactions||0),0),
        revenue: rs.reduce((s,r)=>s+(r.revenue||0),0),
        isBrand: rs[0].isBrand,
      })).sort((a,b) => b.cost - a.cost).slice(0, 10)

      return {
        campaign: camp,
        productCount: [...new Set(campProducts.map(r => r.productName))].length,
        termCount: [...new Set(campTerms.map(r => r.term))].length,
        prodSpend: prodAgg.cost, prodRevenue: prodAgg.revenue, prodROAS: prodAgg.roas,
        termSpend, termClicks, termConv, termRev,
        topProds, topTerms,
      }
    }).filter(c => c.productCount > 0 || c.termCount > 0)
  }, [rows, allSearchTerms, campaignFilter])

  const rows = useMemo(() => campaignFilter === 'all' ? allRows : allRows.filter(r => r.campaignName === campaignFilter), [allRows, campaignFilter])
  const prev = useMemo(() => campaignFilter === 'all' ? prevAllRows : prevAllRows.filter(r => r.campaignName === campaignFilter), [prevAllRows, campaignFilter])

  const totals     = useMemo(() => aggProd(rows), [rows])
  const prevTotals = useMemo(() => aggProd(prev), [prev])
  const hasData    = rows.length > 0

  // Group by product name
  const byProduct = useMemo(() => {
    const map = {}
    for (const r of rows) {
      const k = r.productName || 'Unknown'
      if (!map[k]) map[k] = []
      map[k].push(r)
    }
    return Object.values(map).map(rs => ({
      productName: rs[0].productName,
      skuCount: [...new Set(rs.map(r => r.productTitle))].length,
      skus: rs,
      ...aggProd(rs),
    }))
  }, [rows])

  const sorted = useMemo(() => {
    return [...byProduct].sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey]
      return sortDir === 'desc' ? bv - av : av - bv
    })
  }, [byProduct, sortKey, sortDir])

  function toggleSort(key) {
    if (sortKey === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    else { setSortKey(key); setSortDir('desc') }
  }

  const thStyle = (key) => ({
    padding: '8px 12px', fontSize: 10, fontWeight: 600, color: sortKey === key ? 'var(--text)' : 'var(--text3)',
    textTransform: 'uppercase', letterSpacing: '0.05em', cursor: 'pointer',
    background: 'var(--bg3)', borderBottom: '0.5px solid var(--border2)',
    textAlign: key === 'productName' ? 'left' : 'right', whiteSpace: 'nowrap', userSelect: 'none',
  })

  const tdStyle = (color) => ({
    padding: '9px 12px', fontSize: 13, borderBottom: '0.5px solid var(--border)',
    textAlign: 'right', color: color || 'var(--text)',
  })

  const chartData = sorted.slice(0, 10).map(r => ({
    name: r.productName.length > 24 ? r.productName.slice(0, 24) + '…' : r.productName,
    spend: Math.round(r.cost),
    revenue: Math.round(r.revenue),
  }))

  return (
    <div style={{ padding: '20px 24px' }}>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 18, fontWeight: 600, marginBottom: 2 }}>Google — Product Performance</h1>
        <div style={{ fontSize: 12, color: 'var(--text3)' }}>Shopping & PMax · click any product to drill into color, size, fit, height</div>
      </div>

      <FilterBar filters={filters} showCohort={false} showSaleTag={false} />

      {/* Campaign filter */}
      {campaigns.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 500 }}>Campaign</span>
          <select value={campaignFilter} onChange={e => { setCampaignFilter(e.target.value); setExpandedProduct(null) }} style={{
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
      )}

      {!hasData && (
        <div style={{ background: 'var(--red-dim)', border: '0.5px solid var(--red-border)', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 12, color: 'var(--red)' }}>
          No product data — sync Windsor from the Upload page
        </div>
      )}

      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0,1fr))', gap: 10, marginBottom: 16 }}>
        {[
          { label: 'Total spend',  val: fmtINR(totals.cost),    delta: deltaLabel(totals.cost, prevTotals.cost) },
          { label: 'Impressions',  val: fmtNum(totals.impressions), delta: deltaLabel(totals.impressions, prevTotals.impressions) },
          { label: 'Clicks',       val: fmtNum(totals.clicks),   delta: deltaLabel(totals.clicks, prevTotals.clicks) },
          { label: 'Revenue',      val: fmtINR(totals.revenue),  delta: deltaLabel(totals.revenue, prevTotals.revenue), accent: 'var(--green)' },
          { label: 'ROAS',         val: `${totals.roas.toFixed(2)}x`, delta: deltaLabel(totals.roas, prevTotals.roas), accent: totals.roas >= 4 ? 'var(--green)' : totals.roas >= 2 ? 'var(--amber)' : 'var(--red)' },
        ].map(m => <MetricCard key={m.label} label={m.label} value={m.val} delta={m.delta} accent={m.accent} />)}
      </div>

      {/* Chart */}
      {hasData && (
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

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 16, borderBottom: '0.5px solid var(--border)' }}>
        {[['products', 'Products'], ['cohort', 'Products x Search Terms']].map(([key, label]) => (
          <button key={key} onClick={() => setActiveTab(key)} style={{
            padding: '8px 16px', fontSize: 13, cursor: 'pointer', fontWeight: activeTab === key ? 600 : 400,
            background: 'transparent', border: 'none',
            color: activeTab === key ? 'var(--blue)' : 'var(--text2)',
            borderBottom: `2px solid ${activeTab === key ? 'var(--blue)' : 'transparent'}`,
            marginBottom: -1,
          }}>{label}</button>
        ))}
      </div>

      {/* Cohort view */}
      {activeTab === 'cohort' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {cohortData.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
              No data — sync Windsor and select a date range
            </div>
          ) : cohortData.map(c => (
            <CohortCard key={c.campaign} data={c} />
          ))}
        </div>
      )}

      {activeTab === 'products' && <>
      {/* Table header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>{sorted.length} products</div>
        <div style={{ fontSize: 11, color: 'var(--text3)' }}>Click a row to drill into color · size · fit · height</div>
      </div>

      {/* Product table */}
      <div style={{ overflowX: 'auto', borderRadius: 8, border: '0.5px solid var(--border)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {[
                { key: 'productName', label: 'Product' },
                { key: 'skuCount',    label: 'SKUs' },
                { key: 'cost',        label: 'Spend' },
                { key: 'impressions', label: 'Impressions' },
                { key: 'clicks',      label: 'Clicks' },
                { key: 'ctr',         label: 'CTR' },
                { key: 'cpc',         label: 'CPC' },
                { key: 'conversions', label: 'Conv.' },
                { key: 'revenue',     label: 'Revenue' },
                { key: 'roas',        label: 'ROAS' },
              ].map(col => (
                <th key={col.key} style={thStyle(col.key)} onClick={() => toggleSort(col.key)}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                    {col.label}
                    {sortKey === col.key
                      ? <span style={{ color: 'var(--pink)', fontSize: 11 }}>{sortDir === 'desc' ? '↓' : '↑'}</span>
                      : <span style={{ opacity: 0.2, fontSize: 11 }}>↕</span>
                    }
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => {
              const isExpanded = expandedProduct === r.productName
              return (
                <React.Fragment key={r.productName}>
                  <tr
                    onClick={() => setExpandedProduct(isExpanded ? null : r.productName)}
                    style={{ cursor: 'pointer', background: isExpanded ? 'var(--bg3)' : 'transparent' }}
                    onMouseEnter={e => { if (!isExpanded) e.currentTarget.style.background = 'var(--bg3)' }}
                    onMouseLeave={e => { if (!isExpanded) e.currentTarget.style.background = 'transparent' }}
                  >
                    <td style={{ ...tdStyle(), textAlign: 'left', fontWeight: 600 }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 10, color: 'var(--text3)', transition: 'transform .15s', display: 'inline-block', transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
                        {r.productName}
                      </span>
                    </td>
                    <td style={tdStyle()}>{r.skuCount}</td>
                    <td style={tdStyle()}>{fmtINR(r.cost)}</td>
                    <td style={tdStyle()}>{fmtNum(r.impressions)}</td>
                    <td style={tdStyle()}>{fmtNum(r.clicks)}</td>
                    <td style={tdStyle(r.ctr >= 0.02 ? 'var(--green)' : r.ctr >= 0.01 ? 'var(--amber)' : 'var(--red)')}>{fmtPct(r.ctr)}</td>
                    <td style={tdStyle()}>{fmtINR(r.cpc)}</td>
                    <td style={tdStyle()}>{fmtNum(r.conversions, 1)}</td>
                    <td style={tdStyle('var(--green)')}>{fmtINR(r.revenue)}</td>
                    <td style={tdStyle(r.roas >= 4 ? 'var(--green)' : r.roas >= 2 ? 'var(--amber)' : 'var(--red)')}>{r.roas.toFixed(2)}x</td>
                  </tr>
                  {isExpanded && <DrillRows skus={r.skus} totalCost={r.cost} />}
                </React.Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    </>}
    </div>
  )
}

function CohortCard({ data: c }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ background: 'var(--bg2)', border: '0.5px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
      {/* Campaign header */}
      <div onClick={() => setOpen(o => !o)} style={{
        padding: '12px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: open ? '0.5px solid var(--border)' : 'none',
      }}
        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg3)'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 10, color: 'var(--text3)', transform: open ? 'rotate(90deg)' : 'rotate(0)', display: 'inline-block', transition: 'transform .15s' }}>▶</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{c.campaign}</div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
              {c.productCount} products · {c.termCount} search terms
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 20 }}>
          {[
            { label: 'Prod Spend', val: `₹${Math.round(c.prodSpend).toLocaleString('en-IN')}` },
            { label: 'Prod ROAS',  val: c.prodROAS > 0 ? `${c.prodROAS.toFixed(2)}x` : '—', color: c.prodROAS >= 4 ? 'var(--green)' : c.prodROAS >= 2 ? 'var(--amber)' : 'var(--red)' },
            { label: 'Term Spend', val: `₹${Math.round(c.termSpend).toLocaleString('en-IN')}` },
            { label: 'Term Conv',  val: c.termConv > 0 ? Math.round(c.termConv).toLocaleString('en-IN') : '—' },
          ].map(m => (
            <div key={m.label} style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{m.label}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: m.color || 'var(--text)' }}>{m.val}</div>
            </div>
          ))}
        </div>
      </div>

      {open && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
          {/* Products side */}
          <div style={{ padding: '12px 16px', borderRight: '0.5px solid var(--border)' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--blue)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
              Top Products
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr>
                  {['Product','Spend','Revenue','ROAS'].map((h,i) => (
                    <th key={h} style={{ padding: '4px 8px', fontSize: 10, fontWeight: 600, color: 'var(--text3)', textAlign: i===0?'left':'right', textTransform:'uppercase', letterSpacing:'0.05em', borderBottom:'0.5px solid var(--border)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {c.topProds.map((p, i) => (
                  <tr key={i} onMouseEnter={e=>e.currentTarget.style.background='var(--bg3)'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                    <td style={{ padding:'5px 8px', color:'var(--text)', fontWeight:500, maxWidth:200, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.name}</td>
                    <td style={{ padding:'5px 8px', textAlign:'right', color:'var(--text)' }}>₹{Math.round(p.cost).toLocaleString('en-IN')}</td>
                    <td style={{ padding:'5px 8px', textAlign:'right', color:'var(--green)' }}>₹{Math.round(p.revenue).toLocaleString('en-IN')}</td>
                    <td style={{ padding:'5px 8px', textAlign:'right', color: p.roas>=4?'var(--green)':p.roas>=2?'var(--amber)':'var(--red)', fontWeight:500 }}>{p.roas.toFixed(2)}x</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Search terms side */}
          <div style={{ padding: '12px 16px' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--green)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
              Top Search Terms
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr>
                  {['Search Term','Spend','Clicks','Conv.'].map((h,i) => (
                    <th key={h} style={{ padding: '4px 8px', fontSize: 10, fontWeight: 600, color: 'var(--text3)', textAlign: i===0?'left':'right', textTransform:'uppercase', letterSpacing:'0.05em', borderBottom:'0.5px solid var(--border)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {c.topTerms.map((t, i) => (
                  <tr key={i} onMouseEnter={e=>e.currentTarget.style.background='var(--bg3)'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                    <td style={{ padding:'5px 8px', color:'var(--text)', maxWidth:200, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {t.isBrand && <span style={{ fontSize:9, padding:'1px 5px', borderRadius:3, background:'var(--blue-dim)', color:'var(--blue)', marginRight:5, fontWeight:600 }}>B</span>}
                      {t.term}
                    </td>
                    <td style={{ padding:'5px 8px', textAlign:'right', color:'var(--text)' }}>₹{Math.round(t.cost).toLocaleString('en-IN')}</td>
                    <td style={{ padding:'5px 8px', textAlign:'right', color:'var(--text)' }}>{t.clicks.toLocaleString('en-IN')}</td>
                    <td style={{ padding:'5px 8px', textAlign:'right', color: t.conversions>0?'var(--green)':'var(--text3)' }}>{t.conversions > 0 ? Math.round(t.conversions) : '—'}</td>
                  </tr>
                ))}
                {c.topTerms.length === 0 && (
                  <tr><td colSpan={4} style={{ padding:'10px 8px', color:'var(--text3)', fontSize:11 }}>No search terms data for this campaign</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
