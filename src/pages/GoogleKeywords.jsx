import React, { useMemo, useState } from 'react'
import { useData } from '../data/store.jsx'
import { useFilters } from '../hooks/useFilters.js'
import FilterBar from '../components/FilterBar.jsx'
import DrillTable from '../components/DrillTable.jsx'
import MetricCard from '../components/MetricCard.jsx'
import { fmtINRCompact, fmtX, fmtPct, fmtNum, deltaLabel } from '../utils/formatters.js'
import { isBrandKeyword } from '../utils/parser.js'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, Legend, Cell, PieChart, Pie,
} from 'recharts'
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns'

// ── helpers ───────────────────────────────────────────────────────────────────
function aggG(rows) {
  const cost = rows.reduce((s, r) => s + (r.cost || 0), 0)
  const rev  = rows.reduce((s, r) => s + (r.revenue || 0), 0)
  const tx   = rows.reduce((s, r) => s + (r.transactions || 0), 0)
  const cl   = rows.reduce((s, r) => s + (r.clicks || 0), 0)
  const imp  = rows.reduce((s, r) => s + (r.impressions || 0), 0)
  const sess = rows.reduce((s, r) => s + (r.sessions || 0), 0)
  return {
    cost, revenue: rev, transactions: tx, clicks: cl, impressions: imp, sessions: sess,
    roas:  cost > 0  ? rev / cost   : 0,
    cpa:   tx   > 0  ? cost / tx    : 0,
    cpc:   cl   > 0  ? cost / cl    : 0,
    ctr:   imp  > 0  ? cl / imp     : 0,
    cpm:   imp  > 0  ? (cost / imp) * 1000 : 0,
    is:    rows.reduce((s, r) => s + (r.impressionShare || 0), 0) / Math.max(rows.length, 1),
  }
}

function aggGA4(rows) {
  const rev  = rows.reduce((s, r) => s + (r.revenue || 0), 0)
  const tx   = rows.reduce((s, r) => s + (r.transactions || 0), 0)
  const sess = rows.reduce((s, r) => s + (r.sessions || 0), 0)
  return { revenue: rev, transactions: tx, sessions: sess }
}

const TABS = [
  { key: 'overview',    label: 'Overview' },
  { key: 'brand_nb',   label: 'Brand vs NB' },
  { key: 'keywords',   label: 'Top keywords' },
  { key: 'mom',        label: 'MoM trend' },
]

const SEG_CUTS = [
  { key: 'all',    label: 'All' },
  { key: 'women',  label: 'Women' },
  { key: 'men',    label: "Men" },
]

