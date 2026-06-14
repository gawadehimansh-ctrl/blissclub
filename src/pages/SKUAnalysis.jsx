import React, { useMemo, useState, useCallback, useEffect } from 'react'
import { useData } from '../data/store.jsx'
import { fmtINR, fmtINRCompact, fmtX } from '../utils/formatters.js'

const BUCKETS = [
  { id: 1, label: 'Bucket 1', range: 'Top 265',     skuRange: [1, 265],        color: '#1db954' },
  { id: 2, label: 'Bucket 2', range: '266–500',     skuRange: [266, 500],      color: '#6366f1' },
  { id: 3, label: 'Bucket 3', range: '501–1,000',   skuRange: [501, 1000],     color: '#3b82f6' },
  { id: 4, label: 'Bucket 4', range: '1,001–1,500', skuRange: [1001, 1500],    color: '#f59e0b' },
  { id: 5, label: 'Bucket 5', range: '1,501–2,000', skuRange: [1501, 2000],    color: '#e8457a' },
  { id: 6, label: 'Bucket 6', range: '2,001–2,500', skuRange: [2001, 2500],    color: '#8b5cf6' },
  { id: 7, label: 'Bucket 7', range: '2,501–3,000', skuRange: [2501, 3000],    color: '#06b6d4' },
  { id: 8, label: 'Bucket 8', range: '3,001+',      skuRange: [3001, Infinity],color: '#64748b' },
]

const MONTHS = ['Nov-2025','Dec-2025','Jan-2026','Feb-2026','Mar-2026','Apr-2026','May-2026']
const MONTH_SHORT = ['Nov','Dec','Jan','Feb','Mar','Apr','May']
const TABS = ['Bucket Overview', 'SKU Master', 'Daily Tracker']

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

function parseMaster(ws, XLSX) {
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null })
  const skus = []
  for (let i = 3; i < rows.length; i++) {
    const r = rows[i]
    if (!r || !r[1]) continue
    const sku = { rank: Number(r[0]) || i - 2, name: String(r[1]), top50: r[2] === '✓', bucket: r[27] || '', months: {}, total: {} }
    MONTHS.forEach((m, mi) => {
      const base = 3 + mi * 3
      sku.months[m] = { revenue: parseFloat(r[base]) || 0, spend: parseFloat(r[base+1]) || 0, roas: parseFloat(r[base+2]) || 0 }
    })
    sku.total = { revenue: parseFloat(r[24]) || 0, spend: parseFloat(r[25]) || 0, roas: parseFloat(r[26]) || 0 }
    skus.push(sku)
  }
  return skus
}

function parseBucketing(ws, XLSX) {
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null })
  const result = {}
  let curBucket = null
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i]
    if (r[0]) curBucket = r[0]
    if (!curBucket || !r[2]) continue
    if (!result[curBucket]) result[curBucket] = { avg: {}, total: {}, days: {} }
    const metric = r[2]
    const avg = parseFloat(r[3]) || 0
    const tot = parseFloat(r[4]) || 0
    const key = metric === 'Rev %' ? 'rev' : metric === 'Spend %' ? 'spend' : 'roas'
    result[curBucket].avg[key] = avg
    result[curBucket].total[key] = tot
    for (let d = 0; d < 9; d++) {
      const dk = `${d+1}`
      if (!result[curBucket].days[dk]) result[curBucket].days[dk] = {}
      result[curBucket].days[dk][key] = parseFloat(r[5+d]) || 0
    }
  }
  return result
}

function Spark({ values, color, w = 80, h = 22 }) {
  const valid = (values || []).filter(v => v > 0)
  if (valid.length < 2) return null
  const min = Math.min(...valid), max = Math.max(...valid), range = max - min || 1
  const pts = values.map((v, i) => `${(i/(values.length-1))*w},${h - ((v-min)/range)*(h-4) - 2}`).join(' ')
  return <svg width={w} height={h} style={{display:'block'}}><polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
}

function roasCol(v) {
  if (!v || v <= 0) return 'var(--text3)'
  return v >= 3 ? 'var(--green)' : v >= 1.5 ? 'var(--amber)' : 'var(--red)'
}

