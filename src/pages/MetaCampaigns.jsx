import React, { useMemo, useState } from 'react'
import { useData } from '../data/store.jsx'
import { useFilters } from '../hooks/useFilters.js'
import FilterBar from '../components/FilterBar.jsx'
import { aggregateRows, calcROAS, calcROASGap } from '../utils/metrics.js'
import { fmtINRCompact, fmtX, fmtPct, fmtNum } from '../utils/formatters.js'

// ── Helpers ───────────────────────────────────────────────────────────────────
function groupBy(rows, key) {
  const map = {}
  for (const r of rows) {
    const k = r[key] || 'Unknown'
    if (!map[k]) map[k] = []
    map[k].push(r)
  }
  return map
}

function buildRow(rows, totalSpend) {
  const agg = aggregateRows(rows)
  const spend = agg.spend || 0
  return {
    ...agg,
    spend,
    spendPct:  totalSpend > 0 ? (spend / totalSpend) * 100 : 0,
    cpm:       (agg.impressions || 0) > 0 ? (spend / agg.impressions) * 1000 : 0,
    ctr:       (agg.impressions || 0) > 0 ? (agg.clicks || 0) / agg.impressions : 0,
    cpc:       (agg.clicks || 0) > 0 ? spend / agg.clicks : 0,
    roas1dc:   calcROAS(agg.fbRevenue, spend),
    roasGA4:   calcROAS(agg.gaRevenue, spend),
    gap:       calcROASGap(agg.fbRevenue, agg.gaRevenue, spend),
    cpa:       (agg.gaOrders || 0) > 0 ? spend / agg.gaOrders : 0,
    ecr:       (agg.sessions || 0) > 0 ? (agg.gaOrders || 0) / agg.sessions : 0,
  }
}

// ── Style constants ───────────────────────────────────────────────────────────
const COLS = [
  { key: 'spend',    label: 'Spend',     fmt: fmtINRCompact,  w: 90 },
  { key: 'spendPct', label: 'Spend %',   fmt: v => `${(v||0).toFixed(1)}%`, w: 70 },
  { key: 'impressions', label: 'Impr',   fmt: fmtNum,         w: 80 },
  { key: 'cpm',     label: 'CPM',        fmt: v => v > 0 ? fmtINRCompact(v) : '—', w: 70 },
  { key: 'ctr',     label: 'CTR',        fmt: v => v > 0 ? fmtPct(v) : '—', w: 60 },
  { key: 'cpc',     label: 'CPC',        fmt: v => v > 0 ? fmtINRCompact(v) : '—', w: 70 },
  { key: 'roas1dc', label: '1DC ROAS',   fmt: v => v > 0 ? fmtX(v) : '—', w: 80, color: v => v >= 3 ? '#22c55e' : v >= 1.5 ? '#fbbf24' : v > 0 ? '#ef4444' : '#475569' },
  { key: 'roasGA4', label: 'GA4 ROAS',   fmt: v => v > 0 ? fmtX(v) : '—', w: 80, color: v => v >= 3 ? '#22c55e' : v >= 1.5 ? '#fbbf24' : v > 0 ? '#ef4444' : '#475569' },
  { key: 'gap',     label: 'Gap %',      fmt: v => v !== null && v !== undefined ? `${v > 0 ? '+' : ''}${v.toFixed(0)}%` : '—', w: 70,
    color: v => v > 30 ? '#ef4444' : v > 15 ? '#fbbf24' : '#22c55e' },
  { key: 'gaRevenue', label: 'GA4 Rev',  fmt: v => v > 0 ? fmtINRCompact(v) : '—', w: 90, color: () => '#a78bfa' },
  { key: 'gaOrders',  label: 'Orders',   fmt: v => v > 0 ? fmtNum(v) : '—', w: 60 },
  { key: 'cpa',     label: 'CPA',        fmt: v => v > 0 ? fmtINRCompact(v) : '—', w: 80 },
  { key: 'ecr',     label: 'ECR',        fmt: v => v > 0 ? fmtPct(v) : '—', w: 60 },
]

