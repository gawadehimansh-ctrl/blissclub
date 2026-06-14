import React, { useMemo, useState, useCallback, useEffect } from 'react'
import { useData } from '../data/store.jsx'
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

const SEGMENTS = [
  { key: 'NEW (Prospecting)', label: 'New (Prospecting)', color: '#3b82f6' },
  { key: 'ENGAGED',           label: 'Engaged',           color: '#f59e0b' },
  { key: 'EXISTING',          label: 'Existing',          color: '#1db954' },
  { key: 'UNKNOWN',           label: 'Unknown',           color: '#64748b' },
]

const METRIC_ROWS = [
  'Amount Spent', '% of Overall Spend', 'Purchase Value', 'Cost per Purchase', 'AOV', 'ROAS',
  'CPM', 'CPC', 'CTR', 'CVR', 'LC to LPV', 'LPV to ATC', 'ATC to CI', 'CI to Purchase',
  'Link Clicks', 'LPV', 'Adds to Cart', 'Checkouts', 'Purchases', 'Reach', 'Impressions', 'Frequency',
  'Cost per LPV', 'Cost per ATC',
]

// Parse a single segment sheet (row-per-metric, col-per-day)
function parseSegmentSheet(ws, XLSX) {
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null })
  const headerRow = rows[1] // ['Metric', '60-Day Total', '11-Apr', ...]
  const dayLabels = headerRow.slice(2) // skip Metric + 60-Day Total
  const metrics = {}
  for (let i = 2; i < rows.length; i++) {
    const r = rows[i]
    const name = r[0]
    if (!name || !METRIC_ROWS.includes(name)) continue
    metrics[name] = {
      total: Number(r[1]) || 0,
      daily: r.slice(2).map(v => Number(v) || 0),
    }
  }
  return { dayLabels, metrics }
}

// Parse the 60-Day Summary sheet for the top-level table
function parseSummarySheet(ws, XLSX) {
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null })
  const header = rows[1] // Segment, Spend, %ofTotal, PurchaseValue, Purchases, ROAS, AOV, Cost/Purchase, Reach, Impr, Freq, CPM, CPC, CTR%, LC->LPV, LPV->ATC, ATC->CI, CI->Purchase, CVR
  const out = {}
  for (let i = 2; i < rows.length; i++) {
    const r = rows[i]
    const name = r[0]
    if (!name) continue
    const clean = String(name).replace('▶', '').trim()
    out[clean] = {
      spend: Number(r[1]) || 0,
      pctOfSpend: Number(r[2]) || 0,
      revenue: Number(r[3]) || 0,
      purchases: Number(r[4]) || 0,
      roas: Number(r[5]) || 0,
      aov: Number(r[6]) || 0,
      costPerPurchase: Number(r[7]) || 0,
      reach: Number(r[8]) || 0,
      impressions: Number(r[9]) || 0,
      frequency: Number(r[10]) || 0,
      cpm: Number(r[11]) || 0,
      cpc: Number(r[12]) || 0,
      ctr: Number(r[13]) || 0,
      lcToLpv: Number(r[14]) || 0,
      lpvToAtc: Number(r[15]) || 0,
      atcToCi: Number(r[16]) || 0,
      ciToPurchase: Number(r[17]) || 0,
      cvr: Number(r[18]) || 0,
    }
  }
  return out
}

function Spark({ values, color, w = 100, h = 24 }) {
  const valid = (values || []).filter(v => v !== 0)
  if (valid.length < 2) return null
  const min = Math.min(...values), max = Math.max(...values), range = max - min || 1
  const pts = values.map((v, i) => `${(i/(values.length-1))*w},${h - ((v-min)/range)*(h-4) - 2}`).join(' ')
  return <svg width={w} height={h} style={{display:'block'}}><polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
}

function roasCol(v) {
  if (!v || v <= 0) return 'var(--text3)'
  return v >= 2 ? 'var(--green)' : v >= 1 ? 'var(--amber)' : 'var(--red)'
}

