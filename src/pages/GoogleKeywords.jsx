import React, { useMemo, useState } from 'react'
import { useData } from '../data/store.jsx'
import { useFilters } from '../hooks/useFilters.js'
import FilterBar from '../components/FilterBar.jsx'
import DrillTable from '../components/DrillTable.jsx'
import MetricCard from '../components/MetricCard.jsx'
import { fmtINRCompact, fmtX, fmtPct, fmtPctRaw, fmtNum, deltaLabel } from '../utils/formatters.js'
import { isBrandKeyword } from '../utils/parser.js'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from 'recharts'

function aggGoogle(rows) {
  const cost = rows.reduce((s, r) => s + r.cost, 0)
  const revenue = rows.reduce((s, r) => s + r.revenue, 0)
  const transactions = rows.reduce((s, r) => s + r.transactions, 0)
  const clicks = rows.reduce((s, r) => s + r.clicks, 0)
  const impressions = rows.reduce((s, r) => s + r.impressions, 0)
  const sessions = rows.reduce((s, r) => s + r.sessions, 0)
  return {
    cost, revenue, transactions, clicks, impressions, sessions,
    roas: cost > 0 ? revenue / cost : 0,
    cpa: transactions > 0 ? cost / transactions : 0,
    ctr: impressions > 0 ? clicks / impressions : 0,
    cpc: clicks > 0 ? cost / clicks : 0,
  }
}

const SEGMENT_CUTS = [
  { key: 'overall', label: 'Overall' },
  { key: 'women', label: 'Women' },
  { key: 'men', label: "Men's" },
]

