import React, { useMemo, useState } from 'react'
import { useData } from '../data/store.jsx'
import { useFilters } from '../hooks/useFilters.js'
import FilterBar from '../components/FilterBar.jsx'
import { aggregateRows, calcROAS } from '../utils/metrics.js'
import { fmtINRCompact, fmtX, fmtPct, fmtNum } from '../utils/formatters.js'

const COHORTS = ['ACQ', 'REM', 'RET']
const COHORT_COLORS = { ACQ: 'var(--blue)', REM: 'var(--amber)', RET: 'var(--green)' }
const COHORT_BG = { ACQ: '66,133,244', REM: '245,158,11', RET: '29,185,84' }

const Y_DIMS = [
  { key: 'product', label: 'Product' },
  { key: 'format', label: 'Format' },
  { key: 'contentType', label: 'Content type' },
  { key: 'creator', label: 'Creator' },
  { key: 'saleTag', label: 'BAU vs Sale' },
]

// All metrics shown per cohort column group
const COL_METRICS = [
  { key: 'spend', label: 'Spend', fmt: v => fmtINRCompact(v), color: () => 'var(--text)' },
  { key: 'spendPct', label: 'Spend %', fmt: v => v > 0 ? `${v.toFixed(1)}%` : '—', color: () => 'var(--text2)' },
  { key: 'impressions', label: 'Impr.', fmt: v => fmtNum(v), color: () => 'var(--text2)' },
  { key: 'cpm', label: 'CPM', fmt: v => v > 0 ? fmtINRCompact(v) : '—', color: () => 'var(--text2)' },
  { key: 'ctr', label: 'CTR', fmt: v => v > 0 ? fmtPct(v) : '—', color: v => v >= 0.02 ? 'var(--green)' : v >= 0.01 ? 'var(--amber)' : v > 0 ? 'var(--red)' : 'var(--text3)' },
  { key: 'cpc', label: 'CPC', fmt: v => v > 0 ? fmtINRCompact(v) : '—', color: () => 'var(--text2)' },
  { key: 'roas1dc', label: '1DC ROAS', fmt: v => v > 0 ? fmtX(v) : '—', color: v => v >= 3 ? 'var(--green)' : v >= 1.5 ? 'var(--amber)' : v > 0 ? 'var(--red)' : 'var(--text3)' },
  { key: 'roasGA4', label: 'GA4 ROAS', fmt: v => v > 0 ? fmtX(v) : '—', color: v => v >= 3 ? 'var(--green)' : v >= 1.5 ? 'var(--amber)' : v > 0 ? 'var(--red)' : 'var(--text3)' },
  { key: 'gaRevenue', label: 'GA4 Rev', fmt: v => v > 0 ? fmtINRCompact(v) : '—', color: () => 'var(--purple)' },
  { key: 'orders', label: 'Orders', fmt: v => v > 0 ? fmtNum(v) : '—', color: () => 'var(--text2)' },
  { key: 'cpa', label: 'CPA', fmt: v => v > 0 ? fmtINRCompact(v) : '—', color: () => 'var(--text2)' },
  { key: 'ecr', label: 'ECR', fmt: v => v > 0 ? fmtPct(v) : '—', color: () => 'var(--text2)' },
  { key: 'creatives', label: 'Creatives', fmt: v => v > 0 ? fmtNum(v) : '—', color: () => 'var(--text2)' },
]

function buildCohortData(rows, totalSpend) {
  const agg = aggregateRows(rows)
  const spend = agg.spend || 0
  return {
    spend,
    spendPct: totalSpend > 0 ? spend / totalSpend * 100 : 0,
    impressions: agg.impressions || 0,
    cpm: agg.impressions > 0 ? (spend / agg.impressions) * 1000 : 0,
    ctr: agg.impressions > 0 ? agg.clicks / agg.impressions : 0,
    cpc: agg.clicks > 0 ? spend / agg.clicks : 0,
    roas1dc: calcROAS(agg.fbRevenue, spend),
    roasGA4: calcROAS(agg.gaRevenue, spend),
    gaRevenue: agg.gaRevenue || 0,
    orders: agg.gaOrders || 0,
    cpa: agg.gaOrders > 0 ? spend / agg.gaOrders : 0,
    ecr: agg.sessions > 0 ? agg.gaOrders / agg.sessions : 0,
    creatives: [...new Set(rows.map(r => r.creativeName || r.adName))].length,
  }
}