// ── Main ──────────────────────────────────────────────────────────────────────
export default function GoogleKeywords() {
  const { state } = useData()
  const filters = useFilters('thisMonth')
  const { filterRows, getPrevRows } = filters
  const [tab, setTab]       = useState('overview')
  const [segCut, setSegCut] = useState('all')

  // ── filtered rows ─────────────────────────────────────────────────────────
  const allGoogle = useMemo(() => filterRows(state.googleDump, 'date'), [state.googleDump, filters])
  const prevGoogle = useMemo(() => getPrevRows(state.googleDump, 'date'), [state.googleDump, filters])
  const allGA4 = useMemo(() => filterRows(state.ga4Dump, 'date'), [state.ga4Dump, filters])
  const prevGA4 = useMemo(() => getPrevRows(state.ga4Dump, 'date'), [state.ga4Dump, filters])

  // apply segment cut
  function applySeg(rows) {
    if (segCut === 'men') return rows.filter(r => (r.campaignName || '').toLowerCase().includes('men'))
    if (segCut === 'women') return rows.filter(r => !(r.campaignName || '').toLowerCase().includes('men') || (r.campaignName || '').toLowerCase().includes('women'))
    return rows
  }

  const googleRows = useMemo(() => applySeg(allGoogle), [allGoogle, segCut])
  const googlePrev = useMemo(() => applySeg(prevGoogle), [prevGoogle, segCut])

  // brand vs NB split
  const brandRows  = useMemo(() => googleRows.filter(r => isBrandKeyword(r.campaignName) || (r.campaignType || '').toLowerCase().includes('brand')), [googleRows])
  const nbRows     = useMemo(() => googleRows.filter(r => !isBrandKeyword(r.campaignName) && !(r.campaignType || '').toLowerCase().includes('brand')), [googleRows])
  const brandPrev  = useMemo(() => googlePrev.filter(r => isBrandKeyword(r.campaignName) || (r.campaignType || '').toLowerCase().includes('brand')), [googlePrev])
  const nbPrev     = useMemo(() => googlePrev.filter(r => !isBrandKeyword(r.campaignName) && !(r.campaignType || '').toLowerCase().includes('brand')), [googlePrev])

  // GA4 brand vs NB (from session utm_term)
  const ga4Brand = useMemo(() => allGA4.filter(r => isBrandKeyword(r.manualTerm || r.sessionManualTerm || r.term || '')), [allGA4])
  const ga4NB    = useMemo(() => allGA4.filter(r => !isBrandKeyword(r.manualTerm || r.sessionManualTerm || r.term || '') && (r.manualTerm || r.sessionManualTerm || r.term || '')), [allGA4])
  const ga4BrandPrev = useMemo(() => prevGA4.filter(r => isBrandKeyword(r.manualTerm || r.sessionManualTerm || r.term || '')), [prevGA4])
  const ga4NBPrev    = useMemo(() => prevGA4.filter(r => !isBrandKeyword(r.manualTerm || r.sessionManualTerm || r.term || '')), [prevGA4])

  const totBrand = useMemo(() => aggG(brandRows), [brandRows])
  const totNB    = useMemo(() => aggG(nbRows), [nbRows])
  const totBrandPrev = useMemo(() => aggG(brandPrev), [brandPrev])
  const totNBPrev    = useMemo(() => aggG(nbPrev), [nbPrev])
  const ga4BrandAgg  = useMemo(() => aggGA4(ga4Brand), [ga4Brand])
  const ga4NBAgg     = useMemo(() => aggGA4(ga4NB), [ga4NB])
  const ga4BrandPrevAgg = useMemo(() => aggGA4(ga4BrandPrev), [ga4BrandPrev])
  const ga4NBPrevAgg    = useMemo(() => aggGA4(ga4NBPrev), [ga4NBPrev])

  // total Google ROAS
  const totAll = useMemo(() => aggG(googleRows), [googleRows])
  const totAllPrev = useMemo(() => aggG(googlePrev), [googlePrev])

  // ── MoM trend (last 6 months) ─────────────────────────────────────────────
  const momTrend = useMemo(() => {
    const months = Array.from({ length: 6 }, (_, i) => {
      const d = subMonths(new Date(), 5 - i)
      return { start: startOfMonth(d), end: endOfMonth(d), label: format(d, 'MMM yy') }
    })
    return months.map(m => {
      const mRows = state.googleDump.filter(r => {
        const d = r.date instanceof Date ? r.date : new Date(r.date)
        return d >= m.start && d <= m.end
      })
      const mBrand = mRows.filter(r => isBrandKeyword(r.campaignName))
      const mNB    = mRows.filter(r => !isBrandKeyword(r.campaignName))
      const bAgg   = aggG(mBrand)
      const nbAgg  = aggG(mNB)
      const total  = bAgg.cost + nbAgg.cost
      return {
        label: m.label,
        brandCost: bAgg.cost,
        nbCost: nbAgg.cost,
        brandRev: bAgg.revenue,
        nbRev: nbAgg.revenue,
        brandPct: total > 0 ? Math.round(bAgg.cost / total * 100) : 0,
        nbPct: total > 0 ? Math.round(nbAgg.cost / total * 100) : 0,
        brandROAS: bAgg.roas,
        nbROAS: nbAgg.roas,
        brandIS: bAgg.is,
      }
    })
  }, [state.googleDump])

  // ── Top NB keywords from GA4 ──────────────────────────────────────────────
  const topNBTerms = useMemo(() => {
    const map = {}
    for (const r of ga4NB) {
      const term = r.manualTerm || r.sessionManualTerm || r.term || 'unknown'
      if (!map[term]) map[term] = { term, sessions: 0, transactions: 0, revenue: 0 }
      map[term].sessions     += r.sessions || 0
      map[term].transactions += r.transactions || 0
      map[term].revenue      += r.revenue || 0
    }
    return Object.values(map)
      .filter(r => r.sessions > 0)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 50)
      .map(r => ({ ...r, cr: r.sessions > 0 ? r.transactions / r.sessions : 0 }))
  }, [ga4NB])

  // ── Campaign table (brand vs NB) ──────────────────────────────────────────
  const campBNB = useMemo(() => {
    const map = {}
    for (const r of googleRows) {
      const k = r.campaignName || 'Unknown'
      if (!map[k]) map[k] = { campaignName: k, campaignType: r.campaignType || '', isBrand: isBrandKeyword(k), rows: [] }
      map[k].rows.push(r)
    }
    return Object.values(map).map(c => {
      const agg = aggG(c.rows)
      return { ...c, ...agg, rows: undefined }
    }).sort((a, b) => b.cost - a.cost)
  }, [googleRows])

  // ── IS trend ─────────────────────────────────────────────────────────────
  const isData = momTrend.map(m => ({ label: m.label, brandIS: +(m.brandIS * 100).toFixed(1) }))

  const hasGoogle = googleRows.length > 0
  const hasGA4    = allGA4.length > 0

  const TIP = { contentStyle: { background: 'var(--bg3)', border: '0.5px solid var(--border2)', fontSize: 12, borderRadius: 6 } }

  // ── Columns ───────────────────────────────────────────────────────────────
  const campCols = [
    { key: 'campaignName', label: 'Campaign', align: 'left', bold: true, render: (v, r) => (
      <span style={{ display:'flex', alignItems:'center', gap:6 }}>
        <span style={{ fontSize:10, padding:'1px 6px', borderRadius:5, fontWeight:500,
          background: r.isBrand ? 'rgba(34,197,94,0.12)' : 'rgba(59,130,246,0.12)',
          color: r.isBrand ? 'var(--green)' : 'var(--blue)',
          border: `0.5px solid ${r.isBrand ? 'rgba(34,197,94,0.3)' : 'rgba(59,130,246,0.3)'}`,
        }}>{r.isBrand ? 'Brand' : 'NB'}</span>
        {v}
      </span>
    )},
    { key: 'campaignType', label: 'Type' },
    { key: 'cost',         label: 'Spend',   render: fmtINRCompact },
    { key: 'impressions',  label: 'Impr.',   render: fmtNum },
    { key: 'clicks',       label: 'Clicks',  render: fmtNum },
    { key: 'ctr',          label: 'CTR',     render: fmtPct },
    { key: 'cpc',          label: 'CPC',     render: fmtINRCompact },
    { key: 'cpm',          label: 'CPM',     render: fmtINRCompact },
    { key: 'transactions', label: 'Txn',     render: fmtNum },
    { key: 'revenue',      label: 'Revenue', render: fmtINRCompact },
    { key: 'roas',         label: 'ROAS',    render: fmtX, color: v => v>=2?'var(--green)':v>=1?'var(--amber)':'var(--red)' },
    { key: 'cpa',          label: 'CPA',     render: fmtINRCompact },
  ]

  const termCols = [
    { key: 'term',         label: 'Keyword',   align: 'left', bold: true },
    { key: 'sessions',     label: 'Sessions',  render: fmtNum },
    { key: 'transactions', label: 'Orders',    render: fmtNum },
    { key: 'revenue',      label: 'Revenue',   render: fmtINRCompact },
    { key: 'cr',           label: 'CR%',       render: v => fmtPct(v), color: v => v>=0.02?'var(--green)':v>=0.01?'var(--amber)':'var(--text2)' },
  ]

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 18, fontWeight: 600, marginBottom: 2 }}>Google — Brand vs Non-Brand</h1>
        <div style={{ fontSize: 12, color: 'var(--text3)' }}>Search campaigns · GA4 session terms · MoM IS trend</div>
      </div>

      <FilterBar filters={filters} showAdvanced showCohort={false} showSaleTag={false} />

      {/* Segment */}
      <div style={{ display:'flex', gap:6, marginBottom:14 }}>
        {SEG_CUTS.map(s => (
          <button key={s.key} onClick={() => setSegCut(s.key)} style={{
            padding:'4px 12px', fontSize:12, borderRadius:20, cursor:'pointer',
            background: segCut===s.key ? (s.key==='men'?'rgba(59,130,246,0.15)':'rgba(232,69,122,0.12)') : 'transparent',
            color: segCut===s.key ? (s.key==='men'?'var(--blue)':'var(--pink)') : 'var(--text2)',
            border: `0.5px solid ${segCut===s.key ? (s.key==='men'?'var(--blue-border)':'var(--pink-border)') : 'var(--border)'}`,
            fontWeight: segCut===s.key ? 500 : 400,
          }}>{s.label}</button>
        ))}
      </div>

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

      {/* ── OVERVIEW TAB ─────────────────────────────────────────────────────── */}
      {tab === 'overview' && (
        <>
          {!hasGoogle && <NoData type="Google" />}
          <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:16 }}>
            <MetricCard label="Total spend"    value={fmtINRCompact(totAll.cost)}   delta={deltaLabel(totAll.cost, totAllPrev.cost)} />
            <MetricCard label="Total revenue"  value={fmtINRCompact(totAll.revenue)} delta={deltaLabel(totAll.revenue, totAllPrev.revenue)} />
            <MetricCard label="ROAS"           value={fmtX(totAll.roas)} delta={deltaLabel(totAll.roas, totAllPrev.roas)} />
            <MetricCard label="Brand spend"    value={fmtINRCompact(totBrand.cost)} accent="var(--green)" sublabel={totAll.cost > 0 ? `${Math.round(totBrand.cost/totAll.cost*100)}% of total` : ''} delta={deltaLabel(totBrand.cost, totBrandPrev.cost)} />
            <MetricCard label="NB spend"       value={fmtINRCompact(totNB.cost)} accent="var(--blue)" sublabel={totAll.cost > 0 ? `${Math.round(totNB.cost/totAll.cost*100)}% of total` : ''} delta={deltaLabel(totNB.cost, totNBPrev.cost)} />
            <MetricCard label="Brand ROAS"     value={fmtX(totBrand.roas)} accent="var(--green)" delta={deltaLabel(totBrand.roas, totBrandPrev.roas)} />
            <MetricCard label="NB ROAS"        value={fmtX(totNB.roas)} accent="var(--blue)" delta={deltaLabel(totNB.roas, totNBPrev.roas)} />
          </div>

          {/* Spend split chart */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:16 }}>
            <Card title="Spend split — Brand vs NB">
              {totAll.cost > 0 ? (
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={[
                      { name:'Brand', value: totBrand.cost, color:'var(--green)' },
                      { name:'Non-Brand', value: totNB.cost, color:'var(--blue)' },
                    ]} cx="50%" cy="50%" innerRadius={45} outerRadius={70} dataKey="value" paddingAngle={3}>
                      <Cell fill="var(--green)" />
                      <Cell fill="var(--blue)" />
                    </Pie>
                    <Tooltip {...TIP} formatter={v => [fmtINRCompact(v), '']} />
                    <Legend iconType="circle" iconSize={8} formatter={(v) => <span style={{ fontSize:11, color:'var(--text2)' }}>{v}</span>} />
                  </PieChart>
                </ResponsiveContainer>
              ) : <EmptyChart />}
            </Card>
            <Card title="GA4 revenue — Brand vs NB">
              {hasGA4 ? (
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={[
                    { name:'Brand', revenue: ga4BrandAgg.revenue, prev: ga4BrandPrevAgg.revenue },
                    { name:'Non-Brand', revenue: ga4NBAgg.revenue, prev: ga4NBPrevAgg.revenue },
                  ]} barSize={32}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize:11, fill:'var(--text3)' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize:11, fill:'var(--text3)' }} axisLine={false} tickLine={false} />
                    <Tooltip {...TIP} formatter={v => [fmtINRCompact(v), '']} />
                    <Bar dataKey="prev" fill="rgba(255,255,255,0.1)" name="Prev period" radius={[4,4,0,0]} />
                    <Bar dataKey="revenue" name="Current" radius={[4,4,0,0]}>
                      <Cell fill="var(--green)" />
                      <Cell fill="var(--blue)" />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : <EmptyChart text="Upload GA4 data" />}
            </Card>
          </div>
        </>
      )}

      {/* ── BRAND vs NB TAB ───────────────────────────────────────────────────── */}
      {tab === 'brand_nb' && (
        <>
          {/* Summary cards per type */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:16 }}>
            <Card title="Brand campaigns" accent="var(--green)">
              <StatGrid rows={[
                ['Spend', fmtINRCompact(totBrand.cost)],
                ['Revenue', fmtINRCompact(totBrand.revenue)],
                ['ROAS', fmtX(totBrand.roas)],
                ['CPC', fmtINRCompact(totBrand.cpc)],
                ['CTR', fmtPct(totBrand.ctr)],
                ['CPA', fmtINRCompact(totBrand.cpa)],
                ['Impressions', fmtNum(totBrand.impressions)],
                ['Clicks', fmtNum(totBrand.clicks)],
              ]} />
            </Card>
            <Card title="Non-brand campaigns" accent="var(--blue)">
              <StatGrid rows={[
                ['Spend', fmtINRCompact(totNB.cost)],
                ['Revenue', fmtINRCompact(totNB.revenue)],
                ['ROAS', fmtX(totNB.roas)],
                ['CPC', fmtINRCompact(totNB.cpc)],
                ['CTR', fmtPct(totNB.ctr)],
                ['CPA', fmtINRCompact(totNB.cpa)],
                ['Impressions', fmtNum(totNB.impressions)],
                ['Clicks', fmtNum(totNB.clicks)],
              ]} />
            </Card>
          </div>

          <div style={{ marginBottom:8 }}>
            <div style={{ fontSize:13, fontWeight:600, marginBottom:4 }}>Campaign-level Brand vs NB breakdown</div>
            <div style={{ fontSize:11, color:'var(--text3)' }}>All Google campaigns · auto-tagged Brand/NB from campaign name</div>
          </div>
          <DrillTable columns={campCols} data={campBNB} defaultSort={{ key:'cost', dir:'desc' }} />
        </>
      )}

      {/* ── KEYWORDS TAB ─────────────────────────────────────────────────────── */}
      {tab === 'keywords' && (
        <>
          <div style={{ marginBottom:14 }}>
            <div style={{ fontSize:13, fontWeight:600, marginBottom:4 }}>Top non-brand keywords</div>
            <div style={{ fontSize:11, color:'var(--text3)', marginBottom:12 }}>Source: GA4 session utm_term · sorted by revenue · {topNBTerms.length} unique terms</div>
          </div>
          {!hasGA4 ? <NoData type="GA4" /> : (
            <DrillTable columns={termCols} data={topNBTerms} defaultSort={{ key:'revenue', dir:'desc' }} />
          )}
        </>
      )}

      {/* ── MOM TREND TAB ────────────────────────────────────────────────────── */}
      {tab === 'mom' && (
        <>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:16 }}>
            <Card title="Spend mix — Brand vs NB (MoM)">
              {momTrend.some(m => m.brandCost > 0 || m.nbCost > 0) ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={momTrend} barSize={18}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize:11, fill:'var(--text3)' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize:11, fill:'var(--text3)' }} axisLine={false} tickLine={false} unit="%" />
                    <Tooltip {...TIP} formatter={(v, n) => [`${v}%`, n]} />
                    <Legend iconType="circle" iconSize={8} formatter={v => <span style={{ fontSize:11, color:'var(--text2)' }}>{v}</span>} />
                    <Bar dataKey="brandPct" fill="var(--green)" name="Brand %" radius={[3,3,0,0]} stackId="a" />
                    <Bar dataKey="nbPct" fill="var(--blue)" name="NB %" radius={[3,3,0,0]} stackId="a" />
                  </BarChart>
                </ResponsiveContainer>
              ) : <EmptyChart text="Upload Google data" />}
            </Card>

            <Card title="ROAS trend — Brand vs NB (MoM)">
              {momTrend.some(m => m.brandROAS > 0 || m.nbROAS > 0) ? (
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={momTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize:11, fill:'var(--text3)' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize:11, fill:'var(--text3)' }} axisLine={false} tickLine={false} />
                    <Tooltip {...TIP} formatter={(v, n) => [`${Number(v).toFixed(2)}x`, n]} />
                    <Legend iconType="circle" iconSize={8} formatter={v => <span style={{ fontSize:11, color:'var(--text2)' }}>{v}</span>} />
                    <Line dataKey="brandROAS" stroke="var(--green)" name="Brand ROAS" strokeWidth={2} dot={{ r:3 }} />
                    <Line dataKey="nbROAS" stroke="var(--blue)" name="NB ROAS" strokeWidth={2} dot={{ r:3 }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : <EmptyChart text="Upload Google data" />}
            </Card>

            <Card title="Brand IS trend (Impression Share MoM)">
              {isData.some(d => d.brandIS > 0) ? (
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={isData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize:11, fill:'var(--text3)' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize:11, fill:'var(--text3)' }} axisLine={false} tickLine={false} unit="%" domain={[0,100]} />
                    <Tooltip {...TIP} formatter={v => [`${v}%`, 'Brand IS']} />
                    <Line dataKey="brandIS" stroke="var(--green)" name="Brand IS %" strokeWidth={2} dot={{ r:3 }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : <EmptyChart text="IS data not in CSV" />}
            </Card>

            <Card title="Revenue MoM — Brand vs NB">
              {momTrend.some(m => m.brandRev > 0 || m.nbRev > 0) ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={momTrend} barSize={14}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize:11, fill:'var(--text3)' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize:11, fill:'var(--text3)' }} axisLine={false} tickLine={false} />
                    <Tooltip {...TIP} formatter={v => [fmtINRCompact(v), '']} />
                    <Legend iconType="circle" iconSize={8} formatter={v => <span style={{ fontSize:11, color:'var(--text2)' }}>{v}</span>} />
                    <Bar dataKey="brandRev" fill="var(--green)" name="Brand rev" radius={[3,3,0,0]} />
                    <Bar dataKey="nbRev" fill="var(--blue)" name="NB rev" radius={[3,3,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <EmptyChart text="Upload data" />}
            </Card>
          </div>
        </>
      )}
    </div>
  )
}

