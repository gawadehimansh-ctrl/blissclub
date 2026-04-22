import React, { useMemo, useState } from 'react'
import { useData } from '../data/store.jsx'
import { useFilters } from '../hooks/useFilters.js'
import FilterBar from '../components/FilterBar.jsx'
import DrillTable from '../components/DrillTable.jsx'
import MetricCard from '../components/MetricCard.jsx'
import { fmtINRCompact, fmtPct, fmtNum, deltaLabel } from '../utils/formatters.js'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, Legend, Cell, PieChart, Pie,
} from 'recharts'

function aggAwr(rows) {
  const cost  = rows.reduce((s, r) => s + (r.cost || 0), 0)
  const imp   = rows.reduce((s, r) => s + (r.impressions || 0), 0)
  const cl    = rows.reduce((s, r) => s + (r.clicks || 0), 0)
  const views = rows.reduce((s, r) => s + (r.videoViews || 0), 0)
  // Use Windsor's average_cpm if available, else calculate
  const cpmSum = rows.reduce((s, r) => s + (r.cpm || 0), 0)
  const cpmAvg = rows.length > 0 && cpmSum > 0 ? cpmSum / rows.length : (imp > 0 ? (cost / imp) * 1000 : 0)
  const hasVideo = views > 0
  return {
    cost, impressions: imp, clicks: cl, videoViews: views,
    cpm:  cpmAvg,
    cpc:  cl    > 0 ? cost / cl    : 0,
    ctr:  imp   > 0 ? cl   / imp   : 0,
    cpv:  hasVideo ? cost / views  : 0,
    vtr:  hasVideo && imp > 0 ? views / imp : 0,
    p25:  rows.reduce((s, r) => s + (r.videoPlayed25  || 0), 0) / Math.max(rows.length, 1),
    p50:  rows.reduce((s, r) => s + (r.videoPlayed50  || 0), 0) / Math.max(rows.length, 1),
    p75:  rows.reduce((s, r) => s + (r.videoPlayed75  || 0), 0) / Math.max(rows.length, 1),
    p100: rows.reduce((s, r) => s + (r.videoPlayed100 || 0), 0) / Math.max(rows.length, 1),
  }
}

const TABS = [
  { key: 'overview',  label: 'Overview' },
  { key: 'campaign',  label: 'Campaign' },
  { key: 'product',   label: 'Product' },
  { key: 'location',  label: 'Location' },
  { key: 'gender',    label: 'Gender' },
]

const TIP = { contentStyle: { background: 'var(--bg3)', border: '0.5px solid var(--border2)', fontSize: 12, borderRadius: 6 } }

