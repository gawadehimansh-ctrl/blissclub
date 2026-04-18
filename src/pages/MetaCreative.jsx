import React, { useMemo, useState } from 'react'
import { useData } from '../data/store.jsx'
import { useFilters } from '../hooks/useFilters.js'
import FilterBar from '../components/FilterBar.jsx'
import { aggregateRows, calcROAS } from '../utils/metrics.js'
import { fmtINRCompact, fmtX, fmtPct, fmtNum } from '../utils/formatters.js'

const PIVOT_DIMS = [
  { key: 'product',     label: 'Product' },
  { key: 'format',      label: 'Format' },
  { key: 'contentType', label: 'Content Type' },
  { key: 'creator',     label: 'Creator' },
  { key: 'cohort',      label: 'Cohort' },
]

function buildMetrics(rows, totalSpend) {
  const agg   = aggregateRows(rows)
  const spend = agg.spend || 0
  const days  = [...new Set(rows.map(r => r.date?.toString?.() || ''))].filter(Boolean).length || 1
  return {
    spend,
    spendMix:  totalSpend > 0 ? (spend / totalSpend) * 100 : 0,
    impressions: agg.impressions || 0,
    cpm:       (agg.impressions || 0) > 0 ? (spend / agg.impressions) * 1000 : 0,
    ctr:       (agg.impressions || 0) > 0 ? (agg.clicks || 0) / agg.impressions : 0,
    cpc:       (agg.clicks || 0) > 0 ? spend / agg.clicks : 0,
    roas1dc:   calcROAS(agg.fbRevenue, spend),
    roasGA4:   calcROAS(agg.gaRevenue, spend),
    gaRevenue: agg.gaRevenue || 0,
    orders:    agg.gaOrders  || 0,
    cpa:       (agg.gaOrders || 0) > 0 ? spend / agg.gaOrders : 0,
    ecr:       (agg.sessions || 0) > 0 ? (agg.gaOrders || 0) / agg.sessions : 0,
    creatives: [...new Set(rows.map(r => r.creativeName || r.adName))].filter(Boolean).length,
    daysRunning: days,
    avgDailySpend: spend / days,
  }
}

// Fatigue: creative running > X days with declining ROAS
function fatigueFlag(rows) {
  const days = [...new Set(rows.map(r => r.date?.toString?.() || ''))].filter(Boolean).length
  if (days < 7) return null
  const sorted = [...rows].sort((a, b) => new Date(a.date) - new Date(b.date))
  const half   = Math.floor(sorted.length / 2)
  const first  = sorted.slice(0, half)
  const second = sorted.slice(half)
  const r1 = calcROAS(first.reduce((s, r)  => s + (r.gaRevenue || 0), 0), first.reduce((s, r)  => s + (r.spend || 0), 0))
  const r2 = calcROAS(second.reduce((s, r) => s + (r.gaRevenue || 0), 0), second.reduce((s, r) => s + (r.spend || 0), 0))
  if (r1 > 0 && r2 > 0 && r2 < r1 * 0.75) return { days, drop: Math.round((1 - r2 / r1) * 100) }
  return null
}

// ── Format insight card ────────────────────────────────────────────────────────
function InsightCard({ icon, label, value, sub, color = '#f472b6' }) {
  return (
    <div style={{
      background: `${color}10`, border: `1px solid ${color}30`,
      borderRadius: 10, padding: '14px 18px', flex: 1, minWidth: 180,
    }}>
      <div style={{ fontSize: 18, marginBottom: 6 }}>{icon}</div>
      <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: '#64748b', marginTop: 3 }}>{sub}</div>}
    </div>
  )
}

