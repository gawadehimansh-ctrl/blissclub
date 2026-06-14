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
}
const META_KNOWN = new Set([
  'Amount spent (INR)','Amount Spent','Purchases conversion value','Purchase Value (INR)',
  'Purchases','Adds to cart','Checkouts initiated','Website landing page views',
  'Link clicks','Impressions','Reach','Frequency','ROAS','CPM (cost per 1,000 impressions)',
  'CPC (cost per link click)','CTR (link click-through rate)','LC to LPV','LPV to ATC',
  'ATC to CI','CI to Purchase','Conversion %','Cost per purchase','Cost per landing page view',
  'Cost per add to cart','AOV','Reporting starts','Reporting ends','Day',
])

function getCol(row, names) {
  for (const n of names) if (row[n] !== undefined) return row[n]
  return undefined
}
function num(v) { return Number(v) || 0 }

function parseExport(ws, XLSX) {
  const rows = XLSX.utils.sheet_to_json(ws, { defval: null })
  if (!rows.length) return { rows: [], dimCols: [], hasAdset: false }
  const allCols = Object.keys(rows[0])
  const dimCols = allCols.filter(c => !META_KNOWN.has(c))
  const hasAdsetCol = allCols.find(c => c.toLowerCase().includes('ad set') || c.toLowerCase().includes('adset'))
  const out = rows.map(r => {
    const adsetName = hasAdsetCol ? String(r[hasAdsetCol] || '') : ''
    const isCatalog = adsetName.toLowerCase().includes('catalog') || adsetName.toLowerCase().includes('auto')
    const date = r['Day'] || r['Reporting starts'] || null
    const dims = {}
    dimCols.forEach(c => { dims[c] = r[c] })
    return {
      dims, date, adsetName,
      bucket: hasAdsetCol ? (isCatalog ? 'catalog' : 'assets') : 'all',
      spend:       num(getCol(r, METRIC_COLS.spend)),
      revenue:     num(getCol(r, METRIC_COLS.revenue)),
      purchases:   num(getCol(r, METRIC_COLS.purchases)),
      addToCart:   num(getCol(r, METRIC_COLS.addToCart)),
      checkouts:   num(getCol(r, METRIC_COLS.checkouts)),
      lpv:         num(getCol(r, METRIC_COLS.lpv)),
      clicks:      num(getCol(r, METRIC_COLS.clicks)),
      impressions: num(getCol(r, METRIC_COLS.impressions)),
      reach:       num(getCol(r, METRIC_COLS.reach)),
    }
  })
  return { rows: out, dimCols, hasAdset: !!hasAdsetCol }
}

function agg(rows) {
  const t = rows.reduce((a, r) => ({
    spend: a.spend + r.spend, revenue: a.revenue + r.revenue,
    purchases: a.purchases + r.purchases, addToCart: a.addToCart + r.addToCart,
    checkouts: a.checkouts + r.checkouts, lpv: a.lpv + r.lpv,
    clicks: a.clicks + r.clicks, impressions: a.impressions + r.impressions,
  }), { spend:0, revenue:0, purchases:0, addToCart:0, checkouts:0, lpv:0, clicks:0, impressions:0 })
  return { ...t,
    roas: t.spend > 0 ? t.revenue / t.spend : 0,
    cpa:  t.purchases > 0 ? t.spend / t.purchases : 0,
    ctr:  t.impressions > 0 ? t.clicks / t.impressions : 0,
  }
}

function roasCol(v) {
  if (!v || v <= 0) return 'var(--text3)'
  return v >= 2.5 ? 'var(--green)' : v >= 1.2 ? 'var(--amber)' : 'var(--red)'
}

