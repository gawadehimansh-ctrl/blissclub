import React, { useMemo, useState } from 'react'
import { useData } from '../data/store.jsx'
import { useFilters } from '../hooks/useFilters.js'
import FilterBar from '../components/FilterBar.jsx'
import DrillTable from '../components/DrillTable.jsx'
import MetricCard from '../components/MetricCard.jsx'
import { aggregateRows, calcROAS } from '../utils/metrics.js'
import { fmtINRCompact, fmtX, fmtPct, fmtNum } from '../utils/formatters.js'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

const PIVOT_DIMS   = ['product', 'format', 'contentType', 'cohort', 'creator']
const PIVOT_LABELS = { product: 'Product', format: 'Format', contentType: 'Content type', cohort: 'Cohort', creator: 'Creator' }
const COLORS = ['var(--pink)', 'var(--blue)', 'var(--amber)', 'var(--green)', 'var(--purple)']
const TABS   = ['Breakdown', 'Creative Performance']

// ── Parse creative name from ad name ─────────────────────────────────────────
// Ad name: "RET_IN_Sales_CA_CustomerList_290424-Static_LTC_Flare_..."
// Creative: everything after the first "-"
function parseCreativeName(adName = '') {
  const idx = adName.indexOf('-')
  if (idx === -1) return adName
  return adName.slice(idx + 1)
}

function groupAndAggregate(rows, dim) {
  const map = {}
  for (const r of rows) {
    const k = r[dim] || 'Unknown'
    if (!map[k]) map[k] = []
    map[k].push(r)
  }
  const spendTotal = rows.reduce((s, r) => s + (r.spend || 0), 0)
  return Object.entries(map).map(([key, rs]) => {
    const agg = aggregateRows(rs)
    return {
      [dim]: key, ...agg,
      roasGA4:       calcROAS(agg.gaRevenue, agg.spend),
      spendMix:      spendTotal > 0 ? (agg.spend / spendTotal) * 100 : 0,
      ctr:           agg.impressions > 0 ? agg.clicks / agg.impressions : 0,
      cpm:           agg.impressions > 0 ? (agg.spend / agg.impressions) * 1000 : 0,
      cpc:           agg.clicks > 0 ? agg.spend / agg.clicks : 0,
      cpa:           agg.gaOrders > 0 ? agg.spend / agg.gaOrders : 0,
      ecr:           agg.sessions > 0 ? agg.gaOrders / agg.sessions : 0,
      creativeCount: [...new Set(rs.map(r => r.adId || r.adName || r.creativeName))].filter(Boolean).length,
    }
  }).sort((a, b) => b.spend - a.spend)
}

// ── Active filter chips ───────────────────────────────────────────────────────
function FilterChips({ filters, onClear }) {
  const chips = []
  if (filters.dateLabel) chips.push({ label: `📅 ${filters.dateLabel}`, key: 'date' })
  if (filters.segment && filters.segment !== 'all') chips.push({ label: `Segment: ${filters.segment}`, key: 'segment' })
  if (filters.saleTag) chips.push({ label: `Tag: ${filters.saleTag}`, key: 'saleTag' })
  if (filters.cohorts?.length) filters.cohorts.forEach(c => chips.push({ label: `Cohort: ${c}`, key: `cohort_${c}` }))
  if (filters.formats?.length) filters.formats.forEach(f => chips.push({ label: `Format: ${f}`, key: `format_${f}` }))
  if (filters.products?.length) filters.products.forEach(p => chips.push({ label: `Product: ${p}`, key: `product_${p}` }))

  if (chips.length <= 1) return null // only date is not worth showing
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10, alignItems: 'center' }}>
      <span style={{ fontSize: 11, color: 'var(--text3)', marginRight: 2 }}>Active filters:</span>
      {chips.map(c => (
        <span key={c.key} style={{
          fontSize: 11, padding: '3px 10px', borderRadius: 20,
          background: 'rgba(127,119,221,0.12)', border: '0.5px solid rgba(127,119,221,0.3)',
          color: '#7F77DD', fontWeight: 500,
        }}>{c.label}</span>
      ))}
      <button onClick={onClear} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: 'rgba(239,68,68,0.08)', border: '0.5px solid rgba(239,68,68,0.2)', color: '#ef4444', cursor: 'pointer' }}>
        ✕ Clear all
      </button>
    </div>
  )
}

