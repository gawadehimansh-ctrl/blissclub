import React, { useMemo, useState } from 'react'
import { useData } from '../data/store.jsx'
import { useFilters } from '../hooks/useFilters.js'
import FilterBar from '../components/FilterBar.jsx'
import DrillTable from '../components/DrillTable.jsx'
import MetricCard from '../components/MetricCard.jsx'
import { aggregateRows, calcROAS, calcROASGap } from '../utils/metrics.js'
import { fmtINRCompact, fmtX, fmtPct, fmtNum, deltaLabel } from '../utils/formatters.js'

const LEVELS = ['Campaign', 'Ad set', 'Ad']

function groupBy(rows, key) {
  const map = {}
  for (const r of rows) {
    const k = r[key] || 'Unknown'
    if (!map[k]) map[k] = []
    map[k].push(r)
  }
  return map
}

export default function MetaCampaigns() {
  const { state } = useData()
  const filters = useFilters('last7')
  const { filterRows, segment } = filters
  const [level, setLevel] = useState('Campaign')
  const [drillKey, setDrillKey] = useState(null) // selected campaign or adset

  const rows = useMemo(() => {
    let r = filterRows(state.metaDB || [])
    // Women/Men filter via adset name
    if (segment === 'women') r = r.filter(x => !x.adsetName.toLowerCase().includes('men') || x.category?.toLowerCase().includes('women'))
    if (segment === 'men') r = r.filter(x => x.adsetName.toLowerCase().includes('men') || x.adsetName.toLowerCase().includes("men's"))
    return r
  }, [state.metaDB, filters, segment])

  // Summary totals
  const totals = useMemo(() => aggregateRows(rows), [rows])

  // Campaign groups — derive from adset name prefix (ACQ/REM/RET + product)
  const campaignGroups = useMemo(() => {
    const g = groupBy(rows, 'cohort')
    return Object.entries(g).map(([cohort, rs]) => {
      const agg = aggregateRows(rs)
      return { ...agg, cohort, _rows: rs }
    }).sort((a, b) => b.spend - a.spend)
  }, [rows])

  // Adset groups
  const adsetGroups = useMemo(() => {
    const source = drillKey && level === 'Ad set' ? rows.filter(r => r.campaignName === drillKey) : rows
    const g = groupBy(source, 'adsetName')
    return Object.entries(g).map(([name, rs]) => {
      const agg = aggregateRows(rs)
      return { ...agg, adsetName: name, _rows: rs }
    }).sort((a, b) => b.spend - a.spend)
  }, [rows, drillKey, level])

  // Ad level
  const adRows = useMemo(() => {
    const source = drillKey && level === 'Ad' ? rows.filter(r => r.adsetName === drillKey) : rows
    return source.map(r => ({
      ...r,
      roasGA4: calcROAS(r.gaRevenue, r.spend),
      ctr: r.impressions > 0 ? r.clicks / r.impressions : 0,
      cpm: r.impressions > 0 ? (r.spend / r.impressions) * 1000 : 0,
      cpc: r.clicks > 0 ? r.spend / r.clicks : 0,
      cpa: r.gaOrders > 0 ? r.spend / r.gaOrders : 0,
    })).sort((a, b) => b.spend - a.spend)
  }, [rows, drillKey, level])

  const campaignCols = [
    { key: 'campaignName', label: 'Campaign', align: 'left', bold: true },
    { key: 'spend', label: 'Spend', render: v => fmtINRCompact(v) },
    { key: 'impressions', label: 'Impr.', render: v => fmtNum(v) },
    { key: 'clicks', label: 'Clicks', render: v => fmtNum(v) },
    { key: 'ctr', label: 'CTR', render: v => fmtPct(v) },
    { key: 'cpm', label: 'CPM', render: v => fmtINRCompact(v) },
    { key: 'gaRevenue', label: 'GA4 Rev', render: v => fmtINRCompact(v), color: () => 'var(--purple)' },
    { key: 'roasGA4', label: 'GA4 ROAS', render: v => fmtX(v), color: v => v >= 4 ? 'var(--green)' : v >= 2 ? 'var(--amber)' : 'var(--red)' },
    { key: 'roasGap', label: 'Gap %', render: v => v != null ? `+${v?.toFixed(1)}%` : '—', color: v => v > 30 ? 'var(--red)' : v > 15 ? 'var(--amber)' : 'var(--text2)' },
    { key: 'gaOrders', label: 'Orders', render: v => fmtNum(v) },
    { key: 'cpa', label: 'CPA', render: v => fmtINRCompact(v) },
  ]

  const adsetCols = [
    { key: 'adsetName', label: 'Ad set', align: 'left', bold: true },
    ...campaignCols.slice(1)
  ]

  const adCols = [
    { key: 'adName', label: 'Ad name', align: 'left', bold: true },
    { key: 'cohort', label: 'Cohort', render: v => v ? <span className="pill pill-meta">{v}</span> : '—' },
    { key: 'format', label: 'Format' },
    { key: 'product', label: 'Product' },
    { key: 'contentType', label: 'Type' },
    { key: 'creator', label: 'Creator' },
    { key: 'spend', label: 'Spend', render: v => fmtINRCompact(v) },
    { key: 'impressions', label: 'Impr.', render: v => fmtNum(v) },
    { key: 'ctr', label: 'CTR', render: v => fmtPct(v), color: v => v > 0.02 ? 'var(--green)' : v > 0.01 ? 'var(--amber)' : 'var(--red)' },
    { key: 'cpc', label: 'CPC', render: v => fmtINRCompact(v) },
    { key: 'cpm', label: 'CPM', render: v => fmtINRCompact(v) },
    { key: 'roasGA4', label: 'GA4 ROAS', render: v => fmtX(v), color: v => v >= 4 ? 'var(--green)' : v >= 2 ? 'var(--amber)' : 'var(--red)' },
    { key: 'roasGap', label: 'Gap %', render: v => v != null ? `+${v?.toFixed(1)}%` : '—', color: v => v > 30 ? 'var(--red)' : v > 15 ? 'var(--amber)' : 'var(--text2)' },
    { key: 'gaRevenue', label: 'GA4 Rev', render: v => fmtINRCompact(v) },
    { key: 'gaOrders', label: 'Orders', render: v => fmtNum(v) },
    { key: 'cpa', label: 'CPA', render: v => fmtINRCompact(v) },
    { key: 'saleTag', label: 'Tag' },
  ]

  const tableData = level === 'Campaign' ? campaignGroups : level === 'Ad set' ? adsetGroups : adRows
  const tableCols = level === 'Campaign' ? campaignCols : level === 'Ad set' ? adsetCols : adCols

  return (
    <div style={{ padding: '28px 32px' }}>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.025em', color: 'var(--text)', marginBottom: 2 }}>Meta campaigns</h1>
        <div style={{ fontSize: 12, color: 'var(--text3)' }}>GA4 ROAS — source of truth</div>
      </div>
      <FilterBar filters={filters} showAdvanced />

      {/* Totals */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0,1fr))', gap: 10, marginBottom: 16 }}>
        <MetricCard label="Spend" value={fmtINRCompact(totals.spend)} accent="var(--pink)" />
        <MetricCard label="GA4 ROAS" value={fmtX(totals.roasGA4)} accent="var(--purple)" sublabel="Source of truth" />
        <MetricCard label="CPA (GA4)" value={fmtINRCompact(totals.cpa)} accent="var(--pink)" />
      </div>

      {/* Level switcher */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        {LEVELS.map(l => (
          <button key={l} onClick={() => { setLevel(l); setDrillKey(null) }}
            style={{
              padding: '5px 14px', fontSize: 12, borderRadius: 6, cursor: 'pointer',
              background: level === l ? 'var(--pink)' : 'var(--bg3)',
              color: level === l ? '#fff' : 'var(--text2)',
              border: `0.5px solid ${level === l ? 'var(--pink)' : 'var(--border2)'}`,
              fontWeight: level === l ? 500 : 400
            }}>
            {l}
          </button>
        ))}
        {drillKey && (
          <span style={{ fontSize: 12, color: 'var(--text3)', marginLeft: 8 }}>
            Filtering: <strong style={{ color: 'var(--text)' }}>{drillKey}</strong>
            <button onClick={() => setDrillKey(null)} style={{ marginLeft: 6, fontSize: 11, color: 'var(--text3)', background: 'none', border: 'none', cursor: 'pointer' }}>✕ clear</button>
          </span>
        )}
      </div>

      <DrillTable
        columns={tableCols}
        data={tableData}
        defaultSort={{ key: 'spend', dir: 'desc' }}
        onRowClick={row => {
          if (level === 'Campaign') { setDrillKey(row.campaignName); setLevel('Ad set') }
          if (level === 'Ad set') { setDrillKey(row.adsetName); setLevel('Ad') }
        }}
      />
    </div>
  )
}