const COHORT_COLOR = { ACQ: '#3b82f6', REM: '#f59e0b', RET: '#22c55e' }

function cohortPill(cohort) {
  const c = COHORT_COLOR[cohort] || '#64748b'
  return (
    <span style={{
      background: `${c}20`, color: c, border: `1px solid ${c}40`,
      borderRadius: 10, padding: '1px 7px', fontSize: 10, fontWeight: 600,
    }}>{cohort || '—'}</span>
  )
}

// ── Ad row ────────────────────────────────────────────────────────────────────
function AdRow({ ad, totalSpend }) {
  const d = buildRow([ad], totalSpend)
  return (
    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', background: 'rgba(0,0,0,0.2)' }}>
      <td style={{ ...TD, paddingLeft: 72, color: '#94a3b8', maxWidth: 260 }}>
        <div style={{ fontSize: 11, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          🎨 {ad.adName || ad.creativeName || 'Unknown ad'}
        </div>
        <div style={{ fontSize: 10, color: '#475569', marginTop: 2 }}>
          {[ad.format, ad.contentType, ad.creator].filter(Boolean).join(' · ')}
        </div>
      </td>
      <td style={{ ...TD, paddingLeft: 8 }}>{cohortPill(ad.cohort)}</td>
      {COLS.map(c => (
        <td key={c.key} style={{ ...TD, color: c.color ? c.color(d[c.key]) : '#94a3b8', fontSize: 11 }}>
          {c.fmt(d[c.key])}
        </td>
      ))}
    </tr>
  )
}

// ── Adset row (expands to ads) ────────────────────────────────────────────────
function AdsetRow({ adsetName, rows, totalSpend, isExpanded, onToggle }) {
  const d = buildRow(rows, totalSpend)
  const cohort = rows[0]?.cohort
  const product = rows[0]?.product

  return (
    <>
      <tr
        onClick={onToggle}
        style={{
          borderBottom: '1px solid rgba(255,255,255,0.04)',
          background: isExpanded ? 'rgba(59,130,246,0.05)' : 'rgba(255,255,255,0.01)',
          cursor: 'pointer',
        }}
      >
        <td style={{ ...TD, paddingLeft: 40, color: '#cbd5e1' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: '#64748b', fontSize: 10, transform: isExpanded ? 'rotate(90deg)' : 'none', display: 'inline-block', transition: 'transform 0.15s' }}>▶</span>
            <div>
              <div style={{ fontSize: 12, fontWeight: 500 }}>{adsetName}</div>
              {product && <div style={{ fontSize: 10, color: '#475569', marginTop: 1 }}>{product}</div>}
            </div>
          </div>
        </td>
        <td style={{ ...TD, paddingLeft: 8 }}>{cohortPill(cohort)}</td>
        {COLS.map(c => (
          <td key={c.key} style={{ ...TD, color: c.color ? c.color(d[c.key]) : '#94a3b8', fontWeight: 500 }}>
            {c.fmt(d[c.key])}
          </td>
        ))}
      </tr>
      {isExpanded && rows.map((ad, i) => (
        <AdRow key={i} ad={ad} totalSpend={totalSpend} />
      ))}
    </>
  )
}

// ── Campaign row (expands to adsets) ─────────────────────────────────────────
function CampaignRow({ campaignName, rows, totalSpend, expandedAdsets, onToggleCampaign, onToggleAdset, isExpanded }) {
  const d = buildRow(rows, totalSpend)
  const cohort = rows[0]?.cohort
  const adsetGroups = useMemo(() => {
    const g = groupBy(rows, 'adsetName')
    return Object.entries(g).sort((a, b) => {
      const aSpend = a[1].reduce((s, r) => s + (r.spend || 0), 0)
      const bSpend = b[1].reduce((s, r) => s + (r.spend || 0), 0)
      return bSpend - aSpend
    })
  }, [rows])

  return (
    <>
      <tr
        onClick={onToggleCampaign}
        style={{
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          background: isExpanded ? 'rgba(244,114,182,0.06)' : 'rgba(255,255,255,0.02)',
          cursor: 'pointer',
        }}
      >
        <td style={{ ...TD, paddingLeft: 16, color: '#f1f5f9' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: '#94a3b8', fontSize: 10, transform: isExpanded ? 'rotate(90deg)' : 'none', display: 'inline-block', transition: 'transform 0.15s' }}>▶</span>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{campaignName}</div>
          </div>
        </td>
        <td style={{ ...TD, paddingLeft: 8 }}>{cohortPill(cohort)}</td>
        {COLS.map(c => (
          <td key={c.key} style={{ ...TD, color: c.color ? c.color(d[c.key]) : '#e2e8f0', fontWeight: 600 }}>
            {c.fmt(d[c.key])}
          </td>
        ))}
      </tr>

      {isExpanded && adsetGroups.map(([adsetName, adsetRows]) => (
        <AdsetRow
          key={adsetName}
          adsetName={adsetName}
          rows={adsetRows}
          totalSpend={totalSpend}
          isExpanded={expandedAdsets.has(adsetName)}
          onToggle={() => onToggleAdset(adsetName)}
        />
      ))}
    </>
  )
}

// ── Summary metric card ───────────────────────────────────────────────────────
function SummaryCard({ label, value, sub }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 10, padding: '14px 18px', flex: 1, minWidth: 130,
    }}>
      <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: '#f1f5f9' }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: '#475569', marginTop: 3 }}>{sub}</div>}
    </div>
  )
}

