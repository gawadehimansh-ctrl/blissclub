import React, { useMemo, useState } from 'react'
import { useData } from '../data/store.jsx'
import { useFilters } from '../hooks/useFilters.js'
import FilterBar from '../components/FilterBar.jsx'
import DrillTable from '../components/DrillTable.jsx'
import MetricCard from '../components/MetricCard.jsx'
import { fmtINRCompact, fmtX, fmtPct, fmtNum, deltaLabel } from '../utils/formatters.js'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid, Legend } from 'recharts'
import { format, eachDayOfInterval } from 'date-fns'

const ACCOUNT_CUTS = [
  { key: 'excl_awareness', label: 'Total excl. awareness', desc: 'Excludes VAC/awareness campaigns', filter: r => r.campaignType !== 'Awareness' },
  { key: 'incl_uac', label: 'Total incl. UAC', desc: 'All campaigns including app', filter: r => true },
  { key: 'excl_uac', label: 'Total excl. UAC', desc: 'Excludes app install campaigns', filter: r => r.campaignType !== 'UAC' },
  { key: 'women', label: 'Women campaigns', desc: 'Women-targeted campaigns', filter: r => !r.campaignName.toLowerCase().includes('men') || r.campaignName.toLowerCase().includes('women') },
  { key: 'men', label: "Men's campaigns", desc: "Men's targeted campaigns", filter: r => r.campaignName.toLowerCase().includes('men') || r.campaignName.toLowerCase().includes("men's") },
]

const CAMP_TYPES = ['All', 'Pmax', 'Search', 'Discovery', 'UAC', 'Awareness', 'Shopping']

function aggGoogle(rows) {
  const cost = rows.reduce((s, r) => s + r.cost, 0)
  const impressions = rows.reduce((s, r) => s + r.impressions, 0)
  const clicks = rows.reduce((s, r) => s + r.clicks, 0)
  const sessions = rows.reduce((s, r) => s + r.sessions, 0)
  const transactions = rows.reduce((s, r) => s + r.transactions, 0)
  const revenue = rows.reduce((s, r) => s + r.revenue, 0)
  return {
    cost, impressions, clicks, sessions, transactions, revenue,
    roas: cost > 0 ? revenue / cost : 0,
    cpa: transactions > 0 ? cost / transactions : 0,
    ctr: impressions > 0 ? clicks / impressions : 0,
    cpm: impressions > 0 ? (cost / impressions) * 1000 : 0,
    cpc: clicks > 0 ? cost / clicks : 0,
    ecr: sessions > 0 ? transactions / sessions : 0,
    aov: transactions > 0 ? revenue / transactions : 0,
  }
}

