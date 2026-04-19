import React, { useMemo, useState } from 'react'
import { useData } from '../data/store.jsx'
import { useFilters } from '../hooks/useFilters.js'
import FilterBar from '../components/FilterBar.jsx'
import DrillTable from '../components/DrillTable.jsx'
import MetricCard from '../components/MetricCard.jsx'
import { fmtINRCompact, fmtX, fmtPct, fmtNum, deltaLabel } from '../utils/formatters.js'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, Legend,
} from 'recharts'
import { format, eachDayOfInterval, eachWeekOfInterval, startOfWeek, endOfWeek,
         subMonths, startOfMonth, endOfMonth, eachMonthOfInterval } from 'date-fns'

// ── helpers ───────────────────────────────────────────────────────────────────
function aggG(rows) {
  const cost = rows.reduce((s, r) => s + (r.cost || 0), 0)
  const imp  = rows.reduce((s, r) => s + (r.impressions || 0), 0)
  const cl   = rows.reduce((s, r) => s + (r.clicks || 0), 0)
  const sess = rows.reduce((s, r) => s + (r.sessions || 0), 0)
  const tx   = rows.reduce((s, r) => s + (r.transactions || 0), 0)
  const rev  = rows.reduce((s, r) => s + (r.revenue || 0), 0)
  return {
    cost, impressions: imp, clicks: cl, sessions: sess, transactions: tx, revenue: rev,
    roas: cost > 0 ? rev / cost : 0,
    cpa:  tx   > 0 ? cost / tx  : 0,
    ctr:  imp  > 0 ? cl / imp   : 0,
    cpm:  imp  > 0 ? cost / imp * 1000 : 0,
    cpc:  cl   > 0 ? cost / cl  : 0,
    ecr:  sess > 0 ? tx / sess  : 0,
    aov:  tx   > 0 ? rev / tx   : 0,
  }
}

// ── Account cuts ──────────────────────────────────────────────────────────────
const ACCOUNT_CUTS = [
  { key: 'excl_awareness', label: 'Total excl. awareness', short: 'Excl. awareness',
    filter: r => (r.campaignType || '') !== 'Awareness' },
  { key: 'incl_uac',       label: 'Total incl. UAC',       short: 'Incl. UAC',
    filter: () => true },
  { key: 'excl_uac',       label: 'Total excl. UAC',       short: 'Excl. UAC',
    filter: r => (r.campaignType || '') !== 'UAC' },
  { key: 'women',          label: "Women's campaigns",      short: 'Women',
    filter: r => { const n = (r.campaignName || '').toLowerCase(); return !n.includes('men') || n.includes('women') } },
  { key: 'men',            label: "Men's campaigns",        short: "Men",
    filter: r => { const n = (r.campaignName || '').toLowerCase(); return n.includes('men') || n.includes("men's") } },
  { key: 'conv_creative',  label: 'Creative — conversion',  short: 'Conv. creative',
    filter: r => ['Pmax','Discovery','Search'].includes(r.campaignType || '') },
  { key: 'aware_creative', label: 'Creative — awareness',   short: 'Aware. creative',
    filter: r => (r.campaignType || '') === 'Awareness' },
]

const CAMP_TYPES = ['All', 'Pmax', 'Search', 'Discovery', 'UAC', 'Awareness', 'Shopping', 'Other']

const PERIOD_TABS = [
  { key: 'daily',   label: 'Daily' },
  { key: 'weekly',  label: 'Weekly' },
  { key: 'monthly', label: 'Monthly' },
]

const TIP = { contentStyle: { background: 'var(--bg3)', border: '1px solid var(--border2)', fontSize: 12, borderRadius: 6 } }