export default function MetaCreative() {
  const { state }  = useData()
  const filters    = useFilters('last30')
  const { filterRows } = filters
  const [tab, setTab]               = useState('Breakdown')
  const [pivotDim, setPivotDim]     = useState('product')
  const [drillCreator, setDrillCreator] = useState(null)
  const [cpSearch, setCpSearch]     = useState('')
  const [cpSort, setCpSort]         = useState({ key: 'gaRevenue', dir: 'desc' })
  const drillRef = React.useRef(null)

  const rows    = useMemo(() => filterRows(state.metaDB || []), [state.metaDB, filters])
  const pivoted = useMemo(() => groupAndAggregate(rows, pivotDim), [rows, pivotDim])
  const totals  = useMemo(() => aggregateRows(rows), [rows])

  // ── Creative Performance: group by parsed creative name ───────────────────
  const creativePerf = useMemo(() => {
    const map = {}
    for (const r of rows) {
      const creative = parseCreativeName(r.adName || r.creativeName || '')
      if (!creative) continue
      if (!map[creative]) {
        map[creative] = {
          rows: [],
          format:      r.format,
          product:     r.product,
          contentType: r.contentType,
          creator:     r.creator,
          cohort:      r.cohort,
          saleTag:     r.saleTag,
        }
      }
      map[creative].rows.push(r)
    }
    return Object.entries(map).map(([creativeName, { rows: rs, ...meta }]) => {
      const agg = aggregateRows(rs)
      const adsetNames = [...new Set(rs.map(r => r.adsetName).filter(Boolean))]
      const campaignNames = [...new Set(rs.map(r => r.campaignName).filter(Boolean))]
      return {
        creativeName,
        ...meta,
        ...agg,
        adsetCount:    adsetNames.length,
        campaignCount: campaignNames.length,
        roasGA4:  calcROAS(agg.gaRevenue, agg.spend),
        ctr:      agg.impressions > 0 ? agg.clicks / agg.impressions : 0,
        cpm:      agg.impressions > 0 ? (agg.spend / agg.impressions) * 1000 : 0,
        cpa:      agg.gaOrders > 0 ? agg.spend / agg.gaOrders : 0,
      }
    }).filter(c => c.spend > 1000).sort((a, b) => b.gaRevenue - a.gaRevenue)
  }, [rows])

  // ── Creator → product drill-down ──────────────────────────────────────────
  const creatorProducts = useMemo(() => {
    if (!drillCreator) return null
    const creatorRows = rows.filter(r => (r.creator || 'Unknown') === drillCreator)
    if (!creatorRows.length) return []
    return groupAndAggregate(creatorRows, 'product')
  }, [rows, drillCreator])

  React.useEffect(() => {
    if (drillCreator && drillRef.current)
      setTimeout(() => drillRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
  }, [drillCreator])

  function clearAllFilters() {
    filters.setSegment?.('all')
    filters.setSaleTag?.('')
    filters.setCohorts?.([])
    filters.setFormats?.([])
    filters.setProducts?.([])
  }

  // ── Column definitions ────────────────────────────────────────────────────
  const pivotCols = [
    { key: pivotDim,        label: PIVOT_LABELS[pivotDim], align: 'left', bold: true },
    { key: 'spend',         label: 'Spend',      render: v => `₹${Math.round(v).toLocaleString('en-IN')}` },
    { key: 'spendMix',      label: 'Spend %',    render: v => `${v.toFixed(1)}%` },
    { key: 'creativeCount', label: 'Creatives',  render: v => fmtNum(v) },
    { key: 'reach',         label: 'Reach',      render: v => v > 0 ? fmtNum(v) : '—' },
    { key: 'impressions',   label: 'Impr.',      render: v => fmtNum(v) },
    { key: 'ctr',           label: 'CTR',        render: v => fmtPct(v), color: v => v>0.02?'var(--green)':v>0.01?'var(--amber)':'var(--red)' },
    { key: 'cpm',           label: 'CPM',        render: v => fmtINRCompact(v) },
    { key: 'cpc',           label: 'CPC',        render: v => fmtINRCompact(v) },
    { key: 'gaRevenue',     label: 'GA4 Rev',    render: v => fmtINRCompact(v), color: () => 'var(--purple)' },
    { key: 'roasGA4',       label: 'GA4 ROAS',   render: v => fmtX(v), color: v => v>=4?'var(--green)':v>=2?'var(--amber)':'var(--red)' },
    { key: 'gaOrders',      label: 'Orders',     render: v => fmtNum(v) },
    { key: 'cpa',           label: 'CPA',        render: v => fmtINRCompact(v) },
  ]

  const drillCols = [
    { key: 'product',     label: 'Product',  align: 'left', bold: true },
    { key: 'spend',       label: 'Spend',    render: v => `₹${Math.round(v).toLocaleString('en-IN')}` },
    { key: 'spendMix',    label: 'Mix %',    render: v => `${v.toFixed(1)}%` },
    { key: 'reach',       label: 'Reach',    render: v => v > 0 ? fmtNum(v) : '—' },
    { key: 'impressions', label: 'Impr.',    render: v => fmtNum(v) },
    { key: 'ctr',         label: 'CTR',      render: v => fmtPct(v), color: v => v>0.02?'var(--green)':v>0.01?'var(--amber)':'var(--red)' },
    { key: 'cpm',         label: 'CPM',      render: v => fmtINRCompact(v) },
    { key: 'gaRevenue',   label: 'GA4 Rev',  render: v => fmtINRCompact(v), color: () => 'var(--purple)' },
    { key: 'roasGA4',     label: 'GA4 ROAS', render: v => fmtX(v), color: v => v>=4?'var(--green)':v>=2?'var(--amber)':'var(--red)' },
    { key: 'gaOrders',    label: 'Orders',   render: v => fmtNum(v) },
    { key: 'cpa',         label: 'CPA',      render: v => fmtINRCompact(v) },
  ]

  const cpCols = [
    { key: 'creativeName',  label: 'Creative name', align: 'left', bold: true,
      render: (v) => <span title={v} style={{ display:'block', maxWidth:380, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{v}</span> },
    { key: 'format',        label: 'Format' },
    { key: 'product',       label: 'Product' },
    { key: 'contentType',   label: 'Type' },
    { key: 'creator',       label: 'Creator' },
    { key: 'cohort',        label: 'Cohort' },
    { key: 'adsetCount',    label: 'Adsets',   render: v => <span style={{ fontSize:11, padding:'2px 7px', borderRadius:4, background:'var(--bg3)', color:'var(--text2)' }}>{v}</span> },
    { key: 'campaignCount', label: 'Campaigns',render: v => <span style={{ fontSize:11, padding:'2px 7px', borderRadius:4, background:'var(--bg3)', color:'var(--text2)' }}>{v}</span> },
    { key: 'spend',         label: 'Spend',    render: v => `₹${Math.round(v).toLocaleString('en-IN')}` },
    { key: 'impressions',   label: 'Impr.',    render: v => fmtNum(v) },
    { key: 'ctr',           label: 'CTR',      render: v => fmtPct(v), color: v => v>0.02?'var(--green)':v>0.01?'var(--amber)':'var(--red)' },
    { key: 'cpm',           label: 'CPM',      render: v => fmtINRCompact(v) },
    { key: 'gaRevenue',     label: 'GA4 Rev',  render: v => fmtINRCompact(v), color: () => 'var(--purple)' },
    { key: 'roasGA4',       label: 'GA4 ROAS', render: v => fmtX(v), color: v => v>=4?'var(--green)':v>=2?'var(--amber)':'var(--red)' },
    { key: 'gaOrders',      label: 'Orders',   render: v => fmtNum(v) },
    { key: 'cpa',           label: 'CPA',      render: v => fmtINRCompact(v) },
  ]

  const uniqueCreativeCount = useMemo(() => creativePerf.length, [creativePerf])

  return (
    <div style={{ padding: '24px 28px', width: '100%' }}>
      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 2 }}>Meta creative lookback</h1>
        <div style={{ fontSize: 12, color: 'var(--text3)' }}>Product · Format · Content type · Creator · Cohort · Unique creative performance</div>
      </div>

      <FilterBar filters={filters} showAdvanced />

      {/* Active filter chips */}
      <FilterChips filters={filters} onClear={clearAllFilters} />

      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 10, marginBottom: 16 }}>
        <MetricCard label="Total spend"           value={fmtINRCompact(totals.spend)}     accent="var(--pink)" />
        <MetricCard label="GA4 revenue"           value={fmtINRCompact(totals.gaRevenue)} accent="var(--purple)" />
        <MetricCard label="GA4 ROAS"              value={fmtX(calcROAS(totals.gaRevenue, totals.spend))} accent="var(--purple)" />
        <MetricCard label="Unique creatives"      value={fmtNum(uniqueCreativeCount)} sublabel="across all adsets" />
      </div>

      {/* Tab switcher */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, background: 'var(--bg2)', padding: 4, borderRadius: 8, width: 'fit-content', border: '0.5px solid var(--border)' }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '6px 18px', fontSize: 13, borderRadius: 6, cursor: 'pointer', border: 'none',
            background: tab === t ? '#7F77DD' : 'transparent',
            color: tab === t ? '#fff' : 'var(--text2)',
            fontWeight: tab === t ? 500 : 400,
          }}>{t}</button>
        ))}
      </div>

      {/* ── TAB 1: Breakdown ── */}
      {tab === 'Breakdown' && (
        <>
          {/* Pivot selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
            <span style={{ fontSize: 12, color: 'var(--text2)', marginRight: 4 }}>Breakdown by:</span>
            {PIVOT_DIMS.map(d => (
              <button key={d} onClick={() => { setPivotDim(d); setDrillCreator(null) }} style={{
                padding: '4px 12px', fontSize: 12, borderRadius: 20, cursor: 'pointer',
                background: pivotDim === d ? 'var(--pink-dim)' : 'var(--bg3)',
                color: pivotDim === d ? 'var(--pink)' : 'var(--text2)',
                border: `0.5px solid ${pivotDim === d ? 'var(--pink-border)' : 'var(--border)'}`,
              }}>{PIVOT_LABELS[d]}</button>
            ))}
          </div>

          {/* Bar chart */}
          {pivoted.length > 0 && pivoted.length <= 12 && (
            <div style={{ background: 'var(--bg2)', border: '0.5px solid var(--border)', borderRadius: 10, padding: '14px 16px', marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 10 }}>GA4 ROAS by {PIVOT_LABELS[pivotDim].toLowerCase()}</div>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={pivoted} barSize={28}>
                  <XAxis dataKey={pivotDim} tick={{ fontSize: 11, fill: 'var(--text3)' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--text3)' }} axisLine={false} tickLine={false} unit="x" />
                  <Tooltip contentStyle={{ background: 'var(--bg3)', border: '0.5px solid var(--border2)', fontSize: 12 }} formatter={v => [`${v.toFixed(2)}x`, 'GA4 ROAS']} />
                  <Bar dataKey="roasGA4" radius={[4,4,0,0]}>
                    {pivoted.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {pivotDim === 'creator' && (
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6 }}>💡 Click a creator row to see their product breakdown</div>
          )}

          <DrillTable
            columns={pivotCols}
            data={pivoted}
            defaultSort={{ key: 'spend', dir: 'desc' }}
            onRowClick={row => {
              if (pivotDim !== 'creator') return
              const name = row.creator || 'Unknown'
              setDrillCreator(prev => prev === name ? null : name)
            }}
            highlightRow={row => pivotDim === 'creator' && (row.creator || 'Unknown') === drillCreator}
          />

          {/* Creator drill panel */}
          {drillCreator && creatorProducts !== null && (
            <div ref={drillRef} style={{ marginTop: 16, background: 'var(--bg2)', border: '0.5px solid var(--blue-border)', borderRadius: 10, padding: '16px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--blue)' }} />
                  <span style={{ fontSize: 15, fontWeight: 700 }}>{drillCreator}</span>
                  <span style={{ fontSize: 12, color: 'var(--text3)' }}>→ {creatorProducts.length} products</span>
                </div>
                <button onClick={() => setDrillCreator(null)} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, background: 'var(--bg3)', border: '0.5px solid var(--border2)', color: 'var(--text2)', cursor: 'pointer' }}>✕ Close</button>
              </div>
              <DrillTable columns={drillCols} data={creatorProducts} defaultSort={{ key: 'spend', dir: 'desc' }} />
            </div>
          )}
        </>
      )}

      {/* ── TAB 2: Creative Performance ── */}
      {tab === 'Creative Performance' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>
              {uniqueCreativeCount.toLocaleString()} unique creatives
            </div>
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>
              Aggregated across all adsets · min ₹1K spend · sorted by GA4 revenue
            </div>
          </div>

          {/* Info callout */}
          <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(127,119,221,0.08)', border: '0.5px solid rgba(127,119,221,0.2)', fontSize: 12, color: 'var(--text2)', marginBottom: 14 }}>
            💡 Creative name is parsed from ad name — everything after the first <code style={{ background:'var(--bg3)', padding:'1px 5px', borderRadius:3 }}>-</code>. Same creative running across multiple adsets is summed here. <strong style={{ color:'var(--text)' }}>Adsets</strong> column shows how many adsets this creative is running in.
          </div>

          <DrillTable
            columns={cpCols}
            data={creativePerf}
            defaultSort={{ key: 'gaRevenue', dir: 'desc' }}
            filename="creative-performance"
          />
        </div>
      )}
    </div>
  )
}
