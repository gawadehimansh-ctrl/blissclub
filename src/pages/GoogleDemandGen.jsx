import React, { useMemo, useState } from 'react'
import { useData } from '../data/store.jsx'
import { useFilters } from '../hooks/useFilters.js'
import FilterBar from '../components/FilterBar.jsx'
import DrillTable from '../components/DrillTable.jsx'
import MetricCard from '../components/MetricCard.jsx'
import { fmtINRCompact, fmtPct, fmtNum, deltaLabel } from '../utils/formatters.js'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts'

const TIP = { contentStyle: { background: 'var(--bg3)', border: '0.5px solid var(--border2)', fontSize: 12, borderRadius: 6 } }

// Detect if ad is video or static based on ad name keywords
function getAdType(adName = '') {
  const n = adName.toLowerCase()
  if (n.includes('video') || n.includes('vid') || n.includes('reel') ||
      n.includes('mp4') || n.includes('mov') || n.includes('_v_') ||
      n.includes('_vid') || n.match(/v\d+/)) return 'Video'
  if (n.includes('static') || n.includes('image') || n.includes('img') ||
      n.includes('_s_') || n.includes('banner') || n.includes('card')) return 'Static'
  return 'Unknown'
}

function aggDG(rows) {
  const cost = rows.reduce((s,r) => s+(r.cost||0), 0)
  const imp  = rows.reduce((s,r) => s+(r.impressions||0), 0)
  const cl   = rows.reduce((s,r) => s+(r.clicks||0), 0)
  const conv = rows.reduce((s,r) => s+(r.conversions||0), 0)
  const rev  = rows.reduce((s,r) => s+(r.conversionValue||0), 0)
  const cpmSum = rows.reduce((s,r) => s+(r.cpm||0), 0)
  return {
    cost, impressions: imp, clicks: cl, conversions: conv, revenue: rev,
    ctr:  imp  > 0 ? cl   / imp  : 0,
    cpc:  cl   > 0 ? cost / cl   : 0,
    cpm:  rows.length > 0 && cpmSum > 0 ? cpmSum / rows.length : (imp > 0 ? cost/imp*1000 : 0),
    roas: cost > 0 ? rev  / cost : 0,
    cpa:  conv > 0 ? cost / conv : 0,
  }
}

function fmtINR(v) {
  if (!v || isNaN(v)) return '—'
  if (v >= 10000000) return `₹${(v/10000000).toFixed(2)}Cr`
  if (v >= 100000)   return `₹${(v/100000).toFixed(1)}L`
  return `₹${Math.round(v).toLocaleString('en-IN')}`
}

const TABS = [
  { key: 'creative', label: 'Creative' },
  { key: 'campaign', label: 'Campaign' },
  { key: 'type',     label: 'Video vs Static' },
]

