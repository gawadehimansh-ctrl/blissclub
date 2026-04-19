import React, { useMemo, useState } from 'react'
import { useData } from '../data/store.jsx'
import {
  CATEGORY_TARGETS,
  PRODUCT_TARGETS,
  DELTA_OK,
  DELTA_WARN,
  PACING_CONFIG,
  getCategoryForProduct,
} from '../data/targets.js'

// ── Formatters ────────────────────────────────────────────────────────────────
const fmt = (n) => {
  if (n === undefined || n === null || isNaN(n)) return '—'
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)}Cr`
  if (n >= 100000)   return `₹${(n / 100000).toFixed(2)}L`
  if (n >= 1000)     return `₹${(n / 1000).toFixed(1)}K`
  return `₹${Math.round(n)}`
}
const fmtX   = (n) => (n == null || isNaN(n) ? '—' : `${Number(n).toFixed(2)}x`)
const fmtPct = (n) => (n == null || isNaN(n) ? '—' : `${(n * 100).toFixed(1)}%`)

// ── Days elapsed ──────────────────────────────────────────────────────────────
function getDaysElapsed() {
  const start     = new Date(PACING_CONFIG.startDate)
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  if (yesterday < start) return 1
  const diff = Math.floor((yesterday - start) / 86400000) + 1
  return Math.min(diff, PACING_CONFIG.totalDays)
}

// ── RAG ───────────────────────────────────────────────────────────────────────
function rag(actual, target, higher = true) {
  if (!target || target === 0 || actual === 0) return 'neutral'
  const ratio = actual / target
  if (higher) {
    if (ratio >= DELTA_OK)   return 'green'
    if (ratio >= DELTA_WARN) return 'amber'
    return 'red'
  } else {
    if (ratio <= (2 - DELTA_OK))   return 'green'
    if (ratio <= (2 - DELTA_WARN)) return 'amber'
    return 'red'
  }
}

const C = {
  green:   { bg: 'rgba(22,163,74,0.08)',  text: '#16a34a', border: 'rgba(22,163,74,0.2)' },
  amber:   { bg: 'rgba(180,83,9,0.08)',   text: '#b45309', border: 'rgba(180,83,9,0.2)' },
  red:     { bg: 'rgba(220,38,38,0.08)',  text: '#dc2626', border: 'rgba(220,38,38,0.2)' },
  neutral: { bg: 'transparent',           text: 'var(--text3)', border: 'var(--border)' },
}

// ── Breakpoint detector ───────────────────────────────────────────────────────
function getBreakpoint(act = {}, tgt = {}) {
  if (!act.spend || act.spend === 0) return { label: 'Spend under-pacing', status: 'red' }
  const checks = [
    { key: 'cpc',      label: 'CPC over target',       higher: false },
    { key: 'cps',      label: 'Cost/Session too high',  higher: false },
    { key: 'sessions', label: 'Sessions low',           higher: true  },
    { key: 'crPct',    label: 'CR% low',                higher: true  },
    { key: 'orders',   label: 'Orders low',             higher: true  },
  ]
  for (const { key, label, higher } of checks) {
    const a = act[key] ?? 0
    const t = tgt[key]
    if (!t) continue
    const status = rag(a, t, higher)
    if (status === 'red' || status === 'amber') return { label, status }
  }
  return null
}

// ── Aggregate actuals from metaDB rows ────────────────────────────────────────
function aggregateActuals(metaDB) {
  const rows = Array.isArray(metaDB) ? metaDB : (metaDB?.rows ?? [])
  const byCategory = {}
  const byProduct  = {}

  for (const row of rows) {
    // Use parser-assigned product, then derive category
    const prod = row.product || 'Other'
    const cat  = row.category || getCategoryForProduct(prod)

    for (const [map, key] of [[byCategory, cat], [byProduct, prod]]) {
      if (!map[key]) map[key] = { spend:0, clicks:0, sessions:0, ga4Revenue:0, orders:0, impressions:0 }
      map[key].spend       += Number(row.spend        || 0)
      map[key].clicks      += Number(row.clicks       || row.linkClicks  || 0)
      map[key].sessions    += Number(row.sessions     || row.ga4Sessions || 0)
      map[key].ga4Revenue  += Number(row.ga4Revenue   || row.gaRevenue   || 0)
      map[key].orders      += Number(row.ga4Orders    || row.gaOrders    || 0)
      map[key].impressions += Number(row.impressions  || 0)
    }
  }

  const derive = (a) => ({
    ...a,
    cpc:     a.clicks   > 0 ? a.spend / a.clicks   : 0,
    cps:     a.sessions > 0 ? a.spend / a.sessions  : 0,
    ga4ROAS: a.spend    > 0 ? a.ga4Revenue / a.spend : 0,
    crPct:   a.sessions > 0 ? a.orders / a.sessions  : 0,
  })

  Object.keys(byCategory).forEach(k => { byCategory[k] = derive(byCategory[k]) })
  Object.keys(byProduct).forEach(k  => { byProduct[k]  = derive(byProduct[k])  })
  return { byCategory, byProduct }
}

// ── PaceBar ───────────────────────────────────────────────────────────────────
function PaceBar({ actual, target, higher = true }) {
  if (!target) return null
  const pct    = Math.min((actual / target) * 100, 120)
  const status = rag(actual, target, higher)
  return (
    <div style={{ display:'flex', alignItems:'center', gap:5 }}>
      <div style={{ flex:1, height:3, background:'var(--bg4)', borderRadius:2, overflow:'hidden' }}>
        <div style={{ width:`${Math.min(pct,100)}%`, height:'100%', background:C[status].text, borderRadius:2 }} />
      </div>
      <span style={{ fontSize:10, color:C[status].text, minWidth:34, textAlign:'right' }}>
        {actual === 0 ? '0.0%' : `${pct.toFixed(0)}%`}
      </span>
    </div>
  )
}

// ── KPI Summary card ─────────────────────────────────────────────────────────
function KPICard({ label, actual, target, formatter=fmt, higher=true }) {
  const daysElapsed = getDaysElapsed()
  const cumTarget   = target * daysElapsed
  const status      = rag(actual, cumTarget, higher)
  const remaining   = Math.max(PACING_CONFIG.totalDays - daysElapsed, 1)
  const deficit     = cumTarget - actual
  const runRate     = deficit > 0 ? deficit / remaining : 0

  return (
    <div style={{
      background:'var(--bg2)', border:'1px solid var(--border)',
      borderRadius:'var(--radius)', padding:'14px 16px', flex:1, minWidth:140, borderTop:'3px solid ' + (status === 'green' ? 'var(--green)' : status === 'amber' ? 'var(--amber)' : status === 'red' ? 'var(--red)' : 'var(--border2)'),
    }}>
      <div style={{ fontSize:10, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:6, fontWeight:600 }}>{label}</div>
      <div style={{ fontSize:22, fontWeight:600, color:'var(--text)', letterSpacing:'-0.02em', fontVariantNumeric:'tabular-nums', marginBottom:2 }}>{formatter(actual)}</div>
      <div style={{ fontSize:10.5, color:'var(--text3)', marginBottom:6 }}>MTD target {formatter(cumTarget)}</div>
      <PaceBar actual={actual} target={cumTarget} higher={higher} />
      {runRate > 0 && (
        <div style={{ fontSize:10.5, color:'var(--text3)', marginTop:5 }}>
          Need: <span style={{ color:'var(--accent)' }}>{formatter(runRate)}/day</span>
        </div>
      )}
    </div>
  )
}

// ── Product row inside category accordion ─────────────────────────────────────
function ProductRow({ prodName, tgt, act, daysElapsed }) {
  const cumRev   = (tgt.ga4Revenue || 0) * daysElapsed
  const cumSpend = (tgt.spends     || 0) * daysElapsed

  const actRev   = act?.ga4Revenue || 0
  const actSpend = act?.spend      || 0
  const actRoas  = act?.ga4ROAS    || 0
  const actCpc   = act?.cpc        || 0
  const actCr    = act?.crPct      || 0
  const actOrd   = act?.orders     || 0

  const revStatus   = rag(actRev,   cumRev,         true)
  const spendStatus = rag(actSpend, cumSpend,        true)
  const roasStatus  = rag(actRoas,  tgt.ga4ROAS,    true)
  const cpcStatus   = rag(actCpc,   tgt.cpc,        false)
  const crStatus    = rag(actCr,    tgt.ecr,        true)

  const bp = getBreakpoint(act || {}, { ...tgt, spend: cumSpend, sessions: (tgt.spends/tgt.cps)*daysElapsed, crPct: tgt.ecr, orders: (tgt.minOrders||0)*daysElapsed })

  const hasData = actSpend > 0

  return (
    <tr style={{ borderBottom:'1px solid var(--border)' }}
      onMouseEnter={e=>e.currentTarget.style.background='var(--bg3)'}
      onMouseLeave={e=>e.currentTarget.style.background='transparent'}
    >
      {/* Product name */}
      <td style={{ padding:'8px 12px 8px 32px', minWidth:200 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <div style={{ width:6, height:6, borderRadius:'50%', background: hasData ? '#22c55e' : '#ef4444', flexShrink:0 }} />
          <div>
            <div style={{ fontSize:12.5, fontWeight:500, color:'var(--text)' }}>{tgt.alias || prodName}</div>
            <div style={{ fontSize:10.5, color:'var(--text3)' }}>{prodName}</div>
          </div>
        </div>
      </td>
      {/* GA4 Revenue */}
      <td style={{ padding:'8px 10px', textAlign:'right' }}>
        <div style={{ fontSize:12, fontWeight:600, color:C[revStatus].text }}>{fmt(actRev)}</div>
        <div style={{ fontSize:10, color:'var(--text3)' }}>tgt {fmt(cumRev)}</div>
        <PaceBar actual={actRev} target={cumRev} higher={true} />
      </td>
      {/* Spend */}
      <td style={{ padding:'8px 10px', textAlign:'right' }}>
        <div style={{ fontSize:12, fontWeight:600, color:C[spendStatus].text }}>{fmt(actSpend)}</div>
        <div style={{ fontSize:10, color:'var(--text3)' }}>tgt {fmt(cumSpend)}</div>
        <PaceBar actual={actSpend} target={cumSpend} higher={true} />
      </td>
      {/* ROAS */}
      <td style={{ padding:'8px 10px', textAlign:'right' }}>
        <div style={{ fontSize:12, fontWeight:600, color:C[roasStatus].text }}>{fmtX(actRoas)}</div>
        <div style={{ fontSize:10, color:'var(--text3)' }}>tgt {fmtX(tgt.ga4ROAS)}</div>
      </td>
      {/* CPC */}
      <td style={{ padding:'8px 10px', textAlign:'right' }}>
        <div style={{ fontSize:12, fontWeight:600, color:C[cpcStatus].text }}>{hasData ? fmt(actCpc) : '—'}</div>
        <div style={{ fontSize:10, color:'var(--text3)' }}>tgt {fmt(tgt.cpc)}</div>
      </td>
      {/* CR% */}
      <td style={{ padding:'8px 10px', textAlign:'right' }}>
        <div style={{ fontSize:12, fontWeight:600, color:C[crStatus].text }}>{hasData ? fmtPct(actCr) : '—'}</div>
        <div style={{ fontSize:10, color:'var(--text3)' }}>tgt {fmtPct(tgt.ecr)}</div>
      </td>
      {/* Breakpoint */}
      <td style={{ padding:'8px 10px', textAlign:'right' }}>
        {bp ? (
          <span style={{
            fontSize:10, padding:'2px 8px', borderRadius:6, fontWeight:500, whiteSpace:'nowrap',
            background:C[bp.status].bg, color:C[bp.status].text, border:`0.5px solid ${C[bp.status].border}`,
          }}>{bp.label}</span>
        ) : hasData ? (
          <span style={{ fontSize:10.5, color:'var(--green)', fontWeight:500 }}>On track</span>
        ) : (
          <span style={{ fontSize:10.5, color:'var(--text3)' }}>No data</span>
        )}
      </td>
    </tr>
  )
}

// ── Category row ──────────────────────────────────────────────────────────────
function CategoryRow({ catName, tgt, act, daysElapsed, byProduct }) {
  const [open, setOpen] = useState(false)

  const cumRev   = (tgt.ga4Revenue || 0) * daysElapsed
  const cumSpend = (tgt.spends     || 0) * daysElapsed

  const actRev   = act?.ga4Revenue || 0
  const actSpend = act?.spend      || 0
  const actRoas  = act?.ga4ROAS    || 0
  const actCpc   = act?.cpc        || 0
  const actCr    = act?.crPct      || 0

  const revStatus   = rag(actRev,   cumRev,       true)
  const spendStatus = rag(actSpend, cumSpend,     true)
  const roasStatus  = rag(actRoas,  tgt.ga4ROAS,  true)
  const cpcStatus   = rag(actCpc,   tgt.cpc,      false)
  const crStatus    = rag(actCr,    tgt.ecr,      true)

  const bp = getBreakpoint(
    act || {},
    { ...tgt, spend: cumSpend, sessions: cumSpend/tgt.cps, crPct: tgt.ecr }
  )

  // products belonging to this category (from PRODUCT_TARGETS)
  const catProducts = Object.entries(PRODUCT_TARGETS).filter(([, p]) => p.category === catName)
  const hasData     = actSpend > 0

  return (
    <>
      {/* Category row */}
      <tr
        onClick={() => catProducts.length > 0 && setOpen(o => !o)}
        style={{
          borderBottom:'1px solid var(--border)',
          cursor: catProducts.length > 0 ? 'pointer' : 'default',
          background: open ? 'rgba(255,255,255,0.03)' : 'transparent',
        }}
        onMouseEnter={e=>{ if (!open) e.currentTarget.style.background='rgba(255,255,255,0.025)' }}
        onMouseLeave={e=>{ if (!open) e.currentTarget.style.background='transparent' }}
      >
        {/* Name + chevron */}
        <td style={{ padding:'10px 12px', minWidth:200 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            {catProducts.length > 0 && (
              <span style={{ fontSize:10, color:'var(--text3)', transition:'transform .15s', display:'inline-block', transform: open ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
            )}
            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
              <div style={{ width:8, height:8, borderRadius:2, background: hasData ? '#22c55e' : '#ef4444', flexShrink:0 }} />
              <span style={{ fontSize:13, fontWeight:600, color:'var(--text)' }}>{catName}</span>
            </div>
            {catProducts.length > 0 && (
              <span style={{ fontSize:10.5, color:'var(--text3)', marginLeft:4 }}>{catProducts.length} products</span>
            )}
          </div>
        </td>
        {/* GA4 Revenue */}
        <td style={{ padding:'10px 10px', textAlign:'right' }}>
          <div style={{ fontSize:13, fontWeight:700, color:C[revStatus].text }}>{fmt(actRev)}</div>
          <div style={{ fontSize:10, color:'var(--text3)', marginBottom:3 }}>tgt {fmt(cumRev)}</div>
          <PaceBar actual={actRev} target={cumRev} higher={true} />
        </td>
        {/* Spend */}
        <td style={{ padding:'10px 10px', textAlign:'right' }}>
          <div style={{ fontSize:13, fontWeight:700, color:C[spendStatus].text }}>{fmt(actSpend)}</div>
          <div style={{ fontSize:10, color:'var(--text3)', marginBottom:3 }}>tgt {fmt(cumSpend)}</div>
          <PaceBar actual={actSpend} target={cumSpend} higher={true} />
        </td>
        {/* ROAS */}
        <td style={{ padding:'10px 10px', textAlign:'right' }}>
          <div style={{ fontSize:13, fontWeight:600, color:C[roasStatus].text }}>{fmtX(actRoas)}</div>
          <div style={{ fontSize:10, color:'var(--text3)' }}>tgt {fmtX(tgt.ga4ROAS)}</div>
        </td>
        {/* CPC */}
        <td style={{ padding:'10px 10px', textAlign:'right' }}>
          <div style={{ fontSize:13, fontWeight:600, color:C[cpcStatus].text }}>{hasData ? fmt(actCpc) : '—'}</div>
          <div style={{ fontSize:10, color:'var(--text3)' }}>tgt {fmt(tgt.cpc)}</div>
        </td>
        {/* CR% */}
        <td style={{ padding:'10px 10px', textAlign:'right' }}>
          <div style={{ fontSize:13, fontWeight:600, color:C[crStatus].text }}>{hasData ? fmtPct(actCr) : '—'}</div>
          <div style={{ fontSize:10, color:'var(--text3)' }}>tgt {fmtPct(tgt.ecr)}</div>
        </td>
        {/* Breakpoint */}
        <td style={{ padding:'10px 10px', textAlign:'right' }}>
          {bp ? (
            <span style={{
              fontSize:11, padding:'3px 10px', borderRadius:6, fontWeight:500, whiteSpace:'nowrap',
              background:C[bp.status].bg, color:C[bp.status].text, border:`0.5px solid ${C[bp.status].border}`,
            }}>{bp.label}</span>
          ) : hasData ? (
            <span style={{ fontSize:11, color:'var(--green)' }}>On track</span>
          ) : (
            <span style={{ fontSize:11, color:'var(--red)' }}>No data</span>
          )}
        </td>
      </tr>

      {/* Product rows — expanded */}
      {open && catProducts.map(([prodName, prodTgt]) => (
        <ProductRow
          key={prodName}
          prodName={prodName}
          tgt={prodTgt}
          act={byProduct[prodName]}
          daysElapsed={daysElapsed}
        />
      ))}
    </>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function PacingTracker() {
  const { state } = useData()
  const daysElapsed = getDaysElapsed()

  const { byCategory, byProduct } = useMemo(() => {
    const rows = Array.isArray(state.metaDB) ? state.metaDB : (state.metaDB?.rows ?? [])
    return aggregateActuals(rows)
  }, [state.metaDB])

  // Account-level totals
  const totals = useMemo(() => {
    const vals = Object.values(byCategory)
    const spend      = vals.reduce((s, v) => s + (v.spend || 0), 0)
    const ga4Revenue = vals.reduce((s, v) => s + (v.ga4Revenue || 0), 0)
    const orders     = vals.reduce((s, v) => s + (v.orders || 0), 0)
    const clicks     = vals.reduce((s, v) => s + (v.clicks || 0), 0)
    const sessions   = vals.reduce((s, v) => s + (v.sessions || 0), 0)
    return {
      spend,
      ga4Revenue,
      orders,
      ga4ROAS: spend > 0 ? ga4Revenue / spend : 0,
      cpc:     clicks > 0 ? spend / clicks : 0,
      crPct:   sessions > 0 ? orders / sessions : 0,
    }
  }, [byCategory])

  // Daily account targets
  const accountTgt = useMemo(() => {
    const cats = Object.values(CATEGORY_TARGETS)
    return {
      ga4Revenue: cats.reduce((s, c) => s + (c.ga4Revenue || 0), 0),
      spends:     cats.reduce((s, c) => s + (c.spends     || 0), 0),
    }
  }, [])

  const hasData = totals.spend > 0

  return (
    <div style={{ padding:'28px 32px' }}>
      {/* Header */}
      <div style={{ marginBottom:16 }}>
        <h1 style={{ fontSize:18, fontWeight:600, letterSpacing:'-0.025em', color:'var(--text)', marginBottom:2 }}>Pacing tracker</h1>
        <div style={{ fontSize:12, color:'var(--text3)' }}>
          Meta GA4 revenue · {PACING_CONFIG.month} · Day {daysElapsed} of {PACING_CONFIG.totalDays} ·
          Targets are <strong style={{ color:'var(--accent)', fontWeight:600 }}>daily benchmarks</strong> — cumulative shown vs days elapsed
        </div>
      </div>

      {/* No data banner */}
      {!hasData && (
        <div style={{
          background:'var(--red-dim)', border:'1px solid var(--red-border)',
          borderRadius:8, padding:'12px 16px', marginBottom:16, fontSize:13, color:'var(--red)',
        }}>
          No Meta data loaded — upload your Meta daily CSV from the Upload page to see live pacing
        </div>
      )}

      {/* KPI summary strip */}
      <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:16 }}>
        <KPICard label="Meta GA4 Revenue" actual={totals.ga4Revenue} target={accountTgt.ga4Revenue} formatter={fmt} higher={true} />
        <KPICard label="Total Spend"      actual={totals.spend}      target={accountTgt.spends}     formatter={fmt} higher={true} />
        <KPICard label="GA4 ROAS"         actual={totals.ga4ROAS}    target={1.70}                  formatter={fmtX} higher={true} />
        <KPICard label="Avg CPC"          actual={totals.cpc}        target={15.94}                 formatter={v => `₹${v.toFixed(0)}`} higher={false} />
        <KPICard label="Orders"           actual={totals.orders}     target={1657}                  formatter={v => Math.round(v).toLocaleString('en-IN')} higher={true} />
      </div>

      {/* Category table */}
      <div style={{ overflowX:'auto', borderRadius:'var(--radius)', border:'1px solid var(--border)', background:'var(--bg2)' }}>
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead>
            <tr>
              {['Category / Product','GA4 Revenue (MTD)','Spend (MTD)','GA4 ROAS','CPC','CR%','Breakpoint'].map((h,i) => (
                <th key={h} style={{
                  padding:'9px 12px', fontSize:10, fontWeight:600, color:'var(--text3)',
                  textTransform:'uppercase', letterSpacing:'0.05em',
                  borderBottom:'1px solid var(--border)', background:'var(--bg3)',
                  textAlign: i===0 ? 'left' : 'right', whiteSpace:'nowrap',
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Object.entries(CATEGORY_TARGETS).map(([catName, tgt]) => (
              <CategoryRow
                key={catName}
                catName={catName}
                tgt={tgt}
                act={byCategory[catName]}
                daysElapsed={daysElapsed}
                byProduct={byProduct}
              />
            ))}
          </tbody>
          {/* Grand total row */}
          <tfoot>
            <tr style={{ background:'var(--bg3)', borderTop:'1px solid var(--border2)' }}>
              <td style={{ padding:'10px 12px', fontSize:13, fontWeight:600, color:'var(--text)' }}>Grand Total</td>
              <td style={{ padding:'10px 10px', textAlign:'right', fontSize:13, fontWeight:700, color: rag(totals.ga4Revenue, accountTgt.ga4Revenue*daysElapsed) === 'green' ? '#22c55e' : '#ef4444' }}>
                {fmt(totals.ga4Revenue)}
                <div style={{ fontSize:10, color:'var(--text3)' }}>tgt {fmt(accountTgt.ga4Revenue * daysElapsed)}</div>
              </td>
              <td style={{ padding:'10px 10px', textAlign:'right', fontSize:13, fontWeight:600, color:'var(--text)' }}>
                {fmt(totals.spend)}
              </td>
              <td style={{ padding:'10px 10px', textAlign:'right', fontSize:13, fontWeight:600, color:'var(--text)' }}>
                {fmtX(totals.ga4ROAS)}
              </td>
              <td style={{ padding:'10px 10px', textAlign:'right', fontSize:13, fontWeight:600, color:'var(--text)' }}>
                {totals.cpc > 0 ? `₹${totals.cpc.toFixed(0)}` : '—'}
              </td>
              <td style={{ padding:'10px 10px', textAlign:'right', fontSize:13, fontWeight:600, color:'var(--text)' }}>
                {fmtPct(totals.crPct)}
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      <div style={{ marginTop:8, fontSize:11, color:'var(--text3)' }}>
        Day {daysElapsed} of {PACING_CONFIG.totalDays} elapsed · Click any category row to expand products · All targets are daily benchmarks × days elapsed
      </div>
    </div>
  )
}
