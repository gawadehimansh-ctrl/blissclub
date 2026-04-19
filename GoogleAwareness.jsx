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
  return {
    cost, impressions: imp, clicks: cl, videoViews: views,
    cpm:  imp   > 0 ? (cost / imp) * 1000  : 0,
    cpc:  cl    > 0 ? cost / cl             : 0,
    ctr:  imp   > 0 ? cl / imp              : 0,
    cpv:  views > 0 ? cost / views          : 0,
    vtr:  imp   > 0 ? views / imp           : 0,
    p25:  rows.reduce((s, r) => s + (r.videoPlayed25  || 0), 0) / Math.max(rows.length, 1),
    p50:  rows.reduce((s, r) => s + (r.videoPlayed50  || 0), 0) / Math.max(rows.length, 1),
    p75:  rows.reduce((s, r) => s + (r.videoPlayed75  || 0), 0) / Math.max(rows.length, 1),
    p100: rows.reduce((s, r) => s + (r.videoPlayed100 || 0), 0) / Math.max(rows.length, 1),
  }
}

const TABS = [
  { key: 'overview',   label: 'Overview' },
  { key: 'videos',     label: 'Video-wise' },
  { key: 'device',     label: 'Device' },
  { key: 'location',   label: 'Location' },
  { key: 'placement',  label: 'Placement' },
]

const TIP = { contentStyle: { background: 'var(--bg3)', border: '0.5px solid var(--border2)', fontSize: 12, borderRadius: 6 } }