export default function MetaCohortMatrix() {
  const { state } = useData()
  const filters = useFilters('last7')
  const { filterRows } = filters
  const [yDim, setYDim] = useState('product')
  const [search, setSearch] = useState('')

  const rows = useMemo(() => filterRows(state.metaDB), [state.metaDB, filters])
  const totalSpend = useMemo(() => rows.reduce((s, r) => s + r.spend, 0), [rows])

  // Cohort summary cards
  const cohortSummary = useMemo(() =>
    COHORTS.map(c => {
      const cr = rows.filter(r => r.cohort === c)
      return { cohort: c, ...buildCohortData(cr, totalSpend) }
    }), [rows, totalSpend])

  // Matrix rows
  const matrixRows = useMemo(() => {
    const dimVals = [...new Set(rows.map(r => r[yDim] || 'Unknown'))].filter(Boolean)
    return dimVals.map(val => {
      const valRows = rows.filter(r => (r[yDim] || 'Unknown') === val)
      const cohortData = {}
      COHORTS.forEach(c => {
        cohortData[c] = buildCohortData(valRows.filter(r => r.cohort === c), totalSpend)
      })
      return { dimVal: val, totalSpend: valRows.reduce((s, r) => s + r.spend, 0), ...cohortData }
    })
    .filter(r => search ? r.dimVal.toLowerCase().includes(search.toLowerCase()) : true)
    .sort((a, b) => b.totalSpend - a.totalSpend)
  }, [rows, yDim, totalSpend, search])

  const thBase = {
    padding: '7px 10px', fontSize: 10, fontWeight: 600, color: 'var(--text3)',
    textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap',
    background: 'var(--bg3)', borderBottom: '0.5px solid var(--border2)',
    textAlign: 'right', position: 'sticky', top: 0, zIndex: 2,
  }
  const tdBase = {
    padding: '6px 10px', fontSize: 12, borderBottom: '0.5px solid var(--border)',
    whiteSpace: 'nowrap', textAlign: 'right',
  }

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 18, fontWeight: 600, marginBottom: 2 }}>Meta cohort matrix</h1>
        <div style={{ fontSize: 12, color: 'var(--text3)' }}>
          Y axis: dimension · X axis: ACQ / REM / RET · all metrics per cohort
        </div>
      </div>

      <FilterBar filters={filters} showCohort={false} />

      {/* Cohort summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 10, marginBottom: 16 }}>
        {cohortSummary.map(c => (
          <div key={c.cohort} style={{
            background: 'var(--bg2)',
            border: `0.5px solid ${COHORT_COLORS[c.cohort]}40`,
            borderRadius: 'var(--radius-lg)', padding: '12px 16px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: COHORT_COLORS[c.cohort] }}>{c.cohort}</span>
              <span style={{ fontSize: 11, color: 'var(--text3)' }}>{c.spendPct.toFixed(1)}% of spend</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 12px' }}>
              {[
                ['Spend', fmtINRCompact(c.spend)],
                ['Creatives', fmtNum(c.creatives)],
                ['GA4 ROAS', fmtX(c.roasGA4)],
                ['1DC ROAS', fmtX(c.roas1dc)],
                ['CPA', fmtINRCompact(c.cpa)],
                ['Orders', fmtNum(c.orders)],
                ['CTR', fmtPct(c.ctr)],
                ['CPC', fmtINRCompact(c.cpc)],
                ['CPM', fmtINRCompact(c.cpm)],
                ['ECR', fmtPct(c.ecr)],
              ].map(([label, val]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: '0.5px solid var(--border)', fontSize: 11 }}>
                  <span style={{ color: 'var(--text3)' }}>{label}</span>
                  <span style={{ fontWeight: 500, color: 'var(--text)' }}>{val}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Dimension selector + search */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12, color: 'var(--text2)' }}>Rows:</span>
          {Y_DIMS.map(d => (
            <button key={d.key} onClick={() => { setYDim(d.key); setSearch('') }} style={{
              padding: '4px 12px', fontSize: 12, borderRadius: 20, cursor: 'pointer',
              background: yDim === d.key ? 'var(--pink-dim)' : 'transparent',
              color: yDim === d.key ? 'var(--pink)' : 'var(--text2)',
              border: `0.5px solid ${yDim === d.key ? 'var(--pink-border)' : 'var(--border)'}`,
              fontWeight: yDim === d.key ? 500 : 400,
            }}>{d.label}</button>
          ))}
        </div>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder={`Search ${Y_DIMS.find(d => d.key === yDim)?.label.toLowerCase()}...`}
          style={{
            padding: '5px 10px', fontSize: 12, borderRadius: 6, marginLeft: 'auto',
            background: 'var(--bg3)', border: '0.5px solid var(--border2)',
            color: 'var(--text)', outline: 'none', width: 200,
          }} />
      </div>

      {/* Matrix table */}
      {matrixRows.length === 0 ? (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text3)', fontSize: 13, background: 'var(--bg2)', borderRadius: 10, border: '0.5px dashed var(--border2)' }}>
          Upload Meta daily CSV to see the cohort matrix
        </div>
      ) : (
        <div style={{ overflowX: 'auto', borderRadius: 10, border: '0.5px solid var(--border)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              {/* Row 1 — cohort group headers */}
              <tr>
                <th rowSpan={2} style={{ ...thBase, textAlign: 'left', minWidth: 140, position: 'sticky', left: 0, zIndex: 3, borderRight: '0.5px solid var(--border2)' }}>
                  {Y_DIMS.find(d => d.key === yDim)?.label}
                </th>
                {COHORTS.map(c => (
                  <th key={c} colSpan={COL_METRICS.length} style={{
                    ...thBase, textAlign: 'center',
                    color: COHORT_COLORS[c],
                    borderLeft: '1.5px solid var(--border2)',
                    background: `rgba(${COHORT_BG[c]},0.08)`,
                    fontSize: 12, fontWeight: 600, letterSpacing: '0.08em',
                  }}>{c}</th>
                ))}
              </tr>
              {/* Row 2 — metric sub-headers per cohort */}
              <tr>
                {COHORTS.map(c =>
                  COL_METRICS.map((m, mi) => (
                    <th key={c+m.key} style={{
                      ...thBase,
                      borderLeft: mi === 0 ? '1.5px solid var(--border2)' : 'none',
                      background: `rgba(${COHORT_BG[c]},0.04)`,
                      color: 'var(--text3)',
                    }}>{m.label}</th>
                  ))
                )}
              </tr>
            </thead>
            <tbody>
              {matrixRows.map((row, ri) => (
                <tr key={ri}
                  style={{ background: ri % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.012)' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg3)'}
                  onMouseLeave={e => e.currentTarget.style.background = ri % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.012)'}
                >
                  <td style={{ ...tdBase, textAlign: 'left', fontWeight: 500, position: 'sticky', left: 0, background: 'var(--bg2)', borderRight: '0.5px solid var(--border2)', zIndex: 1, minWidth: 140 }}>
                    {row.dimVal}
                  </td>
                  {COHORTS.map(c =>
                    COL_METRICS.map((m, mi) => {
                      const val = row[c]?.[m.key] || 0
                      return (
                        <td key={c+m.key} style={{
                          ...tdBase,
                          borderLeft: mi === 0 ? '1.5px solid var(--border2)' : 'none',
                          color: row[c]?.spend > 0 ? m.color(val) : 'var(--text3)',
                          background: mi === 0 && row[c]?.spend > 0 ? `rgba(${COHORT_BG[c]},0.05)` : 'transparent',
                        }}>
                          {row[c]?.spend > 0 ? m.fmt(val) : '—'}
                        </td>
                      )
                    })
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text3)' }}>
        {matrixRows.length} rows · scroll right to see all cohort metrics
      </div>
    </div>
  )
}
