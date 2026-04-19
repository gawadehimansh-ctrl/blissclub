import React, { useMemo } from 'react'
import { useData } from '../data/store.jsx'
import { useFilters } from '../hooks/useFilters.js'
import { aggregateRows, calcROAS, calcCAC, calcROASGap } from '../utils/metrics.js'
import { fmtINRCompact, fmtX, fmtPct, fmtNum, deltaLabel } from '../utils/formatters.js'
import MetricCard from '../components/MetricCard.jsx'
import FilterBar from '../components/FilterBar.jsx'
import DrillTable from '../components/DrillTable.jsx'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid } from 'recharts'
import { format, eachDayOfInterval } from 'date-fns'

export default function Weekly() {
  const { state } = useData()
  const filters = useFilters('last7')
  const { filterRows, getPrevRows, dateFrom, dateTo } = filters

  // Meta filtered rows
  const metaRows = useMemo(() => filterRows(state.metaDB), [state.metaDB, filters])
  const metaPrev = useMemo(() => getPrevRows(state.metaDB), [state.metaDB, filters])

  // Google filtered rows
  const googleRows = useMemo(() => filterRows(state.googleDump, 'date'), [state.googleDump, filters])
  const googlePrev = useMemo(() => getPrevRows(state.googleDump, 'date'), [state.googleDump, filters])

  // GA4 filtered rows
  const ga4Rows = useMemo(() => filterRows(state.ga4Dump), [state.ga4Dump, filters])
  const ga4Prev = useMemo(() => getPrevRows(state.ga4Dump), [state.ga4Dump, filters])

  // Aggregated totals
  const meta = useMemo(() => aggregateRows(metaRows), [metaRows])
  const metaP = useMemo(() => aggregateRows(metaPrev), [metaPrev])
  const google = useMemo(() => ({
    cost: googleRows.reduce((s, r) => s + r.cost, 0),
    impressions: googleRows.reduce((s, r) => s + r.impressions, 0),
    clicks: googleRows.reduce((s, r) => s + r.clicks, 0),
    revenue: googleRows.reduce((s, r) => s + r.revenue, 0),
    transactions: googleRows.reduce((s, r) => s + r.transactions, 0),
    sessions: googleRows.reduce((s, r) => s + r.sessions, 0),
  }), [googleRows])
  const googleP = useMemo(() => ({
    cost: googlePrev.reduce((s, r) => s + r.cost, 0),
    revenue: googlePrev.reduce((s, r) => s + r.revenue, 0),
    transactions: googlePrev.reduce((s, r) => s + r.transactions, 0),
  }), [googlePrev])

  const ga4 = useMemo(() => ({
    revenue: ga4Rows.reduce((s, r) => s + r.revenue, 0),
    transactions: ga4Rows.reduce((s, r) => s + r.transactions, 0),
    sessions: ga4Rows.reduce((s, r) => s + r.sessions, 0),
  }), [ga4Rows])
  const ga4P = useMemo(() => ({
    revenue: ga4Prev.reduce((s, r) => s + r.revenue, 0),
    transactions: ga4Prev.reduce((s, r) => s + r.transactions, 0),
  }), [ga4Prev])

  // Blended metrics
  const uacRows = googleRows.filter(r => r.campaignType === 'UAC')
  const uacSpend = uacRows.reduce((s, r) => s + r.cost, 0)
  const googleExclUAC = google.cost - uacSpend
  const totalSpend = meta.spend + (state.includeUAC ? google.cost : googleExclUAC) + state.clmSpend + state.retentionSpend
  const blendedROAS = ga4.revenue > 0 && totalSpend > 0 ? ga4.revenue / totalSpend : 0
  const blendedCAC = ga4.transactions > 0 && totalSpend > 0 ? totalSpend / ga4.transactions : 0

  // Daily trend for sparkline
  const dailyTrend = useMemo(() => {
    const days = eachDayOfInterval({ start: dateFrom, end: dateTo })
    return days.map(day => {
      const ds = format(day, 'yyyy-MM-dd')
      const mRows = metaRows.filter(r => format(new Date(r.date), 'yyyy-MM-dd') === ds)
      const gRows = googleRows.filter(r => format(new Date(r.date), 'yyyy-MM-dd') === ds)
      const g4Rows = ga4Rows.filter(r => format(new Date(r.date), 'yyyy-MM-dd') === ds)
      const mSpend = mRows.reduce((s, r) => s + r.spend, 0)
      const gCost = gRows.reduce((s, r) => s + r.cost, 0)
      const rev = g4Rows.reduce((s, r) => s + r.revenue, 0)
      return {
        date: format(day, 'd MMM'),
        metaSpend: Math.round(mSpend / 1000),
        googleSpend: Math.round(gCost / 1000),
        revenue: Math.round(rev / 1000),
        roas: (mSpend + gCost) > 0 ? +(rev / (mSpend + gCost)).toFixed(2) : 0
      }
    })
  }, [metaRows, googleRows, ga4Rows, dateFrom, dateTo])

  // Top products from Meta GA revenue
  const topProducts = useMemo(() => {
    const byProduct = {}
    for (const r of metaRows) {
      const p = r.product || 'Other'
      if (!byProduct[p]) byProduct[p] = { product: p, spend: 0, gaRevenue: 0, gaOrders: 0 }
      byProduct[p].spend += r.spend
      byProduct[p].gaRevenue += r.gaRevenue
      byProduct[p].gaOrders += r.gaOrders
    }
    return Object.values(byProduct)
      .map(p => ({ ...p, roas: p.spend > 0 ? p.gaRevenue / p.spend : 0, cpa: p.gaOrders > 0 ? p.spend / p.gaOrders : 0 }))
      .sort((a, b) => b.gaRevenue - a.gaRevenue)
      .slice(0, 10)
  }, [metaRows])

  const noData = !state.metaDB.length && !state.googleDump.length

  const cardRow = { display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 10, marginBottom: 12 }

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 18, fontWeight: 600, marginBottom: 2 }}>Weekly dashboard</h1>
        <div style={{ fontSize: 12, color: 'var(--text3)' }}>Meta + Google · GA4 as source of truth</div>
      </div>

      <FilterBar filters={filters} />

      {noData && (
        <div style={{ padding: '40px 20px', textAlign: 'center', background: 'var(--bg2)', borderRadius: 'var(--radius-lg)', border: '0.5px dashed var(--border2)', marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 6 }}>No data loaded</div>
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>Use the Upload tab to load your Meta, Google, or GA4 CSV exports — or connect Windsor in Settings.</div>
        </div>
      )}

      {/* Blended health */}
      <div style={{ marginBottom: 8, fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Blended commercial health</div>
      <div style={cardRow}>
        <MetricCard label="Blended ROAS" value={fmtX(blendedROAS)} accent="var(--green)"
          sublabel="GA4 rev ÷ all paid spend"
          delta={deltaLabel(blendedROAS, ga4P.revenue > 0 && (metaP.spend || 0) + (googleP.cost || 0) > 0 ? ga4P.revenue / ((metaP.spend || 0) + (googleP.cost || 0)) : null)} />
        <MetricCard label="Blended CAC" value={fmtINRCompact(blendedCAC)} accent="var(--green)"
          sublabel="All spend ÷ GA4 orders"
          delta={deltaLabel(blendedCAC, ga4P.transactions > 0 ? ((metaP.spend || 0) + (googleP.cost || 0)) / ga4P.transactions : null, true)} />
        <MetricCard label="Total spend" value={fmtINRCompact(totalSpend)} accent="var(--amber)"
          sublabel={`Meta + Google${state.includeUAC ? '' : ' excl UAC'}`}
          delta={deltaLabel(totalSpend, (metaP.spend || 0) + (googleP.cost || 0))} />
        <MetricCard label="GA4 revenue" value={fmtINRCompact(ga4.revenue)} accent="var(--purple)"
          sublabel="Source of truth"
          delta={deltaLabel(ga4.revenue, ga4P.revenue)} />
      </div>

      <div style={cardRow}>
        <MetricCard label="GA4 orders" value={fmtNum(ga4.transactions)} sublabel="Transactions"
          delta={deltaLabel(ga4.transactions, ga4P.transactions)} />
        <MetricCard label="GA4 sessions" value={fmtNum(ga4.sessions)} sublabel="All channels"
          delta={deltaLabel(ga4.sessions, ga4Rows.length > 0 ? ga4P.sessions || null : null)} />
        <MetricCard label="CVR" value={fmtPct(ga4.sessions > 0 ? ga4.transactions / ga4.sessions : 0)} sublabel="session → purchase" />
        <MetricCard label="AOV" value={fmtINRCompact(ga4.transactions > 0 ? ga4.revenue / ga4.transactions : 0)} sublabel="GA4 average order" />
      </div>

      {/* Channel cards side by side */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
        {/* Meta */}
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '14px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>Meta</span>
            <span className="pill pill-meta">GA4</span>
          </div>
          {[
            ['Spend', fmtINRCompact(meta.spend), deltaLabel(meta.spend, metaP.spend), false],
            ['GA4 ROAS', fmtX(meta.roasGA4 || calcROAS(meta.gaRevenue, meta.spend)), deltaLabel(calcROAS(meta.gaRevenue, meta.spend), calcROAS(metaP.gaRevenue, metaP.spend)), false],
            ['CPA (GA4)', fmtINRCompact(meta.cpa), deltaLabel(meta.cpa, metaP.spend > 0 && metaP.gaOrders > 0 ? metaP.spend / metaP.gaOrders : null, true), true],
            ['CTR', fmtPct(meta.ctr), null, false],
            ['CPM', fmtINRCompact(meta.cpm), null, true],
          ].map(([lbl, val, dl, lowerBetter]) => (
            <div key={lbl} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
              <span style={{ color: 'var(--text2)' }}>{lbl}</span>
              <span style={{ fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
                {val}
                {dl && <span className={dl.positive ? 'up' : 'dn'} style={{ fontSize: 11 }}>{dl.label}</span>}              </span>
            </div>
          ))}
        </div>

        {/* Google */}
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '14px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>Google</span>
            <span className="pill pill-google">GA4 sourced</span>
          </div>
          {[
            ['Spend (excl UAC)', fmtINRCompact(googleExclUAC), deltaLabel(googleExclUAC, googleP.cost - (googlePrev.filter(r => r.campaignType === 'UAC').reduce((s,r) => s + r.cost, 0))), false],
            ['UAC spend', fmtINRCompact(uacSpend), null, false],
            ['Revenue (GA4)', fmtINRCompact(google.revenue), deltaLabel(google.revenue, googleP.revenue), false],
            ['ROAS (GA4)', fmtX(google.cost > 0 ? google.revenue / google.cost : 0), deltaLabel(google.revenue / google.cost, googleP.revenue / googleP.cost), false],
            ['CPA (GA4)', fmtINRCompact(google.transactions > 0 ? google.cost / google.transactions : 0), null, true],
            ['CTR', fmtPct(google.impressions > 0 ? google.clicks / google.impressions : 0), null, false],
            ['CPM', fmtINRCompact(google.impressions > 0 ? (google.cost / google.impressions) * 1000 : 0), null, true],
          ].map(([lbl, val, dl]) => (
            <div key={lbl} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
              <span style={{ color: 'var(--text2)' }}>{lbl}</span>
              <span style={{ fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
                {val}
                {dl && <span className={dl.positive ? 'up' : 'dn'} style={{ fontSize: 11 }}>{dl.label}</span>}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Daily trend chart */}
      {dailyTrend.length > 1 && (
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '14px 16px', marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Daily spend + revenue trend</div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={dailyTrend} barSize={12}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--text3)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--text3)' }} axisLine={false} tickLine={false} unit="K" />
              <Tooltip contentStyle={{ background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 6, fontSize: 12 }}
                formatter={(v, n) => [`₹${v}K`, n]} />
              <Bar dataKey="metaSpend" fill="var(--pink)" name="Meta spend" opacity={0.8} radius={[2,2,0,0]} />
              <Bar dataKey="googleSpend" fill="var(--blue)" name="Google spend" opacity={0.8} radius={[2,2,0,0]} />
              <Bar dataKey="revenue" fill="var(--green)" name="GA4 revenue" opacity={0.6} radius={[2,2,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Top products */}
      {topProducts.length > 0 && (
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '14px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>Top products</span>
            <span className="pill pill-meta">Meta · GA4 revenue</span>
          </div>
          <DrillTable compact
            columns={[
              { key: 'product', label: 'Product', align: 'left', bold: true },
              { key: 'spend', label: 'Spend', render: v => fmtINRCompact(v) },
              { key: 'gaRevenue', label: 'GA4 Rev', render: v => fmtINRCompact(v) },
              { key: 'gaOrders', label: 'Orders', render: v => fmtNum(v) },
              { key: 'roas', label: 'ROAS', render: v => fmtX(v), color: v => v >= 4 ? 'var(--green)' : v >= 2 ? 'var(--amber)' : 'var(--red)' },
              { key: 'cpa', label: 'CPA', render: v => fmtINRCompact(v) },
            ]}
            data={topProducts}
            defaultSort={{ key: 'gaRevenue', dir: 'desc' }}
          />
        </div>
      )}
    </div>
  )
}
