import React, { useMemo, useState } from 'react'
import { useData } from '../data/store.jsx'
import { useFilters } from '../hooks/useFilters.js'
import FilterBar from '../components/FilterBar.jsx'
import { aggregateRows, calcROAS } from '../utils/metrics.js'
import { fmtINRCompact, fmtX, fmtPct, fmtNum } from '../utils/formatters.js'

const COHORTS = ['ACQ', 'REM', 'RET']
const COHORT_COLOR = { ACQ: '#3b82f6', REM: '#f59e0b', RET: '#22c55e' }
const COHORT_BG    = { ACQ: 'rgba(59,130,246,0.08)', REM: 'rgba(245,158,11,0.08)', RET: 'rgba(34,197,94,0.08)' }
const COHORT_BORDER= { ACQ: 'rgba(59,130,246,0.2)',  REM: 'rgba(245,158,11,0.2)',  RET: 'rgba(34,197,94,0.2)' }
const COHORT_LABEL = { ACQ: 'Acquisition', REM: 'Remarketing', RET: 'Retention' }

const Y_DIMS = [
  { key: 'product',     label: 'Product' },
  { key: 'format',      label: 'Format' },
  { key: 'contentType', label: 'Content Type' },
  { key: 'creator',     label: 'Creator' },
  { key: 'saleTag',     label: 'BAU vs Sale' },
]

const METRICS = [
  { key: 'spend',      label: 'Spend',     fmt: fmtINRCompact },
  { key: 'spendPct',   label: 'Spend %',   fmt: v => v > 0 ? `${v.toFixed(1)}%` : '—' },
  { key: 'cpm',        label: 'CPM',       fmt: v => v > 0 ? fmtINRCompact(v) : '—' },
  { key: 'ctr',        label: 'CTR',       fmt: v => v > 0 ? fmtPct(v) : '—' },
  { key: 'cpc',        label: 'CPC',       fmt: v => v > 0 ? fmtINRCompact(v) : '—' },
  { key: 'roas1dc',    label: '1DC ROAS',  fmt: v => v > 0 ? fmtX(v) : '—' },
  { key: 'roasGA4',    label: 'GA4 ROAS',  fmt: v => v > 0 ? fmtX(v) : '—' },
  { key: 'gaRevenue',  label: 'GA4 Rev',   fmt: v => v > 0 ? fmtINRCompact(v) : '—' },
  { key: 'orders',     label: 'Orders',    fmt: v => v > 0 ? fmtNum(v) : '—' },
  { key: 'cpa',        label: 'CPA',       fmt: v => v > 0 ? fmtINRCompact(v) : '—' },
  { key: 'ecr',        label: 'ECR',       fmt: v => v > 0 ? fmtPct(v) : '—' },
  { key: 'creatives',  label: 'Creatives', fmt: v => v > 0 ? String(v) : '—' },
]

function buildMetrics(rows, totalSpend) {
  const agg = aggregateRows(rows)
  const spend = agg.spend || 0
  return {
    spend,
    spendPct:  totalSpend > 0 ? (spend / totalSpend) * 100 : 0,
    impressions: agg.impressions || 0,
    cpm:       agg.impressions > 0 ? (spend / agg.impressions) * 1000 : 0,
    ctr:       agg.impressions > 0 ? (agg.clicks || 0) / agg.impressions : 0,
    cpc:       (agg.clicks || 0) > 0 ? spend / agg.clicks : 0,
    roas1dc:   calcROAS(agg.fbRevenue, spend),
    roasGA4:   calcROAS(agg.gaRevenue, spend),
    gaRevenue: agg.gaRevenue || 0,
    orders:    agg.gaOrders  || 0,
    cpa:       (agg.gaOrders || 0) > 0 ? spend / agg.gaOrders : 0,
    ecr:       (agg.sessions || 0) > 0 ? (agg.gaOrders || 0) / agg.sessions : 0,
    creatives: [...new Set(rows.map(r => r.creativeName || r.adName))].filter(Boolean).length,
  }
}