// ── Main ──────────────────────────────────────────────────────────────────────
export default function GoogleCampaigns() {
  const { state } = useData()
  const filters = useFilters('last7')
  const { filterRows, getPrevRows, dateFrom, dateTo } = filters
  const [cut, setCut]           = useState('excl_awareness')
  const [campType, setCampType] = useState('All')
  const [period, setPeriod]     = useState('daily')
  const [expanded, setExpanded] = useState({}) // campaign → bool

  const allRows  = useMemo(() => filterRows(state.googleDump, 'date'), [state.googleDump, filters])
  const prevRows = useMemo(() => getPrevRows(state.googleDump, 'date'), [state.googleDump, filters])

  const cutFn     = ACCOUNT_CUTS.find(c => c.key === cut)?.filter || (() => true)
  const cutRows   = useMemo(() => allRows.filter(cutFn),  [allRows, cut])
  const cutPrev   = useMemo(() => prevRows.filter(cutFn), [prevRows, cut])

  const totals     = useMemo(() => aggG(cutRows),  [cutRows])
  const prevTotals = useMemo(() => aggG(cutPrev),  [cutPrev])

  // ── Campaign type breakdown ───────────────────────────────────────────────
  const byType = useMemo(() => {
    const map = {}
    for (const r of cutRows) {
      const t = r.campaignType || 'Other'
      if (!map[t]) map[t] = []
      map[t].push(r)
    }
    return Object.entries(map)
      .map(([type, rs]) => ({ type, ...aggG(rs) }))
      .sort((a, b) => b.cost - a.cost)
  }, [cutRows])

  // ── Time series ───────────────────────────────────────────────────────────
  const timeSeries = useMemo(() => {
    if (!cutRows.length) return []

    if (period === 'daily') {
      const days = eachDayOfInterval({ start: dateFrom, end: dateTo })
      return days.map(d => {
        const label = format(d, 'd MMM')
        const dayRows = cutRows.filter(r => {
          const rd = r.date instanceof Date ? r.date : new Date(r.date)
          return format(rd, 'yyyy-MM-dd') === format(d, 'yyyy-MM-dd')
        })
        const agg = aggG(dayRows)
        return { label, ...agg }
      })
    }

    if (period === 'weekly') {
      const weeks = eachWeekOfInterval({ start: dateFrom, end: dateTo }, { weekStartsOn: 1 })
      return weeks.map(w => {
        const wEnd = endOfWeek(w, { weekStartsOn: 1 })
        const label = `${format(w, 'd MMM')}–${format(wEnd, 'd MMM')}`
        const wRows = cutRows.filter(r => {
          const rd = r.date instanceof Date ? r.date : new Date(r.date)
          return rd >= w && rd <= wEnd
        })
        return { label, ...aggG(wRows) }
      })
    }

    if (period === 'monthly') {
      const months = Array.from({ length: 6 }, (_, i) => subMonths(new Date(), 5 - i))
      return months.map(m => {
        const start = startOfMonth(m), end = endOfMonth(m)
        const mRows = state.googleDump.filter(r => {
          const rd = r.date instanceof Date ? r.date : new Date(r.date)
          return rd >= start && rd <= end
        }).filter(cutFn)
        return { label: format(m, 'MMM yy'), ...aggG(mRows) }
      })
    }
    return []
  }, [cutRows, period, dateFrom, dateTo])

  // ── Campaign table ────────────────────────────────────────────────────────
  const campRows = useMemo(() => {
    const base = campType === 'All' ? cutRows : cutRows.filter(r => r.campaignType === campType)
    const map = {}
    for (const r of base) {
      const k = r.campaignName || 'Unknown'
      if (!map[k]) map[k] = { campaignName: k, campaignType: r.campaignType || '', rows: [] }
      map[k].rows.push(r)
    }
    return Object.values(map).map(c => ({
      campaignName: c.campaignName,
      campaignType: c.campaignType,
      ...aggG(c.rows),
      _rows: c.rows,
    })).sort((a, b) => b.cost - a.cost)
  }, [cutRows, campType])

  // Adset rows for expanded campaign
  function getAdsetRows(campName) {
    const rows = cutRows.filter(r => r.campaignName === campName)
    const map = {}
    for (const r of rows) {
      const k = r.adgroupName || r.adGroup || 'Ad group'
      if (!map[k]) map[k] = []
      map[k].push(r)
    }
    return Object.entries(map).map(([name, rs]) => ({ adgroupName: name, ...aggG(rs) })).sort((a,b) => b.cost - a.cost)
  }

  const hasData = cutRows.length > 0

  // ── Column definitions ────────────────────────────────────────────────────
  const metricCols = [
    { key: 'cost',         label: 'Spend',    render: fmtINRCompact },
    { key: 'impressions',  label: 'Impr.',    render: fmtNum },
    { key: 'clicks',       label: 'Clicks',   render: fmtNum },
    { key: 'ctr',          label: 'CTR',      render: fmtPct, color: v => v>=0.02?'var(--green)':v>=0.01?'var(--amber)':'var(--text2)' },
    { key: 'cpc',          label: 'CPC',      render: fmtINRCompact },
    { key: 'cpm',          label: 'CPM',      render: fmtINRCompact },
    { key: 'transactions', label: 'Orders',   render: fmtNum },
    { key: 'revenue',      label: 'Revenue',  render: fmtINRCompact },
    { key: 'roas',         label: 'ROAS',     render: fmtX, color: v => v>=2?'var(--green)':v>=1?'var(--amber)':'var(--red)' },
    { key: 'cpa',          label: 'CPA',      render: fmtINRCompact },
    { key: 'ecr',          label: 'ECR',      render: fmtPct },
  ]

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize:18, fontWeight:600, marginBottom:2 }}>Google — Campaigns</h1>
        <div style={{ fontSize:12, color:'var(--text3)' }}>7 account cuts · daily / weekly / monthly · campaign drill-down</div>
      </div>

      <FilterBar filters={filters} showAdvanced showCohort={false} showSaleTag={false} />

      {/* Account cut tabs */}
      <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:14 }}>
        {ACCOUNT_CUTS.map(c => (
          <button key={c.key} onClick={() => setCut(c.key)} style={{
            padding:'5px 12px', fontSize:12, borderRadius:8, cursor:'pointer', fontWeight: cut===c.key ? 600 : 400,
            background: cut===c.key ? 'rgba(59,130,246,0.15)' : 'var(--bg2)',
            color: cut===c.key ? 'var(--blue)' : 'var(--text2)',
            border: `0.5px solid ${cut===c.key ? 'var(--blue-border)' : 'var(--border2)'}`,
          }}>{c.short}</button>
        ))}
      </div>

      {!hasData && (
        <div style={{ background:'rgba(239,68,68,0.08)', border:'0.5px solid rgba(239,68,68,0.2)', borderRadius:8, padding:'10px 14px', marginBottom:14, fontSize:12, color:'#ef4444' }}>
          No Google campaign data — upload Google campaigns CSV from Upload page
        </div>
      )}

      {/* KPI cards */}
      <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:16 }}>
        {[
          { label:'Spend',    val: fmtINRCompact(totals.cost),        delta: deltaLabel(totals.cost, prevTotals.cost) },
          { label:'Revenue',  val: fmtINRCompact(totals.revenue),     delta: deltaLabel(totals.revenue, prevTotals.revenue) },
          { label:'ROAS',     val: fmtX(totals.roas),                 delta: deltaLabel(totals.roas, prevTotals.roas) },
          { label:'CPC',      val: fmtINRCompact(totals.cpc),         delta: deltaLabel(totals.cpc, prevTotals.cpc) },
          { label:'CTR',      val: fmtPct(totals.ctr),                delta: deltaLabel(totals.ctr, prevTotals.ctr) },
          { label:'Orders',   val: fmtNum(totals.transactions),       delta: deltaLabel(totals.transactions, prevTotals.transactions) },
          { label:'CPA',      val: fmtINRCompact(totals.cpa),         delta: deltaLabel(totals.cpa, prevTotals.cpa) },
          { label:'ECR',      val: fmtPct(totals.ecr),                delta: deltaLabel(totals.ecr, prevTotals.ecr) },
        ].map(m => <MetricCard key={m.label} label={m.label} value={m.val} delta={m.delta} />)}
      </div>

      {/* Period tabs + trend chart */}
      <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:10, padding:'14px 16px', marginBottom:16 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
          <span style={{ fontSize:13, fontWeight:600 }}>
            {ACCOUNT_CUTS.find(c => c.key === cut)?.label} — spend & ROAS trend
          </span>
          <div style={{ display:'flex', gap:4 }}>
            {PERIOD_TABS.map(p => (
              <button key={p.key} onClick={() => setPeriod(p.key)} style={{
                padding:'3px 10px', fontSize:11, borderRadius:6, cursor:'pointer',
                background: period===p.key ? 'var(--blue)' : 'var(--bg3)',
                color: period===p.key ? '#fff' : 'var(--text2)',
                border: '1px solid var(--border2)', fontWeight: period===p.key ? 600 : 400,
              }}>{p.label}</button>
            ))}
          </div>
        </div>
        {timeSeries.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={timeSeries} barSize={period === 'daily' ? 10 : 20}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize:10, fill:'var(--text3)' }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="left" tick={{ fontSize:10, fill:'var(--text3)' }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize:10, fill:'var(--text3)' }} axisLine={false} tickLine={false} />
              <Tooltip {...TIP} formatter={(v, n) => [n === 'ROAS' ? fmtX(v) : fmtINRCompact(v), n]} />
              <Legend iconType="circle" iconSize={8} formatter={v => <span style={{ fontSize:11, color:'var(--text2)' }}>{v}</span>} />
              <Bar yAxisId="left" dataKey="cost" fill="var(--blue)" fillOpacity={0.7} name="Spend" radius={[3,3,0,0]} />
              <Line yAxisId="right" type="monotone" dataKey="roas" stroke="var(--green)" strokeWidth={2} name="ROAS" dot={{ r:2 }} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div style={{ height:180, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text3)', fontSize:12 }}>
            Upload Google campaign CSV to see trend
          </div>
        )}
      </div>

      {/* Campaign type breakdown */}
      {byType.length > 0 && (
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:16 }}>
          {byType.slice(0, 6).map(t => (
            <div key={t.type} style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:8, padding:'10px 14px', flex:1, minWidth:120 }}>
              <div style={{ fontSize:10, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:4 }}>{t.type}</div>
              <div style={{ fontSize:15, fontWeight:700 }}>{fmtINRCompact(t.cost)}</div>
              <div style={{ fontSize:11, color:'var(--text3)', marginTop:2 }}>{fmtX(t.roas)} ROAS</div>
            </div>
          ))}
        </div>
      )}

      {/* Campaign type filter */}
      <div style={{ display:'flex', gap:5, flexWrap:'wrap', marginBottom:12, alignItems:'center' }}>
        <span style={{ fontSize:12, color:'var(--text2)' }}>Type:</span>
        {CAMP_TYPES.map(t => (
          <button key={t} onClick={() => setCampType(t)} style={{
            padding:'3px 9px', fontSize:11, borderRadius:16, cursor:'pointer',
            background: campType===t ? 'rgba(59,130,246,0.15)' : 'transparent',
            color: campType===t ? 'var(--blue)' : 'var(--text2)',
            border: `0.5px solid ${campType===t ? 'var(--blue-border)' : 'var(--border)'}`,
            fontWeight: campType===t ? 500 : 400,
          }}>{t}</button>
        ))}
      </div>

      {/* Campaign accordion drill-down */}
      <div style={{ border:'1px solid var(--border)', borderRadius:10, overflow:'hidden' }}>
        {/* Header */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 90px 90px 70px 70px 70px 80px 80px 70px 70px', gap:0,
          padding:'7px 14px', background:'var(--bg3)', borderBottom:'1px solid var(--border2)' }}>
          {['Campaign','Spend','Revenue','ROAS','CPC','CTR','Orders','CPA','ECR','Type'].map(h => (
            <div key={h} style={{ fontSize:10, fontWeight:600, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.05em',
              textAlign: h==='Campaign' ? 'left' : 'right' }}>{h}</div>
          ))}
        </div>

        {campRows.length === 0 ? (
          <div style={{ padding:'32px', textAlign:'center', color:'var(--text3)', fontSize:13 }}>No campaign data for this cut</div>
        ) : campRows.map((c, i) => {
          const isOpen = expanded[c.campaignName]
          const adsets = isOpen ? getAdsetRows(c.campaignName) : []

          const colStyle = (align='right') => ({ padding:'9px 14px', fontSize:12, borderBottom:'1px solid var(--border)', textAlign:align })

          return (
            <React.Fragment key={c.campaignName}>
              {/* Campaign row */}
              <div
                onClick={() => setExpanded(prev => ({ ...prev, [c.campaignName]: !prev[c.campaignName] }))}
                style={{ display:'grid', gridTemplateColumns:'1fr 90px 90px 70px 70px 70px 80px 80px 70px 70px',
                  cursor:'pointer', background: isOpen ? 'rgba(59,130,246,0.04)' : i%2===0?'transparent':'rgba(255,255,255,0.012)' }}
                onMouseEnter={e => { if (!isOpen) e.currentTarget.style.background='var(--bg3)' }}
                onMouseLeave={e => { if (!isOpen) e.currentTarget.style.background=i%2===0?'transparent':'rgba(255,255,255,0.012)' }}
              >
                <div style={{ ...colStyle('left'), display:'flex', alignItems:'center', gap:8 }}>
                  <span style={{ fontSize:10, color:'var(--text3)', transition:'transform .15s', display:'inline-block',
                    transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
                  <div style={{ overflow:'hidden' }}>
                    <div style={{ fontSize:12, fontWeight:500, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', maxWidth:280 }}>{c.campaignName}</div>
                    <span style={{ fontSize:10, padding:'1px 5px', borderRadius:4, marginTop:2, display:'inline-block',
                      background:'rgba(59,130,246,0.12)', color:'var(--blue)', border:'0.5px solid rgba(59,130,246,0.25)' }}>
                      {c.campaignType}
                    </span>
                  </div>
                </div>
                <div style={colStyle()}>{fmtINRCompact(c.cost)}</div>
                <div style={colStyle()}>{fmtINRCompact(c.revenue)}</div>
                <div style={{ ...colStyle(), color: c.roas>=2?'var(--green)':c.roas>=1?'var(--amber)':'var(--red)', fontWeight:500 }}>{fmtX(c.roas)}</div>
                <div style={colStyle()}>{fmtINRCompact(c.cpc)}</div>
                <div style={{ ...colStyle(), color: c.ctr>=0.02?'var(--green)':c.ctr>=0.01?'var(--amber)':'var(--text2)' }}>{fmtPct(c.ctr)}</div>
                <div style={colStyle()}>{fmtNum(c.transactions)}</div>
                <div style={colStyle()}>{fmtINRCompact(c.cpa)}</div>
                <div style={colStyle()}>{fmtPct(c.ecr)}</div>
                <div style={colStyle()}></div>
              </div>

              {/* Adgroup rows */}
              {isOpen && adsets.map((ag, ai) => (
                <div key={ag.adgroupName} style={{ display:'grid', gridTemplateColumns:'1fr 90px 90px 70px 70px 70px 80px 80px 70px 70px',
                  background:'rgba(59,130,246,0.03)', borderBottom:'1px solid var(--border)' }}>
                  <div style={{ ...colStyle('left'), paddingLeft:48, display:'flex', alignItems:'center', gap:6 }}>
                    <span style={{ fontSize:9, color:'var(--blue)', opacity:0.6 }}>AD GROUP</span>
                    <span style={{ fontSize:12, color:'var(--text2)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', maxWidth:260 }}>{ag.adgroupName}</span>
                  </div>
                  <div style={{ ...colStyle(), color:'var(--text2)', fontSize:11 }}>{fmtINRCompact(ag.cost)}</div>
                  <div style={{ ...colStyle(), color:'var(--text2)', fontSize:11 }}>{fmtINRCompact(ag.revenue)}</div>
                  <div style={{ ...colStyle(), fontSize:11, color: ag.roas>=2?'var(--green)':ag.roas>=1?'var(--amber)':'var(--red)' }}>{fmtX(ag.roas)}</div>
                  <div style={{ ...colStyle(), fontSize:11, color:'var(--text2)' }}>{fmtINRCompact(ag.cpc)}</div>
                  <div style={{ ...colStyle(), fontSize:11, color: ag.ctr>=0.02?'var(--green)':ag.ctr>=0.01?'var(--amber)':'var(--text2)' }}>{fmtPct(ag.ctr)}</div>
                  <div style={{ ...colStyle(), fontSize:11, color:'var(--text2)' }}>{fmtNum(ag.transactions)}</div>
                  <div style={{ ...colStyle(), fontSize:11, color:'var(--text2)' }}>{fmtINRCompact(ag.cpa)}</div>
                  <div style={{ ...colStyle(), fontSize:11, color:'var(--text2)' }}>{fmtPct(ag.ecr)}</div>
                  <div style={colStyle()}></div>
                </div>
              ))}
            </React.Fragment>
          )
        })}
      </div>
    </div>
  )
}
