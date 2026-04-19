import React, { useMemo, useState } from 'react'
import { useData } from '../data/store.jsx'
import { useFilters } from '../hooks/useFilters.js'
import FilterBar from '../components/FilterBar.jsx'
import DrillTable from '../components/DrillTable.jsx'
import MetricCard from '../components/MetricCard.jsx'
import { fmtINRCompact, fmtX, fmtPct, fmtNum, deltaLabel } from '../utils/formatters.js'
import { isBrandKeyword } from '../utils/parser.js'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid, Legend, Cell, PieChart, Pie } from 'recharts'
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns'

// ── helpers ───────────────────────────────────────────────────────────────────
function aggG(rows) {
  const cost = rows.reduce((s, r) => s + (r.cost || 0), 0)
  const imp  = rows.reduce((s, r) => s + (r.impressions || 0), 0)
  const cl   = rows.reduce((s, r) => s + (r.clicks || 0), 0)
  const tx   = rows.reduce((s, r) => s + (r.transactions || 0), 0)
  const rev  = rows.reduce((s, r) => s + (r.revenue || 0), 0)
  return {
    cost, impressions: imp, clicks: cl, transactions: tx, revenue: rev,
    roas: cost > 0 ? rev / cost : 0,
    cpa:  tx   > 0 ? cost / tx  : 0,
    cpc:  cl   > 0 ? cost / cl  : 0,
    ctr:  imp  > 0 ? cl / imp   : 0,
    cr:   cl   > 0 ? tx / cl    : 0,
  }
}

// ── Burning keyword detector ──────────────────────────────────────────────────
// High spend + low ROAS + significant clicks = burning budget
function isBurning(row) {
  const roas = row.roas || (row.revenue > 0 && row.cost > 0 ? row.revenue / row.cost : 0)
  const hasMeaningfulSpend = row.cost > 500
  const lowRoas = roas < 1.5 && roas > 0
  const hasClicks = row.clicks > 30
  const highCPA = row.cpa > 800 || (row.transactions === 0 && row.cost > 300)
  return hasMeaningfulSpend && (lowRoas || highCPA) && hasClicks
}

// ── Irrelevant search term detector ──────────────────────────────────────────
// Has spend, zero or near-zero conversions, low CTR, not a brand term
function isIrrelevant(row) {
  const hasSpend = row.cost > 100
  const noConversions = row.transactions === 0
  const lowCTR = row.ctr < 0.005 // below 0.5%
  const notBrand = !row.isBrand
  const hasCost = row.cost > 50
  return hasSpend && noConversions && notBrand && (lowCTR || hasCost)
}

const TABS = [
  { key: 'overview',  label: 'Brand vs NB' },
  { key: 'keywords',  label: 'Keywords' },
  { key: 'terms',     label: 'Search terms' },
  { key: 'burning',   label: 'Burning' },
  { key: 'irrelevant',label: '⚠️ Irrelevant' },
  { key: 'mom',       label: 'MoM trend' },
]

const TIP = { contentStyle: { background: 'var(--bg3)', border: '1px solid var(--border2)', fontSize: 12, borderRadius: 6 } }

// ── Brand/NB pill ─────────────────────────────────────────────────────────────
function BrandPill({ isBrand }) {
  return (
    <span style={{
      fontSize:10, padding:'1px 7px', borderRadius:5, fontWeight:600,
      background: isBrand ? 'rgba(34,197,94,0.12)' : 'rgba(59,130,246,0.12)',
      color: isBrand ? 'var(--green)' : 'var(--blue)',
      border: `0.5px solid ${isBrand ? 'rgba(34,197,94,0.3)' : 'rgba(59,130,246,0.3)'}`,
    }}>{isBrand ? 'Brand' : 'NB'}</span>
  )
}

