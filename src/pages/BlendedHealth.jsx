import React, { useMemo } from 'react'
import { useData } from '../data/store.jsx'
import { useFilters } from '../hooks/useFilters.js'
import FilterBar from '../components/FilterBar.jsx'
import MetricCard from '../components/MetricCard.jsx'
import { fmtINRCompact, fmtX, fmtPct, fmtNum, deltaLabel } from '../utils/formatters.js'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, BarChart, Bar } from 'recharts'
import { format, eachDayOfInterval, eachMonthOfInterval, startOfMonth, endOfMonth, subMonths } from 'date-fns'

function aggMeta(rows) {
  return {
    spend: rows.reduce((s, r) => s + r.spend, 0),
    gaRevenue: rows.reduce((s, r) => s + r.gaRevenue, 0),
    gaOrders: rows.reduce((s, r) => s + r.gaOrders, 0),
    fbRevenue: rows.reduce((s, r) => s + r.fbRevenue, 0),
  }
}

function aggGoogle(rows) {
  return {
    cost: rows.reduce((s, r) => s + r.cost, 0),
    revenue: rows.reduce((s, r) => s + r.revenue, 0),
    transactions: rows.reduce((s, r) => s + r.transactions, 0),
  }
}

function aggGA4(rows) {
  return {
    revenue: rows.reduce((s, r) => s + r.revenue, 0),
    transactions: rows.reduce((s, r) => s + r.transactions, 0),
    sessions: rows.reduce((s, r) => s + r.sessions, 0),
  }
}