export default function GoogleAwareness() {
  const { state } = useData()
  const filters = useFilters('last7')
  const { filterRows, getPrevRows } = filters
  const [tab, setTab] = useState('overview')

  // Only AWR campaigns + parse dimensions from name
  function parseAWRName(name = '') {
    const n = name.toLowerCase()
    return {
      gender:   n.includes('women') ? 'Women' : n.includes('men') ? 'Men' : 'All',
      product:  (() => {
        const parts = name.split('_')
        // product is after 'awr' segment: hvs_google_awr_womens_PRODUCT_...
        const awrIdx = parts.findIndex(p => p.toLowerCase() === 'awr')
        return awrIdx >= 0 && parts[awrIdx + 2] ? parts[awrIdx + 2] : 'Unknown'
      })(),
      location: (() => {
        const locs = ['mumbai','delhi','banglore','bangalore','pune','hyderabad','chennai','kolkata']
        const found = locs.find(l => name.toLowerCase().includes(l))
        return found ? found.charAt(0).toUpperCase() + found.slice(1) : 'All'
      })(),
      funnel: n.includes('tof') ? 'TOF' : n.includes('mof') ? 'MOF' : n.includes('bof') ? 'BOF' : '—',
    }
  }

  const allAwareness = useMemo(() => (state.googleAwareness || []).filter(r =>
    r.campaignName && r.campaignName.toLowerCase().includes('_awr_')
  ).map(r => ({ ...r, ...parseAWRName(r.campaignName) })), [state.googleAwareness])

  const rows     = useMemo(() => filterRows(allAwareness, 'date'), [allAwareness, filters])
  const prevRows = useMemo(() => getPrevRows(allAwareness, 'date'), [allAwareness, filters])

  const totals     = useMemo(() => aggAwr(rows),     [rows])
  const prevTotals = useMemo(() => aggAwr(prevRows),  [prevRows])
  const hasData    = rows.length > 0

  // Campaign breakdown
  const byCampaign = useMemo(() => {
    const map = {}
    for (const r of rows) {
      const k = r.campaignName
      if (!map[k]) map[k] = []
      map[k].push(r)
    }
    return Object.entries(map).map(([name, rs]) => ({ campaignName: name, ...aggAwr(rs) })).sort((a,b) => b.cost - a.cost)
  }, [rows])

  // Video-wise breakdown
  const byVideo = useMemo(() => {
    const map = {}
    for (const r of rows) {
      const k = r.videoTitle || r.campaignName
      if (!map[k]) map[k] = []
      map[k].push(r)
    }
    return Object.entries(map)
      .filter(([k]) => k)
      .map(([title, rs]) => ({ videoTitle: title, ...aggAwr(rs) }))
      .sort((a,b) => b.videoViews - a.videoViews)
  }, [rows])

  // Device breakdown
  const byDevice = useMemo(() => {
    const map = {}
    for (const r of rows) {
      const k = r.device || 'Unknown'
      if (!map[k]) map[k] = []
      map[k].push(r)
    }
    return Object.entries(map).map(([device, rs]) => ({ device, ...aggAwr(rs) })).sort((a,b) => b.impressions - a.impressions)
  }, [rows])

  // Location breakdown
  const byLocation = useMemo(() => {
    const map = {}
    for (const r of rows) {
      const k = r.location || 'Unknown'
      if (!map[k]) map[k] = []
      map[k].push(r)
    }
    return Object.entries(map).map(([location, rs]) => ({ location, ...aggAwr(rs) })).sort((a,b) => b.impressions - a.impressions).slice(0, 20)
  }, [rows])

  // View completion funnel data
  const funnelData = [
    { label: '25%',  value: totals.p25  * 100 },
    { label: '50%',  value: totals.p50  * 100 },
    { label: '75%',  value: totals.p75  * 100 },
    { label: '100%', value: totals.p100 * 100 },
  ]

  const campCols = [
    { key: 'campaignName', label: 'Campaign',     align:'left', bold:true },
    { key: 'cost',         label: 'Spend',         render: fmtINRCompact },
    { key: 'impressions',  label: 'Impressions',   render: fmtNum },
    { key: 'videoViews',   label: 'Video Views',   render: fmtNum },
    { key: 'vtr',          label: 'VTR',           render: v => `${(v*100).toFixed(1)}%`, color: v => v>=0.3?'var(--green)':v>=0.15?'var(--amber)':'var(--red)' },
    { key: 'cpv',          label: 'CPV',           render: v => `₹${v.toFixed(2)}` },
    { key: 'cpm',          label: 'CPM',           render: fmtINRCompact },
    { key: 'ctr',          label: 'CTR',           render: fmtPct },
    { key: 'cpc',          label: 'CPC',           render: fmtINRCompact },
    { key: 'clicks',       label: 'Clicks',        render: fmtNum },
    { key: 'p25',          label: 'P25%',          render: v => `${(v*100).toFixed(0)}%` },
    { key: 'p50',          label: 'P50%',          render: v => `${(v*100).toFixed(0)}%` },
    { key: 'p75',          label: 'P75%',          render: v => `${(v*100).toFixed(0)}%` },
    { key: 'p100',         label: 'P100%',         render: v => `${(v*100).toFixed(0)}%` },
  ]

  const videoCols = [
    { key: 'videoTitle',   label: 'Video',          align:'left', bold:true },
    { key: 'cost',         label: 'Spend',           render: fmtINRCompact },
    { key: 'impressions',  label: 'Impressions',     render: fmtNum },
    { key: 'videoViews',   label: 'Views',           render: fmtNum },
    { key: 'vtr',          label: 'VTR',             render: v => `${(v*100).toFixed(1)}%`, color: v => v>=0.3?'var(--green)':v>=0.15?'var(--amber)':'var(--red)' },
    { key: 'cpv',          label: 'CPV',             render: v => `₹${v.toFixed(2)}` },
    { key: 'cpm',          label: 'CPM',             render: fmtINRCompact },
    { key: 'p25',          label: 'P25%',            render: v => `${(v*100).toFixed(0)}%` },
    { key: 'p50',          label: 'P50%',            render: v => `${(v*100).toFixed(0)}%` },
    { key: 'p100',         label: 'P100%',           render: v => `${(v*100).toFixed(0)}%` },
  ]

  return (
    <div style={{ padding: '24px 28px', width: '100%' }}>
      <div style={{ marginBottom:16 }}>
        <h1 style={{ fontSize:18, fontWeight:600, marginBottom:2 }}>Google — Awareness</h1>
        <div style={{ fontSize:12, color:'var(--text3)' }}>YouTube awareness campaigns only (AWR) · Spend, Impressions, CPM, CTR · breakdown by product, city, gender</div>
      </div>

      <FilterBar filters={filters} showAdvanced showCohort={false} showSaleTag={false} />

      {/* Tab bar */}
      <div style={{ display:'flex', gap:0, marginBottom:16, borderBottom:'0.5px solid var(--border)' }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding:'8px 16px', fontSize:13, cursor:'pointer', fontWeight: tab===t.key ? 600 : 400,
            background:'transparent', border:'none',
            color: tab===t.key ? 'var(--blue)' : 'var(--text2)',
            borderBottom: `2px solid ${tab===t.key ? 'var(--blue)' : 'transparent'}`,
            marginBottom: -1,
          }}>{t.label}</button>
        ))}
      </div>

      {!hasData && (
        <div style={{ background:'rgba(239,68,68,0.08)', border:'0.5px solid rgba(239,68,68,0.2)', borderRadius:8, padding:'10px 14px', marginBottom:14, fontSize:12, color:'#ef4444' }}>
          No awareness data — sync Windsor data from the Upload page (AWR campaigns only)
        </div>
      )}

      {/* KPI cards — always visible */}
      <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:16 }}>
        {[
          { label:'Total spend',   val: fmtINRCompact(totals.cost),                delta: deltaLabel(totals.cost, prevTotals.cost) },
          { label:'Impressions',   val: fmtNum(totals.impressions),                delta: deltaLabel(totals.impressions, prevTotals.impressions) },
          { label:'Video views',   val: fmtNum(totals.videoViews),                 delta: deltaLabel(totals.videoViews, prevTotals.videoViews), accent:'var(--blue)' },
          { label:'VTR',           val: `${(totals.vtr*100).toFixed(1)}%`,         delta: deltaLabel(totals.vtr, prevTotals.vtr), accent:'var(--green)' },
          { label:'Avg CPV',       val: `₹${totals.cpv.toFixed(2)}`,               delta: deltaLabel(totals.cpv, prevTotals.cpv) },
          { label:'Avg CPM',       val: fmtINRCompact(totals.cpm),                 delta: deltaLabel(totals.cpm, prevTotals.cpm) },
          { label:'Clicks',        val: fmtNum(totals.clicks),                     delta: deltaLabel(totals.clicks, prevTotals.clicks) },
          { label:'CTR',           val: fmtPct(totals.ctr),                        delta: deltaLabel(totals.ctr, prevTotals.ctr) },
        ].map(m => <MetricCard key={m.label} label={m.label} value={m.val} delta={m.delta} accent={m.accent} />)}
      </div>

      {/* ── OVERVIEW TAB ─────────────────────────────────────────────────────── */}
      {tab === 'overview' && (
        <>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:16 }}>
            {/* View completion funnel */}
            <div style={{ background:'var(--bg2)', border:'0.5px solid var(--border)', borderRadius:10, padding:'14px 16px' }}>
              <div style={{ fontSize:12, color:'var(--text3)', marginBottom:10, fontWeight:500 }}>View completion funnel</div>
              {hasData ? (
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={funnelData} barSize={40}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize:12, fill:'var(--text3)' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize:11, fill:'var(--text3)' }} axisLine={false} tickLine={false} unit="%" domain={[0,100]} />
                    <Tooltip {...TIP} formatter={v => [`${v.toFixed(1)}%`, 'Completion rate']} />
                    <Bar dataKey="value" radius={[4,4,0,0]}>
                      {funnelData.map((_, i) => <Cell key={i} fill={`rgba(59,130,246,${0.4 + i*0.15})`} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : <Empty />}
            </div>

            {/* VTR by campaign */}
            <div style={{ background:'var(--bg2)', border:'0.5px solid var(--border)', borderRadius:10, padding:'14px 16px' }}>
              <div style={{ fontSize:12, color:'var(--text3)', marginBottom:10, fontWeight:500 }}>VTR by campaign (top 6)</div>
              {byCampaign.length > 0 ? (
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={byCampaign.slice(0,6).map(c => ({ name: c.campaignName.slice(0,20)+'...', vtr: +(c.vtr*100).toFixed(1) }))} layout="vertical" barSize={14}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize:10, fill:'var(--text3)' }} axisLine={false} tickLine={false} unit="%" />
                    <YAxis dataKey="name" type="category" tick={{ fontSize:9, fill:'var(--text3)' }} axisLine={false} tickLine={false} width={100} />
                    <Tooltip {...TIP} formatter={v => [`${v}%`, 'VTR']} />
                    <Bar dataKey="vtr" fill="var(--blue)" radius={[0,4,4,0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <Empty />}
            </div>
          </div>

          {/* Campaign table */}
          <div style={{ marginBottom:8 }}>
            <div style={{ fontSize:13, fontWeight:600, marginBottom:4 }}>Campaign-level awareness performance</div>
          </div>
          <DrillTable columns={campCols} data={byCampaign} defaultSort={{ key:'cost', dir:'desc' }} />
        </>
      )}

      {/* ── CAMPAIGN TAB ─────────────────────────────────────────────────────── */}
      {tab === 'campaign' && (
        <DrillTable columns={campCols} data={byCampaign} defaultSort={{ key:'cost', dir:'desc' }} />
      )}

      {/* ── PRODUCT TAB ──────────────────────────────────────────────────────── */}
      {tab === 'product' && (() => {
        const byProduct = Object.values(rows.reduce((map, r) => {
          const k = r.product || 'Unknown'
          if (!map[k]) map[k] = []
          map[k].push(r)
          return map
        }, {})).map(rs => ({ product: rs[0].product, ...aggAwr(rs) })).sort((a,b) => b.cost - a.cost)
        return (
          <>
            <div style={{ background:'var(--bg2)', border:'0.5px solid var(--border)', borderRadius:10, padding:'14px 16px', marginBottom:16 }}>
              <div style={{ fontSize:12, color:'var(--text3)', marginBottom:10, fontWeight:500 }}>Spend by product</div>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={byProduct.slice(0,8).map(p => ({ name: p.product, spend: +p.cost.toFixed(0), cpm: +p.cpm.toFixed(0) }))} barSize={28}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize:10, fill:'var(--text3)' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize:10, fill:'var(--text3)' }} axisLine={false} tickLine={false} />
                  <Tooltip {...TIP} formatter={(v,n) => [n==='spend'?`₹${v.toLocaleString('en-IN')}`:v, n]} />
                  <Bar dataKey="spend" fill="var(--blue)" radius={[3,3,0,0]} name="Spend" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <DrillTable columns={[
              { key:'product',     label:'Product',    align:'left', bold:true },
              { key:'cost',        label:'Spend',      render: v => `₹${Math.round(v).toLocaleString('en-IN')}` },
              { key:'impressions', label:'Impressions',render: fmtNum },
              { key:'clicks',      label:'Clicks',     render: fmtNum },
              { key:'ctr',         label:'CTR',        render: fmtPct, color: v => v>=0.02?'var(--green)':v>=0.01?'var(--amber)':'var(--red)' },
              { key:'cpm',         label:'CPM',        render: v => `₹${Math.round(v).toLocaleString('en-IN')}` },
              { key:'cpc',         label:'CPC',        render: v => `₹${Math.round(v).toLocaleString('en-IN')}` },
            ]} data={byProduct} defaultSort={{ key:'cost', dir:'desc' }} />
          </>
        )
      })()}

      {/* ── LOCATION TAB ─────────────────────────────────────────────────────── */}
      {tab === 'location' && (() => {
        const byLoc = Object.values(rows.reduce((map, r) => {
          const k = r.location || 'Unknown'
          if (!map[k]) map[k] = []
          map[k].push(r)
          return map
        }, {})).map(rs => ({ location: rs[0].location, ...aggAwr(rs) })).sort((a,b) => b.cost - a.cost)
        return (
          <>
            <div style={{ background:'var(--bg2)', border:'0.5px solid var(--border)', borderRadius:10, padding:'14px 16px', marginBottom:16 }}>
              <div style={{ fontSize:12, color:'var(--text3)', marginBottom:10, fontWeight:500 }}>Spend & CPM by city</div>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={byLoc.map(l => ({ name: l.location, spend: +l.cost.toFixed(0), cpm: +l.cpm.toFixed(0) }))} barSize={28}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize:10, fill:'var(--text3)' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize:10, fill:'var(--text3)' }} axisLine={false} tickLine={false} />
                  <Tooltip {...TIP} formatter={(v,n) => [`₹${v.toLocaleString('en-IN')}`, n]} />
                  <Bar dataKey="spend" fill="var(--blue)" radius={[3,3,0,0]} name="Spend" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <DrillTable columns={[
              { key:'location',    label:'City',       align:'left', bold:true },
              { key:'cost',        label:'Spend',      render: v => `₹${Math.round(v).toLocaleString('en-IN')}` },
              { key:'impressions', label:'Impressions',render: fmtNum },
              { key:'clicks',      label:'Clicks',     render: fmtNum },
              { key:'ctr',         label:'CTR',        render: fmtPct },
              { key:'cpm',         label:'CPM',        render: v => `₹${Math.round(v).toLocaleString('en-IN')}` },
              { key:'cpc',         label:'CPC',        render: v => `₹${Math.round(v).toLocaleString('en-IN')}` },
            ]} data={byLoc} defaultSort={{ key:'cost', dir:'desc' }} />
          </>
        )
      })()}

      {/* ── GENDER TAB ───────────────────────────────────────────────────────── */}
      {tab === 'gender' && (() => {
        const byGender = Object.values(rows.reduce((map, r) => {
          const k = r.gender || 'All'
          if (!map[k]) map[k] = []
          map[k].push(r)
          return map
        }, {})).map(rs => ({ gender: rs[0].gender, ...aggAwr(rs) })).sort((a,b) => b.cost - a.cost)
        return (
          <>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:10, marginBottom:16 }}>
              {byGender.map(g => (
                <div key={g.gender} style={{ background:'var(--bg2)', border:'0.5px solid var(--border)', borderRadius:10, padding:'14px 16px' }}>
                  <div style={{ fontSize:13, fontWeight:600, marginBottom:10 }}>{g.gender}</div>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8 }}>
                    {[
                      { label:'Spend',       val:`₹${Math.round(g.cost).toLocaleString('en-IN')}` },
                      { label:'Impressions', val:fmtNum(g.impressions) },
                      { label:'Clicks',      val:fmtNum(g.clicks) },
                      { label:'CTR',         val:fmtPct(g.ctr) },
                      { label:'CPM',         val:`₹${Math.round(g.cpm).toLocaleString('en-IN')}` },
                      { label:'CPC',         val:`₹${Math.round(g.cpc).toLocaleString('en-IN')}` },
                    ].map(m => (
                      <div key={m.label}>
                        <div style={{ fontSize:10, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:2 }}>{m.label}</div>
                        <div style={{ fontSize:16, fontWeight:600 }}>{m.val}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <DrillTable columns={[
              { key:'gender',      label:'Gender',     align:'left', bold:true },
              { key:'cost',        label:'Spend',      render: v => `₹${Math.round(v).toLocaleString('en-IN')}` },
              { key:'impressions', label:'Impressions',render: fmtNum },
              { key:'clicks',      label:'Clicks',     render: fmtNum },
              { key:'ctr',         label:'CTR',        render: fmtPct },
              { key:'cpm',         label:'CPM',        render: v => `₹${Math.round(v).toLocaleString('en-IN')}` },
              { key:'cpc',         label:'CPC',        render: v => `₹${Math.round(v).toLocaleString('en-IN')}` },
            ]} data={byGender} defaultSort={{ key:'cost', dir:'desc' }} />
          </>
        )
      })()}
    </div>
  )
}

function Empty({ text = 'Upload awareness CSV to see data' }) {
  return <div style={{ height:160, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text3)', fontSize:12 }}>{text}</div>
}
