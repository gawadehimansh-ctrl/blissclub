import React, { useMemo, useState, useEffect } from 'react'
import { useData } from '../data/store.jsx'
import { startOfWeek, endOfWeek, subWeeks, format, eachWeekOfInterval, subDays, isWithinInterval } from 'date-fns'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, PieChart, Pie, Cell } from 'recharts'

const BACKEND = import.meta.env.VITE_BACKEND_URL || 'https://blissclub-proxy-production.up.railway.app'
const TIP = { contentStyle: { background: 'var(--bg3)', border: '0.5px solid var(--border2)', fontSize: 12, borderRadius: 6 } }

const fmtC = n => !n ? '₹0' : n >= 10000000 ? `₹${(n/10000000).toFixed(2)}Cr` : n >= 100000 ? `₹${(n/100000).toFixed(1)}L` : n >= 1000 ? `₹${(n/1000).toFixed(1)}K` : `₹${Math.round(n).toLocaleString('en-IN')}`
const fmtN = n => !n ? '0' : Number(n).toLocaleString('en-IN')
const fmtX = n => !n ? '—' : `${Number(n).toFixed(2)}x`
const fmtPct = n => `${Number(n||0).toFixed(1)}%`

function delta(curr, prev) {
  if (!prev || !curr) return null
  return ((curr - prev) / prev) * 100
}

function DeltaBadge({ curr, prev, invert = false }) {
  const d = delta(curr, prev)
  if (d === null) return null
  const positive = invert ? d < 0 : d > 0
  return (
    <span style={{
      fontSize: 11, fontWeight: 500, padding: '2px 6px', borderRadius: 4,
      background: positive ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
      color: positive ? '#22c55e' : '#ef4444',
    }}>
      {d > 0 ? '▲' : '▼'} {Math.abs(d).toFixed(1)}%
    </span>
  )
}

function KpiCard({ label, value, prev, sublabel, accent, invert }) {
  return (
    <div style={{ background: 'var(--bg2)', borderRadius: 10, padding: '16px 18px', border: '0.5px solid var(--border)', borderTop: `2px solid ${accent || 'var(--border)'}` }}>
      <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 8, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>{value}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {prev !== undefined && <DeltaBadge curr={parseFloat(value)} prev={prev} invert={invert} />}
        {sublabel && <span style={{ fontSize: 11, color: 'var(--text3)' }}>{sublabel}</span>}
      </div>
    </div>
  )
}

// Map source/medium to channel
function getChannel(source = '', medium = '') {
  const s = source.toLowerCase(), m = medium.toLowerCase()
  if (s === '(direct)' || m === '(none)') return 'Direct'
  if (m === 'organic') return 'Organic Search'
  if (s === 'ig' || s === 'facebook' || s === 'fb' || m === 'instagram_feed' || m === 'instagram_stories' || m === 'instagram_reels' || m === 'facebook_mobile_feed') return 'Paid Social'
  if (m === 'cpc' && (s === 'google' || s === 'bing')) return 'Paid Search'
  if (s === 'shopify.com' || m === 'referral') return 'Referral'
  if (m === 'email') return 'Email'
  if (s === 'admitad' || m === 'affiliate') return 'Affiliate'
  if (m === 'social') return 'Organic Social'
  return 'Other'
}

const CHANNEL_COLORS = {
  'Paid Social':    '#7F77DD',
  'Paid Search':    '#3b82f6',
  'Organic Search': '#22c55e',
  'Direct':         '#94a3b8',
  'Referral':       '#f59e0b',
  'Email':          '#ec4899',
  'Affiliate':      '#f97316',
  'Organic Social': '#a78bfa',
  'Other':          '#64748b',
}

