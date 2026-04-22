import React, { useMemo } from 'react'
import { useData } from '../data/store.jsx'
import { useFilters } from '../hooks/useFilters.js'
import { aggregateRows, calcROAS, calcCAC, calcROASGap } from '../utils/metrics.js'
import { fmtINRCompact, fmtX, fmtPct, fmtNum, deltaLabel } from '../utils/formatters.js'
import FilterBar from '../components/FilterBar.jsx'
import DrillTable from '../components/DrillTable.jsx'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { format, eachDayOfInterval } from 'date-fns'

// ── Design tokens (Figma-matched) ─────────────────────────────────────────────
const C = {
  green:  'var(--green)',
  pink:   'var(--pink)',
  blue:   'var(--blue)',
  purple: 'var(--purple)',
  amber:  'var(--amber)',
  red:    'var(--red)',
  text:   'var(--text)',
  text2:  'var(--text2)',
  text3:  'var(--text3)',
  bg2:    'var(--bg2)',
  bg3:    'var(--bg3)',
  border: 'var(--border)',
}

// ── KPI card matching Figma design ────────────────────────────────────────────
function KPI({ label, value, sublabel, delta, color = C.text, lowerBetter = false }) {
  const dl = typeof delta === 'object' ? delta : null
  return (
    <div style={{
      background: C.bg2, border: '0.5px solid var(--border)',
      borderRadius: 'var(--radius-lg)', padding: '16px 18px',
    }}>
      <div style={{ fontSize: 10, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, color: C.text, letterSpacing: '-0.02em', lineHeight: 1.1, marginBottom: 4, fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </div>
      {dl && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: sublabel ? 4 : 0 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: dl.positive ? C.green : C.red }}>
            {dl.positive ? '▲' : '▼'} {dl.label}
          </span>
        </div>
      )}
      {sublabel && (
        <div style={{ fontSize: 11, color: C.text3 }}>{sublabel}</div>
      )}
    </div>
  )
}

// ── Section label ─────────────────────────────────────────────────────────────
function SectionLabel({ children }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 700, color: C.text3, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
      {children}
    </div>
  )
}

// ── Metric row inside channel card ────────────────────────────────────────────
function MetricRow({ label, value, delta, last = false }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '8px 0', borderBottom: last ? 'none' : '0.5px solid var(--border)',
      fontSize: 13,
    }}>
      <span style={{ color: C.text2 }}>{label}</span>
      <span style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, color: C.text }}>
        {value}
        {delta && (
          <span style={{ fontSize: 11, fontWeight: 600, color: delta.positive ? C.green : C.red }}>
            {delta.positive ? '+' : ''}{delta.label}
          </span>
        )}
      </span>
    </div>
  )
}