const S = {
  th: { padding:'8px 12px', fontSize:10, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.05em', whiteSpace:'nowrap', background:'var(--bg3)' },
  td: { padding:'8px 12px', borderBottom:'0.5px solid var(--border)', fontSize:12 },
}

export default function SKUAnalysis() {
  const [tab, setTab]         = useState(0)
  const [skus, setSkus]       = useState(null)
  const [bkt, setBkt]         = useState(null)
  const [file, setFile]       = useState('')
  const [loading, setLoading] = useState(false)
  const [bucket, setBucket]   = useState(null)
  const [month, setMonth]     = useState('total')
  const [q, setQ]             = useState('')

  const { state } = useData()

  useEffect(() => {
    const stored = state.skuExcel
    if (stored && stored.wb && !skus) {
      loadXLSX().then(XLSX => {
        const wb = stored.wb
        if (wb.Sheets['Master'])    setSkus(parseMaster(wb.Sheets['Master'], XLSX))
        if (wb.Sheets['Bucketing']) setBkt(parseBucketing(wb.Sheets['Bucketing'], XLSX))
        setFile(stored.fileName)
      })
    }
  }, [state.skuExcel])

  const handleFile = useCallback(async (f) => {
    if (!f) return
    setLoading(true)
    setFile(f.name)
    const XLSX = await loadXLSX()
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'binary' })
        if (wb.Sheets['Master'])    setSkus(parseMaster(wb.Sheets['Master'], XLSX))
        if (wb.Sheets['Bucketing']) setBkt(parseBucketing(wb.Sheets['Bucketing'], XLSX))
      } catch(err) { console.error(err) }
      setLoading(false)
    }
    reader.readAsBinaryString(f)
  }, [])

  const bucketStats = useMemo(() => {
    if (!skus) return BUCKETS.map(b => ({ ...b, skuCount: 0, revenue: 0, spend: 0, roas: 0, trend: [] }))
    return BUCKETS.map(b => {
      const rows = skus.filter(s => s.rank >= b.skuRange[0] && s.rank <= b.skuRange[1])
      const get = (s) => month === 'total' ? s.total : (s.months[month] || { revenue:0, spend:0, roas:0 })
      const rev   = rows.reduce((sum,s) => sum + get(s).revenue, 0)
      const spend = rows.reduce((sum,s) => sum + get(s).spend, 0)
      const trend = MONTHS.map(m => rows.reduce((sum,s) => sum + (s.months[m]?.revenue||0), 0))
      return { ...b, skuCount: rows.length, revenue: rev, spend, roas: spend>0 ? rev/spend : 0, trend }
    })
  }, [skus, month])

  const masterRows = useMemo(() => {
    if (!skus) return []
    return skus
      .filter(s => !q || s.name.toLowerCase().includes(q.toLowerCase()))
      .filter(s => !bucket || (s.rank >= BUCKETS[bucket-1]?.skuRange[0] && s.rank <= BUCKETS[bucket-1]?.skuRange[1]))
      .slice(0, 500)
  }, [skus, q, bucket])

  const juneDays = ['1','2','3','4','5','6','7','8','9']

  return (
    <div style={{padding:'24px 28px'}}>
      {/* Header */}
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20}}>
        <div>
          <h1 style={{fontSize:22, fontWeight:700, marginBottom:4}}>SKU Analysis</h1>
          <div style={{fontSize:12, color:'var(--text3)'}}>
            {skus ? `${skus.length} SKUs · ${file}` : 'Upload SKU bucketing Excel to begin'}
          </div>
        </div>
        <div style={{display:'flex', gap:8, alignItems:'center'}}>
          {skus && (
            <select value={month} onChange={e=>setMonth(e.target.value)}
              style={{fontSize:11, padding:'5px 8px', borderRadius:6, background:'var(--bg3)', border:'0.5px solid var(--border2)', color:'var(--text)', cursor:'pointer'}}>
              <option value="total">7-Month Total</option>
              {MONTHS.map((m,i) => <option key={m} value={m}>{MONTH_SHORT[i]} {m.slice(-4)}</option>)}
            </select>
          )}
          <label style={{fontSize:11, padding:'6px 12px', borderRadius:6, background:'var(--bg3)', border:'0.5px solid var(--border2)', color:'var(--text2)', cursor:'pointer', whiteSpace:'nowrap'}}>
            {loading ? 'Parsing…' : skus ? 'Replace file' : '+ Upload Excel'}
            <input type="file" accept=".xlsx,.xls" style={{display:'none'}} onChange={e=>handleFile(e.target.files?.[0])} />
          </label>
        </div>
      </div>

      {/* Upload prompt */}
      {!skus && !loading && (
        <label style={{display:'block', border:'1.5px dashed var(--border2)', borderRadius:12, padding:'48px 24px', textAlign:'center', cursor:'pointer', background:'var(--bg2)', marginBottom:20}}>
          <input type="file" accept=".xlsx,.xls" style={{display:'none'}} onChange={e=>handleFile(e.target.files?.[0])} />
          <div style={{fontSize:32, marginBottom:8}}>📊</div>
          <div style={{fontSize:14, fontWeight:600, marginBottom:4}}>Drop SKU Bucketing Excel here</div>
          <div style={{fontSize:11, color:'var(--text3)'}}>Needs a Master sheet and a Bucketing sheet · same format as reference file</div>
          <div style={{fontSize:11, color:'var(--blue)', marginTop:8}}>or click to browse</div>
        </label>
      )}
      {loading && <div style={{textAlign:'center', padding:40, color:'var(--text3)', fontSize:13}}>Parsing Excel…</div>}

      {/* Tabs */}
      <div style={{display:'flex', gap:0, borderBottom:'0.5px solid var(--border)', marginBottom:20}}>
        {TABS.map((t,i) => (
          <button key={t} onClick={()=>setTab(i)} style={{padding:'8px 18px', fontSize:12, fontWeight:600, cursor:'pointer', color: tab===i ? 'var(--text)' : 'var(--text3)', background:'transparent', border:'none', borderBottom: tab===i ? '2px solid var(--blue)' : '2px solid transparent', transition:'all .15s'}}>
            {t}
          </button>
        ))}
      </div>

      {/* ── TAB 0: Bucket Overview ────────────────────────────────── */}
      {tab === 0 && (
        <>
          <div style={{display:'grid', gridTemplateColumns:'repeat(4,minmax(0,1fr))', gap:10, marginBottom:20}}>
            {bucketStats.map(b => (
              <div key={b.id} onClick={()=>setBucket(bucket===b.id ? null : b.id)}
                style={{background: bucket===b.id ? `${b.color}14` : 'var(--bg2)', border:`1px solid ${bucket===b.id ? b.color : 'var(--border)'}`, borderRadius:10, padding:'14px 16px', cursor:'pointer', transition:'all .15s'}}>
                <div style={{display:'flex', justifyContent:'space-between', marginBottom:6}}>
                  <span style={{fontSize:12, fontWeight:700, color:b.color}}>{b.label}</span>
                  <span style={{fontSize:10, color:'var(--text3)'}}>{b.skuCount} SKUs</span>
                </div>
                <div style={{fontSize:10, color:'var(--text3)', marginBottom:10}}>{b.range}</div>
                <div style={{display:'flex', justifyContent:'space-between', marginBottom:4}}>
                  <span style={{fontSize:10, color:'var(--text3)'}}>Revenue</span>
                  <span style={{fontSize:12, fontWeight:600, color:b.color}}>{fmtINRCompact(b.revenue)}</span>
                </div>
                <div style={{display:'flex', justifyContent:'space-between', marginBottom:8}}>
                  <span style={{fontSize:10, color:'var(--text3)'}}>ROAS</span>
                  <span style={{fontSize:13, fontWeight:700, color:roasCol(b.roas)}}>{fmtX(b.roas)}</span>
                </div>
                <Spark values={b.trend} color={b.color} w={120} h={22}/>
              </div>
            ))}
          </div>

          {/* Summary table */}
          <div style={{overflowX:'auto', borderRadius:8, border:'0.5px solid var(--border)', marginBottom: bucket ? 16 : 0}}>
            <table style={{width:'100%', borderCollapse:'collapse', fontSize:12}}>
              <thead>
                <tr>
                  {['Bucket','Range','SKUs','Revenue','Spend','ROAS',...MONTH_SHORT].map((h,i) => (
                    <th key={h} style={{...S.th, textAlign: i<2 ? 'left' : 'right'}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bucketStats.map(b => (
                  <tr key={b.id} style={{cursor:'pointer'}}
                    onClick={()=>{ setBucket(b.id); setTab(1) }}
                    onMouseEnter={e=>e.currentTarget.style.background='var(--bg3)'}
                    onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                    <td style={{...S.td, fontWeight:700, color:b.color}}>{b.label}</td>
                    <td style={{...S.td, color:'var(--text3)', fontSize:11}}>{b.range}</td>
                    <td style={{...S.td, textAlign:'right'}}>{b.skuCount}</td>
                    <td style={{...S.td, textAlign:'right', color:'var(--purple)'}}>{fmtINR(b.revenue)}</td>
                    <td style={{...S.td, textAlign:'right'}}>{fmtINR(b.spend)}</td>
                    <td style={{...S.td, textAlign:'right', fontWeight:600, color:roasCol(b.roas)}}>{fmtX(b.roas)}</td>
                    {skus ? MONTHS.map(m => {
                      const rows = skus.filter(s => s.rank >= b.skuRange[0] && s.rank <= b.skuRange[1])
                      const rev = rows.reduce((sum,s)=>sum+(s.months[m]?.revenue||0),0)
                      const sp  = rows.reduce((sum,s)=>sum+(s.months[m]?.spend||0),0)
                      const r   = sp > 0 ? rev/sp : 0
                      return <td key={m} style={{...S.td, textAlign:'right', color:roasCol(r), fontSize:11}}>{r>0 ? fmtX(r) : '—'}</td>
                    }) : MONTHS.map(m => <td key={m} style={{...S.td, textAlign:'right', color:'var(--text3)'}}>—</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── TAB 1: SKU Master ────────────────────────────────────── */}
      {tab === 1 && (
        <>
          <div style={{display:'flex', gap:8, marginBottom:12, flexWrap:'wrap', alignItems:'center'}}>
            <input placeholder="Search SKU…" value={q} onChange={e=>setQ(e.target.value)}
              style={{flex:1, minWidth:180, padding:'7px 12px', borderRadius:8, background:'var(--bg3)', border:'0.5px solid var(--border2)', color:'var(--text)', fontSize:12}}/>
            <button onClick={()=>setBucket(null)}
              style={{padding:'5px 12px', fontSize:11, borderRadius:6, background:!bucket?'var(--blue)':'var(--bg3)', border:'0.5px solid var(--border2)', color:!bucket?'#fff':'var(--text2)', cursor:'pointer'}}>All</button>
            {BUCKETS.map(b => (
              <button key={b.id} onClick={()=>setBucket(bucket===b.id?null:b.id)}
                style={{padding:'5px 10px', fontSize:11, borderRadius:6, background:bucket===b.id?b.color:'var(--bg3)', border:`0.5px solid ${bucket===b.id?b.color:'var(--border2)'}`, color:bucket===b.id?'#fff':'var(--text2)', cursor:'pointer'}}>
                {b.label}
              </button>
            ))}
          </div>

          {!skus ? (
            <div style={{textAlign:'center', padding:40, color:'var(--text3)'}}>Upload Excel to see SKU data</div>
          ) : (
            <div style={{overflowX:'auto', borderRadius:8, border:'0.5px solid var(--border)'}}>
              <table style={{width:'100%', borderCollapse:'collapse', fontSize:12}}>
                <thead>
                  <tr>
                    <th style={{...S.th, textAlign:'right', width:40}}>#</th>
                    <th style={{...S.th, textAlign:'left'}}>Product</th>
                    <th style={{...S.th, textAlign:'center'}}>Bucket</th>
                    <th style={{...S.th, textAlign:'right'}}>Total Rev</th>
                    <th style={{...S.th, textAlign:'right'}}>Total Spend</th>
                    <th style={{...S.th, textAlign:'right'}}>ROAS</th>
                    {MONTH_SHORT.map(m => <th key={m} style={{...S.th, textAlign:'right', minWidth:64}}>{m}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {masterRows.map((s,i) => {
                    const b = BUCKETS.find(b => s.rank >= b.skuRange[0] && s.rank <= b.skuRange[1])
                    return (
                      <tr key={i}
                        onMouseEnter={e=>e.currentTarget.style.background='var(--bg3)'}
                        onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                        <td style={{...S.td, textAlign:'right', color:'var(--text3)'}}>{s.rank}</td>
                        <td style={{...S.td, maxWidth:260, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>
                          {s.top50 && <span style={{fontSize:9, background:'rgba(29,185,84,0.12)', color:'var(--green)', padding:'1px 5px', borderRadius:3, marginRight:6}}>TOP</span>}
                          {s.name}
                        </td>
                        <td style={{...S.td, textAlign:'center'}}>
                          <span style={{fontSize:10, color:b?.color, fontWeight:600}}>{b?.label}</span>
                        </td>
                        <td style={{...S.td, textAlign:'right', color:'var(--purple)'}}>{fmtINR(s.total.revenue)}</td>
                        <td style={{...S.td, textAlign:'right'}}>{fmtINR(s.total.spend)}</td>
                        <td style={{...S.td, textAlign:'right', fontWeight:600, color:roasCol(s.total.roas)}}>{fmtX(s.total.roas)}</td>
                        {MONTHS.map(m => (
                          <td key={m} style={{...S.td, textAlign:'right'}}>
                            <div style={{color:roasCol(s.months[m]?.roas), fontWeight:500}}>{s.months[m]?.roas > 0 ? fmtX(s.months[m].roas) : '—'}</div>
                            <div style={{color:'var(--text3)', fontSize:10}}>{s.months[m]?.revenue > 0 ? fmtINRCompact(s.months[m].revenue) : ''}</div>
                          </td>
                        ))}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {masterRows.length === 500 && <div style={{textAlign:'center', padding:10, fontSize:11, color:'var(--text3)'}}>Showing top 500 · use search to filter</div>}
            </div>
          )}
        </>
      )}

      {/* ── TAB 2: Daily Tracker ─────────────────────────────────── */}
      {tab === 2 && (
        !bkt ? (
          <div style={{textAlign:'center', padding:40, color:'var(--text3)'}}>Upload Excel with Bucketing sheet to see daily data</div>
        ) : (
          <>
            <div style={{fontSize:12, color:'var(--text3)', marginBottom:14}}>Daily Rev %, Spend %, ROAS per bucket — June 2026 vs Nov–Apr average</div>
            <div style={{overflowX:'auto', borderRadius:8, border:'0.5px solid var(--border)'}}>
              <table style={{width:'100%', borderCollapse:'collapse', fontSize:12}}>
                <thead>
                  <tr>
                    <th style={{...S.th, textAlign:'left', width:90}}>Bucket</th>
                    <th style={{...S.th, textAlign:'right', width:70}}>Metric</th>
                    <th style={{...S.th, textAlign:'right', background:'rgba(66,133,244,0.08)'}}>Nov–Apr Avg</th>
                    <th style={{...S.th, textAlign:'right', background:'rgba(66,133,244,0.08)'}}>Jun 1–9</th>
                    {juneDays.map(d => <th key={d} style={{...S.th, textAlign:'right', minWidth:50}}>{d} Jun</th>)}
                  </tr>
                </thead>
                <tbody>
                  {BUCKETS.map(b => {
                    const bd = bkt[b.label]
                    if (!bd) return null
                    const metrics = [
                      { key:'rev',   label:'Rev %',   fmt: v=>`${(v*100).toFixed(1)}%`, color: b.color },
                      { key:'spend', label:'Spend %', fmt: v=>`${(v*100).toFixed(1)}%`, color:'var(--blue)' },
                      { key:'roas',  label:'ROAS',    fmt: v=>`${v.toFixed(2)}x`,        color: v=>roasCol(v) },
                    ]
                    return metrics.map((m,mi) => (
                      <tr key={`${b.id}-${m.key}`} style={{borderBottom: mi===2 ? '1px solid var(--border2)' : '0.5px solid var(--border)'}}>
                        {mi===0 && (
                          <td rowSpan={3} style={{...S.td, fontWeight:700, color:b.color, verticalAlign:'middle', borderRight:'0.5px solid var(--border2)'}}>
                            <div>{b.label}</div>
                            <div style={{fontSize:10, color:'var(--text3)', fontWeight:400}}>{b.range}</div>
                          </td>
                        )}
                        <td style={{...S.td, textAlign:'right', color:'var(--text3)', fontSize:11}}>{m.label}</td>
                        <td style={{...S.td, textAlign:'right', background:'rgba(66,133,244,0.04)', fontWeight:600}}>
                          <span style={{color:typeof m.color==='function'?m.color(bd.avg[m.key]||0):m.color}}>
                            {m.fmt(bd.avg[m.key]||0)}
                          </span>
                        </td>
                        <td style={{...S.td, textAlign:'right', background:'rgba(66,133,244,0.04)'}}>
                          <span style={{color:typeof m.color==='function'?m.color(bd.total[m.key]||0):m.color, fontWeight:600}}>
                            {m.fmt(bd.total[m.key]||0)}
                          </span>
                        </td>
                        {juneDays.map(d => {
                          const v = bd.days[d]?.[m.key] || 0
                          return (
                            <td key={d} style={{...S.td, textAlign:'right', fontSize:11}}>
                              <span style={{color:typeof m.color==='function'?m.color(v):m.color}}>{m.fmt(v)}</span>
                            </td>
                          )
                        })}
                      </tr>
                    ))
                  })}
                </tbody>
              </table>
            </div>
          </>
        )
      )}
    </div>
  )
}
