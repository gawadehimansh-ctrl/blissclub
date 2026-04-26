import React, { useMemo, useState, useEffect, useCallback } from 'react'
import { useData } from '../data/store.jsx'
import { useNavigate } from 'react-router-dom'
import { startOfWeek, endOfWeek, subWeeks, format, subDays } from 'date-fns'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, PieChart, Pie, Cell } from 'recharts'
import { PRESET_RANGES } from '../hooks/useFilters.js'

const PROXY = import.meta.env.VITE_WINDSOR_PROXY_URL || 'https://blissclub-proxy-production.up.railway.app'
const TIP   = { contentStyle: { background:'var(--bg3)', border:'0.5px solid var(--border2)', fontSize:12, borderRadius:6 } }

const fmtC  = n => !n?'₹0':n>=10000000?`₹${(n/10000000).toFixed(2)}Cr`:n>=100000?`₹${(n/100000).toFixed(1)}L`:n>=1000?`₹${(n/1000).toFixed(1)}K`:`₹${Math.round(n).toLocaleString('en-IN')}`
const fmtN  = n => !n?'0':Number(n).toLocaleString('en-IN')
const fmtX  = n => !n?'—':`${Number(n).toFixed(2)}x`
const fmtP  = n => `${Number(n||0).toFixed(1)}%`

function delta(curr, prev) {
  if (!prev || !curr) return null
  return ((curr - prev) / prev) * 100
}
function DeltaBadge({ curr, prev, invert=false }) {
  const d = delta(curr, prev)
  if (d===null) return null
  const pos = invert ? d<0 : d>0
  return <span style={{ fontSize:11, fontWeight:500, padding:'2px 6px', borderRadius:4, background:pos?'rgba(34,197,94,0.12)':'rgba(239,68,68,0.12)', color:pos?'#22c55e':'#ef4444' }}>{d>0?'▲':'▼'} {Math.abs(d).toFixed(1)}%</span>
}
function KpiCard({ label, value, curr, prev, sublabel, accent, invert }) {
  return (
    <div style={{ background:'var(--bg2)', borderRadius:10, padding:'14px 16px', border:'0.5px solid var(--border)', borderTop:`2px solid ${accent||'var(--border)'}` }}>
      <div style={{ fontSize:10, color:'var(--text3)', marginBottom:6, fontWeight:500, textTransform:'uppercase', letterSpacing:'0.05em' }}>{label}</div>
      <div style={{ fontSize:20, fontWeight:700, color:'var(--text)', marginBottom:4 }}>{value}</div>
      <div style={{ display:'flex', alignItems:'center', gap:6 }}>
        {prev!==undefined && <DeltaBadge curr={curr||parseFloat(value)} prev={prev} invert={invert} />}
        {sublabel && <span style={{ fontSize:10, color:'var(--text3)' }}>{sublabel}</span>}
      </div>
    </div>
  )
}

// ── Proper channel classification for BlissClub UTM structure ─────────────────
function getChannel(source='', medium='', campaign='') {
  const s=source.toLowerCase(), m=medium.toLowerCase(), c=campaign.toLowerCase()
  if (s==='(direct)'||m==='(none)'||m==='none') return 'Direct'
  if (m==='organic'&&(s==='google'||s==='bing'||s==='yahoo')) return 'Organic Search'
  if (m==='organic') return 'Organic Social'
  // Meta paid — all these mediums are Meta
  const metaMediums = ['instagram_feed','instagram_stories','instagram_reels','instagram_explore','facebook_mobile_feed','facebook_desktop_feed','facebook_reels','facebook_stories','facebook_marketplace','messenger','instagram','ig','fb_feed','paid_social']
  const metaSources = ['ig','fb','facebook','instagram']
  if (metaMediums.includes(m)||metaSources.includes(s)) return 'Paid Social'
  if (m==='cpc'||(m==='paid'&&(s==='google'||s==='bing'))) return 'Paid Search'
  if (s==='google'&&m==='cpc') return 'Paid Search'
  if (c.includes('pmax')||c.includes('shopping')||m==='shopping') return 'Paid Shopping'
  if (s==='shopify.com'||s==='shopify'||m==='referral') return 'Referral'
  if (m==='email'||m==='e-mail') return 'Email'
  if (s==='admitad'||m==='affiliate'||m==='cpa') return 'Affiliate'
  if (s==='wishlink'||m==='social'||m==='socialmedia') return 'Organic Social'
  if (m==='cross-network'||s==='(cross-network)'||s==='cross-network') return 'Cross-network'
  return 'Other'
}

