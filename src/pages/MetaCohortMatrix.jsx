import React, { useMemo, useState } from 'react'
import { useData } from '../data/store.jsx'
import { useFilters } from '../hooks/useFilters.js'
import FilterBar from '../components/FilterBar.jsx'
import DrillTable from '../components/DrillTable.jsx'
import MetricCard from '../components/MetricCard.jsx'
import { aggregateRows, calcROAS } from '../utils/metrics.js'
import { fmtINRCompact, fmtX, fmtPct, fmtNum, deltaLabel } from '../utils/formatters.js'

const COHORTS = ['ACQ', 'REM', 'RET']
const DIMENSIONS = [
  { key: 'format', label: 'Format' },
  { key: 'product', label: 'Product' },
  { key: 'contentType', label: 'Content type' },
  { key: 'creator', label: 'Creator' },
]
const METRICS = [
  { key: 'spend', label: 'Spend', fmt: v => fmtINRCompact(v) },
  { key: 'spendPct', label: 'Spend %', fmt: v => `${v.toFixed(1)}%` },
  { key: 'roas1dc', label: '1DC ROAS', fmt: v => fmtX(v) },
  { key: 'roasGA4', label: 'GA4 ROAS', fmt: v => fmtX(v) },
  { key: 'cpa', label: 'CPA', fmt: v => fmtINRCompact(v) },
  { key: 'ctr', label: 'CTR', fmt: v => fmtPct(v) },
  { key: 'cpc', label: 'CPC', fmt: v => fmtINRCompact(v) },
]

function buildMatrix(rows, dim) {
  // Get all unique dimension values
  const dimVals = [...new Set(rows.map(r => r[dim] || 'Unknown'))].filter(Boolean).sort()

  // For each dim value, aggregate per cohort
  const matrix = dimVals.map(val => {
    const valRows = rows.filter(r => (r[dim] || 'Unknown') === val)
    const total = aggregateRows(valRows)
    const totalSpend = rows.reduce((s, r) => s + r.spend, 0)

    const cohortData = {}
    COHORTS.forEach(c => {
      const cr = valRows.filter(r => r.cohort === c)
      const agg = aggregateRows(cr)
      cohortData[c] = {
        spend: agg.spend,
        spendPct: totalSpend > 0 ? agg.spend / totalSpend * 100 : 0,
        roas1dc: calcROAS(agg.fbRevenue, agg.spend),
        roasGA4: calcROAS(agg.gaRevenue, agg.spend),
        cpa: agg.gaOrders > 0 ? agg.spend / agg.gaOrders : 0,
        ctr: agg.impressions > 0 ? agg.clicks / agg.impressions : 0,
        cpc: agg.clicks > 0 ? agg.spend / agg.clicks : 0,
        orders: agg.gaOrders,
        gaRevenue: agg.gaRevenue,
      }
    })

    return {
      dimVal: val,
      total: {
        spend: total.spend,
        spendPct: totalSpend > 0 ? total.spend / totalSpend * 100 : 0,
        roas1dc: calcROAS(total.fbRevenue, total.spend),
        roasGA4: calcROAS(total.gaRevenue, total.spend),
        cpa: total.gaOrders > 0 ? total.spend / total.gaOrders : 0,
        ctr: total.impressions > 0 ? total.clicks / total.impressions : 0,
        cpc: total.clicks > 0 ? total.spend / total.clicks : 0,
      },
      ...cohortData,
    }
  }).sort((a, b) => b.total.spend - a.total.spend)

  return matrix
}

function roasColor(v) {
  if (!v || v === 0) return 'var(--text3)'
  if (v >= 3) return 'var(--green)'
  if (v >= 1.5) return 'var(--amber)'
  return 'var(--red)'
}

function ctrColor(v) {
  if (!v || v === 0) return 'var(--text3)'
  if (v >= 0.02) return 'var(--green)'
  if (v >= 0.01) return 'var(--amber)'
  return 'var(--red)'
}