export default function Weekly() {
  const { state }  = useData()
  const [weekOffset, setWeekOffset] = useState(0) // 0 = current week
  const [ga4Items, setGa4Items]     = useState([])

  // Fetch GA4 items data
  useEffect(() => {
    fetch(`${BACKEND}/api/ga4-items`)
      .then(r => r.json())
      .then(d => setGa4Items(d.data || []))
      .catch(() => {})
  }, [])

  // Week boundaries (Mon-Sun)
  const weekStart = useMemo(() => startOfWeek(subWeeks(new Date(), weekOffset), { weekStartsOn: 1 }), [weekOffset])
  const weekEnd   = useMemo(() => endOfWeek(subWeeks(new Date(), weekOffset), { weekStartsOn: 1 }), [weekOffset])
  const prevStart = useMemo(() => startOfWeek(subWeeks(new Date(), weekOffset + 1), { weekStartsOn: 1 }), [weekOffset])
  const prevEnd   = useMemo(() => endOfWeek(subWeeks(new Date(), weekOffset + 1), { weekStartsOn: 1 }), [weekOffset])

  function inWeek(dateVal, start, end) {
    const d = dateVal instanceof Date ? dateVal : new Date(dateVal)
    return d >= start && d <= end
  }

  // ── GA4 rows for current + prev week ────────────────────────────────────────
  const ga4All  = state.ga4Dump || []
  const ga4Week = useMemo(() => ga4All.filter(r => inWeek(r.date, weekStart, weekEnd)), [ga4All, weekStart, weekEnd])
  const ga4Prev = useMemo(() => ga4All.filter(r => inWeek(r.date, prevStart, prevEnd)), [ga4All, prevStart, prevEnd])

  // ── Meta + Google spend ──────────────────────────────────────────────────────
  const metaAll  = state.metaDB || []
  const gAdsAll  = state.googleDump || []

  const metaSpendWeek = useMemo(() => metaAll.filter(r => inWeek(r.date, weekStart, weekEnd)).reduce((s,r) => s+(r.spend||0), 0), [metaAll, weekStart, weekEnd])
  const gadsSpendWeek = useMemo(() => gAdsAll.filter(r => inWeek(r.date, weekStart, weekEnd)).reduce((s,r) => s+(r.cost||0), 0), [gAdsAll, weekStart, weekEnd])
  const metaSpendPrev = useMemo(() => metaAll.filter(r => inWeek(r.date, prevStart, prevEnd)).reduce((s,r) => s+(r.spend||0), 0), [metaAll, prevStart, prevEnd])
  const gadsSpendPrev = useMemo(() => gAdsAll.filter(r => inWeek(r.date, prevStart, prevEnd)).reduce((s,r) => s+(r.cost||0), 0), [gAdsAll, prevStart, prevEnd])

  const totalSpendWeek = metaSpendWeek + gadsSpendWeek
  const totalSpendPrev = metaSpendPrev + gadsSpendPrev

  // ── GA4 KPIs ────────────────────────────────────────────────────────────────
  const revenue      = useMemo(() => ga4Week.reduce((s,r) => s+(r.totalrevenue||r.gaRevenue||0), 0), [ga4Week])
  const revenuePrev  = useMemo(() => ga4Prev.reduce((s,r) => s+(r.totalrevenue||r.gaRevenue||0), 0), [ga4Prev])
  const orders       = useMemo(() => ga4Week.reduce((s,r) => s+(r.transactions||r.gaOrders||0), 0), [ga4Week])
  const ordersPrev   = useMemo(() => ga4Prev.reduce((s,r) => s+(r.transactions||r.gaOrders||0), 0), [ga4Prev])
  const sessions     = useMemo(() => ga4Week.reduce((s,r) => s+(r.sessions||0), 0), [ga4Week])
  const sessionsPrev = useMemo(() => ga4Prev.reduce((s,r) => s+(r.sessions||0), 0), [ga4Prev])

  const blendedROAS  = totalSpendWeek > 0 ? revenue / totalSpendWeek : 0
  const blendedROASP = totalSpendPrev > 0 ? revenuePrev / totalSpendPrev : 0
  const cac          = orders > 0 ? totalSpendWeek / orders : 0
  const cacPrev      = ordersPrev > 0 ? totalSpendPrev / ordersPrev : 0
  const aov          = orders > 0 ? revenue / orders : 0
  const aovPrev      = ordersPrev > 0 ? revenuePrev / ordersPrev : 0
  const cvr          = sessions > 0 ? (orders / sessions) * 100 : 0
  const cvrPrev      = sessionsPrev > 0 ? (ordersPrev / sessionsPrev) * 100 : 0

  // ── Channel split ────────────────────────────────────────────────────────────
  const channelData = useMemo(() => {
    const map = {}
    for (const r of ga4Week) {
      const ch = getChannel(r.source || r.datasource || '', r.medium || '')
      if (!map[ch]) map[ch] = { channel: ch, revenue: 0, sessions: 0, orders: 0 }
      map[ch].revenue  += r.totalrevenue || r.gaRevenue || 0
      map[ch].sessions += r.sessions || 0
      map[ch].orders   += r.transactions || r.gaOrders || 0
    }
    return Object.values(map)
      .map(c => ({ ...c, revShare: revenue > 0 ? (c.revenue / revenue) * 100 : 0 }))
      .sort((a, b) => b.revenue - a.revenue)
  }, [ga4Week, revenue])

  // ── 8-week trend ─────────────────────────────────────────────────────────────
  const weeklyTrend = useMemo(() => {
    return Array.from({ length: 8 }, (_, i) => {
      const wStart = startOfWeek(subWeeks(new Date(), 7 - i + weekOffset), { weekStartsOn: 1 })
      const wEnd   = endOfWeek(wStart, { weekStartsOn: 1 })
      const wGA4   = ga4All.filter(r => inWeek(r.date, wStart, wEnd))
      const wMeta  = metaAll.filter(r => inWeek(r.date, wStart, wEnd))
      const wGads  = gAdsAll.filter(r => inWeek(r.date, wStart, wEnd))
      const wRev   = wGA4.reduce((s,r) => s+(r.totalrevenue||r.gaRevenue||0), 0)
      const wSpend = wMeta.reduce((s,r) => s+(r.spend||0), 0) + wGads.reduce((s,r) => s+(r.cost||0), 0)
      const wOrders= wGA4.reduce((s,r) => s+(r.transactions||r.gaOrders||0), 0)
      return {
        label:   format(wStart, 'dd MMM'),
        revenue: Math.round(wRev),
        spend:   Math.round(wSpend),
        roas:    wSpend > 0 ? parseFloat((wRev/wSpend).toFixed(2)) : 0,
        orders:  Math.round(wOrders),
      }
    })
  }, [ga4All, metaAll, gAdsAll, weekOffset])

  // ── Top categories ────────────────────────────────────────────────────────────
  const topCategories = useMemo(() => {
    const map = {}
    const items = ga4Items.filter(r => inWeek(r.date, weekStart, weekEnd))
    for (const r of items) {
      const k = r.item_category || 'Uncategorised'
      if (!map[k]) map[k] = { category: k, revenue: 0, purchased: 0 }
      map[k].revenue   += Number(r.item_revenue || 0)
      map[k].purchased += Number(r.items_purchased || 0)
    }
    return Object.values(map).sort((a, b) => b.revenue - a.revenue).slice(0, 8)
  }, [ga4Items, weekStart, weekEnd])

  // ── Top products ──────────────────────────────────────────────────────────────
  const topProducts = useMemo(() => {
    const map = {}
    const items = ga4Items.filter(r => inWeek(r.date, weekStart, weekEnd))
    for (const r of items) {
      const k = r.item_name || 'Unknown'
      if (!map[k]) map[k] = { name: k, revenue: 0, purchased: 0 }
      map[k].revenue   += Number(r.item_revenue || 0)
      map[k].purchased += Number(r.items_purchased || 0)
    }
    return Object.values(map).sort((a, b) => b.revenue - a.revenue).slice(0, 10)
  }, [ga4Items, weekStart, weekEnd])

  // ── Platform contribution ─────────────────────────────────────────────────────
  const paidSocialRev = channelData.find(c => c.channel === 'Paid Social')?.revenue || 0
  const paidSearchRev = channelData.find(c => c.channel === 'Paid Search')?.revenue || 0
  const organicRev    = (channelData.find(c => c.channel === 'Organic Search')?.revenue || 0) +
                        (channelData.find(c => c.channel === 'Direct')?.revenue || 0)
  const platformPie = [
    { name: 'Paid Social', value: Math.round(paidSocialRev), color: '#7F77DD' },
    { name: 'Paid Search', value: Math.round(paidSearchRev), color: '#3b82f6' },
    { name: 'Organic/Direct', value: Math.round(organicRev), color: '#22c55e' },
    { name: 'Other', value: Math.round(revenue - paidSocialRev - paidSearchRev - organicRev), color: '#64748b' },
  ].filter(p => p.value > 0)

  const weekLabel = weekOffset === 0 ? 'This week' : weekOffset === 1 ? 'Last week' : `${weekOffset} weeks ago`

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1400 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Weekly Business Overview</h1>
          <div style={{ fontSize: 13, color: 'var(--text3)' }}>
            {format(weekStart, 'd MMM')} – {format(weekEnd, 'd MMM yyyy')} · Blended GA4 · WoW comparison
          </div>
        </div>
        {/* Week navigator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => setWeekOffset(w => w + 1)} style={{ padding: '6px 12px', borderRadius: 7, background: 'var(--bg2)', border: '0.5px solid var(--border2)', color: 'var(--text2)', cursor: 'pointer', fontSize: 13 }}>←</button>
          <span style={{ fontSize: 13, fontWeight: 500, minWidth: 100, textAlign: 'center', color: 'var(--text)' }}>{weekLabel}</span>
          <button onClick={() => setWeekOffset(w => Math.max(0, w - 1))} disabled={weekOffset === 0} style={{ padding: '6px 12px', borderRadius: 7, background: 'var(--bg2)', border: '0.5px solid var(--border2)', color: weekOffset === 0 ? 'var(--text3)' : 'var(--text2)', cursor: weekOffset === 0 ? 'default' : 'pointer', fontSize: 13, opacity: weekOffset === 0 ? 0.4 : 1 }}>→</button>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0,1fr))', gap: 10, marginBottom: 24 }}>
        <KpiCard label="Revenue" value={fmtC(revenue)} prev={revenuePrev} accent="#22c55e" />
        <KpiCard label="Paid Spend" value={fmtC(totalSpendWeek)} prev={totalSpendPrev} accent="#7F77DD" invert />
        <KpiCard label="Blended ROAS" value={fmtX(blendedROAS)} prev={blendedROASP} accent="#a78bfa" sublabel="GA4 ÷ spend" />
        <KpiCard label="Orders" value={fmtN(Math.round(orders))} prev={ordersPrev} accent="#3b82f6" />
        <KpiCard label="AOV" value={fmtC(aov)} prev={aovPrev} accent="#f59e0b" />
        <KpiCard label="Blended CAC" value={fmtC(cac)} prev={cacPrev} accent="#ec4899" invert sublabel="spend ÷ orders" />
        <KpiCard label="Sessions" value={fmtN(Math.round(sessions))} prev={sessionsPrev} accent="#64748b" />
      </div>

      {/* Row 2 — Channel split + Platform pie */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16, marginBottom: 16 }}>
        {/* Channel table */}
        <div style={{ background: 'var(--bg2)', borderRadius: 10, border: '0.5px solid var(--border)', padding: '16px 20px' }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Traffic & Revenue by Channel</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr>
                {['Channel','Sessions','Revenue','Rev %','Orders','CVR'].map((h,i) => (
                  <th key={h} style={{ padding: '6px 10px', fontSize: 10, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', borderBottom: '0.5px solid var(--border2)', textAlign: i===0?'left':'right', letterSpacing:'0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {channelData.map(c => (
                <tr key={c.channel} onMouseEnter={e=>e.currentTarget.style.background='var(--bg3)'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                  <td style={{ padding:'7px 10px', fontWeight:500, display:'flex', alignItems:'center', gap:7 }}>
                    <div style={{ width:8, height:8, borderRadius:2, background: CHANNEL_COLORS[c.channel]||'var(--text3)', flexShrink:0 }} />
                    {c.channel}
                  </td>
                  <td style={{ padding:'7px 10px', textAlign:'right', color:'var(--text3)' }}>{fmtN(Math.round(c.sessions))}</td>
                  <td style={{ padding:'7px 10px', textAlign:'right', color:'#22c55e', fontWeight:500 }}>{fmtC(c.revenue)}</td>
                  <td style={{ padding:'7px 10px', textAlign:'right' }}>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'flex-end', gap:6 }}>
                      <div style={{ width:40, height:4, borderRadius:2, background:'var(--bg3)', overflow:'hidden' }}>
                        <div style={{ width:`${c.revShare}%`, height:'100%', background: CHANNEL_COLORS[c.channel]||'var(--text3)', borderRadius:2 }} />
                      </div>
                      <span style={{ fontSize:11, color:'var(--text3)', minWidth:34 }}>{fmtPct(c.revShare)}</span>
                    </div>
                  </td>
                  <td style={{ padding:'7px 10px', textAlign:'right', color:'var(--text3)' }}>{fmtN(Math.round(c.orders))}</td>
                  <td style={{ padding:'7px 10px', textAlign:'right', color: c.sessions>0&&(c.orders/c.sessions)*100>2?'#22c55e':'var(--text3)' }}>{c.sessions>0?fmtPct((c.orders/c.sessions)*100):'—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Platform pie */}
        <div style={{ background: 'var(--bg2)', borderRadius: 10, border: '0.5px solid var(--border)', padding: '16px 20px' }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Revenue Attribution</div>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 12 }}>By platform (GA4 sessions)</div>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={platformPie} cx="50%" cy="50%" innerRadius={45} outerRadius={70} dataKey="value" paddingAngle={3}>
                {platformPie.map((p, i) => <Cell key={i} fill={p.color} />)}
              </Pie>
              <Tooltip {...TIP} formatter={v => [fmtC(v), '']} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display:'flex', flexDirection:'column', gap:5, marginTop:8 }}>
            {platformPie.map(p => (
              <div key={p.name} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', fontSize:11 }}>
                <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                  <div style={{ width:8, height:8, borderRadius:2, background:p.color }} />
                  <span style={{ color:'var(--text2)' }}>{p.name}</span>
                </div>
                <span style={{ color:'var(--text)', fontWeight:500 }}>{fmtC(p.value)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 3 — 8 week trend */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <div style={{ background: 'var(--bg2)', borderRadius: 10, border: '0.5px solid var(--border)', padding: '16px 20px' }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>8-Week Revenue & Spend Trend</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={weeklyTrend} barSize={16} barGap={3}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize:10, fill:'var(--text3)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize:10, fill:'var(--text3)' }} axisLine={false} tickLine={false} tickFormatter={v => fmtC(v)} />
              <Tooltip {...TIP} formatter={v => [fmtC(v), '']} />
              <Legend iconType="circle" iconSize={8} formatter={v => <span style={{ fontSize:11, color:'var(--text2)' }}>{v}</span>} />
              <Bar dataKey="revenue" fill="#22c55e" name="Revenue" radius={[3,3,0,0]} />
              <Bar dataKey="spend"   fill="#7F77DD" name="Spend"   radius={[3,3,0,0]} fillOpacity={0.7} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div style={{ background: 'var(--bg2)', borderRadius: 10, border: '0.5px solid var(--border)', padding: '16px 20px' }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>8-Week Blended ROAS Trend</div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={weeklyTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize:10, fill:'var(--text3)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize:10, fill:'var(--text3)' }} axisLine={false} tickLine={false} tickFormatter={v => `${v}x`} />
              <Tooltip {...TIP} formatter={v => [`${v}x`, 'ROAS']} />
              <Line dataKey="roas" stroke="#a78bfa" strokeWidth={2.5} dot={{ r:4, fill:'#a78bfa' }} name="Blended ROAS" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Row 4 — Top categories + top products */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Top categories */}
        <div style={{ background: 'var(--bg2)', borderRadius: 10, border: '0.5px solid var(--border)', padding: '16px 20px' }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Top Categories — GA4 Revenue</div>
          {topCategories.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--text3)', padding: '20px 0' }}>No item data — GA4 items syncing...</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr>
                  {['Category','Revenue','Units'].map((h,i) => (
                    <th key={h} style={{ padding:'5px 8px', fontSize:10, fontWeight:600, color:'var(--text3)', borderBottom:'0.5px solid var(--border2)', textAlign:i===0?'left':'right', textTransform:'uppercase', letterSpacing:'0.05em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {topCategories.map((c, i) => (
                  <tr key={c.category} onMouseEnter={e=>e.currentTarget.style.background='var(--bg3)'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                    <td style={{ padding:'6px 8px', display:'flex', alignItems:'center', gap:8 }}>
                      <span style={{ fontSize:10, color:'var(--text3)', minWidth:16 }}>#{i+1}</span>
                      {c.category}
                    </td>
                    <td style={{ padding:'6px 8px', textAlign:'right', color:'#22c55e', fontWeight:500 }}>{fmtC(c.revenue)}</td>
                    <td style={{ padding:'6px 8px', textAlign:'right', color:'var(--text3)' }}>{fmtN(Math.round(c.purchased))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Top products */}
        <div style={{ background: 'var(--bg2)', borderRadius: 10, border: '0.5px solid var(--border)', padding: '16px 20px' }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Top Products — GA4 Revenue</div>
          {topProducts.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--text3)', padding: '20px 0' }}>No item data — GA4 items syncing...</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr>
                  {['Product','Revenue','Units'].map((h,i) => (
                    <th key={h} style={{ padding:'5px 8px', fontSize:10, fontWeight:600, color:'var(--text3)', borderBottom:'0.5px solid var(--border2)', textAlign:i===0?'left':'right', textTransform:'uppercase', letterSpacing:'0.05em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {topProducts.map((p, i) => (
                  <tr key={p.name} onMouseEnter={e=>e.currentTarget.style.background='var(--bg3)'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                    <td style={{ padding:'6px 8px', maxWidth:280, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', display:'flex', alignItems:'center', gap:8 }}>
                      <span style={{ fontSize:10, color:'var(--text3)', minWidth:16 }}>#{i+1}</span>
                      {p.name}
                    </td>
                    <td style={{ padding:'6px 8px', textAlign:'right', color:'#22c55e', fontWeight:500 }}>{fmtC(p.revenue)}</td>
                    <td style={{ padding:'6px 8px', textAlign:'right', color:'var(--text3)' }}>{fmtN(Math.round(p.purchased))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