const S = {
  th: { padding:'8px 12px', fontSize:10, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.05em', whiteSpace:'nowrap', background:'var(--bg3)' },
  td: { padding:'8px 12px', borderBottom:'0.5px solid var(--border)', fontSize:12 },
}

const TABS = ['Overview', 'Segment Detail', 'Daily Comparison']

export default function AudienceSegments() {
  const [tab, setTab]         = useState(0)
  const [summary, setSummary] = useState(null)   // { TOTAL, NEW (Prospecting), ENGAGED, ... }
  const [segments, setSegments] = useState(null) // { 'NEW (Prospecting)': {dayLabels, metrics}, ... }
  const [file, setFile]       = useState('')
  const [loading, setLoading] = useState(false)
  const [activeSeg, setActiveSeg] = useState('NEW (Prospecting)')
  const [dateRange, setDateRange] = useState('')

  const { state } = useData()

  useEffect(() => {
    const stored = state.audienceExcel
    if (stored && stored.wb && !summary) {
      loadXLSX().then(XLSX => {
        const wb = stored.wb
        const summaryWs = wb.Sheets['60-Day Summary']
        if (summaryWs) {
          const raw = XLSX.utils.sheet_to_json(summaryWs, { header: 1, defval: null })
          const title = raw[0]?.[0] || ''
          const match = title.match(/\((.*?)\)/)
          if (match) setDateRange(match[1])
          setSummary(parseSummarySheet(summaryWs, XLSX))
        }
        const segData = {}
        for (const seg of SEGMENTS) {
          const ws = wb.Sheets[seg.key]
          if (ws) segData[seg.key] = parseSegmentSheet(ws, XLSX)
        }
        setSegments(segData)
        setFile(stored.fileName)
      })
    }
  }, [state.audienceExcel])

  const handleFile = useCallback(async (f) => {
    if (!f) return
    setLoading(true)
    setFile(f.name)
    const XLSX = await loadXLSX()
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'binary' })
        const summaryWs = wb.Sheets['60-Day Summary']
        if (summaryWs) {
          const raw = XLSX.utils.sheet_to_json(summaryWs, { header: 1, defval: null })
          const title = raw[0]?.[0] || ''
          const match = title.match(/\((.*?)\)/)
          if (match) setDateRange(match[1])
          setSummary(parseSummarySheet(summaryWs, XLSX))
        }
        const segData = {}
        for (const seg of SEGMENTS) {
          const ws = wb.Sheets[seg.key]
          if (ws) segData[seg.key] = parseSegmentSheet(ws, XLSX)
        }
        setSegments(segData)
      } catch(err) { console.error(err) }
      setLoading(false)
    }
    reader.readAsBinaryString(f)
  }, [])

  const total = summary?.['TOTAL (All Segments)'] || summary?.['TOTAL'] || null

  return (
    <div style={{padding:'24px 28px'}}>
      {/* Header */}
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20}}>
        <div>
          <h1 style={{fontSize:22, fontWeight:700, marginBottom:4}}>Audience Segments</h1>
          <div style={{fontSize:12, color:'var(--text3)'}}>
            {summary ? `${file}${dateRange ? ` · ${dateRange}` : ''}` : 'Upload Meta Audience Segment Breakdown export'}
          </div>
        </div>
        {summary && (
          <label style={{fontSize:11, padding:'6px 12px', borderRadius:6, background:'var(--bg3)', border:'0.5px solid var(--border2)', color:'var(--text2)', cursor:'pointer', whiteSpace:'nowrap'}}>
            Replace file
            <input type="file" accept=".xlsx,.xls" style={{display:'none'}} onChange={e=>handleFile(e.target.files?.[0])} />
          </label>
        )}
      </div>

      {/* Upload prompt */}
      {!summary && !loading && (
        <label style={{display:'block', border:'1.5px dashed var(--border2)', borderRadius:12, padding:'48px 24px', textAlign:'center', cursor:'pointer', background:'var(--bg2)', marginBottom:20}}>
          <input type="file" accept=".xlsx,.xls" style={{display:'none'}} onChange={e=>handleFile(e.target.files?.[0])} />
          <div style={{fontSize:32, marginBottom:8}}>👥</div>
          <div style={{fontSize:14, fontWeight:600, marginBottom:4}}>Drop Audience Segment export here</div>
          <div style={{fontSize:11, color:'var(--text3)'}}>60-Day Summary + per-segment daily sheets (New/Engaged/Existing/Unknown)</div>
          <div style={{fontSize:11, color:'var(--blue)', marginTop:8}}>or click to browse</div>
        </label>
      )}
      {loading && <div style={{textAlign:'center', padding:40, color:'var(--text3)', fontSize:13}}>Parsing Excel…</div>}

      {summary && (
        <>
          {/* Tabs */}
          <div style={{display:'flex', gap:0, borderBottom:'0.5px solid var(--border)', marginBottom:20}}>
            {TABS.map((t,i) => (
              <button key={t} onClick={()=>setTab(i)} style={{padding:'8px 18px', fontSize:12, fontWeight:600, cursor:'pointer', color: tab===i ? 'var(--text)' : 'var(--text3)', background:'transparent', border:'none', borderBottom: tab===i ? '2px solid var(--blue)' : '2px solid transparent', transition:'all .15s'}}>
                {t}
              </button>
            ))}
          </div>

          {/* TAB 0: Overview */}
          {tab === 0 && (
            <>
              {/* Total summary cards */}
              {total && (
                <div style={{display:'grid', gridTemplateColumns:'repeat(4,minmax(0,1fr))', gap:10, marginBottom:20}}>
                  {[
                    { label: 'Total Spend', value: fmtINR(total.spend), color: 'var(--text)' },
                    { label: 'Total Revenue', value: fmtINR(total.revenue), color: 'var(--pink)' },
                    { label: 'Blended ROAS', value: fmtX(total.roas), color: roasCol(total.roas) },
                    { label: 'Total Purchases', value: fmtNum(total.purchases), color: 'var(--text)' },
                  ].map(c => (
                    <div key={c.label} style={{background:'var(--bg2)', border:'0.5px solid var(--border)', borderRadius:10, padding:'14px 16px'}}>
                      <div style={{fontSize:10, color:'var(--text3)', marginBottom:6, textTransform:'uppercase', letterSpacing:'0.05em'}}>{c.label}</div>
                      <div style={{fontSize:20, fontWeight:700, color:c.color}}>{c.value}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Segment cards */}
              <div style={{display:'grid', gridTemplateColumns:'repeat(4,minmax(0,1fr))', gap:10, marginBottom:20}}>
                {SEGMENTS.map(seg => {
                  const d = summary[seg.key]
                  if (!d) return null
                  const trend = segments?.[seg.key]?.metrics?.['ROAS']?.daily || []
                  return (
                    <div key={seg.key} onClick={()=>{setActiveSeg(seg.key); setTab(1)}}
                      style={{background:'var(--bg2)', border:`1px solid var(--border)`, borderRadius:10, padding:'14px 16px', cursor:'pointer', transition:'all .15s'}}
                      onMouseEnter={e=>e.currentTarget.style.borderColor=seg.color}
                      onMouseLeave={e=>e.currentTarget.style.borderColor='var(--border)'}>
                      <div style={{display:'flex', justifyContent:'space-between', marginBottom:6}}>
                        <span style={{fontSize:12, fontWeight:700, color:seg.color}}>{seg.label}</span>
                        <span style={{fontSize:10, color:'var(--text3)'}}>{fmtPct(d.pctOfSpend)} of spend</span>
                      </div>
                      <div style={{display:'flex', justifyContent:'space-between', marginBottom:4}}>
                        <span style={{fontSize:10, color:'var(--text3)'}}>Spend</span>
                        <span style={{fontSize:12, fontWeight:600}}>{fmtINRCompact(d.spend)}</span>
                      </div>
                      <div style={{display:'flex', justifyContent:'space-between', marginBottom:4}}>
                        <span style={{fontSize:10, color:'var(--text3)'}}>Revenue</span>
                        <span style={{fontSize:12, fontWeight:600, color:'var(--pink)'}}>{fmtINRCompact(d.revenue)}</span>
                      </div>
                      <div style={{display:'flex', justifyContent:'space-between', marginBottom:8}}>
                        <span style={{fontSize:10, color:'var(--text3)'}}>ROAS</span>
                        <span style={{fontSize:13, fontWeight:700, color:roasCol(d.roas)}}>{fmtX(d.roas)}</span>
                      </div>
                      <Spark values={trend} color={seg.color} w={130} h={22}/>
                    </div>
                  )
                })}
              </div>

              {/* Summary table */}
              <div style={{overflowX:'auto', borderRadius:8, border:'0.5px solid var(--border)'}}>
                <table style={{width:'100%', borderCollapse:'collapse', fontSize:12}}>
                  <thead>
                    <tr>
                      {['Segment','Spend','% Spend','Revenue','Purchases','ROAS','AOV','Cost/Purchase','CPM','CPC','CTR','CVR'].map((h,i) => (
                        <th key={h} style={{...S.th, textAlign: i===0 ? 'left' : 'right'}}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {total && (
                      <tr style={{borderBottom:'1px solid var(--border2)', fontWeight:700}}>
                        <td style={{...S.td, fontWeight:700}}>Total</td>
                        <td style={{...S.td, textAlign:'right'}}>{fmtINR(total.spend)}</td>
                        <td style={{...S.td, textAlign:'right', color:'var(--text3)'}}>{fmtPct(total.pctOfSpend)}</td>
                        <td style={{...S.td, textAlign:'right', color:'var(--pink)'}}>{fmtINR(total.revenue)}</td>
                        <td style={{...S.td, textAlign:'right'}}>{fmtNum(total.purchases)}</td>
                        <td style={{...S.td, textAlign:'right', color:roasCol(total.roas)}}>{fmtX(total.roas)}</td>
                        <td style={{...S.td, textAlign:'right'}}>{fmtINR(total.aov)}</td>
                        <td style={{...S.td, textAlign:'right'}}>{fmtINR(total.costPerPurchase)}</td>
                        <td style={{...S.td, textAlign:'right'}}>{fmtINR(total.cpm)}</td>
                        <td style={{...S.td, textAlign:'right'}}>{fmtINR(total.cpc)}</td>
                        <td style={{...S.td, textAlign:'right'}}>{fmtPct(total.ctr)}</td>
                        <td style={{...S.td, textAlign:'right'}}>{fmtPct(total.cvr)}</td>
                      </tr>
                    )}
                    {SEGMENTS.map(seg => {
                      const d = summary[seg.key]
                      if (!d) return null
                      return (
                        <tr key={seg.key} style={{cursor:'pointer'}}
                          onClick={()=>{setActiveSeg(seg.key); setTab(1)}}
                          onMouseEnter={e=>e.currentTarget.style.background='var(--bg3)'}
                          onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                          <td style={{...S.td, fontWeight:700, color:seg.color}}>{seg.label}</td>
                          <td style={{...S.td, textAlign:'right'}}>{fmtINR(d.spend)}</td>
                          <td style={{...S.td, textAlign:'right', color:'var(--text3)'}}>{fmtPct(d.pctOfSpend)}</td>
                          <td style={{...S.td, textAlign:'right', color:'var(--pink)'}}>{fmtINR(d.revenue)}</td>
                          <td style={{...S.td, textAlign:'right'}}>{fmtNum(d.purchases)}</td>
                          <td style={{...S.td, textAlign:'right', fontWeight:600, color:roasCol(d.roas)}}>{fmtX(d.roas)}</td>
                          <td style={{...S.td, textAlign:'right'}}>{fmtINR(d.aov)}</td>
                          <td style={{...S.td, textAlign:'right'}}>{fmtINR(d.costPerPurchase)}</td>
                          <td style={{...S.td, textAlign:'right'}}>{fmtINR(d.cpm)}</td>
                          <td style={{...S.td, textAlign:'right'}}>{fmtINR(d.cpc)}</td>
                          <td style={{...S.td, textAlign:'right'}}>{fmtPct(d.ctr)}</td>
                          <td style={{...S.td, textAlign:'right'}}>{fmtPct(d.cvr)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Funnel breakdown */}
              <div style={{marginTop:20}}>
                <div style={{fontSize:13, fontWeight:700, marginBottom:12}}>Funnel Conversion by Segment</div>
                <div style={{overflowX:'auto', borderRadius:8, border:'0.5px solid var(--border)'}}>
                  <table style={{width:'100%', borderCollapse:'collapse', fontSize:12}}>
                    <thead>
                      <tr>
                        {['Segment','LC → LPV','LPV → ATC','ATC → CI','CI → Purchase'].map((h,i) => (
                          <th key={h} style={{...S.th, textAlign: i===0 ? 'left' : 'right'}}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {SEGMENTS.map(seg => {
                        const d = summary[seg.key]
                        if (!d) return null
                        return (
                          <tr key={seg.key}>
                            <td style={{...S.td, fontWeight:700, color:seg.color}}>{seg.label}</td>
                            <td style={{...S.td, textAlign:'right'}}>{fmtPct(d.lcToLpv)}</td>
                            <td style={{...S.td, textAlign:'right'}}>{fmtPct(d.lpvToAtc)}</td>
                            <td style={{...S.td, textAlign:'right'}}>{fmtPct(d.atcToCi)}</td>
                            <td style={{...S.td, textAlign:'right'}}>{fmtPct(d.ciToPurchase)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* TAB 1: Segment Detail */}
          {tab === 1 && segments && (
            <>
              <div style={{display:'flex', gap:8, marginBottom:16, flexWrap:'wrap'}}>
                {SEGMENTS.map(seg => (
                  <button key={seg.key} onClick={()=>setActiveSeg(seg.key)}
                    style={{padding:'6px 14px', fontSize:12, fontWeight:600, borderRadius:8, cursor:'pointer',
                      background: activeSeg===seg.key ? seg.color : 'var(--bg3)',
                      border: `0.5px solid ${activeSeg===seg.key ? seg.color : 'var(--border2)'}`,
                      color: activeSeg===seg.key ? '#fff' : 'var(--text2)'}}>
                    {seg.label}
                  </button>
                ))}
              </div>

              {segments[activeSeg] && (
                <div style={{overflowX:'auto', borderRadius:8, border:'0.5px solid var(--border)'}}>
                  <table style={{width:'100%', borderCollapse:'collapse', fontSize:11}}>
                    <thead>
                      <tr>
                        <th style={{...S.th, textAlign:'left', position:'sticky', left:0, background:'var(--bg3)', zIndex:1}}>Metric</th>
                        <th style={{...S.th, textAlign:'right', background:'rgba(66,133,244,0.08)'}}>60-Day Total</th>
                        {segments[activeSeg].dayLabels.map(d => (
                          <th key={d} style={{...S.th, textAlign:'right', minWidth:60}}>{d}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {METRIC_ROWS.map(m => {
                        const data = segments[activeSeg].metrics[m]
                        if (!data) return null
                        const isPct = ['% of Overall Spend','CTR','CVR','LC to LPV','LPV to ATC','ATC to CI','CI to Purchase'].includes(m)
                        const isMoney = ['Amount Spent','Purchase Value','Cost per Purchase','AOV','CPM','CPC','Cost per LPV','Cost per ATC'].includes(m)
                        const fmt = (v) => isPct ? fmtPct(v) : isMoney ? fmtINRCompact(v) : m === 'ROAS' ? fmtX(v) : fmtNum(v)
                        return (
                          <tr key={m}>
                            <td style={{...S.td, fontWeight:600, position:'sticky', left:0, background:'var(--bg)', whiteSpace:'nowrap'}}>{m}</td>
                            <td style={{...S.td, textAlign:'right', background:'rgba(66,133,244,0.04)', fontWeight:600,
                              color: m==='ROAS' ? roasCol(data.total) : 'var(--text)'}}>
                              {fmt(data.total)}
                            </td>
                            {data.daily.map((v,i) => (
                              <td key={i} style={{...S.td, textAlign:'right',
                                color: m==='ROAS' ? roasCol(v) : 'var(--text2)'}}>
                                {v !== 0 ? fmt(v) : '—'}
                              </td>
                            ))}
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {/* TAB 2: Daily Comparison */}
          {tab === 2 && segments && (
            <>
              <div style={{fontSize:12, color:'var(--text3)', marginBottom:14}}>Daily Spend by Segment — last 60 days</div>
              <div style={{overflowX:'auto', borderRadius:8, border:'0.5px solid var(--border)'}}>
                <table style={{width:'100%', borderCollapse:'collapse', fontSize:11}}>
                  <thead>
                    <tr>
                      <th style={{...S.th, textAlign:'left', position:'sticky', left:0, background:'var(--bg3)', zIndex:1}}>Segment</th>
                      <th style={{...S.th, textAlign:'right', background:'rgba(66,133,244,0.08)'}}>60-Day Total</th>
                      {segments[SEGMENTS[0].key]?.dayLabels.map(d => (
                        <th key={d} style={{...S.th, textAlign:'right', minWidth:60}}>{d}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {SEGMENTS.map(seg => {
                      const spendData = segments[seg.key]?.metrics?.['Amount Spent']
                      if (!spendData) return null
                      return (
                        <tr key={seg.key}>
                          <td style={{...S.td, fontWeight:700, color:seg.color, position:'sticky', left:0, background:'var(--bg)'}}>{seg.label}</td>
                          <td style={{...S.td, textAlign:'right', background:'rgba(66,133,244,0.04)', fontWeight:600}}>{fmtINRCompact(spendData.total)}</td>
                          {spendData.daily.map((v,i) => (
                            <td key={i} style={{...S.td, textAlign:'right'}}>{fmtINRCompact(v)}</td>
                          ))}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <div style={{fontSize:12, color:'var(--text3)', margin:'24px 0 14px'}}>Daily ROAS by Segment</div>
              <div style={{overflowX:'auto', borderRadius:8, border:'0.5px solid var(--border)'}}>
                <table style={{width:'100%', borderCollapse:'collapse', fontSize:11}}>
                  <thead>
                    <tr>
                      <th style={{...S.th, textAlign:'left', position:'sticky', left:0, background:'var(--bg3)', zIndex:1}}>Segment</th>
                      <th style={{...S.th, textAlign:'right', background:'rgba(66,133,244,0.08)'}}>60-Day Avg</th>
                      {segments[SEGMENTS[0].key]?.dayLabels.map(d => (
                        <th key={d} style={{...S.th, textAlign:'right', minWidth:60}}>{d}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {SEGMENTS.map(seg => {
                      const roasData = segments[seg.key]?.metrics?.['ROAS']
                      if (!roasData) return null
                      return (
                        <tr key={seg.key}>
                          <td style={{...S.td, fontWeight:700, color:seg.color, position:'sticky', left:0, background:'var(--bg)'}}>{seg.label}</td>
                          <td style={{...S.td, textAlign:'right', background:'rgba(66,133,244,0.04)', fontWeight:600, color:roasCol(roasData.total)}}>{fmtX(roasData.total)}</td>
                          {roasData.daily.map((v,i) => (
                            <td key={i} style={{...S.td, textAlign:'right', color:roasCol(v)}}>{v>0?fmtX(v):'—'}</td>
                          ))}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
