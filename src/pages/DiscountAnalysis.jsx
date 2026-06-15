import React, { useState, useCallback, useMemo } from 'react'
import { fmtINR, fmtINRCompact, fmtNum } from '../utils/formatters.js'

let _XLSX = null
async function loadXLSX() {
  if (_XLSX) return _XLSX
  return new Promise(resolve => {
    if (window.XLSX) { _XLSX = window.XLSX; return resolve(window.XLSX) }
    const s = document.createElement('script')
    s.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js'
    s.onload = () => { _XLSX = window.XLSX; resolve(window.XLSX) }
    document.head.appendChild(s)
  })
}

function num(v) { return parseFloat(String(v || 0).replace(/[₹,]/g, '')) || 0 }

function parseDiscountExport(ws, XLSX) {
  const rows = XLSX.utils.sheet_to_json(ws, { defval: null })
  return rows.map(r => ({
    date:         String(r['Day'] || r['Date'] || '').slice(0, 10),
    code:         String(r['Discount name'] || r['Discount code'] || '').trim(),
    gross:        num(r['Gross sales']),
    lineDisc:     Math.abs(num(r['Line item discounts'])),
    orderDisc:    Math.abs(num(r['Order-level discounts'])),
    discounts:    Math.abs(num(r['Discounts'])),
    returns:      Math.abs(num(r['Returns'])),
    netSales:     num(r['Net sales']),
  })).filter(r => r.date && r.gross !== 0)
}

// Classify coupon code into bucket
function classifyCode(code) {
  if (!code) return 'no_code'
  const lc = code.toLowerCase()
  if (lc.startsWith('ret') || lc.startsWith('return')) return 'return'
  if (lc.startsWith('nector_')) return 'loyalty'
  if (['extra 25% off','extra 10% off','midnight 25','b2g1','b2g1free','buy2get1_test',
       'demi fine discount','silver300','silver500','bundle_discount','abdchkt25',
       'first10','influencer','custom discount','bellavita goodie','b2g1-offer'].some(k => lc.includes(k.toLowerCase()))) return 'promo'
  return 'other'
}

function classLabel(cls) {
  return { promo:'Named Promo', loyalty:'Loyalty (Nector)', return:'Returns', no_code:'No Code', other:'Other' }[cls] || cls
}

function classColor(cls) {
  return { promo:'#e8457a', loyalty:'#6366f1', return:'#ef4444', no_code:'var(--text3)', other:'#f59e0b' }[cls] || 'var(--text2)'
}