export default function GoogleKeywords() {
  const { state } = useData()
  const filters = useFilters('thisMonth')
  const { filterRows, getPrevRows } = filters
  const [tab, setTab]     = useState('overview')
  const [segCut, setSegCut] = useState('all')
  const [bnbFilter, setBnbFilter] = useState('all') // 'all' | 'brand' | 'nb'

  // ── Data sources ──────────────────────────────────────────────────────────
  const keywords    = useMemo(() => state.googleKeywords || [],    [state.googleKeywords])
  const searchTerms = useMemo(() => state.googleSearchTerms || [], [state.googleSearchTerms])
  const googleRows  = useMemo(() => filterRows(state.googleDump, 'date'), [state.googleDump, filters])
  const googlePrev  = useMemo(() => getPrevRows(state.googleDump, 'date'), [state.googleDump, filters])
  const ga4Rows     = useMemo(() => filterRows(state.ga4Dump, 'date'), [state.ga4Dump, filters])
  const ga4Prev     = useMemo(() => getPrevRows(state.ga4Dump, 'date'), [state.ga4Dump, filters])

  // ── Brand/NB split from Google campaigns ─────────────────────────────────
  const brandCampRows = useMemo(() => googleRows.filter(r => isBrandKeyword(r.campaignName)), [googleRows])
  const nbCampRows    = useMemo(() => googleRows.filter(r => !isBrandKeyword(r.campaignName)), [googleRows])
  const brandPrevRows = useMemo(() => googlePrev.filter(r => isBrandKeyword(r.campaignName)), [googlePrev])
  const nbPrevRows    = useMemo(() => googlePrev.filter(r => !isBrandKeyword(r.campaignName)), [googlePrev])

  const totBrand = useMemo(() => aggG(brandCampRows), [brandCampRows])
  const totNB    = useMemo(() => aggG(nbCampRows),    [nbCampRows])
  const totBrandPrev = useMemo(() => aggG(brandPrevRows), [brandPrevRows])
  const totNBPrev    = useMemo(() => aggG(nbPrevRows),    [nbPrevRows])

  // ── GA4 brand vs NB ───────────────────────────────────────────────────────
  const ga4Brand = useMemo(() => ga4Rows.filter(r => r.isBrand || isBrandKeyword(r.manualTerm || '')), [ga4Rows])
  const ga4NB    = useMemo(() => ga4Rows.filter(r => !r.isBrand && !isBrandKeyword(r.manualTerm || '')), [ga4Rows])

  // ── Keyword aggregations ──────────────────────────────────────────────────
  const keywordRows = useMemo(() => {
    const map = {}
    for (const r of keywords) {
      const k = `${r.keyword}||${r.matchType}`
      if (!map[k]) map[k] = { keyword: r.keyword, matchType: r.matchType, campaignName: r.campaignName, isBrand: r.isBrand, rows:[] }
      map[k].rows.push(r)
    }
    return Object.values(map).map(({ rows, ...rest }) => {
      const agg = aggG(rows)
      const avgIS = rows.reduce((s, r) => s + (r.impressionShare||0), 0) / Math.max(rows.length, 1)
      const avgQS = rows.reduce((s, r) => s + (r.qualityScore||0),    0) / Math.max(rows.length, 1)
      return { ...rest, ...agg, impressionShare: avgIS, qualityScore: avgQS, burning: isBurning({ ...agg, isBrand: rest.isBrand }) }
    }).sort((a,b) => b.cost - a.cost)
  }, [keywords])

  const filteredKeywords = useMemo(() => {
    if (bnbFilter === 'brand') return keywordRows.filter(r => r.isBrand)
    if (bnbFilter === 'nb')    return keywordRows.filter(r => !r.isBrand)
    return keywordRows
  }, [keywordRows, bnbFilter])

  // ── Search term aggregations ──────────────────────────────────────────────
  const termRows = useMemo(() => {
    const map = {}
    for (const r of searchTerms) {
      const k = r.term
      if (!map[k]) map[k] = { term: k, isBrand: r.isBrand, campaignName: r.campaignName, rows:[] }
      map[k].rows.push(r)
    }
    return Object.values(map).map(({ rows, ...rest }) => {
      const agg = aggG(rows)
      return {
        ...rest, ...agg,
        burning:    isBurning(agg),
        irrelevant: isIrrelevant({ ...agg, isBrand: rest.isBrand }),
      }
    }).sort((a,b) => b.cost - a.cost)
  }, [searchTerms])

  const filteredTerms = useMemo(() => {
    if (bnbFilter === 'brand') return termRows.filter(r => r.isBrand)
    if (bnbFilter === 'nb')    return termRows.filter(r => !r.isBrand)
    return termRows
  }, [termRows, bnbFilter])

  const burningKeywords = useMemo(() => keywordRows.filter(r => r.burning),  [keywordRows])
  const burningTerms    = useMemo(() => termRows.filter(r => r.burning),     [termRows])
  const irrelevantTerms = useMemo(() => termRows.filter(r => r.irrelevant),  [termRows])

  // ── MoM trend ─────────────────────────────────────────────────────────────
  const momTrend = useMemo(() => {
    const months = Array.from({ length: 6 }, (_, i) => {
      const d = subMonths(new Date(), 5 - i)
      return { start: startOfMonth(d), end: endOfMonth(d), label: format(d, 'MMM yy') }
    })
    return months.map(m => {
      const mRows   = state.googleDump.filter(r => { const d = r.date instanceof Date ? r.date : new Date(r.date); return d >= m.start && d <= m.end })
      const brand   = mRows.filter(r => isBrandKeyword(r.campaignName))
      const nb      = mRows.filter(r => !isBrandKeyword(r.campaignName))
      const bAgg    = aggG(brand), nbAgg = aggG(nb)
      const total   = bAgg.cost + nbAgg.cost
      return { label: m.label, brandCost: bAgg.cost, nbCost: nbAgg.cost,
        brandPct: total>0 ? Math.round(bAgg.cost/total*100) : 0,
        nbPct: total>0 ? Math.round(nbAgg.cost/total*100) : 0,
        brandROAS: isFinite(bAgg.roas) ? bAgg.roas : 0,
        nbROAS: isFinite(nbAgg.roas) ? nbAgg.roas : 0 }
    })
  }, [state.googleDump])

  // ── Waste summary ─────────────────────────────────────────────────────────
  const wasteSpend = useMemo(() => irrelevantTerms.reduce((s, r) => s + r.cost, 0), [irrelevantTerms])
  const burningSpend = useMemo(() => [...burningKeywords, ...burningTerms].reduce((s, r) => s + r.cost, 0), [burningKeywords, burningTerms])

  // ── Column sets ───────────────────────────────────────────────────────────
  const kwdCols = [
    { key:'isBrand',       label:'Type',       render: v => <BrandPill isBrand={v} /> },
    { key:'keyword',       label:'Keyword',    align:'left', bold:true },
    { key:'matchType',     label:'Match',      render: v => <span style={{ fontSize:10, padding:'1px 6px', borderRadius:4, background:'var(--bg3)', color:'var(--text2)', border:'1px solid var(--border)' }}>{v}</span> },
    { key:'cost',          label:'Spend',      render: fmtINRCompact },
    { key:'impressions',   label:'Impr.',      render: fmtNum },
    { key:'clicks',        label:'Clicks',     render: fmtNum },
    { key:'ctr',           label:'CTR',        render: fmtPct, color: v => v>=0.3?'var(--green)':v>=0.1?'var(--amber)':'var(--red)' },
    { key:'cpc',           label:'CPC',        render: fmtINRCompact },
    { key:'transactions',  label:'Conv.',      render: fmtNum },
    { key:'revenue',       label:'Rev.',       render: fmtINRCompact },
    { key:'roas',          label:'ROAS',       render: v => v>0?fmtX(v):'—', color: v => v>=2?'var(--green)':v>=1?'var(--amber)':v>0?'var(--red)':'var(--text3)' },
    { key:'cpa',           label:'CPA',        render: v => v>0?fmtINRCompact(v):'—' },
    { key:'impressionShare',label:'IS',        render: v => v>0?fmtPct(v):'—', color: v => v>=0.8?'var(--green)':v>=0.5?'var(--amber)':'var(--text2)' },
    { key:'qualityScore',  label:'QS',         render: v => v>0?v.toFixed(0):'—', color: v => v>=7?'var(--green)':v>=5?'var(--amber)':'var(--red)' },
    { key:'burning',       label:'Status',     render: v => v ? <span style={{ fontSize:10, padding:'1px 7px', borderRadius:5, background:'var(--red-dim)', color:'var(--red)', border:'1px solid var(--red-border)' }}>Burning</span> : null },
  ]

  const termCols = [
    { key:'isBrand',      label:'Type',        render: v => <BrandPill isBrand={v} /> },
    { key:'term',         label:'Search term', align:'left', bold:true },
    { key:'cost',         label:'Spend',       render: fmtINRCompact },
    { key:'impressions',  label:'Impr.',       render: fmtNum },
    { key:'clicks',       label:'Clicks',      render: fmtNum },
    { key:'ctr',          label:'CTR',         render: fmtPct, color: v => v>=0.3?'var(--green)':v>=0.1?'var(--amber)':'var(--red)' },
    { key:'cpc',          label:'CPC',         render: fmtINRCompact },
    { key:'transactions', label:'Conv.',       render: fmtNum },
    { key:'revenue',      label:'Rev.',        render: fmtINRCompact },
    { key:'roas',         label:'ROAS',        render: v => v>0?fmtX(v):'—', color: v => v>=2?'var(--green)':v>=1?'var(--amber)':v>0?'var(--red)':'var(--text3)' },
    { key:'burning',      label:'',            render: (v,r) => v ? <span style={{ fontSize:10, padding:'1px 7px', borderRadius:5, background:'var(--red-dim)', color:'var(--red)' }}>Burning</span>
      : r.irrelevant ? <span style={{ fontSize:10, padding:'1px 7px', borderRadius:5, background:'rgba(245,158,11,0.12)', color:'#f59e0b' }}>⚠️ Irrelevant</span> : null },
  ]

  const hasKeywords    = keywords.length > 0
  const hasSearchTerms = searchTerms.length > 0
  const hasGoogle      = googleRows.length > 0

  return (
    <div>
      <div style={{ marginBottom:16 }}>
        <h1 style={{ fontSize:18, fontWeight:600, marginBottom:2 }}>Google — Keywords & Search Terms</h1>
        <div style={{ fontSize:12, color:'var(--text3)' }}>Brand vs NB · Burning keywords · Irrelevant search terms · MoM trend</div>
      </div>

      <FilterBar filters={filters} showAdvanced showCohort={false} showSaleTag={false} />

      {/* Tab bar */}
      <div style={{ display:'flex', gap:0, marginBottom:16, borderBottom:'1px solid var(--border)' }}>
        {TABS.map(t => {
          const count = t.key==='burning' ? (burningKeywords.length + burningTerms.length)
            : t.key==='irrelevant' ? irrelevantTerms.length : 0
          return (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              padding:'8px 14px', fontSize:13, cursor:'pointer', fontWeight: tab===t.key ? 600 : 400,
              background:'transparent', border:'none',
              color: tab===t.key ? 'var(--blue)' : (count>0 && (t.key==='burning'||t.key==='irrelevant') ? '#ef4444' : 'var(--text2)'),
              borderBottom: `2px solid ${tab===t.key ? 'var(--blue)' : 'transparent'}`,
              marginBottom: -1, display:'flex', alignItems:'center', gap:5,
            }}>
              {t.label}
              {count > 0 && <span style={{ fontSize:10, padding:'0px 5px', borderRadius:8, background: t.key==='burning'?'rgba(239,68,68,0.15)':'rgba(245,158,11,0.15)', color: t.key==='burning'?'#ef4444':'#f59e0b', fontWeight:700 }}>{count}</span>}
            </button>
          )
        })}
      </div>

      {/* ── BRAND vs NB OVERVIEW ─────────────────────────────────────────────── */}
      {tab === 'overview' && (
        <>
          {/* Waste alert */}
          {(burningSpend > 0 || wasteSpend > 0) && (
            <div style={{ background:'rgba(239,68,68,0.08)', border:'0.5px solid rgba(239,68,68,0.25)', borderRadius:8, padding:'10px 16px', marginBottom:14, fontSize:12, color:'#ef4444', display:'flex', gap:16, flexWrap:'wrap' }}>
              {burningSpend > 0 && <span><strong>{fmtINRCompact(burningSpend)}</strong> in low-ROAS keywords</span>}
              {wasteSpend > 0  && <span>⚠️ <strong>{fmtINRCompact(wasteSpend)}</strong> wasted on irrelevant search terms with zero conversions</span>}
              <button onClick={() => setTab('burning')} style={{ background:'none', border:'none', cursor:'pointer', color:'#ef4444', textDecoration:'underline', fontSize:12 }}>View details →</button>
            </div>
          )}

          {/* Summary cards */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:12, marginBottom:16 }}>
            {/* Brand */}
            <div style={{ background:'var(--bg2)', border:'0.5px solid rgba(34,197,94,0.3)', borderLeft:'2px solid var(--green)', borderRadius:10, padding:'14px 16px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                <span style={{ fontSize:14, fontWeight:700, color:'var(--green)' }}>Brand</span>
                <BrandPill isBrand={true} />
              </div>
              <StatGrid rows={[
                ['Spend', fmtINRCompact(totBrand.cost)],
                ['Revenue', fmtINRCompact(totBrand.revenue)],
                ['ROAS', fmtX(totBrand.roas)],
                ['CPC', fmtINRCompact(totBrand.cpc)],
                ['CTR', fmtPct(totBrand.ctr)],
                ['Conv.', fmtNum(totBrand.transactions)],
                ['CPA', fmtINRCompact(totBrand.cpa)],
                ['CR%', fmtPct(totBrand.cr)],
              ]} />
            </div>
            {/* Non-Brand */}
            <div style={{ background:'var(--bg2)', border:'0.5px solid rgba(59,130,246,0.3)', borderLeft:'2px solid var(--blue)', borderRadius:10, padding:'14px 16px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                <span style={{ fontSize:14, fontWeight:700, color:'var(--blue)' }}>Non-Brand</span>
                <BrandPill isBrand={false} />
              </div>
              <StatGrid rows={[
                ['Spend', fmtINRCompact(totNB.cost)],
                ['Revenue', fmtINRCompact(totNB.revenue)],
                ['ROAS', fmtX(totNB.roas)],
                ['CPC', fmtINRCompact(totNB.cpc)],
                ['CTR', fmtPct(totNB.ctr)],
                ['Conv.', fmtNum(totNB.transactions)],
                ['CPA', fmtINRCompact(totNB.cpa)],
                ['CR%', fmtPct(totNB.cr)],
              ]} />
            </div>
          </div>

          {/* Spend split */}
          {hasGoogle && (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:10, padding:'14px 16px' }}>
                <div style={{ fontSize:12, color:'var(--text3)', marginBottom:10, fontWeight:500 }}>Spend split — Brand vs NB</div>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={[{ name:'Brand', value:totBrand.cost }, { name:'Non-Brand', value:totNB.cost }]}
                      cx="50%" cy="50%" innerRadius={45} outerRadius={70} dataKey="value" paddingAngle={3}>
                      <Cell fill="var(--green)" />
                      <Cell fill="var(--blue)" />
                    </Pie>
                    <Tooltip {...TIP} formatter={v => [fmtINRCompact(v), '']} />
                    <Legend iconType="circle" iconSize={8} formatter={v => <span style={{ fontSize:11, color:'var(--text2)' }}>{v}</span>} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:10, padding:'14px 16px' }}>
                <div style={{ fontSize:12, color:'var(--text3)', marginBottom:10, fontWeight:500 }}>ROAS comparison — Brand vs NB</div>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={[{ name:'Brand', roas: totBrand.roas }, { name:'Non-Brand', roas: totNB.roas }]} barSize={40}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize:12, fill:'var(--text3)' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize:11, fill:'var(--text3)' }} axisLine={false} tickLine={false} />
                    <Tooltip {...TIP} formatter={v => [fmtX(v), 'ROAS']} />
                    <Bar dataKey="roas" radius={[4,4,0,0]}>
                      <Cell fill="var(--green)" />
                      <Cell fill="var(--blue)" />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── KEYWORDS TAB ─────────────────────────────────────────────────────── */}
      {tab === 'keywords' && (
        <>
          <BNBFilterBar value={bnbFilter} onChange={setBnbFilter} brandCount={keywordRows.filter(r=>r.isBrand).length} nbCount={keywordRows.filter(r=>!r.isBrand).length} />
          {!hasKeywords ? <NoData type="Google keywords" /> : (
            <DrillTable columns={kwdCols} data={filteredKeywords} defaultSort={{ key:'cost', dir:'desc' }} />
          )}
        </>
      )}

      {/* ── SEARCH TERMS TAB ─────────────────────────────────────────────────── */}
      {tab === 'terms' && (
        <>
          <BNBFilterBar value={bnbFilter} onChange={setBnbFilter} brandCount={termRows.filter(r=>r.isBrand).length} nbCount={termRows.filter(r=>!r.isBrand).length} />
          {!hasSearchTerms ? <NoData type="Google search terms" /> : (
            <DrillTable columns={termCols} data={filteredTerms} defaultSort={{ key:'cost', dir:'desc' }} />
          )}
        </>
      )}

      {/* ── BURNING TAB ──────────────────────────────────────────────────────── */}
      {tab === 'burning' && (
        <>
          <div style={{ background:'rgba(239,68,68,0.08)', border:'0.5px solid rgba(239,68,68,0.25)', borderRadius:8, padding:'12px 16px', marginBottom:14 }}>
            <div style={{ fontSize:13, fontWeight:600, color:'#ef4444', marginBottom:4 }}>Burning Keywords & Search Terms</div>
            <div style={{ fontSize:12, color:'#ef4444', opacity:0.8 }}>
              Flagged: spend &gt; ₹500 + ROAS &lt; 1.5x + 30+ clicks. Total burning spend: <strong>{fmtINRCompact(burningSpend)}</strong>
            </div>
          </div>
          {burningKeywords.length > 0 && (
            <>
              <div style={{ fontSize:13, fontWeight:600, marginBottom:8, marginTop:4 }}>Burning keywords ({burningKeywords.length})</div>
              <DrillTable columns={kwdCols.filter(c => c.key !== 'burning')} data={burningKeywords} defaultSort={{ key:'cost', dir:'desc' }} compact />
            </>
          )}
          {burningTerms.length > 0 && (
            <>
              <div style={{ fontSize:13, fontWeight:600, marginBottom:8, marginTop:16 }}>Burning search terms ({burningTerms.length})</div>
              <DrillTable columns={termCols.filter(c => c.key !== 'burning')} data={burningTerms} defaultSort={{ key:'cost', dir:'desc' }} compact />
            </>
          )}
          {burningKeywords.length === 0 && burningTerms.length === 0 && (
            <div style={{ padding:'32px', textAlign:'center', color:'var(--text3)', fontSize:13, background:'var(--bg2)', borderRadius:10, border:'0.5px dashed var(--border2)' }}>
              {hasKeywords || hasSearchTerms ? 'No burning keywords detected' : 'Upload keywords and search terms CSVs to detect burning'}
            </div>
          )}
        </>
      )}

      {/* ── IRRELEVANT TAB ───────────────────────────────────────────────────── */}
      {tab === 'irrelevant' && (
        <>
          <div style={{ background:'rgba(245,158,11,0.08)', border:'0.5px solid rgba(245,158,11,0.25)', borderRadius:8, padding:'12px 16px', marginBottom:14 }}>
            <div style={{ fontSize:13, fontWeight:600, color:'#f59e0b', marginBottom:4 }}>⚠️ Irrelevant search terms — add as negatives</div>
            <div style={{ fontSize:12, color:'#f59e0b', opacity:0.8 }}>
              Criteria: spend &gt; ₹100 + zero conversions + not a brand term. Wasted spend: <strong>{fmtINRCompact(wasteSpend)}</strong>
            </div>
          </div>
          {irrelevantTerms.length > 0 ? (
            <DrillTable
              columns={[
                { key:'term',         label:'Search term',  align:'left', bold:true },
                { key:'cost',         label:'Wasted spend', render: v => <span style={{ color:'#f59e0b', fontWeight:600 }}>{fmtINRCompact(v)}</span> },
                { key:'impressions',  label:'Impr.',        render: fmtNum },
                { key:'clicks',       label:'Clicks',       render: fmtNum },
                { key:'ctr',          label:'CTR',          render: fmtPct, color: ()=>'var(--red)' },
                { key:'cpc',          label:'CPC',          render: fmtINRCompact },
                { key:'transactions', label:'Conv.',        render: v => <span style={{ color:'#ef4444' }}>{v}</span> },
                { key:'campaignName', label:'Campaign',     render: v => <span style={{ fontSize:11, color:'var(--text3)' }}>{v}</span> },
                { key:'irrelevant',   label:'Action',       render: () => <span style={{ fontSize:10, padding:'2px 8px', borderRadius:5, background:'rgba(245,158,11,0.12)', color:'#f59e0b', border:'0.5px solid rgba(245,158,11,0.3)', cursor:'pointer' }}>Add as negative</span> },
              ]}
              data={irrelevantTerms} defaultSort={{ key:'cost', dir:'desc' }}
            />
          ) : (
            <div style={{ padding:'32px', textAlign:'center', color:'var(--text3)', fontSize:13, background:'var(--bg2)', borderRadius:10, border:'0.5px dashed var(--border2)' }}>
              {hasSearchTerms ? 'No irrelevant search terms detected' : 'Upload Google search terms CSV to detect irrelevant terms'}
            </div>
          )}
        </>
      )}

      {/* ── MoM TAB ──────────────────────────────────────────────────────────── */}
      {tab === 'mom' && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          <Card title="Spend mix — Brand vs NB (MoM)">
            {momTrend.some(m => m.brandCost > 0) ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={momTrend} barSize={18}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize:11, fill:'var(--text3)' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize:11, fill:'var(--text3)' }} axisLine={false} tickLine={false} unit="%" />
                  <Tooltip {...TIP} formatter={(v,n) => [`${v}%`, n]} />
                  <Legend iconType="circle" iconSize={8} formatter={v => <span style={{ fontSize:11, color:'var(--text2)' }}>{v}</span>} />
                  <Bar dataKey="brandPct" fill="var(--green)" name="Brand %" radius={[3,3,0,0]} stackId="a" />
                  <Bar dataKey="nbPct" fill="var(--blue)" name="NB %" radius={[3,3,0,0]} stackId="a" />
                </BarChart>
              </ResponsiveContainer>
            ) : <Empty />}
          </Card>
          <Card title="ROAS trend — Brand vs NB (MoM)">
            {momTrend.some(m => m.brandROAS > 0) ? (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={momTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize:11, fill:'var(--text3)' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize:11, fill:'var(--text3)' }} axisLine={false} tickLine={false} tickFormatter={v => isFinite(v) ? fmtX(v) : '—'} />
                  <Tooltip {...TIP} formatter={(v,n) => [isFinite(v) ? fmtX(v) : '—', n]} />
                  <Legend iconType="circle" iconSize={8} formatter={v => <span style={{ fontSize:11, color:'var(--text2)' }}>{v}</span>} />
                  <Line dataKey="brandROAS" stroke="var(--green)" name="Brand ROAS" strokeWidth={2} dot={{ r:3 }} />
                  <Line dataKey="nbROAS" stroke="var(--blue)" name="NB ROAS" strokeWidth={2} dot={{ r:3 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : <Empty />}
          </Card>
        </div>
      )}
    </div>
  )
}

