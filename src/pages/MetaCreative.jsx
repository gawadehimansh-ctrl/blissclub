import React, { useMemo, useState } from 'react'
import { useData } from '../data/store.jsx'
import { useFilters } from '../hooks/useFilters.js'
import FilterBar from '../components/FilterBar.jsx'
import DrillTable from '../components/DrillTable.jsx'
import MetricCard from '../components/MetricCard.jsx'
import { aggregateRows, calcROAS } from '../utils/metrics.js'
import { fmtINRCompact, fmtX, fmtPct, fmtNum } from '../utils/formatters.js'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

const PIVOT_DIMS = ['product', 'format', 'contentType', 'cohort', 'creator']
const PIVOT_LABELS = { product: 'Product', format: 'Format', contentType: 'Content type', cohort: 'Cohort', creator: 'Creator' }

function groupAndAggregate(rows, dim) {
  const map = {}
  for (const r of rows) {
    const k = r[dim] || 'Unknown'
    if (!map[k]) map[k] = []
    map[k].push(r)
  }
  return Object.entries(map).map(([key, rs]) => {
    const agg = aggregateRows(rs)
    const spendTotal = rows.reduce((s, r) => s + r.spend, 0)
    return {
      [dim]: key,
      ...agg,
      roasGA4: calcROAS(agg.gaRevenue, agg.spend),
      spendMix: spendTotal > 0 ? (agg.spend / spendTotal) * 100 : 0,
      ctr: agg.impressions > 0 ? agg.clicks / agg.impressions : 0,
      cpm: agg.impressions > 0 ? (agg.spend / agg.impressions) * 1000 : 0,
      cpc: agg.clicks > 0 ? agg.spend / agg.clicks : 0,
      cpa: agg.gaOrders > 0 ? agg.spend / agg.gaOrders : 0,
      ecr: agg.sessions > 0 ? agg.gaOrders / agg.sessions : 0,
      creativeCount: [...new Set(rs.map(r => r.adId || r.adName || r.creativeName))].filter(Boolean).length,
    }
  }).sort((a, b) => b.spend - a.spend)
}

