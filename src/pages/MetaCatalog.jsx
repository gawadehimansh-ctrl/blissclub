import React, { useMemo, useState } from 'react'
import { useData } from '../data/store.jsx'
import { CATALOG_MAP } from '../data/catalogMap.js'

// CATALOG_MAP: { contentId → { g: groupId, n: productName } }
// Used ONLY for grouping — all performance data comes from Windsor API (state.metaCatalog)

const fmtC = n => !n ? '—' : n >= 10000000 ? '₹'+(n/10000000).toFixed(2)+'Cr' : n >= 100000 ? '₹'+(n/100000).toFixed(1)+'L' : n >= 1000 ? '₹'+(n/1000).toFixed(1)+'K' : '₹'+Math.round(n).toLocaleString('en-IN')
const fmtN = n => !n ? '—' : Number(n).toLocaleString('en-IN')
const fmtR = n => !n ? '—' : Number(n).toFixed(2)+'x'
const fmtP = n => Number(n||0).toFixed(2)+'%'

const TH  = { padding:'9px 12px', fontSize:10, fontWeight:600, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.05em', background:'var(--bg3)', borderBottom:'0.5px solid var(--border2)', whiteSpace:'nowrap', cursor:'pointer', userSelect:'none' }
const TD  = { padding:'9px 12px', fontSize:12, borderBottom:'0.5px solid var(--border)', color:'var(--text)', whiteSpace:'nowrap' }
const TDr = { ...TD, textAlign:'right' }
const TDs = { ...TDr, color:'var(--text3)' }

function RoasBadge({ roas }) {
  const r = Number(roas||0)
  if (!r) return <span style={{ color:'var(--text3)' }}>—</span>
  const color = r>=3?'#22c55e':r>=2?'#86efac':r>=1?'#f59e0b':'#ef4444'
  return <span style={{ color, fontWeight:600 }}>{fmtR(r)}</span>
}

function SortTh({ col, label, sort, onSort, title }) {
  const active = sort.col === col
  return (
    <th style={{ ...TH, color: active?'var(--text)':undefined }} title={title} onClick={() => onSort(col)}>
      {label}{active?(sort.dir==='asc'?' ↑':' ↓'):''}
    </th>
  )
}

// ── Variant drill panel ───────────────────────────────────────────────────────
function VariantDrill({ variants }) {
  const [sort, setSort] = useState({ col:'spend', dir:'desc' })
  function onSort(col) { setSort(s => ({ col, dir: s.col===col&&s.dir==='desc'?'asc':'desc' })) }

  const sorted = useMemo(() =>
    [...variants].sort((a,b) => sort.dir==='desc' ? b[sort.col]-a[sort.col] : a[sort.col]-b[sort.col])
  , [variants, sort])

  return (
    <tr>
      <td colSpan={12} style={{ padding:0, background:'rgba(127,119,221,0.04)', borderBottom:'1px solid var(--border2)' }}>
        <div style={{ padding:'10px 12px 14px 44px' }}>
          <div style={{ fontSize:10, fontWeight:600, color:'var(--text3)', letterSpacing:'0.08em', marginBottom:8 }}>
            VARIANT BREAKDOWN — {sorted.length} variants (Content ID level) · all data from Windsor API
          </div>
          <div style={{ overflowX:'auto', borderRadius:7, border:'0.5px solid var(--border)' }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr>
                  <SortTh col="contentId"   label="Content ID"  sort={sort} onSort={onSort} />
                  <SortTh col="spend"       label="Spend"       sort={sort} onSort={onSort} />
                  <SortTh col="impressions" label="Impr."       sort={sort} onSort={onSort} />
                  <SortTh col="clicks"      label="Clicks"      sort={sort} onSort={onSort} />
                  <SortTh col="ctr"         label="CTR%"        sort={sort} onSort={onSort} />
                  <SortTh col="atc"         label="ATC"         sort={sort} onSort={onSort} />
                  <SortTh col="atcRate"     label="ATC%"        sort={sort} onSort={onSort} title="ATC / Views" />
                  <SortTh col="views"       label="Views"       sort={sort} onSort={onSort} />
                  <SortTh col="purchases"   label="Purchases"   sort={sort} onSort={onSort} />
                  <SortTh col="revenue"     label="Revenue"     sort={sort} onSort={onSort} />
                  <SortTh col="roas"        label="ROAS"        sort={sort} onSort={onSort} />
                  <SortTh col="cpa"         label="CPA"         sort={sort} onSort={onSort} />
                </tr>
              </thead>
              <tbody>
                {sorted.map((v, i) => (
                  <tr key={v.contentId}
                    style={{ background: i%2===0?'transparent':'rgba(255,255,255,0.01)' }}
                    onMouseEnter={e => e.currentTarget.style.background='var(--bg3)'}
                    onMouseLeave={e => e.currentTarget.style.background=i%2===0?'transparent':'rgba(255,255,255,0.01)'}>
                    <td style={{ ...TD, fontSize:11, fontFamily:'monospace', color:'var(--text3)' }}>{v.contentId}</td>
                    <td style={TD}>{fmtC(v.spend)}</td>
                    <td style={TDs}>{fmtN(Math.round(v.impressions))}</td>
                    <td style={TDs}>{fmtN(Math.round(v.clicks))}</td>
                    <td style={{ ...TD, color:v.ctr>=2?'#22c55e':v.ctr>=1?'#f59e0b':undefined }}>{fmtP(v.ctr)}</td>
                    <td style={TDs}>{v.atc>0?fmtN(Math.round(v.atc)):'—'}</td>
                    <td style={{ ...TD, color:v.atcRate>10?'#22c55e':v.atcRate>5?'#f59e0b':undefined }}>{v.atcRate>0?fmtP(v.atcRate):'—'}</td>
                    <td style={TDs}>{fmtN(Math.round(v.views))}</td>
                    <td style={TDs}>{v.purchases>0?fmtN(Math.round(v.purchases)):'—'}</td>
                    <td style={{ ...TD, color:v.revenue>0?'#22c55e':undefined }}>{fmtC(v.revenue)}</td>
                    <td style={TD}><RoasBadge roas={v.roas} /></td>
                    <td style={TDs}>{v.cpa>0?fmtC(v.cpa):'—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </td>
    </tr>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function MetaCatalog() {
  const { state }   = useData()
  const [search, setSearch] = useState('')
  const [sort, setSort]     = useState({ col:'spend', dir:'desc' })
  const [expanded, setExpanded] = useState(null)

  const raw = state.metaCatalog || []

  // ── Aggregate Windsor data by Content ID ──────────────────────────────────
  const byContentId = useMemo(() => {
    const map = {}
    for (const r of raw) {
      const contentId = (r.product_id || '').split(',')[0].trim()
      if (!contentId) continue
      if (!map[contentId]) map[contentId] = {
        contentId,
        spend:0, impressions:0, clicks:0,
        atc:0, views:0, purchases:0, revenue:0,
      }
      const g = map[contentId]
      g.spend       += Number(r.spend||0)
      g.impressions += Number(r.impressions||0)
      g.clicks      += Number(r.clicks||0)
      g.atc         += Number(r.actions_add_to_cart||0)
      g.views       += Number(r.actions_view_content||0)
      g.purchases   += Number(r.actions_purchase||0)
      g.revenue     += Number(r.action_values_purchase||0)
    }
    return Object.values(map).map(v => ({
      ...v,
      ctr:     v.impressions>0 ? v.clicks/v.impressions*100 : 0,
      roas:    v.spend>0 ? v.revenue/v.spend : 0,
      atcRate: v.views>0 ? v.atc/v.views*100 : 0,
      cpa:     v.purchases>0 ? v.spend/v.purchases : 0,
    }))
  }, [raw])

  // ── Group by Product (via CATALOG_MAP Group ID) ───────────────────────────
  const products = useMemo(() => {
    const map = {}
    for (const v of byContentId) {
      const entry = CATALOG_MAP[v.contentId]
      // If not in map, use product name from Windsor product_id field
      const groupId = entry?.g || v.contentId
      const productName = entry?.n ||
        (raw.find(r => (r.product_id||'').startsWith(v.contentId))?.product_id||'').split(',').slice(1).join(',').trim() ||
        'Unknown'

      if (!map[groupId]) map[groupId] = {
        groupId, productName, variants:[],
        spend:0, impressions:0, clicks:0,
        atc:0, views:0, purchases:0, revenue:0,
      }
      const g = map[groupId]
      g.variants.push(v)
      g.spend       += v.spend
      g.impressions += v.impressions
      g.clicks      += v.clicks
      g.atc         += v.atc
      g.views       += v.views
      g.purchases   += v.purchases
      g.revenue     += v.revenue
    }
    return Object.values(map).map(g => ({
      ...g,
      variantCount: g.variants.length,
      ctr:     g.impressions>0 ? g.clicks/g.impressions*100 : 0,
      roas:    g.spend>0 ? g.revenue/g.spend : 0,
      atcRate: g.views>0 ? g.atc/g.views*100 : 0,
      cpa:     g.purchases>0 ? g.spend/g.purchases : 0,
    }))
  }, [byContentId, raw])

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const totalSpend    = products.reduce((s,p)=>s+p.spend,0)
  const totalRevenue  = products.reduce((s,p)=>s+p.revenue,0)
  const totalPurchases= products.reduce((s,p)=>s+p.purchases,0)
  const totalAtc      = products.reduce((s,p)=>s+p.atc,0)
  const totalViews    = products.reduce((s,p)=>s+p.views,0)
  const blendedRoas   = totalSpend>0 ? totalRevenue/totalSpend : 0

  function onSort(col) { setSort(s=>({ col, dir:s.col===col&&s.dir==='desc'?'asc':'desc' })) }

  const filtered = useMemo(() => {
    let out = products
    if (search) { const q=search.toLowerCase(); out=out.filter(p=>p.productName.toLowerCase().includes(q)) }
    return [...out].sort((a,b)=>sort.dir==='desc'?b[sort.col]-a[sort.col]:a[sort.col]-b[sort.col])
  }, [products, search, sort])

  const CARD = { background:'var(--bg2)', borderRadius:10, padding:'16px 20px', border:'0.5px solid var(--border)' }

  if (raw.length===0) return (
    <div style={{ padding:40, color:'var(--text3)', fontSize:14 }}>
      No catalog data — click <strong>Sync everything</strong> on the Upload page.
    </div>
  )

  return (
    <div style={{ padding:'28px 32px', maxWidth:1400 }}>
      <div style={{ marginBottom:24 }}>
        <h1 style={{ fontSize:22, fontWeight:700, marginBottom:4 }}>Meta Catalog / DPA — Product Intelligence</h1>
        <div style={{ fontSize:13, color:'var(--text3)' }}>
          {products.length} products · {byContentId.length} variants · all data via Windsor API · click row → variant drill
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(6,1fr)', gap:12, marginBottom:28 }}>
        {[
          { label:'Total Spend',    value:fmtC(totalSpend) },
          { label:'Revenue',        value:fmtC(totalRevenue) },
          { label:'Blended ROAS',   value:fmtR(blendedRoas), color:blendedRoas>=2?'#22c55e':blendedRoas>=1?'#f59e0b':'#ef4444' },
          { label:'Purchases',      value:fmtN(Math.round(totalPurchases)) },
          { label:'Add to Cart',    value:fmtN(Math.round(totalAtc)), sub:totalViews>0?fmtP(totalAtc/totalViews*100)+' ATC rate':null },
          { label:'Products',       value:fmtN(products.length) },
        ].map(k => (
          <div key={k.label} style={CARD}>
            <div style={{ fontSize:11, color:'var(--text3)', marginBottom:6 }}>{k.label}</div>
            <div style={{ fontSize:22, fontWeight:700, color:k.color||'var(--text)' }}>{k.value}</div>
            {k.sub && <div style={{ fontSize:11, color:'var(--text3)', marginTop:4 }}>{k.sub}</div>}
          </div>
        ))}
      </div>

      {/* Controls */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
        <div style={{ fontSize:13, fontWeight:600 }}>{filtered.length} products</div>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search product…"
          style={{ padding:'6px 12px', borderRadius:6, border:'0.5px solid var(--border)', background:'var(--bg2)', color:'var(--text)', fontSize:12, width:220 }} />
      </div>

      {/* Product table */}
      <div style={{ overflowX:'auto', borderRadius:10, border:'0.5px solid var(--border)' }}>
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead>
            <tr>
              <th style={{ ...TH, minWidth:220, textAlign:'left' }}>Product</th>
              <SortTh col="variantCount" label="Variants"  sort={sort} onSort={onSort} />
              <SortTh col="spend"        label="Spend"     sort={sort} onSort={onSort} />
              <SortTh col="impressions"  label="Impr."     sort={sort} onSort={onSort} />
              <SortTh col="clicks"       label="Clicks"    sort={sort} onSort={onSort} />
              <SortTh col="ctr"          label="CTR%"      sort={sort} onSort={onSort} />
              <SortTh col="atc"          label="ATC"       sort={sort} onSort={onSort} />
              <SortTh col="atcRate"      label="ATC%"      sort={sort} onSort={onSort} title="ATC / Views" />
              <SortTh col="purchases"    label="Purchases" sort={sort} onSort={onSort} />
              <SortTh col="revenue"      label="Revenue"   sort={sort} onSort={onSort} />
              <SortTh col="roas"         label="ROAS"      sort={sort} onSort={onSort} />
              <SortTh col="cpa"          label="CPA"       sort={sort} onSort={onSort} />
            </tr>
          </thead>
          <tbody>
            {filtered.map((p, i) => {
              const isExpanded = expanded===p.groupId
              return (
                <React.Fragment key={p.groupId}>
                  <tr onClick={()=>setExpanded(isExpanded?null:p.groupId)}
                    style={{ cursor:'pointer', background:isExpanded?'var(--bg3)':i%2===0?'transparent':'rgba(255,255,255,0.01)' }}
                    onMouseEnter={e=>{ if(!isExpanded) e.currentTarget.style.background='var(--bg3)' }}
                    onMouseLeave={e=>{ if(!isExpanded) e.currentTarget.style.background=i%2===0?'transparent':'rgba(255,255,255,0.01)' }}>
                    <td style={{ ...TD, textAlign:'left', fontWeight:600 }}>
                      <span style={{ display:'inline-flex', alignItems:'center', gap:8 }}>
                        <span style={{ fontSize:9, color:'var(--text3)', display:'inline-block', transform:isExpanded?'rotate(90deg)':'rotate(0)', transition:'transform .15s' }}>▶</span>
                        {p.productName}
                      </span>
                    </td>
                    <td style={TDs}>{p.variantCount}</td>
                    <td style={TD}>{fmtC(p.spend)}</td>
                    <td style={TDs}>{fmtN(Math.round(p.impressions))}</td>
                    <td style={TDs}>{fmtN(Math.round(p.clicks))}</td>
                    <td style={{ ...TD, color:p.ctr>=2?'#22c55e':p.ctr>=1?'#f59e0b':undefined }}>{fmtP(p.ctr)}</td>
                    <td style={TDs}>{p.atc>0?fmtN(Math.round(p.atc)):'—'}</td>
                    <td style={{ ...TD, color:p.atcRate>10?'#22c55e':p.atcRate>5?'#f59e0b':undefined }}>{p.atcRate>0?fmtP(p.atcRate):'—'}</td>
                    <td style={TDs}>{p.purchases>0?fmtN(Math.round(p.purchases)):'—'}</td>
                    <td style={{ ...TD, color:p.revenue>0?'#22c55e':undefined }}>{fmtC(p.revenue)}</td>
                    <td style={TD}><RoasBadge roas={p.roas} /></td>
                    <td style={TDs}>{p.cpa>0?fmtC(p.cpa):'—'}</td>
                  </tr>
                  {isExpanded && <VariantDrill variants={p.variants} />}
                </React.Fragment>
              )
            })}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop:10, fontSize:11, color:'var(--text3)' }}>
        All metrics from Windsor API · product grouping via Meta Commerce Manager ID mapping · ROAS = Meta-attributed
      </div>
    </div>
  )
}