export default function BlendedHealth() {
  const { state, dispatch } = useData()
  const filters = useFilters('last30')
  const { filterRows, getPrevRows, dateFrom, dateTo } = filters

  const metaRows = useMemo(() => filterRows(state.metaDB), [state.metaDB, filters])
  const googleRows = useMemo(() => filterRows(state.googleDump, 'date'), [state.googleDump, filters])
  const ga4Rows = useMemo(() => filterRows(state.ga4Dump), [state.ga4Dump, filters])
  const metaPrev = useMemo(() => getPrevRows(state.metaDB), [state.metaDB, filters])
  const googlePrev = useMemo(() => getPrevRows(state.googleDump, 'date'), [state.googleDump, filters])
  const ga4Prev = useMemo(() => getPrevRows(state.ga4Dump), [state.ga4Dump, filters])

  const meta = useMemo(() => aggMeta(metaRows), [metaRows])
  const google = useMemo(() => aggGoogle(googleRows), [googleRows])
  const ga4 = useMemo(() => aggGA4(ga4Rows), [ga4Rows])
  const metaP = useMemo(() => aggMeta(metaPrev), [metaPrev])
  const googleP = useMemo(() => aggGoogle(googlePrev), [googlePrev])
  const ga4P = useMemo(() => aggGA4(ga4Prev), [ga4Prev])

  const uacSpend = googleRows.filter(r => r.campaignType === 'UAC').reduce((s, r) => s + r.cost, 0)
  const googleExclUAC = google.cost - uacSpend

  const totalSpend = meta.spend
    + (state.includeUAC ? google.cost : googleExclUAC)
    + state.clmSpend
    + state.retentionSpend

  const prevSpend = metaP.spend + googleP.cost

  // Use GA4 as truth — fall back to Meta+Google reported if no GA4
  const truthRevenue = ga4.revenue || (meta.gaRevenue + google.revenue)
  const truthOrders = ga4.transactions || (meta.gaOrders + google.transactions)
  const truthRevPrev = ga4P.revenue || (metaP.gaRevenue + googleP.revenue)
  const truthOrdersPrev = ga4P.transactions || (metaP.gaOrders + googleP.transactions)

  const blendedROAS = totalSpend > 0 ? truthRevenue / totalSpend : 0
  const blendedCAC = truthOrders > 0 ? totalSpend / truthOrders : 0
  const prevROAS = prevSpend > 0 ? truthRevPrev / prevSpend : 0
  const prevCAC = truthOrdersPrev > 0 ? prevSpend / truthOrdersPrev : 0

  // DOD trend
  const dodTrend = useMemo(() => {
    const days = eachDayOfInterval({ start: dateFrom, end: dateTo })
    return days.map(day => {
      const ds = format(day, 'yyyy-MM-dd')
      const mR = metaRows.filter(r => format(new Date(r.date), 'yyyy-MM-dd') === ds)
      const gR = googleRows.filter(r => format(new Date(r.date), 'yyyy-MM-dd') === ds)
      const g4R = ga4Rows.filter(r => format(new Date(r.date), 'yyyy-MM-dd') === ds)
      const ms = mR.reduce((s, r) => s + r.spend, 0)
      const gc = gR.reduce((s, r) => s + r.cost, 0)
      const rev = g4R.reduce((s, r) => s + r.revenue, 0) || mR.reduce((s, r) => s + r.gaRevenue, 0)
      const orders = g4R.reduce((s, r) => s + r.transactions, 0) || mR.reduce((s, r) => s + r.gaOrders, 0)
      const spend = ms + gc
      return {
        date: format(day, 'd MMM'),
        spend: Math.round(spend / 1000),
        revenue: Math.round(rev / 1000),
        roas: spend > 0 ? +(rev / spend).toFixed(2) : 0,
        cac: orders > 0 ? Math.round(spend / orders) : 0,
      }
    })
  }, [metaRows, googleRows, ga4Rows, dateFrom, dateTo])

  // MoM trend — last 6 months
  const momTrend = useMemo(() => {
    const months = []
    for (let i = 5; i >= 0; i--) {
      const d = subMonths(new Date(), i)
      const from = startOfMonth(d); const to = endOfMonth(d)
      const mR = state.metaDB.filter(r => { const dt = new Date(r.date); return dt >= from && dt <= to })
      const gR = state.googleDump.filter(r => { const dt = new Date(r.date); return dt >= from && dt <= to })
      const g4R = state.ga4Dump.filter(r => { const dt = new Date(r.date); return dt >= from && dt <= to })
      const ms = mR.reduce((s, r) => s + r.spend, 0)
      const gc = gR.reduce((s, r) => s + r.cost, 0)
      const rev = g4R.reduce((s, r) => s + r.revenue, 0) || mR.reduce((s, r) => s + r.gaRevenue, 0)
      const orders = g4R.reduce((s, r) => s + r.transactions, 0) || mR.reduce((s, r) => s + r.gaOrders, 0)
      const spend = ms + gc
      months.push({
        label: format(d, "MMM''yy"),
        metaSpend: Math.round(ms / 100000),
        googleSpend: Math.round(gc / 100000),
        revenue: Math.round(rev / 100000),
        roas: spend > 0 ? +(rev / spend).toFixed(2) : 0,
        cac: orders > 0 ? Math.round(spend / orders) : 0,
      })
    }
    return months
  }, [state.metaDB, state.googleDump, state.ga4Dump])

  // Spend composition
  const spendComposition = [
    { name: 'Meta', value: meta.spend, color: 'var(--pink)', pct: totalSpend > 0 ? meta.spend / totalSpend * 100 : 0 },
    { name: `Google${state.includeUAC ? '' : ' (excl UAC)'}`, value: state.includeUAC ? google.cost : googleExclUAC, color: 'var(--blue)', pct: totalSpend > 0 ? (state.includeUAC ? google.cost : googleExclUAC) / totalSpend * 100 : 0 },
    ...(state.clmSpend > 0 ? [{ name: 'CLM', value: state.clmSpend, color: 'var(--green)', pct: state.clmSpend / totalSpend * 100 }] : []),
    ...(state.retentionSpend > 0 ? [{ name: 'Retention', value: state.retentionSpend, color: 'var(--amber)', pct: state.retentionSpend / totalSpend * 100 }] : []),
  ]

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 2 }}>Blended health</h1>
        <div style={{ fontSize: 12, color: 'var(--text3)' }}>True blended ROAS and CAC · GA4 as revenue source of truth</div>
      </div>
      <FilterBar filters={filters} />

      {/* Spend toggles */}
      <div style={{ background: 'var(--bg2)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', padding: '10px 14px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 500 }}>Include in blended calculation:</span>

        {[
          { label: 'Meta', key: null, fixed: true, color: 'var(--pink)' },
          { label: 'Google (excl UAC)', key: null, fixed: true, color: 'var(--blue)' },
          { label: 'Include UAC', key: 'includeUAC', color: 'var(--amber)' },
        ].map(item => (
          <label key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: item.fixed ? 'default' : 'pointer' }}>
            <input type="checkbox"
              checked={item.fixed ? true : state[item.key]}
              disabled={item.fixed}
              onChange={e => item.key && dispatch({ type: item.key === 'includeUAC' ? 'SET_INCLUDE_UAC' : '', value: e.target.checked })}
            />
            <span style={{ color: item.color }}>{item.label}</span>
          </label>
        ))}

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12, color: 'var(--green)' }}>CLM spend ₹L:</span>
          <input type="number" min="0" step="0.1" value={state.clmSpend / 100000 || ''}
            onChange={e => dispatch({ type: 'SET_CLM_SPEND', value: (parseFloat(e.target.value) || 0) * 100000 })}
            style={{ width: 80, padding: '3px 8px', fontSize: 12, background: 'var(--bg3)', border: '0.5px solid var(--border2)', borderRadius: 6, color: 'var(--text)' }}
            placeholder="0" />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12, color: 'var(--amber)' }}>Retention spend ₹L:</span>
          <input type="number" min="0" step="0.1" value={state.retentionSpend / 100000 || ''}
            onChange={e => dispatch({ type: 'SET_RETENTION_SPEND', value: (parseFloat(e.target.value) || 0) * 100000 })}
            style={{ width: 80, padding: '3px 8px', fontSize: 12, background: 'var(--bg3)', border: '0.5px solid var(--border2)', borderRadius: 6, color: 'var(--text)' }}
            placeholder="0" />
        </div>
      </div>

      {/* Blended KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 10, marginBottom: 16 }}>
        <MetricCard label="Blended ROAS" value={fmtX(blendedROAS)} accent="var(--green)"
          sublabel="GA4 rev ÷ all paid spend"
          delta={deltaLabel(blendedROAS, prevROAS)} />
        <MetricCard label="Blended CAC" value={fmtINRCompact(blendedCAC)} accent="var(--green)"
          sublabel="All spend ÷ GA4 orders"
          delta={deltaLabel(blendedCAC, prevCAC, true)} />
        <MetricCard label="Total spend" value={fmtINRCompact(totalSpend)} accent="var(--amber)"
          delta={deltaLabel(totalSpend, prevSpend)} />
        <MetricCard label="GA4 revenue" value={fmtINRCompact(truthRevenue)} accent="var(--purple)"
          sublabel="Source of truth"
          delta={deltaLabel(truthRevenue, truthRevPrev)} />
      </div>

      {/* Spend composition */}
      <div style={{ background: 'var(--bg2)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '14px 16px', marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Spend composition</div>
        <div style={{ display: 'flex', gap: 0, height: 20, borderRadius: 4, overflow: 'hidden', marginBottom: 8 }}>
          {spendComposition.filter(s => s.value > 0).map(s => (
            <div key={s.name} style={{ width: `${s.pct}%`, background: s.color, opacity: 0.85, transition: 'width .3s' }} title={`${s.name}: ${fmtINRCompact(s.value)}`} />
          ))}
        </div>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {spendComposition.filter(s => s.value > 0).map(s => (
            <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: s.color }} />
              <span style={{ color: 'var(--text2)' }}>{s.name}</span>
              <span style={{ fontWeight: 500 }}>{fmtINRCompact(s.value)}</span>
              <span style={{ color: 'var(--text3)' }}>{s.pct.toFixed(1)}%</span>
            </div>
          ))}
        </div>
      </div>

      {/* DOD trend */}
      {dodTrend.length > 1 && (
        <div style={{ background: 'var(--bg2)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '14px 16px', marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Daily ROAS trend</div>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={dodTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--text3)' }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="spend" tick={{ fontSize: 11, fill: 'var(--text3)' }} axisLine={false} tickLine={false} unit="K" />
              <YAxis yAxisId="roas" orientation="right" tick={{ fontSize: 11, fill: 'var(--text3)' }} axisLine={false} tickLine={false} unit="x" />
              <Tooltip contentStyle={{ background: 'var(--bg3)', border: '0.5px solid var(--border2)', fontSize: 12 }} />
              <Line yAxisId="spend" type="monotone" dataKey="spend" stroke="var(--pink)" strokeWidth={1.5} dot={false} name="Spend (₹K)" />
              <Line yAxisId="spend" type="monotone" dataKey="revenue" stroke="var(--green)" strokeWidth={1.5} dot={false} name="Revenue (₹K)" />
              <Line yAxisId="roas" type="monotone" dataKey="roas" stroke="var(--amber)" strokeWidth={2} dot={false} name="Blended ROAS" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* MoM trend */}
      {momTrend.some(m => m.revenue > 0) && (
        <div style={{ background: 'var(--bg2)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '14px 16px' }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Month-on-month spend vs revenue</div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={momTrend} barSize={16}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--text3)' }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="val" tick={{ fontSize: 11, fill: 'var(--text3)' }} axisLine={false} tickLine={false} unit="L" />
              <YAxis yAxisId="roas" orientation="right" tick={{ fontSize: 11, fill: 'var(--text3)' }} axisLine={false} tickLine={false} unit="x" />
              <Tooltip contentStyle={{ background: 'var(--bg3)', border: '0.5px solid var(--border2)', fontSize: 12 }}
                formatter={(v, n) => n.includes('ROAS') || n.includes('x') ? [`${v}x`, n] : [`₹${v}L`, n]} />
              <Bar yAxisId="val" dataKey="metaSpend" fill="var(--pink)" name="Meta spend (₹L)" opacity={0.8} radius={[2,2,0,0]} stackId="spend" />
              <Bar yAxisId="val" dataKey="googleSpend" fill="var(--blue)" name="Google spend (₹L)" opacity={0.8} radius={[2,2,0,0]} stackId="spend" />
              <Line yAxisId="roas" type="monotone" dataKey="roas" stroke="var(--amber)" strokeWidth={2} dot={{ fill: 'var(--amber)', r: 3 }} name="Blended ROAS" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