export default function MetaCreative() {
  const { state } = useData()
  const filters = useFilters('last30')
  const { filterRows } = filters
  const [pivotDim, setPivotDim] = useState('product')

  const rows = useMemo(() => filterRows(state.metaDB || []), [state.metaDB, filters])
  const pivoted = useMemo(() => groupAndAggregate(rows, pivotDim), [rows, pivotDim])
  const totals = useMemo(() => aggregateRows(rows), [rows])

  // Top creatives by GA4 ROAS
  const topCreatives = useMemo(() => {
    const byCreative = {}
    for (const r of rows) {
      const k = r.creativeName || r.adName
      if (!byCreative[k]) byCreative[k] = []
      byCreative[k].push(r)
    }
    return Object.entries(byCreative).map(([name, rs]) => {
      const agg = aggregateRows(rs)
      return {
        creativeName: name,
        format: rs[0]?.format,
        product: rs[0]?.product,
        contentType: rs[0]?.contentType,
        creator: rs[0]?.creator,
        cohort: rs[0]?.cohort,
        ...agg,
          roasGA4: calcROAS(agg.gaRevenue, agg.spend),
        ctr: agg.impressions > 0 ? agg.clicks / agg.impressions : 0,
        cpa: agg.gaOrders > 0 ? agg.spend / agg.gaOrders : 0,
      }
    }).filter(c => c.spend > 1000)
      .sort((a, b) => b.gaRevenue - a.gaRevenue)
  }, [rows])

  const cols = [
    { key: pivotDim, label: PIVOT_LABELS[pivotDim], align: 'left', bold: true },
    { key: 'spend', label: 'Spend', render: v => `₹${Math.round(v).toLocaleString('en-IN')}` },
    { key: 'spendMix', label: 'Spend %', render: v => `${v.toFixed(1)}%` },
    { key: 'creativeCount', label: 'Creatives', render: v => fmtNum(v) },
    { key: 'impressions', label: 'Impr.', render: v => fmtNum(v) },
    { key: 'ctr', label: 'CTR', render: v => fmtPct(v), color: v => v > 0.02 ? 'var(--green)' : v > 0.01 ? 'var(--amber)' : 'var(--red)' },
    { key: 'cpm', label: 'CPM', render: v => fmtINRCompact(v) },
    { key: 'cpc', label: 'CPC', render: v => fmtINRCompact(v) },
    { key: 'gaRevenue', label: 'GA4 Rev', render: v => fmtINRCompact(v), color: () => 'var(--purple)' },
    { key: 'roasGA4', label: 'GA4 ROAS', render: v => fmtX(v), color: v => v >= 4 ? 'var(--green)' : v >= 2 ? 'var(--amber)' : 'var(--red)' },
    { key: 'gaOrders', label: 'Orders', render: v => fmtNum(v) },
    { key: 'cpa', label: 'CPA', render: v => fmtINRCompact(v) },
    { key: 'ecr', label: 'ECR', render: v => fmtPct(v) },
  ]

  const topCreativeCols = [
    { key: 'creativeName', label: 'Creative', align: 'left', bold: true },
    { key: 'format', label: 'Format' },
    { key: 'product', label: 'Product' },
    { key: 'contentType', label: 'Type' },
    { key: 'creator', label: 'Creator' },
    { key: 'cohort', label: 'Cohort' },
    { key: 'spend', label: 'Spend', render: v => `₹${Math.round(v).toLocaleString('en-IN')}` },
    { key: 'ctr', label: 'CTR', render: v => fmtPct(v), color: v => v > 0.02 ? 'var(--green)' : v > 0.01 ? 'var(--amber)' : 'var(--red)' },
    { key: 'roasGA4', label: 'GA4 ROAS', render: v => fmtX(v), color: v => v >= 4 ? 'var(--green)' : v >= 2 ? 'var(--amber)' : 'var(--red)' },
    { key: 'gaRevenue', label: 'GA4 Rev', render: v => fmtINRCompact(v) },
    { key: 'gaOrders', label: 'Orders', render: v => fmtNum(v) },
    { key: 'cpa', label: 'CPA', render: v => fmtINRCompact(v) },
  ]

  const COLORS = ['var(--pink)', 'var(--blue)', 'var(--amber)', 'var(--green)', 'var(--purple)']

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 2 }}>Meta creative lookback</h1>
        <div style={{ fontSize: 12, color: 'var(--text3)' }}>Product · Format · Content type · Creator · Cohort breakdown</div>
      </div>
      <FilterBar filters={filters} showAdvanced />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0,1fr))', gap: 10, marginBottom: 16 }}>
        <MetricCard label="Total spend" value={fmtINRCompact(totals.spend)} accent="var(--pink)" />
        <MetricCard label="GA4 revenue" value={fmtINRCompact(totals.gaRevenue)} accent="var(--purple)" />
        <MetricCard label="GA4 ROAS" value={fmtX(calcROAS(totals.gaRevenue, totals.spend))} accent="var(--purple)" />
        <MetricCard label="Unique creatives" value={fmtNum([...new Set(rows.map(r => r.adId || r.adName || r.creativeName).filter(Boolean))].length)} />
      </div>

      {/* Pivot selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
        <span style={{ fontSize: 12, color: 'var(--text2)', marginRight: 4 }}>Breakdown by:</span>
        {PIVOT_DIMS.map(d => (
          <button key={d} onClick={() => setPivotDim(d)}
            style={{
              padding: '4px 12px', fontSize: 12, borderRadius: 20, cursor: 'pointer',
              background: pivotDim === d ? 'var(--pink-dim)' : 'var(--bg3)',
              color: pivotDim === d ? 'var(--pink)' : 'var(--text2)',
              border: `0.5px solid ${pivotDim === d ? 'var(--pink-border)' : 'var(--border)'}`,
            }}>
            {PIVOT_LABELS[d]}
          </button>
        ))}
      </div>

      {/* Bar chart of spend by dimension */}
      {pivoted.length > 0 && pivoted.length <= 12 && (
        <div style={{ background: 'var(--bg2)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '14px 16px', marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 10 }}>GA4 ROAS by {PIVOT_LABELS[pivotDim].toLowerCase()}</div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={pivoted} barSize={28}>
              <XAxis dataKey={pivotDim} tick={{ fontSize: 11, fill: 'var(--text3)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--text3)' }} axisLine={false} tickLine={false} unit="x" />
              <Tooltip contentStyle={{ background: 'var(--bg3)', border: '0.5px solid var(--border2)', fontSize: 12 }}
                formatter={v => [`${v.toFixed(2)}x`, 'GA4 ROAS']} />
              <Bar dataKey="roasGA4" radius={[4,4,0,0]}>
                {pivoted.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <DrillTable columns={cols} data={pivoted} defaultSort={{ key: 'spend', dir: 'desc' }} />

      <div style={{ marginTop: 24, marginBottom: 8 }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>All creatives</div>
        <div style={{ fontSize: 12, color: 'var(--text3)' }}>Sorted by GA4 revenue · min ₹1K spend</div>
      </div>
      <DrillTable columns={topCreativeCols} data={topCreatives} defaultSort={{ key: 'gaRevenue', dir: 'desc' }} compact />
    </div>
  )
}