export default function GoogleKeywords() {
  const { state } = useData()
  const filters = useFilters('thisMonth')
  const { filterRows, getPrevRows } = filters
  const [segCut, setSegCut] = useState('overall')

  // GA4 data — brand vs non-brand from session term
  const ga4Rows = useMemo(() => filterRows(state.ga4Dump), [state.ga4Dump, filters])
  const ga4Prev = useMemo(() => getPrevRows(state.ga4Dump), [state.ga4Dump, filters])

  // Google rows — search campaigns only for keyword view
  const googleRows = useMemo(() => {
    let rows = filterRows(state.googleDump, 'date')
    if (segCut === 'women') rows = rows.filter(r => !r.campaignName.toLowerCase().includes('men') || r.campaignName.toLowerCase().includes('women'))
    if (segCut === 'men') rows = rows.filter(r => r.campaignName.toLowerCase().includes('men'))
    return rows
  }, [state.googleDump, filters, segCut])
  const googlePrev = useMemo(() => {
    let rows = getPrevRows(state.googleDump, 'date')
    if (segCut === 'women') rows = rows.filter(r => !r.campaignName.toLowerCase().includes('men'))
    if (segCut === 'men') rows = rows.filter(r => r.campaignName.toLowerCase().includes('men'))
    return rows
  }, [state.googleDump, filters, segCut])

  // Brand vs NB split from GA4
  const brandGA4 = useMemo(() => ga4Rows.filter(r => r.isBrand), [ga4Rows])
  const nbGA4 = useMemo(() => ga4Rows.filter(r => !r.isBrand && r.manualTerm), [ga4Rows])
  const brandPrev = useMemo(() => ga4Prev.filter(r => r.isBrand), [ga4Prev])
  const nbPrev = useMemo(() => ga4Prev.filter(r => !r.isBrand && r.manualTerm), [ga4Prev])

  const brandRev = brandGA4.reduce((s, r) => s + r.revenue, 0)
  const nbRev = nbGA4.reduce((s, r) => s + r.revenue, 0)
  const brandRevPrev = brandPrev.reduce((s, r) => s + r.revenue, 0)
  const nbRevPrev = nbPrev.reduce((s, r) => s + r.revenue, 0)
  const brandSessions = brandGA4.reduce((s, r) => s + r.sessions, 0)
  const nbSessions = nbGA4.reduce((s, r) => s + r.sessions, 0)
  const totalRevGA4 = brandRev + nbRev

  // Brand vs NB Google spend
  const brandSpend = googleRows.filter(r => isBrandKeyword(r.campaignName)).reduce((s, r) => s + r.cost, 0)
  const nbSpend = googleRows.filter(r => !isBrandKeyword(r.campaignName) && r.campaignType === 'Search').reduce((s, r) => s + r.cost, 0)

  // Campaign-level brand vs NB table
  const brandNBRows = useMemo(() => {
    const searchRows = googleRows.filter(r => r.campaignType === 'Search' || r.campaignType === 'Pmax')
    const map = {}
    for (const r of searchRows) {
      const k = r.campaignName
      if (!map[k]) map[k] = []
      map[k].push(r)
    }
    return Object.entries(map).map(([name, rs]) => {
      const a = aggGoogle(rs)
      const isBrand = isBrandKeyword(name)
      return { campaignName: name, isBrand, brandLabel: isBrand ? 'Brand' : 'Non-brand', ...a }
    }).sort((a, b) => b.cost - a.cost)
  }, [googleRows])

  // Top GA4 keyword terms (non-brand)
  const topNBTerms = useMemo(() => {
    const map = {}
    for (const r of ga4Rows) {
      if (r.isBrand || !r.manualTerm || r.manualTerm === '(not set)' || r.manualTerm === '(not provided)') continue
      const k = r.manualTerm
      if (!map[k]) map[k] = { term: k, sessions: 0, transactions: 0, revenue: 0, tag: r.tag || '' }
      map[k].sessions += r.sessions
      map[k].transactions += r.transactions
      map[k].revenue += r.revenue
    }
    return Object.values(map)
      .map(t => ({ ...t, cvr: t.sessions > 0 ? t.transactions / t.sessions : 0, revenue_per_session: t.sessions > 0 ? t.revenue / t.sessions : 0 }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 50)
  }, [ga4Rows])

  // MoM brand vs NB trend (use monthly GA4 data)
  const momTrend = useMemo(() => {
    const allGA4 = state.ga4Dump
    const months = {}
    for (const r of allGA4) {
      if (!r.date) continue
      const d = r.date instanceof Date ? r.date : new Date(r.date)
      if (isNaN(d)) continue
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      if (!months[key]) months[key] = { month: key, brandRev: 0, nbRev: 0, brandSessions: 0, nbSessions: 0 }
      if (r.isBrand) { months[key].brandRev += r.revenue; months[key].brandSessions += r.sessions }
      else if (r.manualTerm) { months[key].nbRev += r.revenue; months[key].nbSessions += r.sessions }
    }
    return Object.values(months)
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-6)
      .map(m => ({
        ...m,
        label: m.month.replace(/^(\d{4})-0?(\d+)$/, (_, y, mo) => `${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][+mo-1]}'${y.slice(2)}`),
        brandPct: (m.brandRev + m.nbRev) > 0 ? Math.round(m.brandRev / (m.brandRev + m.nbRev) * 100) : 0,
        nbPct: (m.brandRev + m.nbRev) > 0 ? Math.round(m.nbRev / (m.brandRev + m.nbRev) * 100) : 0,
      }))
  }, [state.ga4Dump])

  const bnbCols = [
    { key: 'campaignName', label: 'Campaign', align: 'left', bold: true },
    { key: 'brandLabel', label: 'Type', render: v => <span className={`pill ${v === 'Brand' ? 'pill-green' : 'pill-google'}`}>{v}</span> },
    { key: 'cost', label: 'Spend', render: v => fmtINRCompact(v) },
    { key: 'clicks', label: 'Clicks', render: v => fmtNum(v) },
    { key: 'ctr', label: 'CTR', render: v => fmtPct(v) },
    { key: 'cpc', label: 'CPC', render: v => fmtINRCompact(v) },
    { key: 'sessions', label: 'Sessions', render: v => fmtNum(v) },
    { key: 'transactions', label: 'Orders', render: v => fmtNum(v) },
    { key: 'revenue', label: 'Revenue', render: v => fmtINRCompact(v) },
    { key: 'roas', label: 'ROAS', render: v => fmtX(v), color: v => v >= 5 ? 'var(--green)' : v >= 2 ? 'var(--amber)' : 'var(--red)' },
    { key: 'cpa', label: 'CPA', render: v => fmtINRCompact(v) },
  ]

  const termCols = [
    { key: 'term', label: 'Keyword / UTM term', align: 'left', bold: true },
    { key: 'tag', label: 'Tag' },
    { key: 'sessions', label: 'Sessions', render: v => fmtNum(v) },
    { key: 'transactions', label: 'Orders', render: v => fmtNum(v) },
    { key: 'revenue', label: 'Revenue', render: v => fmtINRCompact(v) },
    { key: 'cvr', label: 'CVR', render: v => fmtPct(v), color: v => v > 0.03 ? 'var(--green)' : v > 0.01 ? 'var(--amber)' : 'var(--red)' },
    { key: 'revenue_per_session', label: 'Rev/session', render: v => fmtINRCompact(v) },
  ]

  const pieData = [
    { name: 'Brand', value: Math.round(brandRev), color: 'var(--green)' },
    { name: 'Non-brand', value: Math.round(nbRev), color: 'var(--blue)' },
  ]

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 18, fontWeight: 600, marginBottom: 2 }}>Brand vs non-brand</h1>
        <div style={{ fontSize: 12, color: 'var(--text3)' }}>GA4 revenue split · MoM trend · top non-brand terms</div>
      </div>
      <FilterBar filters={filters} />

      {/* Segment cut */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {SEGMENT_CUTS.map(c => (
          <button key={c.key} onClick={() => setSegCut(c.key)}
            style={{
              padding: '5px 14px', fontSize: 12, borderRadius: 6, cursor: 'pointer',
              background: segCut === c.key ? 'var(--blue-dim)' : 'var(--bg3)',
              color: segCut === c.key ? 'var(--blue)' : 'var(--text2)',
              border: `0.5px solid ${segCut === c.key ? 'var(--blue-border)' : 'var(--border2)'}`,
              fontWeight: segCut === c.key ? 500 : 400
            }}>
            {c.label}
          </button>
        ))}
      </div>

      {/* Brand vs NB summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 10, marginBottom: 16 }}>
        <MetricCard label="Brand revenue (GA4)" value={fmtINRCompact(brandRev)} accent="var(--green)"
          sublabel={totalRevGA4 > 0 ? `${Math.round(brandRev / totalRevGA4 * 100)}% of total` : ''}
          delta={deltaLabel(brandRev, brandRevPrev)} />
        <MetricCard label="Non-brand revenue" value={fmtINRCompact(nbRev)} accent="var(--blue)"
          sublabel={totalRevGA4 > 0 ? `${Math.round(nbRev / totalRevGA4 * 100)}% of total` : ''}
          delta={deltaLabel(nbRev, nbRevPrev)} />
        <MetricCard label="Brand spend (Google)" value={fmtINRCompact(brandSpend)} accent="var(--green)"
          sublabel="Search brand campaigns" />
        <MetricCard label="Non-brand spend" value={fmtINRCompact(nbSpend)} accent="var(--blue)"
          sublabel="Search non-brand" />
      </div>

      {/* Charts side by side */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12, marginBottom: 16 }}>
        {/* Pie */}
        <div style={{ background: 'var(--bg2)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '14px 16px' }}>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8 }}>Revenue split this period</div>
          {totalRevGA4 > 0 ? (
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={65} dataKey="value" paddingAngle={3}>
                  {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip contentStyle={{ background: 'var(--bg3)', border: '0.5px solid var(--border2)', fontSize: 12 }}
                  formatter={v => [fmtINRCompact(v), '']} />
                <Legend iconType="circle" iconSize={8} formatter={(v, e) => <span style={{ fontSize: 11, color: 'var(--text2)' }}>{v}</span>} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', fontSize: 12 }}>No GA4 data</div>
          )}
        </div>

        {/* MoM trend */}
        <div style={{ background: 'var(--bg2)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '14px 16px' }}>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8 }}>Brand vs non-brand revenue MoM</div>
          {momTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={momTrend} barSize={18}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--text3)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--text3)' }} axisLine={false} tickLine={false} unit="%" />
                <Tooltip contentStyle={{ background: 'var(--bg3)', border: '0.5px solid var(--border2)', fontSize: 12 }}
                  formatter={(v, n) => [`${v}%`, n]} />
                <Bar dataKey="brandPct" fill="var(--green)" name="Brand %" radius={[2,2,0,0]} stackId="a" />
                <Bar dataKey="nbPct" fill="var(--blue)" name="Non-brand %" radius={[2,2,0,0]} stackId="a" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', fontSize: 12 }}>Upload GA4 data to see MoM trend</div>
          )}
        </div>
      </div>

      {/* Brand vs NB campaign table */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Campaign-level brand vs non-brand</div>
        <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8 }}>Search + Pmax campaigns · auto-tagged from campaign name</div>
      </div>
      <DrillTable columns={bnbCols} data={brandNBRows} defaultSort={{ key: 'cost', dir: 'desc' }} />

      {/* Top non-brand terms from GA4 */}
      <div style={{ marginTop: 24, marginBottom: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Top non-brand keywords (GA4)</div>
        <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8 }}>From GA4 session utm_term · sorted by revenue</div>
      </div>
      <DrillTable columns={termCols} data={topNBTerms} defaultSort={{ key: 'revenue', dir: 'desc' }} compact />
    </div>
  )
}