// ── Top creatives table ────────────────────────────────────────────────────────
function CreativeRow({ name, rows, totalSpend, rank }) {
  const d       = buildMetrics(rows, totalSpend)
  const fatigue = fatigueFlag(rows)
  const sample  = rows[0] || {}

  return (
    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      <td style={{ ...TD, textAlign: 'left', paddingLeft: 16, minWidth: 280 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <span style={{ fontSize: 11, color: '#475569', minWidth: 20, marginTop: 2 }}>#{rank}</span>
          <div>
            <div style={{ fontSize: 12, color: '#cbd5e1', fontWeight: 500, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {name}
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
              {sample.cohort && <span style={{ background: 'rgba(59,130,246,0.15)', color: '#60a5fa', borderRadius: 10, padding: '1px 7px', fontSize: 10 }}>{sample.cohort}</span>}
              {sample.format && <span style={{ background: 'rgba(255,255,255,0.06)', color: '#94a3b8', borderRadius: 10, padding: '1px 7px', fontSize: 10 }}>{sample.format}</span>}
              {sample.contentType && <span style={{ background: 'rgba(255,255,255,0.06)', color: '#94a3b8', borderRadius: 10, padding: '1px 7px', fontSize: 10 }}>{sample.contentType}</span>}
              {fatigue && (
                <span style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171', borderRadius: 10, padding: '1px 7px', fontSize: 10, fontWeight: 600 }}>
                  ⚠ Fatigue ({fatigue.days}d, -{fatigue.drop}% ROAS)
                </span>
              )}
            </div>
          </div>
        </div>
      </td>
      <td style={{ ...TD, color: '#a78bfa' }}>{fmtINRCompact(d.gaRevenue)}</td>
      <td style={{ ...TD, color: d.roasGA4 >= 3 ? '#22c55e' : d.roasGA4 >= 1.5 ? '#fbbf24' : '#ef4444' }}>{d.roasGA4 > 0 ? fmtX(d.roasGA4) : '—'}</td>
      <td style={{ ...TD, color: d.roas1dc >= 3 ? '#22c55e' : d.roas1dc >= 1.5 ? '#fbbf24' : '#ef4444' }}>{d.roas1dc > 0 ? fmtX(d.roas1dc) : '—'}</td>
      <td style={{ ...TD }}>{fmtINRCompact(d.spend)}</td>
      <td style={{ ...TD, color: '#64748b' }}>{d.spendMix.toFixed(1)}%</td>
      <td style={{ ...TD }}>{d.cpc > 0 ? fmtINRCompact(d.cpc) : '—'}</td>
      <td style={{ ...TD, color: d.ctr >= 0.02 ? '#22c55e' : d.ctr >= 0.01 ? '#fbbf24' : '#ef4444' }}>{d.ctr > 0 ? fmtPct(d.ctr) : '—'}</td>
      <td style={{ ...TD }}>{d.ecr > 0 ? fmtPct(d.ecr) : '—'}</td>
      <td style={{ ...TD, color: '#64748b' }}>{d.daysRunning}d</td>
    </tr>
  )
}

const TD = { padding: '9px 12px', whiteSpace: 'nowrap', textAlign: 'right', fontSize: 12, color: '#94a3b8' }
const TH = { padding: '8px 12px', fontSize: 10, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.6, whiteSpace: 'nowrap', textAlign: 'right', borderBottom: '1px solid rgba(255,255,255,0.07)' }

// ── Pivot table ────────────────────────────────────────────────────────────────
function PivotTable({ pivoted, dimKey, dimLabel }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'rgba(255,255,255,0.04)' }}>
              <th style={{ ...TH, textAlign: 'left', paddingLeft: 16, minWidth: 160 }}>{dimLabel}</th>
              <th style={TH}>GA4 Rev</th>
              <th style={TH}>GA4 ROAS</th>
              <th style={TH}>1DC ROAS</th>
              <th style={TH}>Spend</th>
              <th style={TH}>Spend %</th>
              <th style={TH}>CPC</th>
              <th style={TH}>CTR</th>
              <th style={TH}>ECR</th>
              <th style={TH}>CPA</th>
              <th style={TH}>Creatives</th>
            </tr>
          </thead>
          <tbody>
            {pivoted.map((row, i) => (
              <tr key={row.dimVal} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)' }}>
                <td style={{ ...TD, textAlign: 'left', paddingLeft: 16, color: '#cbd5e1', fontWeight: 500 }}>{row.dimVal}</td>
                <td style={{ ...TD, color: '#a78bfa' }}>{fmtINRCompact(row.gaRevenue)}</td>
                <td style={{ ...TD, color: row.roasGA4 >= 3 ? '#22c55e' : row.roasGA4 >= 1.5 ? '#fbbf24' : '#ef4444' }}>{row.roasGA4 > 0 ? fmtX(row.roasGA4) : '—'}</td>
                <td style={{ ...TD, color: row.roas1dc >= 3 ? '#22c55e' : row.roas1dc >= 1.5 ? '#fbbf24' : '#ef4444' }}>{row.roas1dc > 0 ? fmtX(row.roas1dc) : '—'}</td>
                <td style={TD}>{fmtINRCompact(row.spend)}</td>
                <td style={{ ...TD, color: '#64748b' }}>{row.spendMix.toFixed(1)}%</td>
                <td style={TD}>{row.cpc > 0 ? fmtINRCompact(row.cpc) : '—'}</td>
                <td style={{ ...TD, color: row.ctr >= 0.02 ? '#22c55e' : row.ctr >= 0.01 ? '#fbbf24' : '#ef4444' }}>{row.ctr > 0 ? fmtPct(row.ctr) : '—'}</td>
                <td style={TD}>{row.ecr > 0 ? fmtPct(row.ecr) : '—'}</td>
                <td style={TD}>{row.cpa > 0 ? fmtINRCompact(row.cpa) : '—'}</td>
                <td style={{ ...TD, color: '#64748b' }}>{row.creatives}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function MetaCreative() {
  const { state }  = useData()
  const filters    = useFilters('last30')
  const { filterRows } = filters
  const [pivotDim, setPivotDim] = useState('product')
  const [creativeSearch, setCreativeSearch] = useState('')
  const [showFatigueOnly, setShowFatigueOnly] = useState(false)

  const rows       = useMemo(() => filterRows(state.metaDB), [state.metaDB, filters])
  const totalSpend = useMemo(() => rows.reduce((s, r) => s + (r.spend || 0), 0), [rows])

  // Pivot data
  const pivoted = useMemo(() => {
    const g = {}
    for (const r of rows) {
      const k = r[pivotDim] || 'Unknown'
      if (!g[k]) g[k] = []
      g[k].push(r)
    }
    return Object.entries(g).map(([val, rs]) => ({
      dimVal: val, ...buildMetrics(rs, totalSpend),
    })).sort((a, b) => b.spend - a.spend)
  }, [rows, pivotDim, totalSpend])

  // Format insight: best vs worst format by GA4 ROAS
  const formatInsights = useMemo(() => {
    const g = {}
    for (const r of rows) {
      const k = r.format || 'Unknown'
      if (!g[k]) g[k] = []
      g[k].push(r)
    }
    const formats = Object.entries(g)
      .map(([f, rs]) => ({ format: f, ...buildMetrics(rs, totalSpend) }))
      .filter(f => f.spend > 0)
      .sort((a, b) => b.roasGA4 - a.roasGA4)
    return formats
  }, [rows, totalSpend])

  const best  = formatInsights[0]
  const worst = formatInsights[formatInsights.length - 1]

  // Top creatives
  const creativeGroups = useMemo(() => {
    const g = {}
    for (const r of rows) {
      const k = r.creativeName || r.adName || 'Unknown'
      if (!g[k]) g[k] = []
      g[k].push(r)
    }
    return Object.entries(g)
      .map(([name, rs]) => ({ name, rows: rs, ...buildMetrics(rs, totalSpend), fatigue: fatigueFlag(rs) }))
      .filter(c => c.spend > 0)
      .filter(c => !creativeSearch || c.name.toLowerCase().includes(creativeSearch.toLowerCase()))
      .filter(c => !showFatigueOnly || c.fatigue)
      .sort((a, b) => b.roasGA4 - a.roasGA4)
  }, [rows, totalSpend, creativeSearch, showFatigueOnly])

  const fatigueCount = useMemo(() => creativeGroups.filter(c => c.fatigue).length, [creativeGroups])

  return (
    <div style={{ padding: '24px 28px', background: '#090e1a', minHeight: '100vh', color: '#e2e8f0', fontFamily: 'system-ui, sans-serif' }}>

      <div style={{ marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Creative Lookback</h1>
        <div style={{ fontSize: 13, color: '#64748b' }}>Format performance · Creative fatigue · Top creatives by GA4 ROAS</div>
      </div>

      <FilterBar filters={filters} />

      {/* Format insight cards */}
      {formatInsights.length > 0 && (
        <div style={{ display: 'flex', gap: 12, margin: '20px 0', flexWrap: 'wrap' }}>
          {best && best !== worst && (
            <InsightCard
              icon="🏆"
              label="Best Format"
              value={best.format}
              sub={`GA4 ROAS ${fmtX(best.roasGA4)} · ${fmtINRCompact(best.spend)} spend`}
              color="#22c55e"
            />
          )}
          {worst && best !== worst && worst.roasGA4 < best.roasGA4 * 0.6 && (
            <InsightCard
              icon="⚠️"
              label="Weakest Format"
              value={worst.format}
              sub={`GA4 ROAS ${fmtX(worst.roasGA4)} · ${((worst.roasGA4 / best.roasGA4) * 100).toFixed(0)}% of best`}
              color="#ef4444"
            />
          )}
          {best && worst && best !== worst && (
            <InsightCard
              icon="📊"
              label="Format Gap"
              value={`${fmtX(best.roasGA4)} vs ${fmtX(worst.roasGA4)}`}
              sub={`${best.format} outperforms ${worst.format} by ${(best.roasGA4 / Math.max(worst.roasGA4, 0.01)).toFixed(1)}x`}
              color="#f472b6"
            />
          )}
          {fatigueCount > 0 && (
            <InsightCard
              icon="🔴"
              label="Creative Fatigue"
              value={`${fatigueCount} creatives`}
              sub="Running 7+ days with ROAS decline >25%"
              color="#f59e0b"
            />
          )}
          <InsightCard
            icon="🎨"
            label="Active Creatives"
            value={String(creativeGroups.length)}
            sub={`${fmtINRCompact(totalSpend)} total spend`}
            color="#3b82f6"
          />
        </div>
      )}

      {/* Pivot breakdown */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#94a3b8' }}>Breakdown by</span>
          {PIVOT_DIMS.map(d => (
            <button key={d.key} onClick={() => setPivotDim(d.key)} style={{
              background: pivotDim === d.key ? 'rgba(244,114,182,0.2)' : 'rgba(255,255,255,0.05)',
              border: pivotDim === d.key ? '1px solid rgba(244,114,182,0.5)' : '1px solid rgba(255,255,255,0.1)',
              color: pivotDim === d.key ? '#f472b6' : '#94a3b8',
              borderRadius: 20, padding: '5px 14px', fontSize: 12, cursor: 'pointer',
            }}>{d.label}</button>
          ))}
        </div>
        <PivotTable
          pivoted={pivoted}
          dimKey={pivotDim}
          dimLabel={PIVOT_DIMS.find(d => d.key === pivotDim)?.label}
        />
      </div>

      {/* Top creatives */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#f1f5f9' }}>All Creatives</span>
          <input
            placeholder="Search creative name..."
            value={creativeSearch}
            onChange={e => setCreativeSearch(e.target.value)}
            style={{
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
              color: '#e2e8f0', borderRadius: 8, padding: '6px 12px', fontSize: 12,
              outline: 'none', minWidth: 240,
            }}
          />
          <button onClick={() => setShowFatigueOnly(!showFatigueOnly)} style={{
            background: showFatigueOnly ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.05)',
            border: showFatigueOnly ? '1px solid rgba(245,158,11,0.5)' : '1px solid rgba(255,255,255,0.1)',
            color: showFatigueOnly ? '#fbbf24' : '#94a3b8',
            borderRadius: 20, padding: '5px 14px', fontSize: 12, cursor: 'pointer',
          }}>
            ⚠ Fatigue only {fatigueCount > 0 ? `(${fatigueCount})` : ''}
          </button>
          <span style={{ fontSize: 12, color: '#475569' }}>{creativeGroups.length} creatives · sorted by GA4 ROAS</span>
        </div>

        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.04)' }}>
                  <th style={{ ...TH, textAlign: 'left', paddingLeft: 16, minWidth: 300 }}>Creative</th>
                  <th style={TH}>GA4 Rev</th>
                  <th style={TH}>GA4 ROAS</th>
                  <th style={TH}>1DC ROAS</th>
                  <th style={TH}>Spend</th>
                  <th style={TH}>Spend %</th>
                  <th style={TH}>CPC</th>
                  <th style={TH}>CTR</th>
                  <th style={TH}>ECR</th>
                  <th style={TH}>Running</th>
                </tr>
              </thead>
              <tbody>
                {creativeGroups.slice(0, 100).map((c, i) => (
                  <CreativeRow key={c.name} name={c.name} rows={c.rows} totalSpend={totalSpend} rank={i + 1} />
                ))}
                {creativeGroups.length === 0 && (
                  <tr><td colSpan={10} style={{ padding: 32, textAlign: 'center', color: '#475569' }}>
                    No creatives found
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