const TH = { padding:'8px 12px', fontSize:10, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.05em', whiteSpace:'nowrap', background:'var(--bg3)' }
const TD = { padding:'8px 12px', borderBottom:'0.5px solid var(--border)', fontSize:12 }
const CARD = { background:'var(--bg2)', border:'0.5px solid var(--border)', borderRadius:10, padding:'14px 16px' }

function MetricCards({ data, title, accent }) {
  return (
    <div style={{...CARD, borderLeft: accent ? `3px solid ${accent}` : undefined}}>
      <div style={{fontSize:12, fontWeight:700, marginBottom:10, color: accent || 'var(--text)'}}>{title}</div>
      <div style={{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10}}>
        <div><div style={{fontSize:10, color:'var(--text3)', marginBottom:4}}>Spend</div><div style={{fontSize:15, fontWeight:700}}>{fmtINR(data.spend)}</div></div>
        <div><div style={{fontSize:10, color:'var(--text3)', marginBottom:4}}>Revenue</div><div style={{fontSize:15, fontWeight:700, color:'var(--pink)'}}>{fmtINR(data.revenue)}</div></div>
        <div><div style={{fontSize:10, color:'var(--text3)', marginBottom:4}}>ROAS</div><div style={{fontSize:15, fontWeight:700, color:roasCol(data.roas)}}>{fmtX(data.roas)}</div></div>
        <div><div style={{fontSize:10, color:'var(--text3)', marginBottom:4}}>Purchases</div><div style={{fontSize:14, fontWeight:600}}>{fmtNum(data.purchases)}</div></div>
        <div><div style={{fontSize:10, color:'var(--text3)', marginBottom:4}}>CPA</div><div style={{fontSize:14, fontWeight:600}}>{data.cpa > 0 ? fmtINR(data.cpa) : '—'}</div></div>
        <div><div style={{fontSize:10, color:'var(--text3)', marginBottom:4}}>CTR</div><div style={{fontSize:14, fontWeight:600}}>{fmtPct(data.ctr)}</div></div>
      </div>
    </div>
  )
}

function UploadBox({ label, hint, onFile, fileName, loading }) {
  return (
    <label style={{display:'block', border:'1.5px dashed var(--border2)', borderRadius:12, padding: fileName ? '14px 18px' : '36px 24px', textAlign: fileName ? 'left' : 'center', cursor:'pointer', background:'var(--bg2)', marginBottom:16}}>
      <input type="file" accept=".xlsx,.xls" style={{display:'none'}} onChange={e => onFile(e.target.files?.[0])} />
      {fileName ? (
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
          <div style={{fontSize:12}}>✅ {fileName}</div>
          <div style={{fontSize:11, color:'var(--blue)'}}>Replace</div>
        </div>
      ) : (
        <>
          <div style={{fontSize:26, marginBottom:6}}>📤</div>
          <div style={{fontSize:13, fontWeight:600, marginBottom:4}}>{loading ? 'Parsing…' : label}</div>
          <div style={{fontSize:11, color:'var(--text3)'}}>{hint}</div>
        </>
      )}
    </label>
  )
}

function BreakdownTable({ parsed, splitByBucket }) {
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
    return Object.entries(map)
      .map(([key, g]) => ({ key, all: agg(g.all), catalog: agg(g.catalog), assets: agg(g.assets) }))
      .sort((a, b) => b.all.spend - a.all.spend)
  }, [parsed, dimCol])

  return (
    <div style={{overflowX:'auto', borderRadius:8, border:'0.5px solid var(--border)'}}>
      <table style={{width:'100%', borderCollapse:'collapse', fontSize:12}}>
        <thead>
          <tr>
            <th style={{...TH, textAlign:'left'}}>{dimCol || 'Segment'}</th>
            <th style={{...TH, textAlign:'right'}}>Spend</th>
            <th style={{...TH, textAlign:'right'}}>Revenue</th>
            <th style={{...TH, textAlign:'right'}}>ROAS</th>
            <th style={{...TH, textAlign:'right'}}>Purchases</th>
            <th style={{...TH, textAlign:'right'}}>CPA</th>
            <th style={{...TH, textAlign:'right'}}>CTR</th>
            {splitByBucket && parsed.hasAdset && (
              <>
                <th style={{...TH, textAlign:'right', background:'rgba(29,185,84,0.08)'}}>Assets ROAS</th>
                <th style={{...TH, textAlign:'right', background:'rgba(167,139,250,0.08)'}}>Catalog ROAS</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {groups.map(g => (
            <tr key={g.key}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg3)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <td style={{...TD, maxWidth:280, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{g.key}</td>
              <td style={{...TD, textAlign:'right'}}>{fmtINR(g.all.spend)}</td>
              <td style={{...TD, textAlign:'right', color:'var(--pink)'}}>{fmtINR(g.all.revenue)}</td>
              <td style={{...TD, textAlign:'right', fontWeight:600, color:roasCol(g.all.roas)}}>{fmtX(g.all.roas)}</td>
              <td style={{...TD, textAlign:'right'}}>{fmtNum(g.all.purchases)}</td>
              <td style={{...TD, textAlign:'right'}}>{g.all.cpa > 0 ? fmtINR(g.all.cpa) : '—'}</td>
              <td style={{...TD, textAlign:'right'}}>{fmtPct(g.all.ctr)}</td>
              {splitByBucket && parsed.hasAdset && (
                <>
                  <td style={{...TD, textAlign:'right', color:roasCol(g.assets.roas)}}>{g.assets.spend > 0 ? fmtX(g.assets.roas) : '—'}</td>
                  <td style={{...TD, textAlign:'right', color:roasCol(g.catalog.roas)}}>{g.catalog.spend > 0 ? fmtX(g.catalog.roas) : '—'}</td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const TABS = [
  { key: 'overview',  label: 'Overview' },
  { key: 'audience',  label: 'Audience', hint: 'Breakdown by Audience Segment / Age' },
  { key: 'funnel',    label: 'Catalog vs Assets', hint: 'Auto-split via adset name containing "catalog" or "auto"' },
  { key: 'device',    label: 'Device', hint: 'Breakdown by Device Platform' },
  { key: 'platform',  label: 'Platform', hint: 'Breakdown by Platform (Facebook/Instagram/etc)' },
  { key: 'placement', label: 'Placement', hint: 'Breakdown by Placement' },
  { key: 'product',   label: 'Product ID', hint: 'Breakdown by Product ID' },
  { key: 'creative',  label: 'Creative', hint: 'Breakdown by Ad name / Creative' },
  { key: 'gokwik',    label: 'Gokwik', hint: 'Gokwik last-click export — product, subcategory, revenue' },
]

const GENERIC_TABS = ['audience','device','platform','placement','product','creative']
const FUNNEL_STEPS = ['impressions','clicks','lpv','addToCart','checkouts','purchases']
const FUNNEL_LABELS = ['Impressions','Link Clicks','Landing Page Views','Add to Cart','Checkouts','Purchases']

export default function DemiFineAnalysis() {
  const [tab, setTab] = useState('overview')
  const [data, setData] = useState({})
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
          [key]: { parsed, fileName: f.name, prevParsed: prev[key]?.parsed || null }
        }))
      } catch(err) { console.error(err) }
      setLoading(null)
    }
    reader.readAsBinaryString(f)
  }, [])

  const filterRows = useCallback((parsed) => {
    if (!parsed || dateFilter === 'all') return parsed
    return { ...parsed, rows: parsed.rows.filter(r => r.date === dateFilter) }
  }, [dateFilter])

  const availableDates = useMemo(() => {
    const dates = new Set()
    Object.values(data).forEach(d => {
      d.parsed?.rows.forEach(r => { if (r.date) dates.add(String(r.date)) })
    })
    return [...dates].sort()
  }, [data])

  // Find first dataset with adset split for overview + funnel
  const primaryData = useMemo(() => {
    const entry = Object.entries(data).find(([, d]) => d.parsed.hasAdset)
    if (!entry) return null
    return filterRows(entry[1].parsed)
  }, [data, filterRows])

  const activeTab = TABS.find(t => t.key === tab)

  return (
    <div style={{padding:'24px 28px'}}>
      {/* Header */}
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:16, flexWrap:'wrap', gap:12}}>
        <div>
          <h1 style={{fontSize:22, fontWeight:700, marginBottom:4}}>Demi-Fine Analysis</h1>
          <div style={{fontSize:12, color:'var(--text3)'}}>Catalog = adset contains "catalog" or "auto" · Assets = everything else</div>
        </div>
        {availableDates.length > 1 && (
          <div style={{display:'flex', gap:8, alignItems:'center'}}>
            <span style={{fontSize:11, color:'var(--text3)'}}>Date</span>
            <select value={dateFilter} onChange={e => setDateFilter(e.target.value)}
              style={{fontSize:11, padding:'5px 10px', borderRadius:6, background:'var(--bg3)', border:'0.5px solid var(--border2)', color:'var(--text)', cursor:'pointer'}}>
              <option value="all">All dates</option>
              {availableDates.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* Tab bar */}
      <div style={{display:'flex', gap:6, marginBottom:20, flexWrap:'wrap'}}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding:'7px 14px', fontSize:12, fontWeight:600, borderRadius:8, cursor:'pointer', whiteSpace:'nowrap',
            background: tab === t.key ? 'var(--blue)' : 'var(--bg3)',
            border: `0.5px solid ${tab === t.key ? 'var(--blue)' : 'var(--border2)'}`,
            color: tab === t.key ? '#fff' : 'var(--text2)',
          }}>
            {t.label}{data[t.key] ? ' ✓' : ''}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW ── */}
      {tab === 'overview' && (
        <div>
          {Object.keys(data).length === 0 && (
            <div style={{textAlign:'center', padding:60, color:'var(--text3)', fontSize:13}}>
              Upload exports in each tab to populate the overview. Start with <b>Audience</b> for headline numbers.
            </div>
          )}

          {primaryData && (
            <div style={{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:24}}>
              <MetricCards data={agg(primaryData.rows)} title="Total Demi-Fine" />
              <MetricCards data={agg(primaryData.rows.filter(r => r.bucket === 'assets'))} title="Assets" accent="#1db954" />
              <MetricCards data={agg(primaryData.rows.filter(r => r.bucket === 'catalog'))} title="Catalog (DPA)" accent="#a78bfa" />
            </div>
          )}

          {/* Per-tab summary */}
          {Object.keys(data).length > 0 && (
            <div style={{display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:24}}>
              {TABS.filter(t => t.key !== 'overview' && t.key !== 'gokwik' && data[t.key]).map(t => {
                const parsed = filterRows(data[t.key].parsed)
                const totals = agg(parsed.rows)
                return (
                  <div key={t.key} style={CARD}>
                    <div style={{fontSize:11, fontWeight:700, marginBottom:8, color:'var(--text2)'}}>{t.label}</div>
                    <div style={{display:'flex', justifyContent:'space-between', marginBottom:4}}>
                      <span style={{fontSize:10, color:'var(--text3)'}}>Spend</span>
                      <span style={{fontSize:12, fontWeight:600}}>{fmtINRCompact(totals.spend)}</span>
                    </div>
                    <div style={{display:'flex', justifyContent:'space-between'}}>
                      <span style={{fontSize:10, color:'var(--text3)'}}>ROAS</span>
                      <span style={{fontSize:13, fontWeight:700, color:roasCol(totals.roas)}}>{fmtX(totals.roas)}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Day vs Day comparison */}
          {Object.entries(data).some(([, d]) => d.prevParsed) && (
            <div>
              <div style={{fontSize:13, fontWeight:700, marginBottom:12}}>Day vs Day Comparison</div>
              <div style={{overflowX:'auto', borderRadius:8, border:'0.5px solid var(--border)'}}>
                <table style={{width:'100%', borderCollapse:'collapse', fontSize:12}}>
                  <thead>
                    <tr>
                      {['Dataset','Prev Spend','New Spend','Δ Spend','Prev ROAS','New ROAS','Δ ROAS'].map((h,i) => (
                        <th key={h} style={{...TH, textAlign: i === 0 ? 'left' : 'right'}}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {TABS.filter(t => data[t.key]?.prevParsed).map(t => {
                      const prev = agg(data[t.key].prevParsed.rows)
                      const curr = agg(data[t.key].parsed.rows)
                      const dS = curr.spend - prev.spend
                      const dR = curr.roas - prev.roas
                      return (
                        <tr key={t.key}>
                          <td style={{...TD, fontWeight:600}}>{t.label}</td>
                          <td style={{...TD, textAlign:'right', color:'var(--text3)'}}>{fmtINRCompact(prev.spend)}</td>
                          <td style={{...TD, textAlign:'right'}}>{fmtINRCompact(curr.spend)}</td>
                          <td style={{...TD, textAlign:'right', color: dS >= 0 ? 'var(--green)' : 'var(--red)'}}>{dS >= 0 ? '+' : ''}{fmtINRCompact(dS)}</td>
                          <td style={{...TD, textAlign:'right', color:'var(--text3)'}}>{fmtX(prev.roas)}</td>
                          <td style={{...TD, textAlign:'right', color:roasCol(curr.roas)}}>{fmtX(curr.roas)}</td>
                          <td style={{...TD, textAlign:'right', color: dR >= 0 ? 'var(--green)' : 'var(--red)'}}>{dR >= 0 ? '+' : ''}{fmtX(dR)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── GENERIC BREAKDOWN TABS ── */}
      {GENERIC_TABS.includes(tab) && (
        <div>
          <UploadBox
            label={`Upload ${activeTab.label} export`}
            hint={activeTab.hint}
            onFile={f => handleFile(tab, f)}
            fileName={data[tab]?.fileName}
            loading={loading === tab}
          />
          {data[tab] && (
            <div>
              {filterRows(data[tab].parsed).dimCols.length === 0 ? (
                <div style={{fontSize:12, color:'var(--text3)'}}>No breakdown column detected.</div>
              ) : (
                <div>
                  <div style={{marginBottom:14}}>
                    <MetricCards data={agg(filterRows(data[tab].parsed).rows)} title="Total" />
                  </div>
                  <BreakdownTable parsed={filterRows(data[tab].parsed)} splitByBucket={true} />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── CATALOG VS ASSETS FUNNEL ── */}
      {tab === 'funnel' && (
        <div>
          {!primaryData ? (
            <div style={{fontSize:12, color:'var(--text3)', padding:20}}>
              Upload an export with "Ad set name" column (e.g. Audience tab) to see the funnel split.
            </div>
          ) : (
            <div>
              <div style={{display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:12, marginBottom:20}}>
                <MetricCards data={agg(primaryData.rows.filter(r => r.bucket === 'assets'))} title="Assets" accent="#1db954" />
                <MetricCards data={agg(primaryData.rows.filter(r => r.bucket === 'catalog'))} title="Catalog (DPA / Advantage+)" accent="#a78bfa" />
              </div>
              <div style={{overflowX:'auto', borderRadius:8, border:'0.5px solid var(--border)'}}>
                <table style={{width:'100%', borderCollapse:'collapse', fontSize:12}}>
                  <thead>
                    <tr>
                      <th style={{...TH, textAlign:'left'}}>Funnel Step</th>
                      <th style={{...TH, textAlign:'right'}}>Assets</th>
                      <th style={{...TH, textAlign:'right'}}>Catalog</th>
                    </tr>
                  </thead>
                  <tbody>
                    {FUNNEL_STEPS.map((key, i) => {
                      const assetsVal = agg(primaryData.rows.filter(r => r.bucket === 'assets'))[key]
                      const catalogVal = agg(primaryData.rows.filter(r => r.bucket === 'catalog'))[key]
                      return (
                        <tr key={key}>
                          <td style={{...TD, fontWeight:600}}>{FUNNEL_LABELS[i]}</td>
                          <td style={{...TD, textAlign:'right'}}>{fmtNum(assetsVal)}</td>
                          <td style={{...TD, textAlign:'right'}}>{fmtNum(catalogVal)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── GOKWIK ── */}
      {tab === 'gokwik' && (
        <div>
          <UploadBox
            label="Upload Gokwik last-click export"
            hint="Columns: Product, Subcategory, Revenue (last-click)"
            onFile={f => handleFile('gokwik', f)}
            fileName={data.gokwik?.fileName}
            loading={loading === 'gokwik'}
          />
          {data.gokwik && (
            <div>
              <div style={{marginBottom:14}}>
                <MetricCards data={agg(filterRows(data.gokwik.parsed).rows)} title="Gokwik Last-Click Total" accent="#f59e0b" />
              </div>
              <BreakdownTable parsed={filterRows(data.gokwik.parsed)} splitByBucket={false} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
