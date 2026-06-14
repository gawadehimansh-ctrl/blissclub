import React, { useMemo, useState, useCallback } from 'react'
import { fmtINR, fmtINRCompact, fmtX, fmtNum, fmtPct } from '../utils/formatters.js'

let _XLSX = null
async function loadXLSX() {
  if (_XLSX) return _XLSX
  return new Promise((resolve) => {
    if (window.XLSX) { _XLSX = window.XLSX; return resolve(window.XLSX) }
    const s = document.createElement('script')
    s.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js'
    s.onload = () => { _XLSX = window.XLSX; resolve(window.XLSX) }
    document.head.appendChild(s)
  })
}

// ── Known metric columns from Meta Ads Manager exports ───────────────────────
const METRIC_COLS = {
  spend:      ['Amount spent (INR)', 'Amount Spent'],
  revenue:    ['Purchases conversion value', 'Purchase Value (INR)'],
  purchases:  ['Purchases'],
  addToCart:  ['Adds to cart'],
  checkouts:  ['Checkouts initiated'],
  lpv:        ['Website landing page views'],
  clicks:     ['Link clicks'],
  impressions:['Impressions'],
  reach:      ['Reach'],
  frequency:  ['Frequency'],
  roas:       ['ROAS'],
  cpm:        ['CPM (cost per 1,000 impressions)', 'CPM'],
  cpc:        ['CPC (cost per link click)', 'CPC'],
  ctr:        ['CTR (link click-through rate)', 'CTR'],
}
const META_KNOWN = new Set([
  ...Object.values(METRIC_COLS).flat(),
  'Cost per purchase','Cost per landing page view','Cost per add to cart','AOV',
  'LC to LPV','LPV to ATC','ATC to CI','CI to Purchase','Conversion %',
  'Reporting starts','Reporting ends','Day',
])

function getCol(row, names) {
  for (const n of names) if (row[n] !== undefined) return row[n]
  return undefined
}
function num(v) { return Number(v) || 0 }

// Parse any "Breakdown by X" Meta export into normalized rows
function parseExport(ws, XLSX) {
  const rows = XLSX.utils.sheet_to_json(ws, { defval: null })
  if (!rows.length) return { rows: [], dimCols: [], dateCol: null }
  const allCols = Object.keys(rows[0])
  const dimCols = allCols.filter(c => !META_KNOWN.has(c))
  const hasAdset = allCols.find(c => c.toLowerCase().includes('ad set') || c.toLowerCase().includes('adset'))

  const out = rows.map(r => {
    const adsetName = hasAdset ? String(r[hasAdset] || '') : ''
    const lower = adsetName.toLowerCase()
    const isCatalog = lower.includes('catalog')
    const date = r['Day'] || r['Reporting starts'] || null
    const dims = {}
    dimCols.forEach(c => { dims[c] = r[c] })
    return {
      dims, date, adsetName,
      bucket: hasAdset ? (isCatalog ? 'catalog' : 'assets') : 'all',
      spend:      num(getCol(r, METRIC_COLS.spend)),
      revenue:    num(getCol(r, METRIC_COLS.revenue)),
      purchases:  num(getCol(r, METRIC_COLS.purchases)),
      addToCart:  num(getCol(r, METRIC_COLS.addToCart)),
      checkouts:  num(getCol(r, METRIC_COLS.checkouts)),
      lpv:        num(getCol(r, METRIC_COLS.lpv)),
      clicks:     num(getCol(r, METRIC_COLS.clicks)),
      impressions:num(getCol(r, METRIC_COLS.impressions)),
      reach:      num(getCol(r, METRIC_COLS.reach)),
    }
  })
  return { rows: out, dimCols, hasAdset: !!hasAdset }
}

// Aggregate rows -> { spend, revenue, roas, purchases, ... }
function agg(rows) {
  const t = rows.reduce((a, r) => ({
    spend: a.spend + r.spend, revenue: a.revenue + r.revenue,
    purchases: a.purchases + r.purchases, addToCart: a.addToCart + r.addToCart,
    checkouts: a.checkouts + r.checkouts, lpv: a.lpv + r.lpv,
    clicks: a.clicks + r.clicks, impressions: a.impressions + r.impressions,
  }), { spend:0, revenue:0, purchases:0, addToCart:0, checkouts:0, lpv:0, clicks:0, impressions:0 })
  return { ...t, roas: t.spend > 0 ? t.revenue / t.spend : 0, cpa: t.purchases > 0 ? t.spend / t.purchases : 0,
    ctr: t.impressions > 0 ? t.clicks / t.impressions : 0 }
}