const TH = { padding:'7px 12px', fontSize:10, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.05em', background:'var(--bg3)', whiteSpace:'nowrap' }
const TD = { padding:'7px 12px', borderBottom:'0.5px solid var(--border)', fontSize:12 }

export default function DiscountAnalysis() {
  const [rows, setRows]   = useState(null)
  const [file, setFile]   = useState('')
  const [loading, setLoading] = useState(false)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo]     = useState('')
  const [compareFrom, setCompareFrom] = useState('')
  const [compareTo, setCompareTo]     = useState('')
  const [view, setView] = useState('overview') // overview | daily | codes
  const [classFilter, setClassFilter] = useState('all')
  const DISC_ALERT = 0.30 // flag if discount % > 30%

  const handleFile = useCallback(async f => {
    if (!f) return
    setLoading(true)
    setFile(f.name)
    const XLSX = await loadXLSX()
    const reader = new FileReader()
    reader.onload = e => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'binary' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const parsed = parseDiscountExport(ws, XLSX)
        setRows(parsed)
        // Auto-set date range
        const dates = parsed.map(r => r.date).filter(Boolean).sort()
        if (dates.length) { setDateFrom(dates[0]); setDateTo(dates[dates.length-1]) }
      } catch(err) { console.error(err) }
      setLoading(false)
    }
    reader.readAsBinaryString(f)
  }, [])

  const filtered = useMemo(() => {
    if (!rows) return []
    return rows.filter(r => (!dateFrom || r.date >= dateFrom) && (!dateTo || r.date <= dateTo))
  }, [rows, dateFrom, dateTo])

  const compared = useMemo(() => {
    if (!rows || !compareFrom || !compareTo) return []
    return rows.filter(r => r.date >= compareFrom && r.date <= compareTo)
  }, [rows, compareFrom, compareTo])

  function calcMetrics(r) {
    const gross    = r.reduce((s,x) => s + x.gross, 0)
    const disc     = r.reduce((s,x) => s + x.discounts, 0)
    const returns  = r.reduce((s,x) => s + x.returns, 0)
    const net      = r.reduce((s,x) => s + x.netSales, 0)
    const discPct  = gross > 0 ? disc / gross : 0
    return { gross, disc, returns, net, discPct }
  }

  const curr = useMemo(() => calcMetrics(filtered), [filtered])
  const comp = useMemo(() => calcMetrics(compared), [compared])

  // Daily aggregation
  const dailyData = useMemo(() => {
    const map = {}
    filtered.forEach(r => {
      if (!map[r.date]) map[r.date] = { date: r.date, gross: 0, disc: 0, returns: 0, net: 0 }
      map[r.date].gross   += r.gross
      map[r.date].disc    += r.discounts
      map[r.date].returns += r.returns
      map[r.date].net     += r.netSales
    })
    return Object.values(map).sort((a,b) => a.date.localeCompare(b.date)).map(d => ({
      ...d, discPct: d.gross > 0 ? d.disc / d.gross : 0
    }))
  }, [filtered])

  // Code aggregation
  const codeData = useMemo(() => {
    const map = {}
    filtered.forEach(r => {
      const cls = classifyCode(r.code)
      if (classFilter !== 'all' && cls !== classFilter) return
      const key = r.code || '(no code)'
      if (!map[key]) map[key] = { code: key, cls, gross: 0, disc: 0, net: 0, txns: 0 }
      map[key].gross += r.gross
      map[key].disc  += r.discounts
      map[key].net   += r.netSales
      map[key].txns  += 1
    })
    return Object.values(map).map(d => ({ ...d, discPct: d.gross > 0 ? d.disc / d.gross : 0 }))
      .sort((a,b) => b.disc - a.disc).slice(0, 100)
  }, [filtered, classFilter])

  // Class summary
  const classSummary = useMemo(() => {
    const map = {}
    filtered.forEach(r => {
      const cls = classifyCode(r.code)
      if (!map[cls]) map[cls] = { cls, gross: 0, disc: 0, net: 0 }
      map[cls].gross += r.gross
      map[cls].disc  += r.discounts
      map[cls].net   += r.netSales
    })
    return Object.values(map).map(d => ({ ...d, discPct: d.gross > 0 ? d.disc / d.gross : 0 }))
      .sort((a,b) => b.disc - a.disc)
  }, [filtered])

  const tabBtn = active => ({
    padding:'6px 14px', fontSize:12, fontWeight:600, borderRadius:8, cursor:'pointer',
    background: active ? 'var(--blue)' : 'var(--bg3)',
    border: '0.5px solid ' + (active ? 'var(--blue)' : 'var(--border2)'),
    color: active ? '#fff' : 'var(--text2)',
  })

  const discColor = v => v >= DISC_ALERT ? 'var(--red)' : v >= 0.20 ? 'var(--amber)' : 'var(--green)'

  return (
    <div style={{padding:'24px 28px'}}>
      <div style={{marginBottom:16}}>
        <h1 style={{fontSize:22, fontWeight:700, marginBottom:4}}>Discount Analysis</h1>
        <div style={{fontSize:12, color:'var(--text3)'}}>
          Track discount % of gross revenue · Alert threshold: {(DISC_ALERT*100).toFixed(0)}%
          {file && <span style={{marginLeft:8, color:'var(--text2)'}}>· {file}</span>}
        </div>
      </div>

      {!rows && !loading && (
        <label style={{display:'block', border:'1.5px dashed var(--border2)', borderRadius:12, padding:'40px 24px', textAlign:'center', cursor:'pointer', background:'var(--bg2)', marginBottom:20}}>
          <input type="file" accept=".xlsx,.xls,.csv" style={{display:'none'}} onChange={e=>handleFile(e.target.files?.[0])} />
          <div style={{fontSize:28, marginBottom:8}}>🏷️</div>
          <div style={{fontSize:13, fontWeight:600, marginBottom:4}}>Upload Shopify discount export</div>
          <div style={{fontSize:11, color:'var(--text3)'}}>Day, Discount name, Gross sales, Discounts, Returns, Net sales</div>
          <div style={{fontSize:11, color:'var(--blue)', marginTop:6}}>or click to browse</div>
        </label>
      )}
      {loading && <div style={{textAlign:'center', padding:40, color:'var(--text3)'}}>Parsing file…</div>}

      {rows && (
        <>
          {/* Date filter */}
          <div style={{display:'flex', gap:12, marginBottom:20, flexWrap:'wrap', alignItems:'flex-end'}}>
            <div>
              <div style={{fontSize:11, color:'var(--text3)', marginBottom:4}}>From</div>
              <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)}
                style={{padding:'6px 10px', borderRadius:6, background:'var(--bg3)', border:'0.5px solid var(--border2)', color:'var(--text)', fontSize:12}}/>
            </div>
            <div>
              <div style={{fontSize:11, color:'var(--text3)', marginBottom:4}}>To</div>
              <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)}
                style={{padding:'6px 10px', borderRadius:6, background:'var(--bg3)', border:'0.5px solid var(--border2)', color:'var(--text)', fontSize:12}}/>
            </div>
            <div style={{width:1, background:'var(--border)', alignSelf:'stretch'}}/>
            <div style={{fontSize:11, color:'var(--text3)', alignSelf:'center'}}>Compare</div>
            <div>
              <div style={{fontSize:11, color:'var(--text3)', marginBottom:4}}>From</div>
              <input type="date" value={compareFrom} onChange={e=>setCompareFrom(e.target.value)}
                style={{padding:'6px 10px', borderRadius:6, background:'var(--bg3)', border:'0.5px solid var(--border2)', color:'var(--text)', fontSize:12}}/>
            </div>
            <div>
              <div style={{fontSize:11, color:'var(--text3)', marginBottom:4}}>To</div>
              <input type="date" value={compareTo} onChange={e=>setCompareTo(e.target.value)}
                style={{padding:'6px 10px', borderRadius:6, background:'var(--bg3)', border:'0.5px solid var(--border2)', color:'var(--text)', fontSize:12}}/>
            </div>
            <label style={{fontSize:11, padding:'6px 12px', borderRadius:6, background:'var(--bg3)', border:'0.5px solid var(--border2)', color:'var(--text2)', cursor:'pointer', alignSelf:'flex-end'}}>
              Replace file <input type="file" accept=".xlsx,.xls,.csv" style={{display:'none'}} onChange={e=>handleFile(e.target.files?.[0])} />
            </label>
          </div>

          {/* Alert banner */}
          {curr.discPct >= DISC_ALERT && (
            <div style={{background:'rgba(239,68,68,0.1)', border:'0.5px solid rgba(239,68,68,0.4)', borderRadius:8, padding:'10px 16px', marginBottom:16, fontSize:12, color:'var(--red)', fontWeight:600}}>
              ⚠️ Discount % is {(curr.discPct*100).toFixed(1)}% — above the {(DISC_ALERT*100).toFixed(0)}% GM alert threshold
            </div>
          )}

          {/* KPI cards */}
          <div style={{display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:20}}>
            {[
              { label:'Gross Sales', val: fmtINR(curr.gross), comp: compared.length ? fmtINR(comp.gross) : null },
              { label:'Total Discounts', val: fmtINR(curr.disc), comp: compared.length ? fmtINR(comp.disc) : null, color:'var(--amber)' },
              { label:'Discount %', val: (curr.discPct*100).toFixed(1)+'%', comp: compared.length ? (comp.discPct*100).toFixed(1)+'%' : null, color: discColor(curr.discPct) },
              { label:'Net Sales', val: fmtINR(curr.net), comp: compared.length ? fmtINR(comp.net) : null, color:'var(--green)' },
            ].map(c => (
              <div key={c.label} style={{background:'var(--bg2)', border:'0.5px solid var(--border)', borderRadius:10, padding:'14px 16px'}}>
                <div style={{fontSize:10, color:'var(--text3)', marginBottom:6, textTransform:'uppercase', letterSpacing:'0.05em'}}>{c.label}</div>
                <div style={{fontSize:20, fontWeight:700, color: c.color || 'var(--text)'}}>{c.val}</div>
                {c.comp && <div style={{fontSize:11, color:'var(--text3)', marginTop:4}}>Compare: <span style={{fontWeight:600, color:'var(--text2)'}}>{c.comp}</span></div>}
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div style={{display:'flex', gap:6, marginBottom:20}}>
            <button style={tabBtn(view==='overview')} onClick={()=>setView('overview')}>Overview</button>
            <button style={tabBtn(view==='daily')} onClick={()=>setView('daily')}>Daily</button>
            <button style={tabBtn(view==='codes')} onClick={()=>setView('codes')}>By Code</button>
          </div>

          {/* OVERVIEW */}
          {view === 'overview' && (
            <div>
              <div style={{fontSize:13, fontWeight:700, marginBottom:12}}>Discount by Category</div>
              <div style={{overflowX:'auto', borderRadius:8, border:'0.5px solid var(--border)', marginBottom:20}}>
                <table style={{width:'100%', borderCollapse:'collapse', fontSize:12}}>
                  <thead>
                    <tr>{['Category','Gross','Discount','Disc %','Net Sales'].map((h,i)=>(
                      <th key={h} style={{...TH, textAlign: i===0?'left':'right'}}>{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody>
                    {classSummary.map(c => (
                      <tr key={c.cls}
                        onMouseEnter={e=>e.currentTarget.style.background='var(--bg3)'}
                        onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                        <td style={{...TD, fontWeight:700, color:classColor(c.cls)}}>{classLabel(c.cls)}</td>
                        <td style={{...TD, textAlign:'right'}}>{fmtINR(c.gross)}</td>
                        <td style={{...TD, textAlign:'right', color:'var(--amber)'}}>{fmtINR(c.disc)}</td>
                        <td style={{...TD, textAlign:'right', fontWeight:600, color:discColor(c.discPct)}}>{(c.discPct*100).toFixed(1)}%</td>
                        <td style={{...TD, textAlign:'right', color:'var(--green)'}}>{fmtINR(c.net)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* DAILY */}
          {view === 'daily' && (
            <div style={{overflowX:'auto', borderRadius:8, border:'0.5px solid var(--border)'}}>
              <table style={{width:'100%', borderCollapse:'collapse', fontSize:12}}>
                <thead>
                  <tr>{['Date','Gross','Discount','Disc %','Returns','Net Sales'].map((h,i)=>(
                    <th key={h} style={{...TH, textAlign: i===0?'left':'right'}}>{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {dailyData.map(d => (
                    <tr key={d.date}
                      style={{background: d.discPct >= DISC_ALERT ? 'rgba(239,68,68,0.04)' : 'transparent'}}
                      onMouseEnter={e=>e.currentTarget.style.background='var(--bg3)'}
                      onMouseLeave={e=>e.currentTarget.style.background= d.discPct >= DISC_ALERT ? 'rgba(239,68,68,0.04)' : 'transparent'}>
                      <td style={{...TD}}>
                        {d.date}
                        {d.discPct >= DISC_ALERT && <span style={{marginLeft:6, fontSize:9, color:'var(--red)'}}>⚠️ HIGH</span>}
                      </td>
                      <td style={{...TD, textAlign:'right'}}>{fmtINR(d.gross)}</td>
                      <td style={{...TD, textAlign:'right', color:'var(--amber)'}}>{fmtINR(d.disc)}</td>
                      <td style={{...TD, textAlign:'right', fontWeight:600, color:discColor(d.discPct)}}>{(d.discPct*100).toFixed(1)}%</td>
                      <td style={{...TD, textAlign:'right', color:'var(--red)'}}>{fmtINR(d.returns)}</td>
                      <td style={{...TD, textAlign:'right', color:'var(--green)'}}>{fmtINR(d.net)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* BY CODE */}
          {view === 'codes' && (
            <div>
              <div style={{display:'flex', gap:6, marginBottom:14, flexWrap:'wrap'}}>
                {['all','promo','loyalty','return','other','no_code'].map(cls => (
                  <button key={cls} onClick={()=>setClassFilter(cls)} style={{
                    padding:'4px 10px', fontSize:11, fontWeight:600, borderRadius:6, cursor:'pointer',
                    background: classFilter===cls ? classColor(cls) : 'var(--bg3)',
                    border: '0.5px solid ' + (classFilter===cls ? classColor(cls) : 'var(--border2)'),
                    color: classFilter===cls ? '#fff' : 'var(--text2)',
                  }}>
                    {cls === 'all' ? 'All' : classLabel(cls)}
                  </button>
                ))}
              </div>
              <div style={{overflowX:'auto', borderRadius:8, border:'0.5px solid var(--border)'}}>
                <table style={{width:'100%', borderCollapse:'collapse', fontSize:12}}>
                  <thead>
                    <tr>{['Code','Type','Gross','Discount','Disc %','Net Sales'].map((h,i)=>(
                      <th key={h} style={{...TH, textAlign: i<2?'left':'right'}}>{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody>
                    {codeData.map(c => (
                      <tr key={c.code}
                        onMouseEnter={e=>e.currentTarget.style.background='var(--bg3)'}
                        onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                        <td style={{...TD, maxWidth:240, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontWeight:500}}>{c.code}</td>
                        <td style={{...TD}}>
                          <span style={{fontSize:10, padding:'2px 6px', borderRadius:4, fontWeight:600, background: classColor(c.cls)+'22', color: classColor(c.cls)}}>
                            {classLabel(c.cls)}
                          </span>
                        </td>
                        <td style={{...TD, textAlign:'right'}}>{fmtINR(c.gross)}</td>
                        <td style={{...TD, textAlign:'right', color:'var(--amber)'}}>{fmtINR(c.disc)}</td>
                        <td style={{...TD, textAlign:'right', fontWeight:600, color:discColor(c.discPct)}}>{(c.discPct*100).toFixed(1)}%</td>
                        <td style={{...TD, textAlign:'right', color:'var(--green)'}}>{fmtINR(c.net)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