const CHANNEL_COLORS = {
  'Paid Social':    '#7F77DD',
  'Paid Search':    '#3b82f6',
  'Paid Shopping':  '#0ea5e9',
  'Organic Search': '#22c55e',
  'Organic Social': '#86efac',
  'Direct':         '#94a3b8',
  'Referral':       '#f59e0b',
  'Email':          '#ec4899',
  'Affiliate':      '#f97316',
  'Cross-network':  '#a78bfa',
  'Other':          '#64748b',
}

// ── Date picker ───────────────────────────────────────────────────────────────
function DatePicker({ dateFrom, dateTo, dateLabel, compFrom, compTo, onApply }) {
  const [open, setOpen]     = useState(false)
  const [showComp, setShowComp] = useState(false)

  return (
    <div style={{ position:'relative' }}>
      <button onClick={()=>setOpen(o=>!o)} style={{
        display:'flex', alignItems:'center', gap:8, padding:'7px 14px', borderRadius:8,
        background:'var(--bg2)', border:'0.5px solid var(--border2)', cursor:'pointer', fontSize:12, color:'var(--text)', fontWeight:500,
      }}>
        📅 {dateLabel || `${format(dateFrom,'d MMM')} – ${format(dateTo,'d MMM yy')}`}
        <span style={{ fontSize:9, opacity:0.5 }}>▼</span>
      </button>
      {open && (
        <div style={{ position:'absolute', right:0, top:'calc(100% + 6px)', zIndex:200, background:'var(--bg2)', border:'0.5px solid var(--border2)', borderRadius:10, padding:12, minWidth:200, boxShadow:'0 8px 32px rgba(0,0,0,0.4)' }}>
          <div style={{ fontSize:10, color:'var(--text3)', marginBottom:8, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em' }}>Date range</div>
          {Object.entries(PRESET_RANGES).map(([key, fn]) => {
            const p = fn()
            return (
              <button key={key} onClick={()=>{ onApply({ dateFrom:p.from, dateTo:p.to, dateLabel:p.label }); setOpen(false) }} style={{
                display:'block', width:'100%', textAlign:'left', padding:'6px 10px', fontSize:12,
                borderRadius:6, cursor:'pointer', border:'none', background:dateLabel===p.label?'var(--bg3)':'transparent',
                color:dateLabel===p.label?'var(--text)':'var(--text2)',
              }}>{p.label}</button>
            )
          })}
          <div style={{ borderTop:'0.5px solid var(--border)', marginTop:8, paddingTop:8 }}>
            <button onClick={()=>setShowComp(s=>!s)} style={{ fontSize:11, color:'var(--text3)', background:'none', border:'none', cursor:'pointer', padding:0 }}>
              {showComp ? '▼' : '▶'} Compare period
            </button>
            {showComp && (
              <div style={{ marginTop:6 }}>
                {['Previous period','Previous week','Previous month'].map(l => (
                  <button key={l} onClick={()=>{ /* comparison logic */ setOpen(false) }} style={{ display:'block', width:'100%', textAlign:'left', padding:'5px 10px', fontSize:11, borderRadius:5, cursor:'pointer', border:'none', background:'transparent', color:'var(--text2)' }}>{l}</button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default function Weekly() {
  const { state }    = useData()
  const navigate     = useNavigate()
  const [dateFrom, setDateFrom] = useState(subDays(new Date(), 6))
  const [dateTo, setDateTo]     = useState(new Date())
  const [dateLabel, setDateLabel] = useState('Last 7 days')
  const [ga4Items, setGa4Items] = useState([])
  const [itemsLoading, setItemsLoading] = useState(true)
  // Drill state: null | { channel, source } 
  const [drill, setDrill] = useState(null) // { level: 'channel'|'source'|'campaign', channel, source }

  // Comparison = same span, previous period
  const spanMs   = dateTo - dateFrom
  const compTo   = new Date(dateFrom - 1)
  const compFrom = new Date(compTo - spanMs)

  // Fetch GA4 channel data (all sessions incl organic/google/direct)
  const [ga4Full, setGa4Full] = useState([])
  useEffect(() => {
    fetch(`${PROXY}/api/ga4`)
      .then(r => r.json())
      .then(d => setGa4Full(d.data || []))
      .catch(() => {})
  }, [])

  // Fetch GA4 items for categories/products
  useEffect(() => {
    setItemsLoading(true)
    fetch(`${PROXY}/api/ga4-items`)
      .then(r => r.json())
      .then(d => { setGa4Items(d.data || []); setItemsLoading(false) })
      .catch(() => setItemsLoading(false))
  }, [])

  function inRange(dateVal, from, to) {
    const d = dateVal instanceof Date ? dateVal : new Date(dateVal)
    const f = new Date(from); f.setHours(0,0,0,0)
    const t = new Date(to);   t.setHours(23,59,59,999)
    return d >= f && d <= t
  }

  // ── Data sources ─────────────────────────────────────────────────────────────
  // Use full GA4 (all sessions) for channel split, ga4Dump for KPIs (has revenue)
  const ga4All  = state.ga4Dump  || []
  const metaAll = state.metaDB   || []
  const gAdsAll = state.googleDump || []

  const ga4Week = useMemo(()=> ga4All.filter(r=>inRange(r.date,dateFrom,dateTo)), [ga4All,dateFrom,dateTo])
  const ga4Prev = useMemo(()=> ga4All.filter(r=>inRange(r.date,compFrom,compTo)), [ga4All,compFrom,compTo])
  const metaWeek= useMemo(()=> metaAll.filter(r=>inRange(r.date,dateFrom,dateTo)), [metaAll,dateFrom,dateTo])
  const gadsWeek= useMemo(()=> gAdsAll.filter(r=>inRange(r.date,dateFrom,dateTo)), [gAdsAll,dateFrom,dateTo])
  const metaPrev= useMemo(()=> metaAll.filter(r=>inRange(r.date,compFrom,compTo)), [metaAll,compFrom,compTo])
  const gadsPrev= useMemo(()=> gAdsAll.filter(r=>inRange(r.date,compFrom,compTo)), [gAdsAll,compFrom,compTo])

  const totalSpend = useMemo(()=> metaWeek.reduce((s,r)=>s+(r.spend||0),0) + gadsWeek.reduce((s,r)=>s+(r.cost||0),0), [metaWeek,gadsWeek])
  const totalSpendP= useMemo(()=> metaPrev.reduce((s,r)=>s+(r.spend||0),0) + gadsPrev.reduce((s,r)=>s+(r.cost||0),0), [metaPrev,gadsPrev])
  const metaSpend  = useMemo(()=> metaWeek.reduce((s,r)=>s+(r.spend||0),0), [metaWeek])
  const gadsSpend  = useMemo(()=> gadsWeek.reduce((s,r)=>s+(r.cost||0),0), [gadsWeek])

  const revenue  = useMemo(()=> ga4Week.reduce((s,r)=>s+(r.totalrevenue||r.gaRevenue||0),0), [ga4Week])
  const revPrev  = useMemo(()=> ga4Prev.reduce((s,r)=>s+(r.totalrevenue||r.gaRevenue||0),0), [ga4Prev])
  const orders   = useMemo(()=> ga4Week.reduce((s,r)=>s+(r.transactions||r.gaOrders||0),0), [ga4Week])
  const ordersPrev=useMemo(()=> ga4Prev.reduce((s,r)=>s+(r.transactions||r.gaOrders||0),0), [ga4Prev])
  const sessions = useMemo(()=> ga4Week.reduce((s,r)=>s+(r.sessions||0),0), [ga4Week])
  const sessPrev = useMemo(()=> ga4Prev.reduce((s,r)=>s+(r.sessions||0),0), [ga4Prev])

  const roas   = totalSpend>0 ? revenue/totalSpend : 0
  const roasPrev=totalSpendP>0? revPrev/totalSpendP: 0
  const cac    = orders>0 ? totalSpend/orders : 0
  const cacPrev= ordersPrev>0 ? totalSpendP/ordersPrev : 0
  const aov    = orders>0 ? revenue/orders : 0
  const aovPrev= ordersPrev>0 ? revPrev/ordersPrev : 0

  // ── Channel split ─────────────────────────────────────────────────────────────
  const channelData = useMemo(()=>{
    const map = {}
    // Use full GA4 data for channel split (has source/medium for ALL channels)
    const ga4FullWeek = ga4Full.filter(r=>inRange(r.date,dateFrom,dateTo))
    for (const r of ga4FullWeek) {
      const ch = getChannel(r.source||'', r.medium||'', r.campaign||'')
      if (!map[ch]) map[ch] = { channel:ch, revenue:0, sessions:0, orders:0, sources:{} }
      map[ch].revenue  += r.totalrevenue||r.gaRevenue||0
      map[ch].sessions += r.sessions||0
      map[ch].orders   += r.transactions||r.gaOrders||0
      // Track source breakdown for drill
      const src = r.source||'(unknown)'
      if (!map[ch].sources[src]) map[ch].sources[src] = { source:src, revenue:0, sessions:0, orders:0, campaigns:{} }
      map[ch].sources[src].revenue  += r.totalrevenue||r.gaRevenue||0
      map[ch].sources[src].sessions += r.sessions||0
      map[ch].sources[src].orders   += r.transactions||r.gaOrders||0
      // Track campaign breakdown
      const camp = r.campaign||'(unknown)'
      if (!map[ch].sources[src].campaigns[camp]) map[ch].sources[src].campaigns[camp] = { campaign:camp, revenue:0, sessions:0, orders:0 }
      map[ch].sources[src].campaigns[camp].revenue  += r.totalrevenue||r.gaRevenue||0
      map[ch].sources[src].campaigns[camp].sessions += r.sessions||0
      map[ch].sources[src].campaigns[camp].orders   += r.transactions||r.gaOrders||0
    }
    return Object.values(map).map(c=>({...c,revShare:revenue>0?(c.revenue/revenue)*100:0,sourcesArr:Object.values(c.sources).sort((a,b)=>b.revenue-a.revenue)})).sort((a,b)=>b.revenue-a.revenue)
  }, [ga4Full, dateFrom, dateTo, revenue])

  // ── 8-week trend ─────────────────────────────────────────────────────────────
  const weeklyTrend = useMemo(()=>{
    return Array.from({length:8},(_,i)=>{
      const wS = startOfWeek(subWeeks(new Date(), 7-i), {weekStartsOn:1})
      const wE = endOfWeek(wS, {weekStartsOn:1})
      const wGA4  = ga4All.filter(r=>inRange(r.date,wS,wE))
      const wMeta = metaAll.filter(r=>inRange(r.date,wS,wE))
      const wGads = gAdsAll.filter(r=>inRange(r.date,wS,wE))
      const wRev  = wGA4.reduce((s,r)=>s+(r.totalrevenue||r.gaRevenue||0),0)
      const wSpend= wMeta.reduce((s,r)=>s+(r.spend||0),0)+wGads.reduce((s,r)=>s+(r.cost||0),0)
      const wOrd  = wGA4.reduce((s,r)=>s+(r.transactions||r.gaOrders||0),0)
      return { label:format(wS,'dd MMM'), revenue:Math.round(wRev), spend:Math.round(wSpend), roas:wSpend>0?parseFloat((wRev/wSpend).toFixed(2)):0, orders:Math.round(wOrd) }
    })
  }, [ga4All,metaAll,gAdsAll])

  // ── GA4 items ─────────────────────────────────────────────────────────────────
  const itemsInRange = useMemo(()=> ga4Items.filter(r=>inRange(r.date||r.Date,dateFrom,dateTo)), [ga4Items,dateFrom,dateTo])

  const topCategories = useMemo(()=>{
    const map = {}
    for (const r of itemsInRange) {
      const k = r.item_category||r.itemCategory||'Uncategorised'
      if (!map[k]) map[k] = {category:k,revenue:0,purchased:0}
      map[k].revenue   += Number(r.item_revenue||r.itemRevenue||0)
      map[k].purchased += Number(r.items_purchased||r.itemsPurchased||0)
    }
    return Object.values(map).sort((a,b)=>b.revenue-a.revenue).slice(0,8)
  }, [itemsInRange])

  const topProducts = useMemo(()=>{
    const map = {}
    for (const r of itemsInRange) {
      const k = r.item_name||r.itemName||'Unknown'
      if (!map[k]) map[k] = {name:k,revenue:0,purchased:0}
      map[k].revenue   += Number(r.item_revenue||r.itemRevenue||0)
      map[k].purchased += Number(r.items_purchased||r.itemsPurchased||0)
    }
    return Object.values(map).sort((a,b)=>b.revenue-a.revenue).slice(0,10)
  }, [itemsInRange])

  const platformPie = useMemo(()=>{
    const paid_social = channelData.find(c=>c.channel==='Paid Social')?.revenue||0
    const paid_search = (channelData.find(c=>c.channel==='Paid Search')?.revenue||0)+(channelData.find(c=>c.channel==='Paid Shopping')?.revenue||0)
    const organic     = (channelData.find(c=>c.channel==='Organic Search')?.revenue||0)+(channelData.find(c=>c.channel==='Direct')?.revenue||0)+(channelData.find(c=>c.channel==='Organic Social')?.revenue||0)
    const other       = revenue - paid_social - paid_search - organic
    return [
      { name:'Paid Social',  value:Math.round(paid_social), color:'#7F77DD' },
      { name:'Paid Search',  value:Math.round(paid_search), color:'#3b82f6' },
      { name:'Organic',      value:Math.round(organic),     color:'#22c55e' },
      { name:'Other',        value:Math.round(Math.max(0,other)), color:'#64748b' },
    ].filter(p=>p.value>0)
  }, [channelData, revenue])

  // Drill — which channel is selected
  const drillChannel = drill ? channelData.find(c=>c.channel===drill.channel) : null
  const drillSources = drillChannel ? drillChannel.sourcesArr : []
  const drillSource  = drill?.source ? drillSources.find(s=>s.source===drill.source) : null
  const drillCampaigns = drillSource ? Object.values(drillSource.campaigns).sort((a,b)=>b.revenue-a.revenue).slice(0,15) : []

  function applyDate({dateFrom:f, dateTo:t, dateLabel:l}) {
    setDateFrom(f); setDateTo(t); setDateLabel(l); setDrill(null)
  }

  const TH = { padding:'6px 10px', fontSize:10, fontWeight:600, color:'var(--text3)', textTransform:'uppercase', borderBottom:'0.5px solid var(--border2)', textAlign:'right', letterSpacing:'0.05em', whiteSpace:'nowrap' }
  const TD = { padding:'7px 10px', fontSize:12, borderBottom:'0.5px solid var(--border)', color:'var(--text)' }

  return (
    <div style={{ padding:'24px 28px', maxWidth:1400 }}>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:700, marginBottom:4 }}>Weekly Business Overview</h1>
          <div style={{ fontSize:13, color:'var(--text3)' }}>
            {format(dateFrom,'d MMM')} – {format(dateTo,'d MMM yyyy')} · GA4 blended · vs {format(compFrom,'d MMM')}–{format(compTo,'d MMM')}
          </div>
        </div>
        <DatePicker dateFrom={dateFrom} dateTo={dateTo} dateLabel={dateLabel} onApply={applyDate} />
      </div>

      {/* KPI Cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,minmax(0,1fr))', gap:10, marginBottom:20 }}>
        <KpiCard label="Revenue"      value={fmtC(revenue)}          curr={revenue}     prev={revPrev}     accent="#22c55e" />
        <KpiCard label="Paid Spend"   value={fmtC(totalSpend)}       curr={totalSpend}  prev={totalSpendP} accent="#7F77DD" invert />
        <KpiCard label="Blended ROAS" value={fmtX(roas)}             curr={roas}        prev={roasPrev}    accent="#a78bfa" sublabel="GA4÷spend" />
        <KpiCard label="Orders"       value={fmtN(Math.round(orders))} curr={orders}    prev={ordersPrev}  accent="#3b82f6" />
        <KpiCard label="AOV"          value={fmtC(aov)}              curr={aov}         prev={aovPrev}     accent="#f59e0b" />
        <KpiCard label="Blended CAC"  value={fmtC(cac)}              curr={cac}         prev={cacPrev}     accent="#ec4899" invert sublabel="spend÷orders" />
        <KpiCard label="Sessions"     value={fmtN(Math.round(sessions))} curr={sessions} prev={sessPrev}   accent="#64748b" />
      </div>

      {/* Spend split pills */}
      <div style={{ display:'flex', gap:8, marginBottom:20, flexWrap:'wrap' }}>
        {[
          { label:'Meta spend',   val:metaSpend,  color:'#7F77DD' },
          { label:'Google spend', val:gadsSpend,  color:'#3b82f6' },
          { label:'Meta ROAS',    val:metaSpend>0?fmtX(revenue*0.95/metaSpend):null,  color:'#a78bfa', isRoas:true },
        ].filter(p=>p.val).map(p=>(
          <div key={p.label} style={{ padding:'6px 14px', borderRadius:20, fontSize:12, background:'var(--bg2)', border:`0.5px solid ${p.color}40`, color:p.color, fontWeight:500 }}>
            {p.label}: {typeof p.val==='string'?p.val:fmtC(p.val)}
          </div>
        ))}
      </div>

      {/* Row — Channel table + Platform pie */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 320px', gap:16, marginBottom:16 }}>
        {/* Channel table with drill */}
        <div style={{ background:'var(--bg2)', borderRadius:10, border:'0.5px solid var(--border)', padding:'16px 20px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
            <div style={{ fontSize:13, fontWeight:600 }}>
              {!drill && 'Traffic & Revenue by Channel'}
              {drill && !drill.source && (
                <span>
                  <button onClick={()=>setDrill(null)} style={{ background:'none',border:'none',cursor:'pointer',color:'var(--text3)',fontSize:12,padding:0 }}>All channels</button>
                  <span style={{ color:'var(--text3)',margin:'0 6px' }}>›</span>
                  <span style={{ color:CHANNEL_COLORS[drill.channel]||'var(--blue)' }}>{drill.channel}</span>
                  <span style={{ fontSize:12,color:'var(--text3)',marginLeft:8 }}>— by source</span>
                </span>
              )}
              {drill?.source && (
                <span>
                  <button onClick={()=>setDrill(null)} style={{ background:'none',border:'none',cursor:'pointer',color:'var(--text3)',fontSize:12,padding:0 }}>All channels</button>
                  <span style={{ color:'var(--text3)',margin:'0 6px' }}>›</span>
                  <button onClick={()=>setDrill({channel:drill.channel})} style={{ background:'none',border:'none',cursor:'pointer',color:CHANNEL_COLORS[drill.channel]||'var(--blue)',fontSize:12,padding:0 }}>{drill.channel}</button>
                  <span style={{ color:'var(--text3)',margin:'0 6px' }}>›</span>
                  <span>{drill.source}</span>
                  <span style={{ fontSize:12,color:'var(--text3)',marginLeft:8 }}>— by campaign</span>
                </span>
              )}
            </div>
            {drill && <button onClick={()=>setDrill(null)} style={{ marginLeft:'auto',fontSize:11,padding:'3px 8px',borderRadius:5,background:'var(--bg3)',border:'0.5px solid var(--border)',color:'var(--text2)',cursor:'pointer' }}>✕ Clear drill</button>}
          </div>

          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
            <thead>
              <tr>
                <th style={{ ...TH, textAlign:'left' }}>{drill?.source?'Campaign':drill?.channel?'Source':'Channel'}</th>
                <th style={TH}>Sessions</th>
                <th style={TH}>Revenue</th>
                <th style={TH}>Rev %</th>
                <th style={TH}>Orders</th>
                <th style={TH}>CVR</th>
              </tr>
            </thead>
            <tbody>
              {/* Channel level */}
              {!drill && channelData.map(c=>(
                <tr key={c.channel} onClick={()=>setDrill({channel:c.channel})}
                  style={{ cursor:'pointer' }}
                  onMouseEnter={e=>e.currentTarget.style.background='var(--bg3)'}
                  onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                  <td style={{ ...TD, textAlign:'left', fontWeight:500, display:'flex', alignItems:'center', gap:8 }}>
                    <div style={{ width:8,height:8,borderRadius:2,background:CHANNEL_COLORS[c.channel]||'var(--text3)',flexShrink:0 }} />
                    {c.channel}
                    <span style={{ fontSize:10,color:'var(--text3)',marginLeft:4 }}>›</span>
                  </td>
                  <td style={{ ...TD, textAlign:'right', color:'var(--text3)' }}>{fmtN(Math.round(c.sessions))}</td>
                  <td style={{ ...TD, textAlign:'right', color:'#22c55e', fontWeight:500 }}>{fmtC(c.revenue)}</td>
                  <td style={{ ...TD, textAlign:'right' }}>
                    <div style={{ display:'flex',alignItems:'center',justifyContent:'flex-end',gap:6 }}>
                      <div style={{ width:36,height:3,borderRadius:2,background:'var(--bg3)',overflow:'hidden' }}>
                        <div style={{ width:`${c.revShare}%`,height:'100%',background:CHANNEL_COLORS[c.channel]||'var(--text3)',borderRadius:2 }} />
                      </div>
                      <span style={{ fontSize:11,color:'var(--text3)',minWidth:32 }}>{fmtP(c.revShare)}</span>
                    </div>
                  </td>
                  <td style={{ ...TD, textAlign:'right', color:'var(--text3)' }}>{fmtN(Math.round(c.orders))}</td>
                  <td style={{ ...TD, textAlign:'right', color:c.sessions>0&&(c.orders/c.sessions)*100>2?'#22c55e':'var(--text3)' }}>{c.sessions>0?fmtP((c.orders/c.sessions)*100):'—'}</td>
                </tr>
              ))}

              {/* Source level drill */}
              {drill && !drill.source && drillSources.map(s=>(
                <tr key={s.source} onClick={()=>setDrill({channel:drill.channel, source:s.source})}
                  style={{ cursor:'pointer' }}
                  onMouseEnter={e=>e.currentTarget.style.background='var(--bg3)'}
                  onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                  <td style={{ ...TD, textAlign:'left', fontWeight:500 }}>
                    {s.source} <span style={{ fontSize:10,color:'var(--text3)',marginLeft:4 }}>›</span>
                  </td>
                  <td style={{ ...TD, textAlign:'right', color:'var(--text3)' }}>{fmtN(Math.round(s.sessions))}</td>
                  <td style={{ ...TD, textAlign:'right', color:'#22c55e', fontWeight:500 }}>{fmtC(s.revenue)}</td>
                  <td style={{ ...TD, textAlign:'right', color:'var(--text3)' }}>{drillChannel?.revenue>0?fmtP((s.revenue/drillChannel.revenue)*100):'—'}</td>
                  <td style={{ ...TD, textAlign:'right', color:'var(--text3)' }}>{fmtN(Math.round(s.orders))}</td>
                  <td style={{ ...TD, textAlign:'right', color:s.sessions>0&&(s.orders/s.sessions)*100>2?'#22c55e':'var(--text3)' }}>{s.sessions>0?fmtP((s.orders/s.sessions)*100):'—'}</td>
                </tr>
              ))}

              {/* Campaign level drill */}
              {drill?.source && drillCampaigns.map(c=>(
                <tr key={c.campaign}
                  onClick={()=>{ navigate('/meta/campaigns', { state:{ campaign:c.campaign } }) }}
                  style={{ cursor:'pointer' }}
                  onMouseEnter={e=>e.currentTarget.style.background='var(--bg3)'}
                  onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                  <td style={{ ...TD, textAlign:'left', maxWidth:280, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }} title={c.campaign}>
                    {c.campaign}
                    <span style={{ fontSize:10,color:'var(--blue)',marginLeft:6 }}>→ view</span>
                  </td>
                  <td style={{ ...TD, textAlign:'right', color:'var(--text3)' }}>{fmtN(Math.round(c.sessions))}</td>
                  <td style={{ ...TD, textAlign:'right', color:'#22c55e', fontWeight:500 }}>{fmtC(c.revenue)}</td>
                  <td style={{ ...TD, textAlign:'right', color:'var(--text3)' }}>{drillSource?.revenue>0?fmtP((c.revenue/drillSource.revenue)*100):'—'}</td>
                  <td style={{ ...TD, textAlign:'right', color:'var(--text3)' }}>{fmtN(Math.round(c.orders))}</td>
                  <td style={{ ...TD, textAlign:'right' }}>{c.sessions>0?fmtP((c.orders/c.sessions)*100):'—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Platform pie */}
        <div style={{ background:'var(--bg2)', borderRadius:10, border:'0.5px solid var(--border)', padding:'16px 20px' }}>
          <div style={{ fontSize:13, fontWeight:600, marginBottom:4 }}>Revenue Attribution</div>
          <div style={{ fontSize:11, color:'var(--text3)', marginBottom:12 }}>GA4 sessions by platform</div>
          <ResponsiveContainer width="100%" height={150}>
            <PieChart>
              <Pie data={platformPie} cx="50%" cy="50%" innerRadius={40} outerRadius={65} dataKey="value" paddingAngle={3}>
                {platformPie.map((p,i)=><Cell key={i} fill={p.color} />)}
              </Pie>
              <Tooltip {...TIP} formatter={v=>[fmtC(v),'']} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display:'flex', flexDirection:'column', gap:6, marginTop:8 }}>
            {platformPie.map(p=>(
              <div key={p.name} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', fontSize:11 }}>
                <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                  <div style={{ width:8,height:8,borderRadius:2,background:p.color }} />
                  <span style={{ color:'var(--text2)' }}>{p.name}</span>
                </div>
                <div style={{ textAlign:'right' }}>
                  <span style={{ color:'var(--text)', fontWeight:500 }}>{fmtC(p.value)}</span>
                  <span style={{ color:'var(--text3)', fontSize:10, marginLeft:6 }}>{revenue>0?fmtP((p.value/revenue)*100):''}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Trend charts */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:16 }}>
        <div style={{ background:'var(--bg2)', borderRadius:10, border:'0.5px solid var(--border)', padding:'16px 20px' }}>
          <div style={{ fontSize:13, fontWeight:600, marginBottom:12 }}>8-Week Revenue & Spend</div>
          <ResponsiveContainer width="100%" height={190}>
            <BarChart data={weeklyTrend} barSize={14} barGap={3}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize:10, fill:'var(--text3)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize:10, fill:'var(--text3)' }} axisLine={false} tickLine={false} tickFormatter={v=>fmtC(v)} />
              <Tooltip {...TIP} formatter={v=>[fmtC(v),'']} />
              <Legend iconType="circle" iconSize={8} formatter={v=><span style={{ fontSize:11,color:'var(--text2)' }}>{v}</span>} />
              <Bar dataKey="revenue" fill="#22c55e" name="Revenue" radius={[3,3,0,0]} />
              <Bar dataKey="spend"   fill="#7F77DD" name="Spend"   radius={[3,3,0,0]} fillOpacity={0.7} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div style={{ background:'var(--bg2)', borderRadius:10, border:'0.5px solid var(--border)', padding:'16px 20px' }}>
          <div style={{ fontSize:13, fontWeight:600, marginBottom:12 }}>8-Week Blended ROAS</div>
          <ResponsiveContainer width="100%" height={190}>
            <LineChart data={weeklyTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize:10, fill:'var(--text3)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize:10, fill:'var(--text3)' }} axisLine={false} tickLine={false} tickFormatter={v=>`${v}x`} />
              <Tooltip {...TIP} formatter={v=>[`${v}x`,'ROAS']} />
              <Line dataKey="roas" stroke="#a78bfa" strokeWidth={2.5} dot={{ r:4, fill:'#a78bfa' }} name="Blended ROAS" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* GA4 items */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
        <div style={{ background:'var(--bg2)', borderRadius:10, border:'0.5px solid var(--border)', padding:'16px 20px' }}>
          <div style={{ fontSize:13, fontWeight:600, marginBottom:12 }}>Top Categories — GA4</div>
          {itemsLoading ? (
            <div style={{ fontSize:12, color:'var(--text3)', padding:'20px 0' }}>Loading...</div>
          ) : topCategories.length===0 ? (
            <div style={{ fontSize:12, color:'var(--text3)', padding:'20px 0' }}>
              No item data yet — sync Windsor to populate.<br/>
              <span style={{ fontSize:11 }}>GA4 item data syncs with the next scheduled sync.</span>
            </div>
          ) : (
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
              <thead><tr>{['Category','Revenue','Units'].map((h,i)=><th key={h} style={{ padding:'5px 8px',fontSize:10,fontWeight:600,color:'var(--text3)',borderBottom:'0.5px solid var(--border2)',textAlign:i===0?'left':'right',textTransform:'uppercase',letterSpacing:'0.05em' }}>{h}</th>)}</tr></thead>
              <tbody>{topCategories.map((c,i)=>(
                <tr key={c.category} onMouseEnter={e=>e.currentTarget.style.background='var(--bg3)'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                  <td style={{ ...TD, textAlign:'left', display:'flex', alignItems:'center', gap:8 }}><span style={{ fontSize:10,color:'var(--text3)',minWidth:16 }}>#{i+1}</span>{c.category}</td>
                  <td style={{ ...TD, textAlign:'right', color:'#22c55e', fontWeight:500 }}>{fmtC(c.revenue)}</td>
                  <td style={{ ...TD, textAlign:'right', color:'var(--text3)' }}>{fmtN(Math.round(c.purchased))}</td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </div>

        <div style={{ background:'var(--bg2)', borderRadius:10, border:'0.5px solid var(--border)', padding:'16px 20px' }}>
          <div style={{ fontSize:13, fontWeight:600, marginBottom:12 }}>Top Products — GA4</div>
          {itemsLoading ? (
            <div style={{ fontSize:12, color:'var(--text3)', padding:'20px 0' }}>Loading...</div>
          ) : topProducts.length===0 ? (
            <div style={{ fontSize:12, color:'var(--text3)', padding:'20px 0' }}>No item data yet.</div>
          ) : (
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
              <thead><tr>{['Product','Revenue','Units'].map((h,i)=><th key={h} style={{ padding:'5px 8px',fontSize:10,fontWeight:600,color:'var(--text3)',borderBottom:'0.5px solid var(--border2)',textAlign:i===0?'left':'right',textTransform:'uppercase',letterSpacing:'0.05em' }}>{h}</th>)}</tr></thead>
              <tbody>{topProducts.map((p,i)=>(
                <tr key={p.name} onMouseEnter={e=>e.currentTarget.style.background='var(--bg3)'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                  <td style={{ ...TD, textAlign:'left', maxWidth:260, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', display:'flex', alignItems:'center', gap:8 }}><span style={{ fontSize:10,color:'var(--text3)',minWidth:16 }}>#{i+1}</span>{p.name}</td>
                  <td style={{ ...TD, textAlign:'right', color:'#22c55e', fontWeight:500 }}>{fmtC(p.revenue)}</td>
                  <td style={{ ...TD, textAlign:'right', color:'var(--text3)' }}>{fmtN(Math.round(p.purchased))}</td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
