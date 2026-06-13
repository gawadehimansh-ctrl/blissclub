import React, { useMemo, useState, useCallback } from 'react'
import { fmtINR, fmtINRCompact, fmtX, fmtNum } from '../utils/formatters.js'

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

// Parse Meta Ads Manager export — "Product ID" col = "47198888067246, Product Name"
function parseCatalog(ws, XLSX) {
  const rows = XLSX.utils.sheet_to_json(ws, { defval: null })
  return rows.map(r => {
    const raw = String(r['Product ID'] || '')
    const commaIdx = raw.indexOf(',')
    const product_id   = commaIdx > -1 ? raw.slice(0, commaIdx).trim() : raw.trim()
    const product_name = commaIdx > -1 ? raw.slice(commaIdx + 1).trim() : raw.trim()
    const spend   = Number(r['Amount spent (INR)']) || 0
    const revenue = Number(r['Purchases conversion value']) || 0
    const roas    = Number(r['ROAS']) || (spend > 0 ? revenue / spend : 0)
    return {
      date: r['Day'],
      product_id, product_name,
      spend, revenue, roas,
      purchases: Number(r['Purchases']) || 0,
      addToCart:  Number(r['Adds to cart']) || 0,
      lpv:        Number(r['Website landing page views']) || 0,
      clicks:     Number(r['Link clicks']) || 0,
      impressions:Number(r['Impressions']) || 0,
      ctr:        Number(r['CTR (link click-through rate)']) || 0,
      cpm:        Number(r['CPM (cost per 1,000 impressions)']) || 0,
      aov:        Number(r['AOV']) || 0,
    }
  })
}

function roasCol(v) {
  if (!v || v <= 0) return 'var(--text3)'
  return v >= 4 ? 'var(--green)' : v >= 2 ? 'var(--amber)' : 'var(--red)'
}