// ── Cohort summary card ────────────────────────────────────────────────────────
function CohortCard({ cohort, data, totalSpend }) {
  const color  = COHORT_COLOR[cohort]
  const bg     = COHORT_BG[cohort]
  const border = COHORT_BORDER[cohort]
  return (
    <div style={{
      background: bg, border: `1px solid ${border}`,
      borderRadius: 12, padding: '16px 20px', flex: 1, minWidth: 200,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
        <span style={{ fontSize: 13, fontWeight: 700, color }}>{cohort}</span>
        <span style={{ fontSize: 11, color: '#64748b' }}>{COHORT_LABEL[cohort]}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px' }}>
        {[
          { label: 'Spend',    val: fmtINRCompact(data.spend) },
          { label: 'Spend %',  val: data.spendPct > 0 ? `${data.spendPct.toFixed(1)}%` : '—' },
          { label: 'GA4 ROAS', val: data.roasGA4 > 0 ? fmtX(data.roasGA4) : '—' },
          { label: '1DC ROAS', val: data.roas1dc > 0 ? fmtX(data.roas1dc) : '—' },
          { label: 'CPC',      val: data.cpc > 0 ? fmtINRCompact(data.cpc) : '—' },
          { label: 'CPA',      val: data.cpa > 0 ? fmtINRCompact(data.cpa) : '—' },
          { label: 'Orders',   val: data.orders > 0 ? fmtNum(data.orders) : '—' },
          { label: 'Creatives',val: data.creatives > 0 ? String(data.creatives) : '—' },
        ].map(({ label, val }) => (
          <div key={label}>
            <div style={{ fontSize: 10, color: '#475569', textTransform: 'uppercase', letterSpacing: 0.6 }}>{label}</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>{val}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Matrix table for one cohort (vertical layout) ─────────────────────────────
function CohortBlock({ cohort, matrixRows, yDim }) {
  const color  = COHORT_COLOR[cohort]
  const bg     = COHORT_BG[cohort]
  const border = COHORT_BORDER[cohort]

  return (
    <div style={{
      border: `1px solid ${border}`,
      borderRadius: 12, overflow: 'hidden', marginBottom: 16,
    }}>
      {/* Cohort header */}
      <div style={{
        background: bg, borderBottom: `1px solid ${border}`,
        padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
        <span style={{ fontSize: 13, fontWeight: 700, color }}>{cohort}</span>
        <span style={{ fontSize: 12, color: '#64748b' }}>— {COHORT_LABEL[cohort]}</span>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
              <th style={{ ...TH, textAlign: 'left', minWidth: 160 }}>
                {Y_DIMS.find(d => d.key === yDim)?.label}
              </th>
              {METRICS.map(m => (
                <th key={m.key} style={TH}>{m.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrixRows.map((row, i) => {
              const d = row[cohort]
              if (!d) return null
              return (
                <tr key={row.dimVal}
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.04)',
                    background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)' }}
                >
                  <td style={{ ...TD, textAlign: 'left', fontWeight: 500, color: '#cbd5e1' }}>
                    {row.dimVal}
                  </td>
                  {METRICS.map(m => (
                    <td key={m.key} style={{ ...TD, color: metricColor(m.key, d[m.key]) }}>
                      {d.spend > 0 ? m.fmt(d[m.key]) : '—'}
                    </td>
                  ))}
                </tr>
              )
            })}
            {matrixRows.length === 0 && (
              <tr><td colSpan={METRICS.length + 1} style={{ ...TD, textAlign: 'center', color: '#475569', padding: 24 }}>
                No data for this cohort
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const TH = {
  padding: '8px 12px', fontSize: 10, fontWeight: 600, color: '#64748b',
  textTransform: 'uppercase', letterSpacing: 0.6, whiteSpace: 'nowrap',
  textAlign: 'right', borderBottom: '1px solid rgba(255,255,255,0.07)',
}
const TD = {
  padding: '8px 12px', whiteSpace: 'nowrap', textAlign: 'right', fontSize: 12,
}

function metricColor(key, val) {
  if (!val || val === 0) return '#475569'
  if (key === 'roasGA4' || key === 'roas1dc') return val >= 3 ? '#22c55e' : val >= 1.5 ? '#fbbf24' : '#ef4444'
  if (key === 'ctr') return val >= 0.02 ? '#22c55e' : val >= 0.01 ? '#fbbf24' : '#ef4444'
  if (key === 'gaRevenue') return '#a78bfa'
  if (key === 'spend') return '#e2e8f0'
  return '#94a3b8'
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function MetaCohortMatrix() {
  const { state }  = useData()
  const filters    = useFilters('last7')
  const { filterRows } = filters
  const [yDim, setYDim]     = useState('product')
  const [search, setSearch] = useState('')

  const rows       = useMemo(() => filterRows(state.metaDB), [state.metaDB, filters])
  const totalSpend = useMemo(() => rows.reduce((s, r) => s + (r.spend || 0), 0), [rows])

  // Cohort summary cards
  const cohortSummary = useMemo(() =>
    Object.fromEntries(COHORTS.map(c => [
      c, buildMetrics(rows.filter(r => r.cohort === c), totalSpend)
    ])), [rows, totalSpend])

  // Matrix rows — one entry per dimension value, each with ACQ/REM/RET sub-data
  const matrixRows = useMemo(() => {
    const dimVals = [...new Set(rows.map(r => r[yDim] || 'Unknown'))].filter(Boolean)
    return dimVals
      .map(val => {
        const valRows = rows.filter(r => (r[yDim] || 'Unknown') === val)
        const entry = {
          dimVal: val,
          totalSpend: valRows.reduce((s, r) => s + (r.spend || 0), 0),
        }
        COHORTS.forEach(c => {
          entry[c] = buildMetrics(valRows.filter(r => r.cohort === c), totalSpend)
        })
        return entry
      })
      .filter(r => !search || r.dimVal.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => b.totalSpend - a.totalSpend)
  }, [rows, yDim, totalSpend, search])

  const hasData = rows.length > 0

  return (
    <div style={{ padding: '24px 28px', background: '#090e1a', minHeight: '100vh', color: '#e2e8f0', fontFamily: 'system-ui, sans-serif' }}>

      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Cohort Matrix</h1>
        <div style={{ fontSize: 13, color: '#64748b' }}>ACQ · REM · RET breakdown across all dimensions</div>
      </div>

      <FilterBar filters={filters} />

      {!hasData && (
        <div style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)', borderRadius: 10, padding: '14px 18px', margin: '20px 0', color: '#fbbf24', fontSize: 13 }}>
          ⚠️ Upload a Meta CSV to see cohort data.
        </div>
      )}

      {/* Cohort summary cards — 3 stacked horizontally */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 28, flexWrap: 'wrap' }}>
        {COHORTS.map(c => (
          <CohortCard key={c} cohort={c} data={cohortSummary[c] || {}} totalSpend={totalSpend} />
        ))}
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        {/* Dimension tabs */}
        <div style={{ display: 'flex', gap: 6 }}>
          {Y_DIMS.map(d => (
            <button key={d.key} onClick={() => setYDim(d.key)} style={{
              background: yDim === d.key ? 'rgba(244,114,182,0.2)' : 'rgba(255,255,255,0.05)',
              border: yDim === d.key ? '1px solid rgba(244,114,182,0.5)' : '1px solid rgba(255,255,255,0.1)',
              color: yDim === d.key ? '#f472b6' : '#94a3b8',
              borderRadius: 20, padding: '5px 14px', fontSize: 12, cursor: 'pointer',
            }}>{d.label}</button>
          ))}
        </div>

        {/* Search */}
        <input
          placeholder={`Search ${Y_DIMS.find(d => d.key === yDim)?.label}...`}
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
            color: '#e2e8f0', borderRadius: 8, padding: '6px 12px', fontSize: 12,
            outline: 'none', minWidth: 220,
          }}
        />
        <span style={{ fontSize: 12, color: '#475569' }}>{matrixRows.length} rows</span>
      </div>

      {/* Three cohort blocks stacked vertically — ACQ then REM then RET */}
      {COHORTS.map(c => (
        <CohortBlock key={c} cohort={c} matrixRows={matrixRows} yDim={yDim} />
      ))}
    </div>
  )
}