function BNBFilterBar({ value, onChange, brandCount, nbCount }) {
  return (
    <div style={{ display:'flex', gap:6, marginBottom:12, alignItems:'center' }}>
      <span style={{ fontSize:12, color:'var(--text2)' }}>Show:</span>
      {[['all','All',brandCount+nbCount],['brand','Brand only',brandCount],['nb','Non-brand only',nbCount]].map(([v,l,c]) => (
        <button key={v} onClick={() => onChange(v)} style={{
          padding:'4px 12px', fontSize:12, borderRadius:20, cursor:'pointer',
          background: value===v ? (v==='brand'?'rgba(34,197,94,0.12)':v==='nb'?'rgba(59,130,246,0.12)':'var(--bg3)') : 'transparent',
          color: value===v ? (v==='brand'?'var(--green)':v==='nb'?'var(--blue)':'var(--text)') : 'var(--text2)',
          border: `0.5px solid ${value===v ? (v==='brand'?'rgba(34,197,94,0.3)':v==='nb'?'rgba(59,130,246,0.3)':'var(--border2)') : 'var(--border)'}`,
          fontWeight: value===v ? 500 : 400,
        }}>{l} <span style={{ fontSize:10, opacity:0.7 }}>({c})</span></button>
      ))}
    </div>
  )
}

function StatGrid({ rows }) {
  return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'3px 16px' }}>
      {rows.map(([label, val]) => (
        <div key={label} style={{ display:'flex', justifyContent:'space-between', padding:'3px 0', borderBottom:'1px solid var(--border)', fontSize:12 }}>
          <span style={{ color:'var(--text3)' }}>{label}</span>
          <span style={{ fontWeight:500 }}>{val}</span>
        </div>
      ))}
    </div>
  )
}

function Card({ title, children }) {
  return (
    <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:10, padding:'14px 16px' }}>
      <div style={{ fontSize:12, color:'var(--text3)', marginBottom:10, fontWeight:500 }}>{title}</div>
      {children}
    </div>
  )
}

function Empty({ text='Upload Google data to see trend' }) {
  return <div style={{ height:160, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text3)', fontSize:12 }}>{text}</div>
}

function NoData({ type }) {
  return (
    <div style={{ background:'rgba(239,68,68,0.08)', border:'0.5px solid rgba(239,68,68,0.2)', borderRadius:8, padding:'10px 14px', fontSize:12, color:'#ef4444', marginBottom:12 }}>
      No {type} data — upload the {type} CSV from Upload page (separate from campaigns CSV)
    </div>
  )
}