export default function GoogleDemandGen() {
  const { state } = useData()
  const filters = useFilters('last30')
  const { filterRows, getPrevRows } = filters
  const [tab, setTab] = useState('creative')
  const [campFilter, setCampFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all') // 'all' | 'Video' | 'Static'

  const allRows = useMemo(() => {
    return (filterRows(state.googleDemandGen || [], 'date')).map(r => ({
      ...r, adType: getAdType(r.adName || ''),
    }))
  }, [state.googleDemandGen, filters])

  const prevRows = useMemo(() => {
    return (getPrevRows(state.googleDemandGen || [], 'date')).map(r => ({
      ...r, adType: getAdType(r.adName || ''),
    }))
  }, [state.googleDemandGen, filters])

  const campaigns = useMemo(() => [...new Set(allRows.map(r => r.campaignName).filter(Boolean))].sort(), [allRows])

  const rows = useMemo(() => {
    let r = campFilter === 'all' ? allRows : allRows.filter(r => r.campaignName === campFilter)
    if (typeFilter !== 'all') r = r.filter(row => row.adType === typeFilter)
    return r
  }, [allRows, campFilter, typeFilter])

  const prev = useMemo(() => {
    let r = campFilter === 'all' ? prevRows : prevRows.filter(r => r.campaignName === campFilter)
    if (typeFilter !== 'all') r = r.filter(row => row.adType === typeFilter)
    return r
  }, [prevRows, campFilter, typeFilter])

  const totals     = useMemo(() => aggDG(rows), [rows])
  const prevTotals = useMemo(() => aggDG(prev), [prev])
  const hasData    = rows.length > 0

  // By creative (ad name)
  const byCreative = useMemo(() => {
    const map = {}
    for (const r of rows) {
      const k = r.adName || 'Unknown'
      if (!map[k]) map[k] = []
      map[k].push(r)
    }
    return Object.values(map).map(rs => ({
      adName:    rs[0].adName,
      adType:    rs[0].adType,
      campaignName: rs[0].campaignName,
      ...aggDG(rs),
    })).sort((a,b) => b.cost - a.cost)
  }, [rows])

  // By campaign
  const byCampaign = useMemo(() => {
    const map = {}
    for (const r of rows) {
      const k = r.campaignName || 'Unknown'
      if (!map[k]) map[k] = []
      map[k].push(r)
    }
    return Object.values(map).map(rs => ({
      campaignName: rs[0].campaignName,
      adCount: [...new Set(rs.map(r => r.adName))].length,
      ...aggDG(rs),
    })).sort((a,b) => b.cost - a.cost)
  }, [rows])

  // By type (Video vs Static)
  const byType = useMemo(() => {
    const map = {}
    for (const r of rows) {
      const k = r.adType || 'Unknown'
      if (!map[k]) map[k] = []
      map[k].push(r)
    }
    return Object.values(map).map(rs => ({
      adType:   rs[0].adType,
      adCount:  [...new Set(rs.map(r => r.adName))].length,
      ...aggDG(rs),
    })).sort((a,b) => b.cost - a.cost)
  }, [rows])

  const creativeCols = [
    { key: 'adName',      label: 'Ad / Creative',  align: 'left', bold: true },
    { key: 'adType',      label: 'Type',            render: v => (
      <span style={{
        fontSize: 10, padding: '2px 7px', borderRadius: 4, fontWeight: 500,
        background: v === 'Video' ? 'var(--blue-dim)' : v === 'Static' ? 'var(--green-dim)' : 'var(--bg4)',
        color: v === 'Video' ? 'var(--blue)' : v === 'Static' ? 'var(--green)' : 'var(--text3)',
        border: `0.5px solid ${v === 'Video' ? 'var(--blue-border)' : v === 'Static' ? 'rgba(29,185,84,0.3)' : 'var(--border)'}`,
      }}>{v}</span>
    )},
    { key: 'cost',        label: 'Spend',           render: v => fmtINR(v) },
    { key: 'impressions', label: 'Impressions',      render: fmtNum },
    { key: 'clicks',      label: 'Clicks',           render: fmtNum },
    { key: 'ctr',         label: 'CTR',              render: fmtPct, color: v => v>=0.02?'var(--green)':v>=0.01?'var(--amber)':'var(--red)' },
    { key: 'cpm',         label: 'CPM',              render: v => fmtINR(v) },
    { key: 'cpc',         label: 'CPC',              render: v => fmtINR(v) },
    { key: 'conversions', label: 'Conv.',             render: v => fmtNum(v, 1) },
    { key: 'revenue',     label: 'Revenue',           render: v => fmtINR(v), color: () => 'var(--green)' },
    { key: 'roas',        label: 'ROAS',              render: v => `${v.toFixed(2)}x`, color: v => v>=4?'var(--green)':v>=2?'var(--amber)':'var(--red)' },
    { key: 'cpa',         label: 'CPA',               render: v => v>0 ? fmtINR(v) : '—' },
  ]

  const campaignCols = [
    { key: 'campaignName', label: 'Campaign',    align: 'left', bold: true },
    { key: 'adCount',      label: 'Creatives',   render: fmtNum },
    { key: 'cost',         label: 'Spend',        render: v => fmtINR(v) },
    { key: 'impressions',  label: 'Impressions',  render: fmtNum },
    { key: 'clicks',       label: 'Clicks',       render: fmtNum },
    { key: 'ctr',          label: 'CTR',          render: fmtPct, color: v => v>=0.02?'var(--green)':v>=0.01?'var(--amber)':'var(--red)' },
    { key: 'cpm',          label: 'CPM',          render: v => fmtINR(v) },
    { key: 'conversions',  label: 'Conv.',         render: v => fmtNum(v, 1) },
    { key: 'revenue',      label: 'Revenue',       render: v => fmtINR(v), color: () => 'var(--green)' },
    { key: 'roas',         label: 'ROAS',          render: v => `${v.toFixed(2)}x`, color: v => v>=4?'var(--green)':v>=2?'var(--amber)':'var(--red)' },
    { key: 'cpa',          label: 'CPA',           render: v => v>0 ? fmtINR(v) : '—' },
  ]

  const typeCols = [
    { key: 'adType',       label: 'Type',         align: 'left', bold: true },
    { key: 'adCount',      label: 'Creatives',    render: fmtNum },
    { key: 'cost',         label: 'Spend',         render: v => fmtINR(v) },
    { key: 'impressions',  label: 'Impressions',   render: fmtNum },
    { key: 'clicks',       label: 'Clicks',        render: fmtNum },
    { key: 'ctr',          label: 'CTR',           render: fmtPct, color: v => v>=0.02?'var(--green)':v>=0.01?'var(--amber)':'var(--red)' },
    { key: 'cpm',          label: 'CPM',           render: v => fmtINR(v) },
    { key: 'conversions',  label: 'Conv.',          render: v => fmtNum(v, 1) },
    { key: 'revenue',      label: 'Revenue',        render: v => fmtINR(v), color: () => 'var(--green)' },
    { key: 'roas',         label: 'ROAS',           render: v => `${v.toFixed(2)}x`, color: v => v>=4?'var(--green)':v>=2?'var(--amber)':'var(--red)' },
  ]

  // Top 8 creatives chart
  const chartData = byCreative.slice(0, 8).map(r => ({
    name: (r.adName || '').length > 22 ? (r.adName||'').slice(0,22)+'…' : (r.adName||''),
    spend: Math.round(r.cost),
    revenue: Math.round(r.revenue),
    type: r.adType,
  }))

  return (
    <div style={{ padding: '24px 28px' }}>
      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 2 }}>Google — Demand Gen</h1>
        <div style={{ fontSize: 12, color: 'var(--text3)' }}>
          Demand Gen campaigns · creative-level performance · video vs static breakdown
        </div>
      </div>

      <FilterBar filters={filters} showCohort={false} showSaleTag={false} />

      {/* Filters row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        {/* Campaign filter */}
        {campaigns.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 500 }}>Campaign</span>
            <select value={campFilter} onChange={e => setCampFilter(e.target.value)} style={{
              padding: '5px 10px', fontSize: 12, borderRadius: 6, cursor: 'pointer',
              background: 'var(--bg2)', border: '0.5px solid var(--border2)',
              color: 'var(--text)', outline: 'none', maxWidth: 360,
            }}>
              <option value="all">All ({campaigns.length})</option>
              {campaigns.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            {campFilter !== 'all' && (
              <button onClick={() => setCampFilter('all')} style={{ padding:'3px 7px', fontSize:11, borderRadius:4, cursor:'pointer', background:'var(--bg3)', border:'0.5px solid var(--border2)', color:'var(--text2)' }}>✕</button>
            )}
          </div>
        )}

        {/* Type filter */}
        <div style={{ display: 'flex', gap: 4 }}>
          {[['all','All'], ['Video','Video'], ['Static','Static'], ['Unknown','Unknown']].map(([val, lbl]) => (
            <button key={val} onClick={() => setTypeFilter(val)} style={{
              padding: '4px 10px', fontSize: 12, borderRadius: 4, cursor: 'pointer',
              background: typeFilter === val ? (val==='Video'?'var(--blue-dim)':val==='Static'?'var(--green-dim)':'var(--pink-dim)') : 'var(--bg2)',
              color: typeFilter === val ? (val==='Video'?'var(--blue)':val==='Static'?'var(--green)':'var(--pink)') : 'var(--text2)',
              border: `0.5px solid ${typeFilter === val ? (val==='Video'?'var(--blue-border)':val==='Static'?'rgba(29,185,84,0.3)':'var(--pink-border)') : 'var(--border)'}`,
              fontWeight: typeFilter === val ? 500 : 400,
            }}>{lbl}</button>
          ))}
        </div>
      </div>

      {!hasData && (
        <div style={{ background: 'var(--red-dim)', border: '0.5px solid var(--red-border)', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 12, color: 'var(--red)' }}>
          No Demand Gen data — sync Windsor from the Upload page. Requires campaigns with "demand" in the name.
        </div>
      )}

      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0,1fr))', gap: 10, marginBottom: 16 }}>
        {[
          { label: 'Spend',       val: fmtINR(totals.cost),        delta: deltaLabel(totals.cost, prevTotals.cost) },
          { label: 'Impressions', val: fmtNum(totals.impressions),  delta: deltaLabel(totals.impressions, prevTotals.impressions) },
          { label: 'Clicks',      val: fmtNum(totals.clicks),       delta: deltaLabel(totals.clicks, prevTotals.clicks) },
          { label: 'CTR',         val: fmtPct(totals.ctr),          delta: deltaLabel(totals.ctr, prevTotals.ctr), accent: totals.ctr>=0.02?'var(--green)':totals.ctr>=0.01?'var(--amber)':'var(--red)' },
          { label: 'Revenue',     val: fmtINR(totals.revenue),      delta: deltaLabel(totals.revenue, prevTotals.revenue), accent: 'var(--green)' },
          { label: 'ROAS',        val: `${totals.roas.toFixed(2)}x`, delta: deltaLabel(totals.roas, prevTotals.roas), accent: totals.roas>=4?'var(--green)':totals.roas>=2?'var(--amber)':'var(--red)' },
        ].map(m => <MetricCard key={m.label} label={m.label} value={m.val} delta={m.delta} accent={m.accent} small />)}
      </div>

      {/* Chart */}
      {hasData && (
        <div style={{ background: 'var(--bg2)', border: '0.5px solid var(--border)', borderRadius: 10, padding: '14px 16px', marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 10, fontWeight: 500 }}>Top 8 creatives — spend vs revenue</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} layout="vertical" barSize={11} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--text3)' }} axisLine={false} tickLine={false} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fill: 'var(--text3)' }} axisLine={false} tickLine={false} width={200} />
              <Tooltip {...TIP} formatter={(v, n) => [`₹${v.toLocaleString('en-IN')}`, n]} />
              <Bar dataKey="spend"   name="Spend"   radius={[0,3,3,0]}>
                {chartData.map((r, i) => <Cell key={i} fill={r.type === 'Video' ? 'var(--blue)' : r.type === 'Static' ? 'var(--green)' : 'var(--purple)'} />)}
              </Bar>
              <Bar dataKey="revenue" name="Revenue" radius={[0,3,3,0]} fillOpacity={0.5}>
                {chartData.map((r, i) => <Cell key={i} fill={r.type === 'Video' ? 'var(--blue)' : r.type === 'Static' ? 'var(--green)' : 'var(--purple)'} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
            {[['var(--blue)','Video'],['var(--green)','Static'],['var(--purple)','Unknown']].map(([c,l]) => (
              <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text3)' }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: c }} />{l}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 16, borderBottom: '0.5px solid var(--border)' }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: '8px 16px', fontSize: 13, cursor: 'pointer', fontWeight: tab===t.key ? 600 : 400,
            background: 'transparent', border: 'none',
            color: tab===t.key ? 'var(--blue)' : 'var(--text2)',
            borderBottom: `2px solid ${tab===t.key ? 'var(--blue)' : 'transparent'}`,
            marginBottom: -1,
          }}>{t.label}</button>
        ))}
      </div>

      {tab === 'creative' && (
        <DrillTable columns={creativeCols} data={byCreative} defaultSort={{ key:'cost', dir:'desc' }} />
      )}
      {tab === 'campaign' && (
        <DrillTable columns={campaignCols} data={byCampaign} defaultSort={{ key:'cost', dir:'desc' }} />
      )}
      {tab === 'type' && (
        <>
          {/* Type summary cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 12, marginBottom: 16 }}>
            {byType.map(t => (
              <div key={t.adType} style={{
                background: 'var(--bg2)', border: '0.5px solid var(--border)', borderRadius: 10, padding: '14px 16px',
                borderTop: `3px solid ${t.adType==='Video'?'var(--blue)':t.adType==='Static'?'var(--green)':'var(--purple)'}`,
              }}>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>{t.adType}</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {[
                    { label: 'Spend',    val: fmtINR(t.cost) },
                    { label: 'Revenue',  val: fmtINR(t.revenue), color: 'var(--green)' },
                    { label: 'ROAS',     val: `${t.roas.toFixed(2)}x`, color: t.roas>=4?'var(--green)':t.roas>=2?'var(--amber)':'var(--red)' },
                    { label: 'CTR',      val: fmtPct(t.ctr), color: t.ctr>=0.02?'var(--green)':t.ctr>=0.01?'var(--amber)':'var(--red)' },
                    { label: 'Conv.',    val: fmtNum(t.conversions, 1) },
                    { label: 'CPA',      val: t.cpa>0?fmtINR(t.cpa):'—' },
                  ].map(m => (
                    <div key={m.label}>
                      <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>{m.label}</div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: m.color || 'var(--text)' }}>{m.val}</div>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text3)' }}>{t.adCount} creatives</div>
              </div>
            ))}
          </div>
          <DrillTable columns={typeCols} data={byType} defaultSort={{ key:'cost', dir:'desc' }} />
        </>
      )}
    </div>
  )
}