export default function Weekly() {
  const { state } = useData()
  const filters = useFilters('last7')
  const { filterRows, getPrevRows, dateFrom, dateTo } = filters

  const metaRows  = useMemo(() => filterRows(state.metaDB), [state.metaDB, filters])
  const metaPrev  = useMemo(() => getPrevRows(state.metaDB), [state.metaDB, filters])
  const googleRows = useMemo(() => filterRows(state.googleDump, 'date'), [state.googleDump, filters])
  const googlePrev = useMemo(() => getPrevRows(state.googleDump, 'date'), [state.googleDump, filters])
  const ga4Rows   = useMemo(() => filterRows(state.ga4Dump), [state.ga4Dump, filters])
  const ga4Prev   = useMemo(() => getPrevRows(state.ga4Dump), [state.ga4Dump, filters])

  const meta  = useMemo(() => aggregateRows(metaRows), [metaRows])
  const metaP = useMemo(() => aggregateRows(metaPrev), [metaPrev])

  const google = useMemo(() => ({
    cost:         googleRows.reduce((s,r) => s+r.cost, 0),
    impressions:  googleRows.reduce((s,r) => s+r.impressions, 0),
    clicks:       googleRows.reduce((s,r) => s+r.clicks, 0),
    revenue:      googleRows.reduce((s,r) => s+r.revenue, 0),
    transactions: googleRows.reduce((s,r) => s+r.transactions, 0),
    sessions:     googleRows.reduce((s,r) => s+r.sessions, 0),
  }), [googleRows])

  const googleP = useMemo(() => ({
    cost:         googlePrev.reduce((s,r) => s+r.cost, 0),
    revenue:      googlePrev.reduce((s,r) => s+r.revenue, 0),
    transactions: googlePrev.reduce((s,r) => s+r.transactions, 0),
  }), [googlePrev])

  const ga4 = useMemo(() => ({
    revenue:      ga4Rows.reduce((s,r) => s+r.revenue, 0),
    transactions: ga4Rows.reduce((s,r) => s+r.transactions, 0),
    sessions:     ga4Rows.reduce((s,r) => s+r.sessions, 0),
  }), [ga4Rows])

  const ga4P = useMemo(() => ({
    revenue:      ga4Prev.reduce((s,r) => s+r.revenue, 0),
    transactions: ga4Prev.reduce((s,r) => s+r.transactions, 0),
    sessions:     ga4Prev.reduce((s,r) => s+r.sessions, 0),
  }), [ga4Prev])

  const uacRows      = googleRows.filter(r => r.campaignType === 'UAC')
  const uacSpend     = uacRows.reduce((s,r) => s+r.cost, 0)
  const googleExclUAC = google.cost - uacSpend
  const totalSpend   = meta.spend + (state.includeUAC ? google.cost : googleExclUAC) + state.clmSpend + state.retentionSpend
  const blendedROAS  = ga4.revenue > 0 && totalSpend > 0 ? ga4.revenue / totalSpend : 0
  const blendedCAC   = ga4.transactions > 0 && totalSpend > 0 ? totalSpend / ga4.transactions : 0

  const prevTotalSpend = (metaP.spend||0) + (googleP.cost||0)
  const prevBlendedROAS = ga4P.revenue > 0 && prevTotalSpend > 0 ? ga4P.revenue / prevTotalSpend : null
  const prevBlendedCAC  = ga4P.transactions > 0 && prevTotalSpend > 0 ? prevTotalSpend / ga4P.transactions : null

  const metaROAS  = calcROAS(meta.gaRevenue, meta.spend)
  const metaPROAS = calcROAS(metaP.gaRevenue, metaP.spend)
  const metaCPA   = meta.gaOrders > 0 ? meta.spend / meta.gaOrders : 0
  const metaPCPA  = metaP.gaOrders > 0 ? metaP.spend / metaP.gaOrders : null
  const metaCTR   = meta.impressions > 0 ? meta.clicks / meta.impressions : 0
  const metaCPM   = meta.impressions > 0 ? (meta.spend / meta.impressions) * 1000 : 0

  const gROAS     = google.cost > 0 ? google.revenue / google.cost : 0
  const gPROAS    = googleP.cost > 0 ? googleP.revenue / googleP.cost : null
  const gCPA      = google.transactions > 0 ? google.cost / google.transactions : 0
  const gCTR      = google.impressions > 0 ? google.clicks / google.impressions : 0
  const gCPM      = google.impressions > 0 ? (google.cost / google.impressions) * 1000 : 0
  const prevUACSpend = googlePrev.filter(r => r.campaignType==='UAC').reduce((s,r)=>s+r.cost,0)
  const prevGExclUAC = googleP.cost - prevUACSpend

  const dailyTrend = useMemo(() => {
    const days = eachDayOfInterval({ start: dateFrom, end: dateTo })
    return days.map(day => {
      const ds = format(day, 'yyyy-MM-dd')
      const mRows = metaRows.filter(r => format(new Date(r.date), 'yyyy-MM-dd') === ds)
      const gRows = googleRows.filter(r => format(new Date(r.date), 'yyyy-MM-dd') === ds)
      const g4Rows = ga4Rows.filter(r => format(new Date(r.date), 'yyyy-MM-dd') === ds)
      return {
        date: format(day, 'd MMM'),
        metaSpend:    Math.round(mRows.reduce((s,r) => s+r.spend, 0) / 1000),
        googleSpend:  Math.round(gRows.reduce((s,r) => s+r.cost, 0) / 1000),
        revenue:      Math.round(g4Rows.reduce((s,r) => s+r.revenue, 0) / 1000),
      }
    })
  }, [metaRows, googleRows, ga4Rows, dateFrom, dateTo])

  const topProducts = useMemo(() => {
    const byProduct = {}
    for (const r of metaRows) {
      const p = r.product || 'Other'
      if (!byProduct[p]) byProduct[p] = { product: p, spend: 0, gaRevenue: 0, gaOrders: 0 }
      byProduct[p].spend      += r.spend
      byProduct[p].gaRevenue  += r.gaRevenue
      byProduct[p].gaOrders   += r.gaOrders
    }
    return Object.values(byProduct)
      .map(p => ({ ...p, roas: p.spend > 0 ? p.gaRevenue / p.spend : 0, cpa: p.gaOrders > 0 ? p.spend / p.gaOrders : 0 }))
      .sort((a,b) => b.gaRevenue - a.gaRevenue)
      .slice(0, 10)
  }, [metaRows])

  const noData = !state.metaDB.length && !state.googleDump.length

  return (
    <div style={{ padding: '24px 28px', width: '100%', boxSizing: 'border-box' }}>
      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 2, letterSpacing: '-0.02em' }}>Weekly dashboard</h1>
        <div style={{ fontSize: 12, color: C.text3 }}>Meta + Google · GA4 as source of truth</div>
      </div>

      <FilterBar filters={filters} />

      {noData && (
        <div style={{ padding: '40px 20px', textAlign: 'center', background: C.bg2, borderRadius: 'var(--radius-lg)', border: '0.5px dashed var(--border2)', marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 6 }}>No data loaded</div>
          <div style={{ fontSize: 12, color: C.text3 }}>Use the Upload tab to load your Meta, Google, or GA4 exports — or sync Windsor.</div>
        </div>
      )}

      {/* ── Blended commercial health ── */}
      <SectionLabel>Blended commercial health</SectionLabel>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 10, marginBottom: 10, width: '100%' }}>
        <KPI label="Blended ROAS" value={fmtX(blendedROAS)} color={C.green}
          sublabel="GA4 rev ÷ all paid spend"
          delta={prevBlendedROAS ? deltaLabel(blendedROAS, prevBlendedROAS) : null} />
        <KPI label="Blended CAC" value={fmtINRCompact(blendedCAC)} color={C.green}
          sublabel="All spend ÷ GA4 orders"
          delta={prevBlendedCAC ? deltaLabel(blendedCAC, prevBlendedCAC, true) : null} />
        <KPI label="Total spend" value={fmtINRCompact(totalSpend)} color={C.amber}
          sublabel={`Meta + Google${state.includeUAC ? '' : ' excl UAC'}`}
          delta={deltaLabel(totalSpend, prevTotalSpend)} />
        <KPI label="GA4 revenue" value={fmtINRCompact(ga4.revenue)} color={C.purple}
          sublabel="Source of truth"
          delta={deltaLabel(ga4.revenue, ga4P.revenue)} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 10, marginBottom: 20, width: '100%' }}>
        <KPI label="GA4 orders" value={fmtNum(ga4.transactions)} color={C.text3}
          sublabel="Transactions"
          delta={deltaLabel(ga4.transactions, ga4P.transactions)} />
        <KPI label="GA4 sessions" value={fmtNum(ga4.sessions)} color={C.text3}
          sublabel="All channels"
          delta={deltaLabel(ga4.sessions, ga4P.sessions)} />
        <KPI label="CVR" value={fmtPct(ga4.sessions > 0 ? ga4.transactions / ga4.sessions : 0)}
          color={C.text3} sublabel="Session → purchase" />
        <KPI label="AOV" value={fmtINRCompact(ga4.transactions > 0 ? ga4.revenue / ga4.transactions : 0)}
          color={C.text3} sublabel="GA4 average order" />
      </div>

      {/* ── Channel breakdown ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20, width: '100%' }}>
        {/* Meta card */}
        <div style={{ background: C.bg2, border: '0.5px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '16px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <span style={{ fontSize: 15, fontWeight: 700 }}>Meta</span>
            <span className="pill pill-meta">GA4</span>
          </div>
          <MetricRow label="Spend"      value={fmtINRCompact(meta.spend)}  delta={deltaLabel(meta.spend, metaP.spend)} />
          <MetricRow label="GA4 ROAS"   value={fmtX(metaROAS)}             delta={deltaLabel(metaROAS, metaPROAS)} />
          <MetricRow label="CPA (GA4)"  value={fmtINRCompact(metaCPA)}     delta={deltaLabel(metaCPA, metaPCPA, true)} />
          <MetricRow label="CTR"        value={fmtPct(metaCTR)} />
          <MetricRow label="CPM"        value={fmtINRCompact(metaCPM)} last />
        </div>

        {/* Google card */}
        <div style={{ background: C.bg2, border: '0.5px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '16px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <span style={{ fontSize: 15, fontWeight: 700 }}>Google</span>
            <span className="pill pill-google">GA4 sourced</span>
          </div>
          <MetricRow label="Spend (excl UAC)" value={fmtINRCompact(googleExclUAC)} delta={deltaLabel(googleExclUAC, prevGExclUAC)} />
          <MetricRow label="UAC spend"         value={fmtINRCompact(uacSpend)} />
          <MetricRow label="Revenue (GA4)"     value={fmtINRCompact(google.revenue)} delta={deltaLabel(google.revenue, googleP.revenue)} />
          <MetricRow label="ROAS (GA4)"        value={fmtX(gROAS)}                   delta={deltaLabel(gROAS, gPROAS)} />
          <MetricRow label="CPA (GA4)"         value={fmtINRCompact(gCPA)} />
          <MetricRow label="CTR"               value={fmtPct(gCTR)} />
          <MetricRow label="CPM"               value={fmtINRCompact(gCPM)} last />
        </div>
      </div>

      {/* ── Daily trend chart ── */}
      {dailyTrend.length > 1 && (
        <div style={{ background: C.bg2, border: '0.5px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '16px 18px', marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>Daily spend + revenue trend</div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={dailyTrend} barSize={12}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: C.text3 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: C.text3 }} axisLine={false} tickLine={false} unit="K" />
              <Tooltip contentStyle={{ background: 'var(--bg3)', border: '0.5px solid var(--border2)', borderRadius: 6, fontSize: 12 }}
                formatter={(v,n) => [`₹${v}K`, n]} />
              <Bar dataKey="metaSpend"   fill="var(--pink)"  name="Meta spend"   opacity={0.85} radius={[3,3,0,0]} />
              <Bar dataKey="googleSpend" fill="var(--blue)"  name="Google spend" opacity={0.85} radius={[3,3,0,0]} />
              <Bar dataKey="revenue"     fill="var(--green)" name="GA4 revenue"  opacity={0.6}  radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Top products ── */}
      {topProducts.length > 0 && (
        <div style={{ background: C.bg2, border: '0.5px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '16px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>Top products</span>
            <span className="pill pill-meta">Meta · GA4 revenue</span>
          </div>
          <DrillTable compact
            columns={[
              { key: 'product',   label: 'Product',  align: 'left', bold: true },
              { key: 'spend',     label: 'Spend',    render: v => fmtINRCompact(v) },
              { key: 'gaRevenue', label: 'GA4 Rev',  render: v => fmtINRCompact(v), color: () => 'var(--purple)' },
              { key: 'gaOrders',  label: 'Orders',   render: v => fmtNum(v) },
              { key: 'roas',      label: 'ROAS',     render: v => fmtX(v), color: v => v>=4?'var(--green)':v>=2?'var(--amber)':'var(--red)' },
              { key: 'cpa',       label: 'CPA',      render: v => fmtINRCompact(v) },
            ]}
            data={topProducts}
            defaultSort={{ key: 'gaRevenue', dir: 'desc' }}
          />
        </div>
      )}
    </div>
  )
}