export default function GoogleCampaigns() {
  const { state } = useData()
  const filters = useFilters('last7')
  const { filterRows, getPrevRows, dateFrom, dateTo } = filters
  const [activeCut, setActiveCut] = useState('excl_awareness')
  const [campTypeFilter, setCampTypeFilter] = useState('All')
  const [drillLevel, setDrillLevel] = useState('Campaign') // Campaign | Type

  const allRows = useMemo(() => filterRows(state.googleDump, 'date'), [state.googleDump, filters])
  const prevRows = useMemo(() => getPrevRows(state.googleDump, 'date'), [state.googleDump, filters])

  const cutFilter = ACCOUNT_CUTS.find(c => c.key === activeCut)?.filter || (() => true)
  const cutRows = useMemo(() => allRows.filter(cutFilter), [allRows, activeCut])
  const cutPrev = useMemo(() => prevRows.filter(cutFilter), [prevRows, activeCut])

  const totals = useMemo(() => aggGoogle(cutRows), [cutRows])
  const prevTotals = useMemo(() => aggGoogle(cutPrev), [cutPrev])

  // Campaign type breakdown
  const byType = useMemo(() => {
    const types = {}
    for (const r of cutRows) {
      const t = r.campaignType || 'Other'
      if (!types[t]) types[t] = []
      types[t].push(r)
    }
    return Object.entries(types).map(([type, rs]) => ({ type, ...aggGoogle(rs) }))
      .sort((a, b) => b.cost - a.cost)
  }, [cutRows])

  // Campaign table
  const campaignRows = useMemo(() => {
    const filtered = campTypeFilter === 'All' ? cutRows : cutRows.filter(r => r.campaignType === campTypeFilter)
    const map = {}
    for (const r of filtered) {
      const k = r.campaignName
      if (!map[k]) map[k] = []
      map[k].push(r)
    }
    return Object.entries(map).map(([name, rs]) => ({
      campaignName: name,
      campaignType: rs[0]?.campaignType || '',
      saleTag: rs[0]?.saleTag || '',
      ...aggGoogle(rs)
    })).sort((a, b) => b.cost - a.cost)
  }, [cutRows, campTypeFilter])

  // Daily trend
  const dailyTrend = useMemo(() => {
    const days = eachDayOfInterval({ start: dateFrom, end: dateTo })
    return days.map(day => {
      const ds = format(day, 'yyyy-MM-dd')
      const dr = cutRows.filter(r => format(new Date(r.date), 'yyyy-MM-dd') === ds)
      const a = aggGoogle(dr)
      return { date: format(day, 'd MMM'), spend: Math.round(a.cost / 1000), revenue: Math.round(a.revenue / 1000), roas: +a.roas.toFixed(2) }
    })
  }, [cutRows, dateFrom, dateTo])

  const campCols = [
    { key: 'campaignName', label: 'Campaign', align: 'left', bold: true },
    { key: 'campaignType', label: 'Type', render: v => <span className={`pill pill-${v === 'UAC' ? 'amber' : v === 'Awareness' ? 'green' : 'google'}`}>{v}</span> },
    { key: 'saleTag', label: 'Tag', render: v => v ? <span className={`pill ${v === 'Sale' ? 'pill-red' : 'pill-google'}`}>{v}</span> : '—' },
    { key: 'cost', label: 'Spend', render: v => fmtINRCompact(v) },
    { key: 'impressions', label: 'Impr.', render: v => fmtNum(v) },
    { key: 'clicks', label: 'Clicks', render: v => fmtNum(v) },
    { key: 'ctr', label: 'CTR', render: v => fmtPct(v), color: v => v > 0.05 ? 'var(--green)' : v > 0.02 ? 'var(--amber)' : 'var(--red)' },
    { key: 'cpc', label: 'CPC', render: v => fmtINRCompact(v) },
    { key: 'cpm', label: 'CPM', render: v => fmtINRCompact(v) },
    { key: 'sessions', label: 'Sessions', render: v => fmtNum(v) },
    { key: 'transactions', label: 'Orders', render: v => fmtNum(v) },
    { key: 'revenue', label: 'Revenue', render: v => fmtINRCompact(v) },
    { key: 'roas', label: 'ROAS', render: v => fmtX(v), color: v => v >= 5 ? 'var(--green)' : v >= 2 ? 'var(--amber)' : 'var(--red)' },
    { key: 'cpa', label: 'CPA', render: v => fmtINRCompact(v) },
    { key: 'ecr', label: 'ECR', render: v => fmtPct(v) },
    { key: 'aov', label: 'AOV', render: v => fmtINRCompact(v) },
  ]

  const typeCols = [
    { key: 'type', label: 'Campaign type', align: 'left', bold: true },
    { key: 'cost', label: 'Spend', render: v => fmtINRCompact(v) },
    { key: 'impressions', label: 'Impr.', render: v => fmtNum(v) },
    { key: 'clicks', label: 'Clicks', render: v => fmtNum(v) },
    { key: 'ctr', label: 'CTR', render: v => fmtPct(v) },
    { key: 'sessions', label: 'Sessions', render: v => fmtNum(v) },
    { key: 'transactions', label: 'Orders', render: v => fmtNum(v) },
    { key: 'revenue', label: 'Revenue', render: v => fmtINRCompact(v) },
    { key: 'roas', label: 'ROAS', render: v => fmtX(v), color: v => v >= 5 ? 'var(--green)' : v >= 2 ? 'var(--amber)' : 'var(--red)' },
    { key: 'cpa', label: 'CPA', render: v => fmtINRCompact(v) },
  ]

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 18, fontWeight: 600, marginBottom: 2 }}>Google campaigns</h1>
        <div style={{ fontSize: 12, color: 'var(--text3)' }}>5 account cuts · campaign type drill-down</div>
      </div>
      <FilterBar filters={filters} />

      {/* Account cut tabs */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
        {ACCOUNT_CUTS.map(cut => (
          <button key={cut.key} onClick={() => setActiveCut(cut.key)}
            style={{
              padding: '6px 14px', fontSize: 12, borderRadius: 6, cursor: 'pointer',
              background: activeCut === cut.key ? 'var(--blue-dim)' : 'var(--bg3)',
              color: activeCut === cut.key ? 'var(--blue)' : 'var(--text2)',
              border: `0.5px solid ${activeCut === cut.key ? 'var(--blue-border)' : 'var(--border)'}`,
              fontWeight: activeCut === cut.key ? 500 : 400,
            }}>
            {cut.label}
          </button>
        ))}
      </div>
      <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 12 }}>
        {ACCOUNT_CUTS.find(c => c.key === activeCut)?.desc}
      </div>

      {/* KPI strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0,1fr))', gap: 10, marginBottom: 16 }}>
        <MetricCard label="Spend" value={fmtINRCompact(totals.cost)} accent="var(--blue)"
          delta={deltaLabel(totals.cost, prevTotals.cost)} />
        <MetricCard label="Revenue" value={fmtINRCompact(totals.revenue)} accent="var(--blue)"
          delta={deltaLabel(totals.revenue, prevTotals.revenue)} />
        <MetricCard label="ROAS" value={fmtX(totals.roas)} accent="var(--blue)"
          delta={deltaLabel(totals.roas, prevTotals.roas)} />
        <MetricCard label="CPA" value={fmtINRCompact(totals.cpa)} accent="var(--blue)"
          delta={deltaLabel(totals.cpa, prevTotals.cpa, true)} />
        <MetricCard label="Orders" value={fmtNum(totals.transactions)} accent="var(--blue)"
          delta={deltaLabel(totals.transactions, prevTotals.transactions)} />
      </div>

      {/* Trend chart */}
      {dailyTrend.length > 1 && (
        <div style={{ background: 'var(--bg2)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '14px 16px', marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 10 }}>Daily spend vs revenue</div>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={dailyTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--text3)' }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="left" tick={{ fontSize: 11, fill: 'var(--text3)' }} axisLine={false} tickLine={false} unit="K" />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: 'var(--text3)' }} axisLine={false} tickLine={false} unit="x" />
              <Tooltip contentStyle={{ background: 'var(--bg3)', border: '0.5px solid var(--border2)', fontSize: 12 }} />
              <Line yAxisId="left" type="monotone" dataKey="spend" stroke="var(--blue)" strokeWidth={2} dot={false} name="Spend (₹K)" />
              <Line yAxisId="left" type="monotone" dataKey="revenue" stroke="var(--green)" strokeWidth={2} dot={false} name="Revenue (₹K)" />
              <Line yAxisId="right" type="monotone" dataKey="roas" stroke="var(--amber)" strokeWidth={1.5} dot={false} name="ROAS" strokeDasharray="4 2" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Campaign type breakdown */}
      <div style={{ background: 'var(--bg2)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '14px 16px', marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>By campaign type</div>
        <DrillTable columns={typeCols} data={byType} defaultSort={{ key: 'cost', dir: 'desc' }} compact />
      </div>

      {/* Campaign table with type filter */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 12, color: 'var(--text2)' }}>Campaign type:</span>
        {CAMP_TYPES.map(t => (
          <button key={t} onClick={() => setCampTypeFilter(t)}
            style={{
              padding: '4px 10px', fontSize: 12, borderRadius: 20, cursor: 'pointer',
              background: campTypeFilter === t ? 'var(--blue-dim)' : 'transparent',
              color: campTypeFilter === t ? 'var(--blue)' : 'var(--text2)',
              border: `0.5px solid ${campTypeFilter === t ? 'var(--blue-border)' : 'var(--border)'}`,
            }}>
            {t}
          </button>
        ))}
      </div>

      <DrillTable columns={campCols} data={campaignRows} defaultSort={{ key: 'cost', dir: 'desc' }} />
    </div>
  )
}