export default function MetaCohortMatrix() {
  const { state } = useData()
  const filters = useFilters('last7')
  const { filterRows } = filters
  const [dim, setDim] = useState('format')
  const [metric, setMetric] = useState('roasGA4')

  const rows = useMemo(() => filterRows(state.metaDB), [state.metaDB, filters])
  const matrix = useMemo(() => buildMatrix(rows, dim), [rows, dim])

  // Summary per cohort
  const cohortSummary = useMemo(() => {
    return COHORTS.map(c => {
      const cr = rows.filter(r => r.cohort === c)
      const agg = aggregateRows(cr)
      const totalSpend = rows.reduce((s, r) => s + r.spend, 0)
      return {
        cohort: c,
        spend: agg.spend,
        spendPct: totalSpend > 0 ? agg.spend / totalSpend * 100 : 0,
        roas1dc: calcROAS(agg.fbRevenue, agg.spend),
        roasGA4: calcROAS(agg.gaRevenue, agg.spend),
        cpa: agg.gaOrders > 0 ? agg.spend / agg.gaOrders : 0,
        orders: agg.gaOrders,
        gaRevenue: agg.gaRevenue,
        ctr: agg.impressions > 0 ? agg.clicks / agg.impressions : 0,
        cpc: agg.clicks > 0 ? agg.spend / agg.clicks : 0,
        impressions: agg.impressions,
        creatives: [...new Set(cr.map(r => r.creativeName))].length,
      }
    })
  }, [rows])

  const metricFmt = METRICS.find(m => m.key === metric)?.fmt || (v => v)
  const maxVal = Math.max(...matrix.flatMap(row => COHORTS.map(c => row[c]?.[metric] || 0)), 0.01)

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 18, fontWeight: 600, marginBottom: 2 }}>Meta cohort matrix</h1>
        <div style={{ fontSize: 12, color: 'var(--text3)' }}>Cohort × Format · Product · Content type · Creator</div>
      </div>

      <FilterBar filters={filters} showCohort={false} />

      {/* Cohort summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 10, marginBottom: 16 }}>
        {cohortSummary.map(c => (
          <div key={c.cohort} style={{
            background: 'var(--bg2)', border: '0.5px solid var(--border)',
            borderRadius: 'var(--radius-lg)', padding: '14px 16px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: c.cohort === 'ACQ' ? 'var(--blue)' : c.cohort === 'REM' ? 'var(--amber)' : 'var(--green)' }}>{c.cohort}</span>
              <span style={{ fontSize: 11, color: 'var(--text3)' }}>{c.spendPct.toFixed(1)}% of spend</span>
            </div>
            {[
              ['Spend', fmtINRCompact(c.spend)],
              ['GA4 ROAS', fmtX(c.roasGA4)],
              ['1DC ROAS', fmtX(c.roas1dc)],
              ['CPA', fmtINRCompact(c.cpa)],
              ['CTR', fmtPct(c.ctr)],
              ['CPC', fmtINRCompact(c.cpc)],
              ['Creatives', fmtNum(c.creatives)],
              ['Orders', fmtNum(c.orders)],
            ].map(([label, val]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '0.5px solid var(--border)', fontSize: 12 }}>
                <span style={{ color: 'var(--text2)' }}>{label}</span>
                <span style={{ fontWeight: 500 }}>{val}</span>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Dimension + metric selectors */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12, color: 'var(--text2)' }}>Breakdown:</span>
          {DIMENSIONS.map(d => (
            <button key={d.key} onClick={() => setDim(d.key)} style={{
              padding: '4px 12px', fontSize: 12, borderRadius: 20, cursor: 'pointer',
              background: dim === d.key ? 'var(--pink-dim)' : 'transparent',
              color: dim === d.key ? 'var(--pink)' : 'var(--text2)',
              border: `0.5px solid ${dim === d.key ? 'var(--pink-border)' : 'var(--border)'}`,
              fontWeight: dim === d.key ? 500 : 400,
            }}>{d.label}</button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12, color: 'var(--text2)' }}>Show:</span>
          {METRICS.map(m => (
            <button key={m.key} onClick={() => setMetric(m.key)} style={{
              padding: '4px 12px', fontSize: 12, borderRadius: 20, cursor: 'pointer',
              background: metric === m.key ? 'rgba(29,185,84,0.15)' : 'transparent',
              color: metric === m.key ? 'var(--green)' : 'var(--text2)',
              border: `0.5px solid ${metric === m.key ? 'rgba(29,185,84,0.4)' : 'var(--border)'}`,
              fontWeight: metric === m.key ? 500 : 400,
            }}>{m.label}</button>
          ))}
        </div>
      </div>

      {/* Cross-tab matrix */}
      {matrix.length === 0 ? (
        <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text3)', fontSize: 13, background: 'var(--bg2)', borderRadius: 'var(--radius-lg)', border: '0.5px dashed var(--border2)' }}>
          Upload Meta daily CSV to see the cohort matrix
        </div>
      ) : (
        <div style={{ overflowX: 'auto', borderRadius: 'var(--radius-lg)', border: '0.5px solid var(--border)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ ...th, textAlign: 'left', width: 160 }}>
                  {DIMENSIONS.find(d => d.key === dim)?.label}
                </th>
                {/* Total column */}
                <th style={{ ...th, background: 'rgba(255,255,255,0.04)' }}>Total</th>
                {/* Per cohort — 2 sub-columns each */}
                {COHORTS.map(c => (
                  <th key={c} colSpan={2} style={{
                    ...th,
                    color: c === 'ACQ' ? 'var(--blue)' : c === 'REM' ? 'var(--amber)' : 'var(--green)',
                    borderLeft: '0.5px solid var(--border2)',
                  }}>{c}</th>
                ))}
              </tr>
              <tr>
                <th style={{ ...th2, textAlign: 'left' }}></th>
                <th style={{ ...th2, background: 'rgba(255,255,255,0.04)' }}>
                  {METRICS.find(m => m.key === metric)?.label}
                </th>
                {COHORTS.map(c => [
                  <th key={c+'spend'} style={{ ...th2, borderLeft: '0.5px solid var(--border2)', fontSize: 10 }}>Spend</th>,
                  <th key={c+'metric'} style={{ ...th2, fontSize: 10 }}>
                    {METRICS.find(m => m.key === metric)?.label}
                  </th>
                ])}
              </tr>
            </thead>
            <tbody>
              {matrix.map((row, ri) => (
                <tr key={ri} style={{ background: ri % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)' }}>
                  <td style={{ ...td, fontWeight: 500, textAlign: 'left' }}>{row.dimVal}</td>
                  {/* Total */}
                  <td style={{ ...td, background: 'rgba(255,255,255,0.02)', color: metric.includes('roas') ? roasColor(row.total[metric]) : metric === 'ctr' ? ctrColor(row.total[metric]) : 'var(--text)', fontWeight: 500 }}>
                    {metricFmt(row.total[metric] || 0)}
                  </td>
                  {/* Per cohort */}
                  {COHORTS.map(c => {
                    const val = row[c]?.[metric] || 0
                    const intensity = maxVal > 0 ? val / maxVal : 0
                    const cohortColor = c === 'ACQ' ? '66,133,244' : c === 'REM' ? '245,158,11' : '29,185,84'
                    return [
                      <td key={c+'s'} style={{ ...td, borderLeft: '0.5px solid var(--border2)', color: 'var(--text2)', fontSize: 11 }}>
                        {row[c]?.spend > 0 ? fmtINRCompact(row[c].spend) : '—'}
                      </td>,
                      <td key={c+'m'} style={{
                        ...td,
                        background: val > 0 ? `rgba(${cohortColor},${(intensity * 0.25).toFixed(2)})` : 'transparent',
                        color: metric.includes('roas') ? roasColor(val) : metric === 'ctr' ? ctrColor(val) : 'var(--text)',
                        fontWeight: val > 0 ? 500 : 400,
                      }}>
                        {val > 0 ? metricFmt(val) : '—'}
                      </td>
                    ]
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Flat drill table below */}
      <div style={{ marginTop: 24, marginBottom: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Full breakdown — all rows</div>
        <div style={{ fontSize: 11, color: 'var(--text3)' }}>Every {DIMENSIONS.find(d => d.key === dim)?.label.toLowerCase()} × cohort combination · sortable</div>
      </div>
      <DrillTable
        compact
        columns={[
          { key: 'dimVal', label: DIMENSIONS.find(d => d.key === dim)?.label, align: 'left', bold: true },
          { key: 'cohort', label: 'Cohort', render: v => <span style={{ fontSize: 11, padding: '1px 7px', borderRadius: 8, background: v === 'ACQ' ? 'var(--blue-dim)' : v === 'REM' ? 'var(--amber-dim)' : 'var(--green-dim)', color: v === 'ACQ' ? 'var(--blue)' : v === 'REM' ? 'var(--amber)' : 'var(--green)' }}>{v}</span> },
          { key: 'spend', label: 'Spend', render: v => fmtINRCompact(v) },
          { key: 'spendPct', label: 'Spend %', render: v => `${v?.toFixed(1)}%` },
          { key: 'roas1dc', label: '1DC ROAS', render: v => fmtX(v) },
          { key: 'roasGA4', label: 'GA4 ROAS', render: v => fmtX(v), color: v => roasColor(v) },
          { key: 'cpa', label: 'CPA', render: v => fmtINRCompact(v) },
          { key: 'ctr', label: 'CTR', render: v => fmtPct(v), color: v => ctrColor(v) },
          { key: 'cpc', label: 'CPC', render: v => fmtINRCompact(v) },
          { key: 'orders', label: 'Orders', render: v => fmtNum(v) },
          { key: 'gaRevenue', label: 'GA4 Rev', render: v => fmtINRCompact(v) },
        ]}
        data={matrix.flatMap(row =>
          COHORTS.filter(c => row[c]?.spend > 0).map(c => ({
            dimVal: row.dimVal,
            cohort: c,
            spend: row[c].spend,
            spendPct: row[c].spendPct,
            roas1dc: row[c].roas1dc,
            roasGA4: row[c].roasGA4,
            cpa: row[c].cpa,
            ctr: row[c].ctr,
            cpc: row[c].cpc,
            orders: row[c].orders,
            gaRevenue: row[c].gaRevenue,
          }))
        )}
        defaultSort={{ key: 'spend', dir: 'desc' }}
      />
    </div>
  )
}

const th = {
  padding: '8px 12px', fontSize: 11, fontWeight: 600, color: 'var(--text2)',
  textTransform: 'uppercase', letterSpacing: '0.05em', background: 'var(--bg3)',
  borderBottom: '0.5px solid var(--border2)', whiteSpace: 'nowrap', textAlign: 'right',
  position: 'sticky', top: 0,
}
const th2 = {
  ...th, fontSize: 10, fontWeight: 400, color: 'var(--text3)', textAlign: 'right',
}
const td = {
  padding: '7px 12px', fontSize: 12, borderBottom: '0.5px solid var(--border)',
  whiteSpace: 'nowrap', textAlign: 'right', color: 'var(--text)',
}