const S = {
  th: { padding:'8px 12px', fontSize:10, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.05em', whiteSpace:'nowrap', background:'var(--bg3)' },
  td: { padding:'8px 12px', borderBottom:'0.5px solid var(--border)', fontSize:12 },
}

export default function MetaCatalog() {
  const [rows, setRows]       = useState(null)
  const [file, setFile]       = useState('')
  const [loading, setLoading] = useState(false)
  const [q, setQ]             = useState('')
  const [sortKey, setSortKey] = useState('spend')

  const handleFile = useCallback(async (f) => {
    if (!f) return
    setLoading(true)
    setFile(f.name)
    const XLSX = await loadXLSX()
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'binary' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        setRows(parseCatalog(ws, XLSX))
      } catch(err) { console.error(err) }
      setLoading(false)
    }
    reader.readAsBinaryString(f)
  }, [])

  // Group by product_id, aggregate across dates
  const products = useMemo(() => {
    if (!rows) return []
    const map = {}
    for (const r of rows) {
      if (!r.product_id || r.product_id === 'unknown') continue
      if (!map[r.product_id]) {
        map[r.product_id] = {
          product_id: r.product_id, product_name: r.product_name,
          spend: 0, revenue: 0, purchases: 0, addToCart: 0, lpv: 0, clicks: 0, impressions: 0,
        }
      }
      const p = map[r.product_id]
      p.spend       += r.spend
      p.revenue     += r.revenue
      p.purchases   += r.purchases
      p.addToCart   += r.addToCart
      p.lpv         += r.lpv
      p.clicks      += r.clicks
      p.impressions += r.impressions
    }
    return Object.values(map).map(p => ({
      ...p,
      roas: p.spend > 0 ? p.revenue / p.spend : 0,
      cpa:  p.purchases > 0 ? p.spend / p.purchases : 0,
      ctr:  p.impressions > 0 ? (p.clicks / p.impressions) * 100 : 0,
    }))
  }, [rows])

  const totals = useMemo(() => {
    const t = products.reduce((acc, p) => ({
      spend: acc.spend + p.spend,
      revenue: acc.revenue + p.revenue,
      purchases: acc.purchases + p.purchases,
    }), { spend: 0, revenue: 0, purchases: 0 })
    return { ...t, roas: t.spend > 0 ? t.revenue / t.spend : 0 }
  }, [products])

  const filtered = useMemo(() => {
    return products
      .filter(p => !q || p.product_name.toLowerCase().includes(q.toLowerCase()) || p.product_id.includes(q))
      .sort((a, b) => b[sortKey] - a[sortKey])
      .slice(0, 500)
  }, [products, q, sortKey])

  const dateRange = useMemo(() => {
    if (!rows || rows.length === 0) return ''
    const dates = [...new Set(rows.map(r => r.date))].sort()
    return dates.length > 1 ? `${dates[0]} → ${dates[dates.length-1]}` : dates[0]
  }, [rows])

  return (
    <div style={{padding:'24px 28px'}}>
      {/* Header */}
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20}}>
        <div>
          <h1 style={{fontSize:22, fontWeight:700, marginBottom:4}}>Meta Catalog</h1>
          <div style={{fontSize:12, color:'var(--text3)'}}>
            {products.length > 0
              ? `${products.length} products · ${file}${dateRange ? ` · ${dateRange}` : ''}`
              : 'Upload Meta Ads Manager catalog export (Breakdown by Product ID)'}
          </div>
        </div>
        {products.length > 0 && (
          <div style={{display:'flex', gap:8, alignItems:'center'}}>
            <select value={sortKey} onChange={e=>setSortKey(e.target.value)}
              style={{fontSize:11, padding:'5px 8px', borderRadius:6, background:'var(--bg3)', border:'0.5px solid var(--border2)', color:'var(--text)', cursor:'pointer'}}>
              <option value="spend">Sort by Spend</option>
              <option value="revenue">Sort by Revenue</option>
              <option value="roas">Sort by ROAS</option>
              <option value="purchases">Sort by Purchases</option>
            </select>
            <label style={{fontSize:11, padding:'6px 12px', borderRadius:6, background:'var(--bg3)', border:'0.5px solid var(--border2)', color:'var(--text2)', cursor:'pointer', whiteSpace:'nowrap'}}>
              Replace file
              <input type="file" accept=".xlsx,.xls" style={{display:'none'}} onChange={e=>handleFile(e.target.files?.[0])} />
            </label>
          </div>
        )}
      </div>

      {/* Upload prompt */}
      {!rows && !loading && (
        <label style={{display:'block', border:'1.5px dashed var(--border2)', borderRadius:12, padding:'48px 24px', textAlign:'center', cursor:'pointer', background:'var(--bg2)', marginBottom:20}}>
          <input type="file" accept=".xlsx,.xls" style={{display:'none'}} onChange={e=>handleFile(e.target.files?.[0])} />
          <div style={{fontSize:32, marginBottom:8}}>🛍️</div>
          <div style={{fontSize:14, fontWeight:600, marginBottom:4}}>Drop Meta Catalog export here</div>
          <div style={{fontSize:11, color:'var(--text3)'}}>Ads Manager → Breakdown → By Delivery → Product ID → Export</div>
          <div style={{fontSize:11, color:'var(--blue)', marginTop:8}}>or click to browse</div>
        </label>
      )}
      {loading && <div style={{textAlign:'center', padding:40, color:'var(--text3)', fontSize:13}}>Parsing Excel… ({rows ? rows.length : 'thousands of'} rows)</div>}

      {products.length > 0 && (
        <>
          {/* Summary cards */}
          <div style={{display:'grid', gridTemplateColumns:'repeat(4,minmax(0,1fr))', gap:10, marginBottom:20}}>
            {[
              { label: 'Products', value: fmtNum(products.length), color: 'var(--text)' },
              { label: 'Total Spend', value: fmtINR(totals.spend), color: 'var(--text)' },
              { label: 'Total Revenue', value: fmtINR(totals.revenue), color: 'var(--pink)' },
              { label: 'Blended ROAS', value: fmtX(totals.roas), color: roasCol(totals.roas) },
            ].map(c => (
              <div key={c.label} style={{background:'var(--bg2)', border:'0.5px solid var(--border)', borderRadius:10, padding:'14px 16px'}}>
                <div style={{fontSize:10, color:'var(--text3)', marginBottom:6, textTransform:'uppercase', letterSpacing:'0.05em'}}>{c.label}</div>
                <div style={{fontSize:20, fontWeight:700, color:c.color}}>{c.value}</div>
              </div>
            ))}
          </div>

          {/* Search */}
          <div style={{marginBottom:12}}>
            <input placeholder="Search product name or ID…" value={q} onChange={e=>setQ(e.target.value)}
              style={{width:'100%', maxWidth:400, padding:'7px 12px', borderRadius:8, background:'var(--bg3)', border:'0.5px solid var(--border2)', color:'var(--text)', fontSize:12}}/>
          </div>

          {/* Table */}
          <div style={{overflowX:'auto', borderRadius:8, border:'0.5px solid var(--border)'}}>
            <table style={{width:'100%', borderCollapse:'collapse', fontSize:12}}>
              <thead>
                <tr>
                  <th style={{...S.th, textAlign:'left'}}>Product</th>
                  <th style={{...S.th, textAlign:'right'}}>Spend</th>
                  <th style={{...S.th, textAlign:'right'}}>Revenue</th>
                  <th style={{...S.th, textAlign:'right'}}>ROAS</th>
                  <th style={{...S.th, textAlign:'right'}}>Purchases</th>
                  <th style={{...S.th, textAlign:'right'}}>CPA</th>
                  <th style={{...S.th, textAlign:'right'}}>ATC</th>
                  <th style={{...S.th, textAlign:'right'}}>LPV</th>
                  <th style={{...S.th, textAlign:'right'}}>CTR</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p,i) => (
                  <tr key={p.product_id+i}
                    onMouseEnter={e=>e.currentTarget.style.background='var(--bg3)'}
                    onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                    <td style={{...S.td, maxWidth:320, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>
                      <div>{p.product_name}</div>
                      <div style={{fontSize:10, color:'var(--text3)'}}>{p.product_id}</div>
                    </td>
                    <td style={{...S.td, textAlign:'right'}}>{fmtINR(p.spend)}</td>
                    <td style={{...S.td, textAlign:'right', color:'var(--pink)'}}>{fmtINR(p.revenue)}</td>
                    <td style={{...S.td, textAlign:'right', fontWeight:600, color:roasCol(p.roas)}}>{fmtX(p.roas)}</td>
                    <td style={{...S.td, textAlign:'right'}}>{fmtNum(p.purchases)}</td>
                    <td style={{...S.td, textAlign:'right'}}>{p.cpa > 0 ? fmtINR(p.cpa) : '—'}</td>
                    <td style={{...S.td, textAlign:'right', color:'var(--text2)'}}>{fmtNum(p.addToCart)}</td>
                    <td style={{...S.td, textAlign:'right', color:'var(--text2)'}}>{fmtNum(p.lpv)}</td>
                    <td style={{...S.td, textAlign:'right', color:'var(--text2)'}}>{p.ctr.toFixed(2)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 500 && <div style={{textAlign:'center', padding:10, fontSize:11, color:'var(--text3)'}}>Showing top 500 · use search to narrow</div>}
          </div>
        </>
      )}
    </div>
  )
}