// ── Small helper components ───────────────────────────────────────────────────
function Card({ title, accent, children }) {
  return (
    <div style={{ background:'var(--bg2)', border:'0.5px solid var(--border)', borderRadius:10, padding:'14px 16px',
      ...(accent ? { borderLeft:`2px solid ${accent}` } : {}) }}>
      <div style={{ fontSize:12, color:'var(--text3)', marginBottom:10, fontWeight:500 }}>{title}</div>
      {children}
    </div>
  )
}

function StatGrid({ rows }) {
  return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'4px 16px' }}>
      {rows.map(([label, val]) => (
        <div key={label} style={{ display:'flex', justifyContent:'space-between', padding:'4px 0', borderBottom:'0.5px solid var(--border)', fontSize:12 }}>
          <span style={{ color:'var(--text3)' }}>{label}</span>
          <span style={{ fontWeight:500 }}>{val}</span>
        </div>
      ))}
    </div>
  )
}

function EmptyChart({ text = 'No data' }) {
  return (
    <div style={{ height:160, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text3)', fontSize:12 }}>
      {text}
    </div>
  )
}

function NoData({ type }) {
  return (
    <div style={{ background:'rgba(239,68,68,0.08)', border:'0.5px solid rgba(239,68,68,0.2)', borderRadius:8, padding:'10px 14px', marginBottom:14, fontSize:12, color:'#ef4444' }}>
      No {type} data loaded — upload CSV from Upload page
    </div>
  )
}