export default function GoogleAwareness() {
  const { state } = useData()
  const filters = useFilters('last7')
  const { filterRows, getPrevRows } = filters
  const [tab, setTab] = useState('overview')

  const rows     = useMemo(() => filterRows(state.googleAwareness || [], 'date'), [state.googleAwareness, filters])
  const prevRows = useMemo(() => getPrevRows(state.googleAwareness || [], 'date'), [state.googleAwareness, filters])

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
    <div style={{ padding: '20px 24px' }}>
      <div style={{ marginBottom:16 }}>
        <h1 style={{ fontSize:18, fontWeight:600, marginBottom:2 }}>Google — Awareness</h1>
        <div style={{ fontSize:12, color:'var(--text3)' }}>YouTube campaigns · VTR, CPV, CPM, view completion funnel</div>
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
          No awareness data — upload Google awareness/YouTube CSV from Upload page
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

      {/* ── VIDEOS TAB ───────────────────────────────────────────────────────── */}
      {tab === 'videos' && (
        <>
          <div style={{ marginBottom:8 }}>
            <div style={{ fontSize:13, fontWeight:600, marginBottom:2 }}>Video-wise performance</div>
            <div style={{ fontSize:11, color:'var(--text3)', marginBottom:12 }}>Individual creatives sorted by views · VTR threshold: green ≥30%, amber ≥15%</div>
          </div>
          <DrillTable columns={videoCols} data={byVideo} defaultSort={{ key:'videoViews', dir:'desc' }} />
        </>
      )}

      {/* ── DEVICE TAB ───────────────────────────────────────────────────────── */}
      {tab === 'device' && (
        <>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:16 }}>
            <div style={{ background:'var(--bg2)', border:'0.5px solid var(--border)', borderRadius:10, padding:'14px 16px' }}>
              <div style={{ fontSize:12, color:'var(--text3)', marginBottom:10, fontWeight:500 }}>Impressions by device</div>
              {byDevice.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={byDevice.map(d => ({ name: d.device, value: d.impressions }))}
                      cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={3}>
                      {byDevice.map((_, i) => <Cell key={i} fill={['var(--blue)','var(--green)','var(--amber)','var(--purple)','#64748b'][i%5]} />)}
                    </Pie>
                    <Tooltip {...TIP} formatter={v => [fmtNum(v), 'Impressions']} />
                    <Legend iconType="circle" iconSize={8} formatter={v => <span style={{ fontSize:11, color:'var(--text2)' }}>{v}</span>} />
                  </PieChart>
                </ResponsiveContainer>
              ) : <Empty />}
            </div>
            <div style={{ background:'var(--bg2)', border:'0.5px solid var(--border)', borderRadius:10, padding:'14px 16px' }}>
              <div style={{ fontSize:12, color:'var(--text3)', marginBottom:10, fontWeight:500 }}>VTR by device</div>
              {byDevice.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={byDevice.map(d => ({ name: d.device, vtr: +(d.vtr*100).toFixed(1), cpv: +d.cpv.toFixed(2) }))} barSize={28}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize:10, fill:'var(--text3)' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize:10, fill:'var(--text3)' }} axisLine={false} tickLine={false} unit="%" />
                    <Tooltip {...TIP} formatter={(v,n) => [n==='vtr'?`${v}%`:`₹${v}`, n==='vtr'?'VTR':'CPV']} />
                    <Legend iconType="circle" iconSize={8} formatter={v => <span style={{ fontSize:11, color:'var(--text2)' }}>{v}</span>} />
                    <Bar dataKey="vtr" fill="var(--blue)" name="VTR %" radius={[3,3,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <Empty />}
            </div>
          </div>
          <DrillTable
            columns={[
              { key:'device',      label:'Device',    align:'left', bold:true },
              { key:'cost',        label:'Spend',     render: fmtINRCompact },
              { key:'impressions', label:'Impr.',     render: fmtNum },
              { key:'videoViews',  label:'Views',     render: fmtNum },
              { key:'vtr',         label:'VTR',       render: v => `${(v*100).toFixed(1)}%`, color: v => v>=0.3?'var(--green)':v>=0.15?'var(--amber)':'var(--red)' },
              { key:'cpv',         label:'CPV',       render: v => `₹${v.toFixed(2)}` },
              { key:'cpm',         label:'CPM',       render: fmtINRCompact },
              { key:'ctr',         label:'CTR',       render: fmtPct },
            ]}
            data={byDevice} defaultSort={{ key:'impressions', dir:'desc' }}
          />
        </>
      )}

      {/* ── LOCATION TAB ─────────────────────────────────────────────────────── */}
      {tab === 'location' && (
        <>
          <div style={{ background:'var(--bg2)', border:'0.5px solid var(--border)', borderRadius:10, padding:'14px 16px', marginBottom:16 }}>
            <div style={{ fontSize:12, color:'var(--text3)', marginBottom:10, fontWeight:500 }}>Spend & impressions by city (top 10)</div>
            {byLocation.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={byLocation.slice(0,10).map(l => ({ name: l.location, impressions: l.impressions, cost: l.cost }))} barSize={16}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize:10, fill:'var(--text3)' }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="left" tick={{ fontSize:10, fill:'var(--text3)' }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize:10, fill:'var(--text3)' }} axisLine={false} tickLine={false} />
                  <Tooltip {...TIP} formatter={(v,n) => [n==='Impressions'?fmtNum(v):fmtINRCompact(v), n]} />
                  <Legend iconType="circle" iconSize={8} formatter={v => <span style={{ fontSize:11, color:'var(--text2)' }}>{v}</span>} />
                  <Bar yAxisId="left" dataKey="impressions" fill="var(--blue)" fillOpacity={0.7} name="Impressions" radius={[3,3,0,0]} />
                  <Bar yAxisId="right" dataKey="cost" fill="var(--green)" fillOpacity={0.7} name="Spend" radius={[3,3,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <Empty />}
          </div>
          <DrillTable
            columns={[
              { key:'location',    label:'City/Location', align:'left', bold:true },
              { key:'cost',        label:'Spend',         render: fmtINRCompact },
              { key:'impressions', label:'Impressions',   render: fmtNum },
              { key:'videoViews',  label:'Views',         render: fmtNum },
              { key:'vtr',         label:'VTR',           render: v => `${(v*100).toFixed(1)}%`, color: v => v>=0.3?'var(--green)':v>=0.15?'var(--amber)':'var(--red)' },
              { key:'cpm',         label:'CPM',           render: fmtINRCompact },
              { key:'cpv',         label:'CPV',           render: v => `₹${v.toFixed(2)}` },
            ]}
            data={byLocation} defaultSort={{ key:'impressions', dir:'desc' }}
          />
        </>
      )}

      {/* ── PLACEMENT TAB ────────────────────────────────────────────────────── */}
      {tab === 'placement' && (
        <div style={{ padding:'32px', textAlign:'center', color:'var(--text3)', fontSize:13,
          background:'var(--bg2)', borderRadius:10, border:'0.5px dashed var(--border2)' }}>
          Upload Google Ads placement report CSV to see Instream / Feed / Shorts breakdown
        </div>
      )}
    </div>
  )
}

function Empty({ text = 'Upload awareness CSV to see data' }) {
  return <div style={{ height:160, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text3)', fontSize:12 }}>{text}</div>
}