function roasCol(v) {
  if (!v || v <= 0) return 'var(--text3)'
  return v >= 2.5 ? 'var(--green)' : v >= 1.2 ? 'var(--amber)' : 'var(--red)'
}

const S = {
  th: { padding:'8px 12px', fontSize:10, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.05em', whiteSpace:'nowrap', background:'var(--bg3)' },
  td: { padding:'8px 12px', borderBottom:'0.5px solid var(--border)', fontSize:12 },
  card: { background:'var(--bg2)', border:'0.5px solid var(--border)', borderRadius:10, padding:'14px 16px' },
  label: { fontSize:10, color:'var(--text3)', marginBottom:6, textTransform:'uppercase', letterSpacing:'0.05em' },
}

function MetricCards({ data, title, accent }) {
  return (
    <div style={{...S.card, borderLeft: accent ? `3px solid ${accent}` : undefined}}>
      <div style={{fontSize:12, fontWeight:700, marginBottom:10, color: accent || 'var(--text)'}}>{title}</div>
      <div style={{display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:10}}>
        <div><div style={S.label}>Spend</div><div style={{fontSize:16, fontWeight:700}}>{fmtINR(data.spend)}</div></div>
        <div><div style={S.label}>Revenue</div><div style={{fontSize:16, fontWeight:700, color:'var(--pink)'}}>{fmtINR(data.revenue)}</div></div>
        <div><div style={S.label}>ROAS</div><div style={{fontSize:16, fontWeight:700, color:roasCol(data.roas)}}>{fmtX(data.roas)}</div></div>
        <div><div style={S.label}>Purchases</div><div style={{fontSize:16, fontWeight:700}}>{fmtNum(data.purchases)}</div></div>
        <div><div style={S.label}>CPA</div><div style={{fontSize:14, fontWeight:600}}>{data.cpa>0?fmtINR(data.cpa):'—'}</div></div>
        <div><div style={S.label}>CTR</div><div style={{fontSize:14, fontWeight:600}}>{fmtPct(data.ctr)}</div></div>
      </div>
    </div>
  )
}

// ── Generic breakdown table for a given dataset ───────────────────────────────
function BreakdownTable({ parsed, splitByBucket = true }) {
  const dimCol = parsed.dimCols[0]
  const groups = useMemo(() => {
    const map = {}
    for (const r of parsed.rows) {
      const key = String(r.dims[dimCol] ?? '—')
      if (!map[key]) map[key] = { all: [], catalog: [], assets: [] }
      map[key].all.push(r)
      if (r.bucket === 'catalog') map[key].catalog.push(r)
      else map[key].assets.push(r)
    }
    return Object.entries(map).map(([key, g]) => ({
      key, all: agg(g.all), catalog: agg(g.catalog), assets: agg(g.assets),
    })).sort((a,b) => b.all.spend - a.all.spend)
  }, [parsed, dimCol])

  return (
    <div style={{overflowX:'auto', borderRadius:8, border:'0.5px solid var(--border)'}}>
      <table style={{width:'100%', borderCollapse:'collapse', fontSize:12}}>
        <thead>
          <tr>
            <th style={{...S.th, textAlign:'left'}}>{dimCol || 'Segment'}</th>
            <th style={{...S.th, textAlign:'right'}}>Spend</th>
            <th style={{...S.th, textAlign:'right'}}>Revenue</th>
            <th style={{...S.th, textAlign:'right'}}>ROAS</th>
            <th style={{...S.th, textAlign:'right'}}>Purchases</th>
            <th style={{...S.th, textAlign:'right'}}>CPA</th>
            <th style={{...S.th, textAlign:'right'}}>CTR</th>
            {splitByBucket && parsed.hasAdset && (
              <>
                <th style={{...S.th, textAlign:'right', background:'rgba(29,185,84,0.08)'}}>Assets ROAS</th>
                <th style={{...S.th, textAlign:'right', background:'rgba(167,139,250,0.08)'}}>Catalog ROAS</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {groups.map(g => (
            <tr key={g.key}
              onMouseEnter={e=>e.currentTarget.style.background='var(--bg3)'}
              onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
              <td style={{...S.td, maxWidth:280, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{g.key}</td>
              <td style={{...S.td, textAlign:'right'}}>{fmtINR(g.all.spend)}</td>
              <td style={{...S.td, textAlign:'right', color:'var(--pink)'}}>{fmtINR(g.all.revenue)}</td>
              <td style={{...S.td, textAlign:'right', fontWeight:600, color:roasCol(g.all.roas)}}>{fmtX(g.all.roas)}</td>
              <td style={{...S.td, textAlign:'right'}}>{fmtNum(g.all.purchases)}</td>
              <td style={{...S.td, textAlign:'right'}}>{g.all.cpa>0?fmtINR(g.all.cpa):'—'}</td>
              <td style={{...S.td, textAlign:'right'}}>{fmtPct(g.all.ctr)}</td>
              {splitByBucket && parsed.hasAdset && (
                <>
                  <td style={{...S.td, textAlign:'right', color:roasCol(g.assets.roas)}}>{g.assets.spend>0?fmtX(g.assets.roas):'—'}</td>
                  <td style={{...S.td, textAlign:'right', color:roasCol(g.catalog.roas)}}>{g.catalog.spend>0?fmtX(g.catalog.roas):'—'}</td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Upload box ─────────────────────────────────────────────────────────────────
function UploadBox({ label, hint, onFile, fileName, loading }) {
  return (
    <label style={{display:'block', border:'1.5px dashed var(--border2)', borderRadius:12, padding: fileName ? '14px 18px' : '40px 24px', textAlign: fileName ? 'left' : 'center', cursor:'pointer', background:'var(--bg2)', marginBottom:16}}>
      <input type="file" accept=".xlsx,.xls" style={{display:'none'}} onChange={e=>onFile(e.target.files?.[0])} />
      {fileName ? (
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
          <div style={{fontSize:12}}>✅ {fileName}</div>
          <div style={{fontSize:11, color:'var(--blue)'}}>Replace file</div>
        </div>
      ) : (
        <>
          <div style={{fontSize:28, marginBottom:6}}>📤</div>
          <div style={{fontSize:13, fontWeight:600, marginBottom:4}}>{loading ? 'Parsing…' : label}</div>
          <div style={{fontSize:11, color:'var(--text3)'}}>{hint}</div>
        </>
      )}
    </label>
  )
}

// ── Tab config ────────────────────────────────────────────────────────────────
const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'audience',  label: 'Audience Segments', hint: 'Breakdown by Audience Segment / Age — adset name col required for catalog/asset split' },
  { key: 'funnel',    label: 'Catalog vs Assets', hint: 'Same audience/adset export — split automatically via adset name containing "catalog"' },
  { key: 'device',    label: 'Device', hint: 'Breakdown by Device Platform' },
  { key: 'platform',  label: 'Platform', hint: 'Breakdown by Platform (Facebook/Instagram/etc)' },
  { key: 'placement', label: 'Placement', hint: 'Breakdown by Placement' },
  { key: 'product',   label: 'Product ID', hint: 'Breakdown by Product ID (catalog/DPA)' },
  { key: 'creative',  label: 'Creative', hint: 'Breakdown by Ad name / Creative' },
  { key: 'gokwik',    label: 'Gokwik (Last-Click)', hint: 'Gokwik export — product, subcategory, last-click revenue' },
]


// ── Sub-components to avoid IIFE-in-JSX syntax issues ────────────────────────

function GenericTab({ tab, tabs, data, loading, handleFile, filterRows }) {
  const tc = tabs.find(t => t.key === tab)
  const parsed = data[tab] ? filterRows(data[tab].parsed) : null
  return (
    <div>
      <UploadBox label={`Upload ${tc.label} export`} hint={tc.hint}
        onFile={f => handleFile(tab, f)} fileName={data[tab]?.fileName} loading={loading === tab} />
      {parsed && (
        parsed.dimCols.length === 0
          ? <div style={{fontSize:12, color:'var(--text3)'}}>Couldn't detect a breakdown column in this file.</div>
          : <>
              <div style={{marginBottom:14}}><MetricCards data={agg(parsed.rows)} title="Total (filtered)" /></div>
              <BreakdownTable parsed={parsed} />
            </>
      )}
    </div>
  )
}

function FunnelTab({ data, filterRows }) {
  const primary = Object.entries(data).find(([, d]) => d.parsed.hasAdset)
  if (!primary) return (
    <div style={{fontSize:12, color:'var(--text3)'}}>
      Upload an export with "Ad set name" (e.g. Audience Segments tab) to see the Catalog vs Assets funnel.
    </div>
  )
  const [, d] = primary
  const parsed = filterRows(d.parsed)
  const catalog = agg(parsed.rows.filter(r => r.bucket === 'catalog'))
  const assets  = agg(parsed.rows.filter(r => r.bucket === 'assets'))
  const steps = [
    ['Impressions', assets.impressions, catalog.impressions],
    ['Link Clicks', assets.clicks, catalog.clicks],
    ['Landing Page Views', assets.lpv, catalog.lpv],
    ['Add to Cart', assets.addToCart, catalog.addToCart],
    ['Checkouts', assets.checkouts, catalog.checkouts],
    ['Purchases', assets.purchases, catalog.purchases],
  ]
  const S = {
    th: { padding:'8px 12px', fontSize:10, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.05em', whiteSpace:'nowrap', background:'var(--bg3)' },
    td: { padding:'8px 12px', borderBottom:'0.5px solid var(--border)', fontSize:12 },
  }
  return (
    <>
      <div style={{display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:12, marginBottom:20}}>
        <MetricCards data={assets} title="Assets — Prospecting / Engagement / Existing" accent="#1db954" />
        <MetricCards data={catalog} title="Catalog (DPA / Advantage+ Catalog)" accent="#a78bfa" />
      </div>
      <div style={{overflowX:'auto', borderRadius:8, border:'0.5px solid var(--border)'}}>
        <table style={{width:'100%', borderCollapse:'collapse', fontSize:12}}>
          <thead>
            <tr>
              <th style={{...S.th, textAlign:'left'}}>Funnel Step</th>
              <th style={{...S.th, textAlign:'right'}}>Assets</th>
              <th style={{...S.th, textAlign:'right'}}>Catalog</th>
            </tr>
          </thead>
          <tbody>
            {steps.map(([label, a, c]) => (
              <tr key={label}>
                <td style={{...S.td, fontWeight:600}}>{label}</td>
                <td style={{...S.td, textAlign:'right'}}>{fmtNum(a)}</td>
                <td style={{...S.td, textAlign:'right'}}>{fmtNum(c)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

function GokwikTab({ data, loading, handleFile, filterRows }) {
  const parsed = data.gokwik ? filterRows(data.gokwik.parsed) : null
  return (
    <div>
      <UploadBox label="Upload Gokwik last-click export"
        hint="Columns: Product, Subcategory, Revenue (last-click) — mapped against Meta product IDs"
        onFile={f => handleFile('gokwik', f)} fileName={data.gokwik?.fileName} loading={loading === 'gokwik'} />
      {parsed && (
        <>
          <div style={{marginBottom:14}}><MetricCards data={agg(parsed.rows)} title="Gokwik Last-Click Total" accent="#f59e0b" /></div>
          <BreakdownTable parsed={parsed} splitByBucket={false} />
        </>
      )}
    </div>
  )
}

export default function DemiFineAnalysis() {
  const [tab, setTab] = useState('overview')
  const [data, setData] = useState({}) // { [tabKey]: { parsed, fileName, prevParsed? } }
  const [loading, setLoading] = useState(null)
  const [dateFilter, setDateFilter] = useState('all')

  const handleFile = useCallback(async (key, f) => {
    if (!f) return
    setLoading(key)
    const XLSX = await loadXLSX()
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'binary' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const parsed = parseExport(ws, XLSX)
        setData(prev => ({
          ...prev,
          [key]: { parsed, fileName: f.name, prevParsed: prev[key]?.parsed || null, prevFileName: prev[key]?.fileName || null }
        }))
      } catch(err) { console.error(err) }
      setLoading(null)
    }
    reader.readAsBinaryString(f)
  }, [])

  // Apply date filter to a parsed dataset
  const filterRows = useCallback((parsed) => {
    if (!parsed) return null
    if (dateFilter === 'all') return parsed
    return { ...parsed, rows: parsed.rows.filter(r => r.date === dateFilter) }
  }, [dateFilter])

  // Collect all available dates across uploaded tabs
  const availableDates = useMemo(() => {
    const dates = new Set()
    Object.values(data).forEach(d => {
      d.parsed?.rows.forEach(r => { if (r.date) dates.add(String(r.date)) })
    })
    return [...dates].sort()
  }, [data])

  const S2 = { tabBtn: (active) => ({
    padding:'7px 14px', fontSize:12, fontWeight:600, borderRadius:8, cursor:'pointer', whiteSpace:'nowrap',
    background: active ? 'var(--blue)' : 'var(--bg3)',
    border: `0.5px solid ${active ? 'var(--blue)' : 'var(--border2)'}`,
    color: active ? '#fff' : 'var(--text2)',
  })}

  return (
    <div style={{padding:'24px 28px'}}>
      {/* Header */}
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:16, flexWrap:'wrap', gap:12}}>
        <div>
          <h1 style={{fontSize:22, fontWeight:700, marginBottom:4}}>Demi-Fine Analysis</h1>
          <div style={{fontSize:12, color:'var(--text3)'}}>
            Catalog = adset name contains "catalog" · Assets = everything else
          </div>
        </div>
        {availableDates.length > 1 && (
          <div style={{display:'flex', gap:8, alignItems:'center'}}>
            <span style={{fontSize:11, color:'var(--text3)'}}>Date</span>
            <select value={dateFilter} onChange={e=>setDateFilter(e.target.value)}
              style={{fontSize:11, padding:'5px 10px', borderRadius:6, background:'var(--bg3)', border:'0.5px solid var(--border2)', color:'var(--text)', cursor:'pointer'}}>
              <option value="all">All dates</option>
              {availableDates.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{display:'flex', gap:6, marginBottom:20, flexWrap:'wrap'}}>
        {TABS.map(t => (
          <button key={t.key} onClick={()=>setTab(t.key)} style={S2.tabBtn(tab===t.key)}>
            {t.label}{data[t.key] ? ' ✓' : ''}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW ── */}
      {tab === 'overview' && (
        <>
          {Object.keys(data).length === 0 ? (
            <div style={{textAlign:'center', padding:60, color:'var(--text3)', fontSize:13}}>
              Upload exports in each tab to populate the overview. Start with <b>Audience Segments</b> for the headline numbers.
            </div>
          ) : (
            <>
              {/* Pick first tab with adset data for catalog vs assets summary */}
              {(() => {
                const primary = Object.entries(data).find(([k,d]) => d.parsed.hasAdset)
                if (!primary) return (
                  <div style={{fontSize:12, color:'var(--text3)', marginBottom:20}}>
                    Upload an export that includes "Ad set name" (e.g. Audience Segments) to see Catalog vs Assets split.
                  </div>
                )
                const [, d] = primary
                const parsed = filterRows(d.parsed)
                const all = agg(parsed.rows)
                const catalog = agg(parsed.rows.filter(r=>r.bucket==='catalog'))
                const assets  = agg(parsed.rows.filter(r=>r.bucket==='assets'))
                return (
                  <div style={{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:24}}>
                    <MetricCards data={all} title="Total Demi-Fine" />
                    <MetricCards data={assets} title="Assets (Prospecting/Engagement)" accent="#1db954" />
                    <MetricCards data={catalog} title="Catalog (DPA)" accent="#a78bfa" />
                  </div>
                )
              })()}

              {/* Per-tab summary cards */}
              <div style={{display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10}}>
                {TABS.filter(t => t.key !== 'overview' && t.key !== 'gokwik' && data[t.key]).map(t => {
                  const parsed = filterRows(data[t.key].parsed)
                  const totals = agg(parsed.rows)
                  return (
                    <div key={t.key} style={S.card}>
     