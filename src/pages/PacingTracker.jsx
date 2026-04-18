import React, { useMemo, useState } from 'react'
import { useData } from '../data/store.jsx'
import {
  CATEGORY_TARGETS,
  PRODUCT_TARGETS,
  DELTA_OK,
  DELTA_WARN,
  PACING_CONFIG,
} from '../data/targets.js'

// ── Formatters ────────────────────────────────────────────────────────────────
const fmt = (n) => {
  if (n === undefined || n === null || isNaN(n)) return '—'
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)}Cr`
  if (n >= 100000)   return `₹${(n / 100000).toFixed(2)}L`
  if (n >= 1000)     return `₹${(n / 1000).toFixed(1)}K`
  return `₹${Math.round(n)}`
}
const fmtN   = (n, d = 1) => (n == null || isNaN(n) ? '—' : Number(n).toFixed(d))
const fmtPct = (n)        => (n == null || isNaN(n) ? '—' : `${(n * 100).toFixed(1)}%`)
const fmtX   = (n)        => (n == null || isNaN(n) ? '—' : `${Number(n).toFixed(2)}x`)

// ── Days elapsed in April up to yesterday ─────────────────────────────────────
function getDaysElapsed() {
  const start     = new Date(PACING_CONFIG.startDate)
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  if (yesterday < start) return 1
  const diff = Math.floor((yesterday - start) / 86400000) + 1
  return Math.min(diff, PACING_CONFIG.totalDays)
}

// ── RAG ───────────────────────────────────────────────────────────────────────
function rag(actual, target, higherIsBetter = true) {
  if (!target || target === 0) return 'neutral'
  const ratio = actual / target
  if (higherIsBetter) {
    if (ratio >= DELTA_OK)   return 'green'
    if (ratio >= DELTA_WARN) return 'amber'
    return 'red'
  } else {
    if (ratio <= (1 / DELTA_OK))   return 'green'
    if (ratio <= (1 / DELTA_WARN)) return 'amber'
    return 'red'
  }
}

const C = {
  green:   { bg: 'rgba(34,197,94,0.12)',  text: '#22c55e', border: 'rgba(34,197,94,0.3)' },
  amber:   { bg: 'rgba(251,191,36,0.12)', text: '#fbbf24', border: 'rgba(251,191,36,0.3)' },
  red:     { bg: 'rgba(239,68,68,0.12)',  text: '#ef4444', border: 'rgba(239,68,68,0.3)' },
  neutral: { bg: 'transparent',           text: '#64748b', border: 'rgba(148,163,184,0.15)' },
}

// ── Breakpoint detector ───────────────────────────────────────────────────────
// Order: spend → CPC → CPS → sessions → CR% → orders
function getBreakpoint(act = {}, tgt = {}) {
  const checks = [
    { key: 'spend',    label: 'Spend under-pacing',   higher: true  },
    { key: 'cpc',      label: 'CPC over target',       higher: false },
    { key: 'cps',      label: 'Cost/Session too high', higher: false },
    { key: 'sessions', label: 'Sessions low',          higher: true  },
    { key: 'crPct',    label: 'CR% low',               higher: true  },
    { key: 'orders',   label: 'Orders low',            higher: true  },
  ]
  for (const { key, label, higher } of checks) {
    const status = rag(act[key] ?? 0, tgt[key], higher)
    if (status === 'red' || status === 'amber') return { label, status }
  }
  return null
}

// ── Aggregate metaDB rows into category + product buckets ─────────────────────
function aggregateActuals(metaDB) {
  const rows = Array.isArray(metaDB) ? metaDB : (metaDB?.rows ?? [])
  const byCategory = {}
  const byProduct  = {}

  for (const row of rows) {
    const cat  = row.category || 'Other'
    const prod = row.product  || 'Other'

    for (const bucket of [
      [byCategory, cat],
      [byProduct, prod],
    ]) {
      const [map, key] = bucket
      if (!map[key]) map[key] = { spend: 0, clicks: 0, sessions: 0, ga4Revenue: 0, orders: 0, impressions: 0 }
      map[key].spend       += Number(row.spend       || 0)
      map[key].clicks      += Number(row.clicks      || row.linkClicks || 0)
      map[key].sessions    += Number(row.sessions    || row.ga4Sessions || 0)
      map[key].ga4Revenue  += Number(row.ga4Revenue  || row.gaRevenue   || 0)
      map[key].orders      += Number(row.ga4Orders   || row.gaOrders    || 0)
      map[key].impressions += Number(row.impressions || 0)
    }
  }

  const derive = (agg) => ({
    ...agg,
    cpc:     agg.clicks   > 0 ? agg.spend / agg.clicks   : 0,
    cps:     agg.sessions > 0 ? agg.spend / agg.sessions  : 0,
    ga4ROAS: agg.spend    > 0 ? agg.ga4Revenue / agg.spend : 0,
    crPct:   agg.sessions > 0 ? agg.orders / agg.sessions  : 0,
  })

  Object.keys(byCategory).forEach(k => { byCategory[k] = derive(byCategory[k]) })
  Object.keys(byProduct).forEach(k  => { byProduct[k]  = derive(byProduct[k])  })

  return { byCategory, byProduct }
}

// ── Sub-components ────────────────────────────────────────────────────────────
function PaceBar({ actual, target, higherIsBetter = true }) {
  if (!target) return null
  const pct    = Math.min((actual / target) * 100, 120)
  const status = rag(actual, target, higherIsBetter)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ flex: 1, height: 4, background: 'rgba(255,255,255,0.07)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: `${Math.min(pct, 100)}%`, height: '100%', background: C[status].text, borderRadius: 2 }} />
      </div>
      <span style={{ fontSize: 11, color: C[status].text, minWidth: 38, textAlign: 'right' }}>
        {fmtPct(actual / target)}
      </span>
    </div>
  )
}

function KPICard({ label, actual, target, formatter = fmt, higherIsBetter = true }) {
  const daysElapsed = getDaysElapsed()
  const cumTarget   = target * daysElapsed
  const status      = rag(actual, cumTarget, higherIsBetter)
  const required    = cumTarget > 0 ? ((cumTarget - actual) / Math.max(PACING_CONFIG.totalDays - daysElapsed, 1)) : 0

  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)',
      border: `1px solid rgba(255,255,255,0.08)`,
      borderRadius: 12,
      padding: '16px 18px',
      flex: 1,
      minWidth: 145,
    }}>
      <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: C[status].text, marginBottom: 2 }}>{formatter(actual)}</div>
      <div style={{ fontSize: 11, color: '#475569', marginBottom: 8 }}>MTD target {formatter(cumTarget)}</div>
      <PaceBar actual={actual} target={cumTarget} higherIsBetter={higherIsBetter} />
      {required > 0 && actual < cumTarget && (
        <div style={{ fontSize: 10, color: '#64748b', marginTop: 6 }}>
          Run-rate needed: <span style={{ color: '#f472b6' }}>{formatter(required)}/day</span>
        </div>
      )}
    </div>
  )
}

function RagCell({ actual, target, formatter = fmt, higherIsBetter = true }) {
  const status = rag(actual, target, higherIsBetter)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontSize: 13, fontWeight: 600, color: C[status].text }}>{formatter(actual || 0)}</span>
      <span style={{ fontSize: 10, color: '#475569' }}>tgt {formatter(target)}</span>
    </div>
  )
}

// ── Products under a category ─────────────────────────────────────────────────
function ProductRows({ categoryName, byProduct, daysElapsed }) {
  const products = Object.entries(PRODUCT_TARGETS).filter(([, p]) => p.category === categoryName)
  if (!products.length) return null

  return (
    <div style={{ background: 'rgba(0,0,0,0.2)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      {/* product sub-header */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '32px 180px 130px 130px 80px 80px 80px 150px',
        gap: 0,
        padding: '8px 16px 8px 48px',
        fontSize: 10,
        color: '#475569',
        textTransform: 'uppercase',
        letterSpacing: 0.8,
        borderBottom: '1px solid rgba(255,255,255,0.04)',
      }}>
        <div />
        <div>Product</div>
        <div>GA4 Rev (cumulative)</div>
        <div>Spend</div>
        <div>ROAS</div>
        <div>CPC</div>
        <div>CR%</div>
        <div>Breakpoint</div>
      </div>

      {products.map(([prodName, tgt]) => {
        const act        = byProduct[prodName] || byProduct[tgt.alias] || {}
        const cumRevTgt  = tgt.ga4Revenue * daysElapsed
        const cumSpndTgt = tgt.spend * daysElapsed
        const bp         = getBreakpoint(act, tgt)
        const revStatus  = rag(act.ga4Revenue || 0, cumRevTgt)

        return (
          <div key={prodName} style={{
            display: 'grid',
            gridTemplateColumns: '32px 180px 130px 130px 80px 80px 80px 150px',
            gap: 0,
            padding: '10px 16px 10px 48px',
            borderBottom: '1px solid rgba(255,255,255,0.03)',
            alignItems: 'center',
          }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: C[revStatus].text }} />

            <div>
              <div style={{ fontSize: 12, fontWeight: 500, color: '#cbd5e1' }}>{prodName}</div>
              {tgt.alias && <div style={{ fontSize: 10, color: '#475569' }}>{tgt.alias}</div>}
            </div>

            <div>
              <div style={{ fontSize: 12, color: C[revStatus].text, fontWeight: 600 }}>{fmt(act.ga4Revenue || 0)}</div>
              <PaceBar actual={act.ga4Revenue || 0} target={cumRevTgt} />
            </div>

            <div>
              <div style={{ fontSize: 12, color: C[rag(act.spend || 0, cumSpndTgt)].text }}>{fmt(act.spend || 0)}</div>
              <PaceBar actual={act.spend || 0} target={cumSpndTgt} />
            </div>

            <RagCell actual={act.ga4ROAS || 0} target={tgt.ga4ROAS} formatter={fmtX} />
            <RagCell actual={act.cpc     || 0} target={tgt.cpc}     formatter={n => '₹' + fmtN(n, 0)} higherIsBetter={false} />
            <RagCell actual={act.crPct   || 0} target={tgt.crPct}   formatter={fmtPct} />

            <div>
              {bp ? (
                <span style={{
                  background: C[bp.status].bg,
                  color: C[bp.status].text,
                  border: `1px solid ${C[bp.status].border}`,
                  borderRadius: 6,
                  padding: '3px 8px',
                  fontSize: 11,
                }}>
                  {bp.label}
                </span>
              ) : act.spend > 0 ? (
                <span style={{ color: '#22c55e', fontSize: 11 }}>✓ On track</span>
              ) : (
                <span style={{ color: '#475569', fontSize: 11 }}>No data</span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function PacingTracker() {
  const { state }         = useData()
  const [expanded, setExpanded] = useState(null)
  const daysElapsed       = getDaysElapsed()
  const hasData           = (state.metaDB?.length ?? 0) > 0

  const { byCategory, byProduct } = useMemo(
    () => aggregateActuals(state.metaDB),
    [state.metaDB]
  )

  // Account-level totals
  const acct = useMemo(() => {
    const t = { spend: 0, ga4Revenue: 0, orders: 0, sessions: 0, clicks: 0 }
    Object.values(byCategory).forEach(c => {
      t.spend      += c.spend
      t.ga4Revenue += c.ga4Revenue
      t.orders     += c.orders
      t.sessions   += c.sessions
      t.clicks     += c.clicks
    })
    return {
      ...t,
      cpc:     t.clicks   > 0 ? t.spend / t.clicks   : 0,
      ga4ROAS: t.spend    > 0 ? t.ga4Revenue / t.spend : 0,
      crPct:   t.sessions > 0 ? t.orders / t.sessions  : 0,
    }
  }, [byCategory])

  // Daily account targets (sum of all categories)
  const acctTgt = useMemo(() => {
    const t = { spend: 0, ga4Revenue: 0, orders: 0, sessions: 0 }
    Object.values(CATEGORY_TARGETS).forEach(c => {
      t.spend      += c.spend
      t.ga4Revenue += c.ga4Revenue
      t.orders     += c.orders
      t.sessions   += c.sessions
    })
    return { ...t, cpc: 11.5, ga4ROAS: 2.18 }
  }, [])

  // Auto-insights: categories that are breaking today
  const breaking = useMemo(() => {
    return Object.entries(CATEGORY_TARGETS)
      .map(([name, tgt]) => {
        const act = byCategory[name]
        if (!act || act.spend === 0) return null
        const bp = getBreakpoint(act, tgt)
        if (!bp) return null
        return { name, ...bp }
      })
      .filter(Boolean)
  }, [byCategory])

  return (
    <div style={{
      padding: '24px 28px',
      minHeight: '100vh',
      background: '#090e1a',
      color: '#e2e8f0',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>

      {/* ── Header ── */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#f1f5f9' }}>Pacing Tracker</h1>
          <span style={{
            background: 'rgba(244,114,182,0.15)',
            color: '#f472b6',
            border: '1px solid rgba(244,114,182,0.3)',
            borderRadius: 20, padding: '2px 12px', fontSize: 11, fontWeight: 500,
          }}>
            Meta GA4 Revenue Only (~55% of Total NR)
          </span>
        </div>
        <div style={{ fontSize: 13, color: '#64748b' }}>
          Day <strong style={{ color: '#94a3b8' }}>{daysElapsed}</strong> of {PACING_CONFIG.totalDays} ·{' '}
          {PACING_CONFIG.month} · All targets are daily benchmarks · Cumulative = target × days elapsed
        </div>
      </div>

      {/* ── No data banner ── */}
      {!hasData && (
        <div style={{
          background: 'rgba(251,191,36,0.08)',
          border: '1px solid rgba(251,191,36,0.25)',
          borderRadius: 10, padding: '14px 18px', marginBottom: 24, color: '#fbbf24', fontSize: 13,
        }}>
          ⚠️ No Meta data loaded yet. Upload a Meta daily CSV on the Upload page to see actuals vs targets.
          Daily targets from the April media plan are shown below.
        </div>
      )}

      {/* ── Account KPI strip ── */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 28, flexWrap: 'wrap' }}>
        <KPICard label="Meta GA4 Revenue"  actual={acct.ga4Revenue} target={acctTgt.ga4Revenue} />
        <KPICard label="Total Spend"        actual={acct.spend}      target={acctTgt.spend} />
        <KPICard label="GA4 ROAS"           actual={acct.ga4ROAS}    target={acctTgt.ga4ROAS}   formatter={fmtX} />
        <KPICard label="Avg CPC"            actual={acct.cpc}        target={acctTgt.cpc}        formatter={n => '₹' + fmtN(n,0)} higherIsBetter={false} />
        <KPICard label="Sessions"           actual={acct.sessions}   target={acctTgt.sessions}   formatter={n => Math.round(n).toLocaleString()} />
        <KPICard label="Orders"             actual={acct.orders}     target={acctTgt.orders}     formatter={n => fmtN(n, 0)} />
      </div>

      {/* ── Breaking insights ── */}
      {breaking.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
            🔴 Breaking Metrics
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {breaking.map((b, i) => (
              <div key={i} style={{
                background: C[b.status].bg,
                border: `1px solid ${C[b.status].border}`,
                borderRadius: 8, padding: '7px 14px', fontSize: 13,
                cursor: 'pointer',
              }}
                onClick={() => setExpanded(expanded === b.name ? null : b.name)}
              >
                <span style={{ color: C[b.status].text, fontWeight: 600 }}>{b.name}</span>
                <span style={{ color: '#94a3b8', marginLeft: 8 }}>→ {b.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Category heatmap ── */}
      <div style={{
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 12, overflow: 'hidden',
      }}>
        {/* Table header */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '32px 180px 160px 140px 80px 80px 80px 150px',
          padding: '10px 16px',
          background: 'rgba(255,255,255,0.04)',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          fontSize: 10, color: '#64748b',
          textTransform: 'uppercase', letterSpacing: 0.8,
        }}>
          <div />
          <div>Category</div>
          <div>GA4 Revenue (MTD)</div>
          <div>Spend (MTD)</div>
          <div>ROAS</div>
          <div>CPC</div>
          <div>CR%</div>
          <div>Breakpoint</div>
        </div>

        {Object.entries(CATEGORY_TARGETS).map(([catName, tgt]) => {
          const act        = byCategory[catName] || {}
          const cumRevTgt  = tgt.ga4Revenue * daysElapsed
          const cumSpndTgt = tgt.spend       * daysElapsed
          const revStatus  = rag(act.ga4Revenue || 0, cumRevTgt)
          const spndStatus = rag(act.spend      || 0, cumSpndTgt)
          const roasStatus = rag(act.ga4ROAS    || 0, tgt.ga4ROAS)
          const cpcStatus  = rag(act.cpc        || 0, tgt.cpc, false)
          const crStatus   = rag(act.crPct      || 0, tgt.crPct)
          const bp         = getBreakpoint(act, tgt)
          const isOpen     = expanded === catName

          return (
            <React.Fragment key={catName}>
              {/* Category row */}
              <div
                onClick={() => setExpanded(isOpen ? null : catName)}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '32px 180px 160px 140px 80px 80px 80px 150px',
                  padding: '13px 16px',
                  borderBottom: '1px solid rgba(255,255,255,0.05)',
                  cursor: 'pointer',
                  background: isOpen ? 'rgba(244,114,182,0.04)' : 'transparent',
                  transition: 'background 0.15s',
                  alignItems: 'center',
                }}
              >
                {/* Expand arrow */}
                <div style={{
                  color: '#64748b', fontSize: 10,
                  transform: isOpen ? 'rotate(90deg)' : 'none',
                  transition: 'transform 0.2s',
                }}>▶</div>

                {/* Name + dot */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: C[revStatus].text, flexShrink: 0 }} />
                  <span style={{ fontWeight: 600, fontSize: 13, color: '#f1f5f9' }}>{catName}</span>
                </div>

                {/* GA4 Revenue */}
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C[revStatus].text, marginBottom: 3 }}>
                    {fmt(act.ga4Revenue || 0)}
                  </div>
                  <PaceBar actual={act.ga4Revenue || 0} target={cumRevTgt} />
                </div>

                {/* Spend */}
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C[spndStatus].text, marginBottom: 3 }}>
                    {fmt(act.spend || 0)}
                  </div>
                  <PaceBar actual={act.spend || 0} target={cumSpndTgt} />
                </div>

                {/* ROAS */}
                <div style={{ fontSize: 13, color: C[roasStatus].text, fontWeight: 600 }}>
                  {fmtX(act.ga4ROAS || 0)}
                  <div style={{ fontSize: 10, color: '#475569', fontWeight: 400 }}>tgt {fmtX(tgt.ga4ROAS)}</div>
                </div>

                {/* CPC */}
                <div style={{ fontSize: 13, color: C[cpcStatus].text, fontWeight: 600 }}>
                  {act.cpc ? '₹' + fmtN(act.cpc, 0) : '—'}
                  <div style={{ fontSize: 10, color: '#475569', fontWeight: 400 }}>tgt ₹{fmtN(tgt.cpc, 0)}</div>
                </div>

                {/* CR% */}
                <div style={{ fontSize: 13, color: C[crStatus].text, fontWeight: 600 }}>
                  {fmtPct(act.crPct || 0)}
                  <div style={{ fontSize: 10, color: '#475569', fontWeight: 400 }}>tgt {fmtPct(tgt.crPct)}</div>
                </div>

                {/* Breakpoint */}
                <div>
                  {bp ? (
                    <span style={{
                      background: C[bp.status].bg,
                      color: C[bp.status].text,
                      border: `1px solid ${C[bp.status].border}`,
                      borderRadius: 6, padding: '3px 8px', fontSize: 11,
                    }}>
                      {bp.label}
                    </span>
                  ) : act.spend > 0 ? (
                    <span style={{ color: '#22c55e', fontSize: 12 }}>✓ On track</span>
                  ) : (
                    <span style={{ color: '#334155', fontSize: 12 }}>No data</span>
                  )}
                </div>
              </div>

              {/* Product accordion */}
              {isOpen && (
                <ProductRows
                  categoryName={catName}
                  byProduct={byProduct}
                  daysElapsed={daysElapsed}
                />
              )}
            </React.Fragment>
          )
        })}
      </div>

      {/* ── Remaining run-rate footer ── */}
      {hasData && (
        <div style={{
          marginTop: 20,
          background: 'rgba(244,114,182,0.06)',
          border: '1px solid rgba(244,114,182,0.2)',
          borderRadius: 10, padding: '14px 20px',
          display: 'flex', alignItems: 'center', gap: 16,
        }}>
          <span style={{ fontSize: 12, color: '#94a3b8' }}>
            📅 {PACING_CONFIG.totalDays - daysElapsed} days remaining in April
          </span>
          {acct.ga4Revenue < acctTgt.ga4Revenue * daysElapsed && (
            <span style={{ fontSize: 13, color: '#f472b6', fontWeight: 600 }}>
              Required daily run-rate to close deficit:{' '}
              {fmt((acctTgt.ga4Revenue * PACING_CONFIG.totalDays - acct.ga4Revenue) / Math.max(PACING_CONFIG.totalDays - daysElapsed, 1))}
              /day
            </span>
          )}
          {acct.ga4Revenue >= acctTgt.ga4Revenue * daysElapsed && (
            <span style={{ fontSize: 13, color: '#22c55e', fontWeight: 600 }}>
              ✓ Ahead of pace — current run-rate: {fmt(acct.ga4Revenue / daysElapsed)}/day
            </span>
          )}
        </div>
      )}
    </div>
  )
}

// ── ProductRows sub-component ─────────────────────────────────────────────────
function ProductRows({ categoryName, byProduct, daysElapsed }) {
  const products = Object.entries(PRODUCT_TARGETS).filter(([, p]) => p.category === categoryName)
  if (!products.length) return null

  return (
    <div style={{ background: 'rgba(0,0,0,0.25)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      {/* Sub-header */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '48px 200px 160px 140px 80px 80px 80px 150px',
        padding: '7px 16px',
        fontSize: 10, color: '#334155',
        textTransform: 'uppercase', letterSpacing: 0.8,
        borderBottom: '1px solid rgba(255,255,255,0.04)',
      }}>
        <div /><div>Product</div><div>GA4 Rev (MTD)</div><div>Spend (MTD)</div>
        <div>ROAS</div><div>CPC</div><div>CR%</div><div>Breakpoint</div>
      </div>

      {products.map(([prodName, tgt]) => {
        // try to match by product name or alias
        const act        = byProduct[prodName] || byProduct[tgt.alias] || {}
        const cumRevTgt  = tgt.ga4Revenue * daysElapsed
        const cumSpndTgt = tgt.spend       * daysElapsed
        const revStatus  = rag(act.ga4Revenue || 0, cumRevTgt)
        const bp         = getBreakpoint(act, tgt)

        return (
          <div key={prodName} style={{
            display: 'grid',
            gridTemplateColumns: '48px 200px 160px 140px 80px 80px 80px 150px',
            padding: '10px 16px',
            borderBottom: '1px solid rgba(255,255,255,0.03)',
            alignItems: 'center',
          }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: C[revStatus].text, margin: '0 auto' }} />

            <div>
              <div style={{ fontSize: 12, fontWeight: 500, color: '#cbd5e1' }}>{prodName}</div>
              {tgt.alias && <div style={{ fontSize: 10, color: '#475569' }}>{tgt.alias}</div>}
            </div>

            <div>
              <div style={{ fontSize: 12, color: C[revStatus].text, fontWeight: 600 }}>{fmt(act.ga4Revenue || 0)}</div>
              <PaceBar actual={act.ga4Revenue || 0} target={cumRevTgt} />
            </div>

            <div>
              <div style={{ fontSize: 12, color: C[rag(act.spend||0,cumSpndTgt)].text, fontWeight: 600 }}>{fmt(act.spend || 0)}</div>
              <PaceBar actual={act.spend || 0} target={cumSpndTgt} />
            </div>

            <div style={{ fontSize: 12, color: C[rag(act.ga4ROAS||0,tgt.ga4ROAS)].text }}>{fmtX(act.ga4ROAS||0)}</div>
            <div style={{ fontSize: 12, color: C[rag(act.cpc||0,tgt.cpc,false)].text }}>{act.cpc ? '₹'+fmtN(act.cpc,0) : '—'}</div>
            <div style={{ fontSize: 12, color: C[rag(act.crPct||0,tgt.crPct)].text }}>{fmtPct(act.crPct||0)}</div>

            <div>
              {bp ? (
                <span style={{
                  background: C[bp.status].bg,
                  color: C[bp.status].text,
                  border: `1px solid ${C[bp.status].border}`,
                  borderRadius: 6, padding: '2px 8px', fontSize: 11,
                }}>{bp.label}</span>
              ) : act.spend > 0 ? (
                <span style={{ color: '#22c55e', fontSize: 11 }}>✓ On track</span>
              ) : (
                <span style={{ color: '#334155', fontSize: 11 }}>No data</span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