const TD = { padding: '10px 10px', whiteSpace: 'nowrap', fontSize: 12, textAlign: 'right', color: '#94a3b8' }

// ── Main ──────────────────────────────────────────────────────────────────────
export default function MetaCampaigns() {
  const { state } = useData()
  const filters   = useFilters('last7')
  const { filterRows } = filters
  const [expandedCampaigns, setExpandedCampaigns] = useState(new Set())
  const [expandedAdsets, setExpandedAdsets]       = useState(new Set())
  const [search, setSearch] = useState('')
  const [cohortFilter, setCohortFilter] = useState('All')

  const rows = useMemo(() => filterRows(state.metaDB), [state.metaDB, filters])

  const totalSpend = useMemo(() => rows.reduce((s, r) => s + (r.spend || 0), 0), [rows])

  const totals = useMemo(() => buildRow(rows, totalSpend), [rows, totalSpend])

  // Filter by cohort + search
  const filteredRows = useMemo(() => {
    let r = rows
    if (cohortFilter !== 'All') r = r.filter(x => x.cohort === cohortFilter)
    if (search) r = r.filter(x =>
      (x.adsetName || '').toLowerCase().includes(search.toLowerCase()) ||
      (x.adName || '').toLowerCase().includes(search.toLowerCase())
    )
    return r
  }, [rows, cohortFilter, search])

  // Campaign groups — use cohort as campaign grouping (ACQ/REM/RET)
  const campaignGroups = useMemo(() => {
    const g = groupBy(filteredRows, 'cohort')
    return Object.entries(g).sort((a, b) => {
      const as = a[1].reduce((s, r) => s + (r.spend || 0), 0)
      const bs = b[1].reduce((s, r) => s + (r.spend || 0), 0)
      return bs - as
    })
  }, [filteredRows])

  const toggleCampaign = (name) => {
    setExpandedCampaigns(prev => {
      const n = new Set(prev)
      n.has(name) ? n.delete(name) : n.add(name)
      return n
    })
  }

  const toggleAdset = (name) => {
    setExpandedAdsets(prev => {
      const n = new Set(prev)
      n.has(name) ? n.delete(name) : n.add(name)
      return n
    })
  }

  return (
    <div style={{ padding: '24px 28px', background: '#090e1a', minHeight: '100vh', color: '#e2e8f0', fontFamily: 'system-ui, sans-serif' }}>

      <div style={{ marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Meta Campaigns</h1>
        <div style={{ fontSize: 13, color: '#64748b' }}>Click campaign → expand adsets · Click adset → expand ads</div>
      </div>

      <FilterBar filters={filters} />

      {/* Summary strip */}
      <div style={{ display: 'flex', gap: 10, margin: '20px 0', flexWrap: 'wrap' }}>
        <SummaryCard label="Total Spend"   value={fmtINRCompact(totals.spend)} />
        <SummaryCard label="GA4 ROAS"      value={totals.roasGA4 > 0 ? fmtX(totals.roasGA4) : '—'} />
        <SummaryCard label="1DC ROAS"      value={totals.roas1dc > 0 ? fmtX(totals.roas1dc) : '—'} />
        <SummaryCard label="Avg CPC"       value={totals.cpc > 0 ? fmtINRCompact(totals.cpc) : '—'} />
        <SummaryCard label="GA4 Revenue"   value={fmtINRCompact(totals.gaRevenue || 0)} />
        <SummaryCard label="Orders"        value={totals.gaOrders > 0 ? fmtNum(totals.gaOrders) : '—'} />
        <SummaryCard label="1DC vs GA4 Gap" value={totals.gap !== null ? `${(totals.gap||0).toFixed(0)}%` : '—'}
          sub="Meta over-reports by this %" />
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        {['All', 'ACQ', 'REM', 'RET'].map(c => (
          <button key={c} onClick={() => setCohortFilter(c)} style={{
            background: cohortFilter === c ? 'rgba(244,114,182,0.2)' : 'rgba(255,255,255,0.05)',
            border: cohortFilter === c ? '1px solid rgba(244,114,182,0.5)' : '1px solid rgba(255,255,255,0.1)',
            color: cohortFilter === c ? '#f472b6' : '#94a3b8',
            borderRadius: 20, padding: '5px 14px', fontSize: 12, cursor: 'pointer',
          }}>{c}</button>
        ))}
        <input
          placeholder="Search adset or ad name..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
            color: '#e2e8f0', borderRadius: 8, padding: '6px 12px', fontSize: 12,
            outline: 'none', minWidth: 240,
          }}
        />
        <button onClick={() => { setExpandedCampaigns(new Set(campaignGroups.map(([k]) => k))); setExpandedAdsets(new Set()) }}
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', borderRadius: 8, padding: '6px 12px', fontSize: 12, cursor: 'pointer' }}>
          Expand all
        </button>
        <button onClick={() => { setExpandedCampaigns(new Set()); setExpandedAdsets(new Set()) }}
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', borderRadius: 8, padding: '6px 12px', fontSize: 12, cursor: 'pointer' }}>
          Collapse all
        </button>
      </div>

      {/* Drill table */}
      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.04)' }}>
                <th style={{ ...TH, textAlign: 'left', minWidth: 260, paddingLeft: 16 }}>Campaign / Adset / Ad</th>
                <th style={{ ...TH, minWidth: 70 }}>Cohort</th>
                {COLS.map(c => <th key={c.key} style={{ ...TH, minWidth: c.w }}>{c.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {campaignGroups.length === 0 && (
                <tr><td colSpan={COLS.length + 2} style={{ padding: 32, textAlign: 'center', color: '#475569' }}>
                  No data — upload a Meta CSV
                </td></tr>
              )}
              {campaignGroups.map(([campaignName, campaignRows]) => (
                <CampaignRow
                  key={campaignName}
                  campaignName={campaignName}
                  rows={campaignRows}
                  totalSpend={totalSpend}
                  isExpanded={expandedCampaigns.has(campaignName)}
                  expandedAdsets={expandedAdsets}
                  onToggleCampaign={() => toggleCampaign(campaignName)}
                  onToggleAdset={toggleAdset}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

const TH = {
  padding: '9px 10px', fontSize: 10, fontWeight: 600, color: '#64748b',
  textTransform: 'uppercase', letterSpacing: 0.6, whiteSpace: 'nowrap',
  textAlign: 'right', borderBottom: '1px solid rgba(255,255,255,0.07)',
  position: 'sticky', top: 0, background: 'rgba(15,20,35,0.95)', zIndex: 2,
}
