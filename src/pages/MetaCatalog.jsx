import React, { useMemo, useState } from 'react'
import { useData } from '../data/store.jsx'
import { useFilters } from '../hooks/useFilters.js'

const fmtC = n => !n ? '—' : n >= 100000 ? '₹' + (n/100000).toFixed(1) + 'L' : n >= 1000 ? '₹' + (n/1000).toFixed(1) + 'K' : '₹' + Number(n).toFixed(0)
const fmtN = n => !n ? '—' : Number(n).toLocaleString('en-IN')
const fmtR = n => !n ? '—' : Number(n).toFixed(2) + 'x'
const fmtP = n => Number(n || 0).toFixed(2) + '%'

const CARD = { background: 'var(--color-background-secondary)', borderRadius: 10, padding: '16px 20px', border: '0.5px solid var(--color-border)' }
const TH   = { padding: '10px 12px', fontSize: 11, color: 'var(--color-text-secondary)', fontWeight: 600, textAlign: 'left', borderBottom: '1px solid var(--color-border)', whiteSpace: 'nowrap', cursor: 'pointer', userSelect: 'none' }
const TD   = { padding: '9px 12px', fontSize: 12, color: 'var(--color-text-primary)', borderBottom: '0.5px solid var(--color-border)', whiteSpace: 'nowrap' }
const TDs  = { ...TD, color: 'var(--color-text-secondary)' }

// Windsor returns product_id as "42313317908736, Ultimate Leggings"
function parseProductId(raw) {
  if (!raw) return { id: '—', name: '—' }
  const comma = raw.indexOf(',')
  if (comma === -1) return { id: raw.trim(), name: raw.trim() }
  return { id: raw.slice(0, comma).trim(), name: raw.slice(comma + 1).trim() }
}

function KpiCard({ label, value, sub, color }) {
  return (
    <div style={CARD}>
      <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: color || 'var(--color-text-primary)' }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

function SortTh({ col, label, sort, onSort, title }) {
  const active = sort.col === col
  return (
    <th style={{ ...TH, color: active ? 'var(--color-text-primary)' : undefined }} title={title} onClick={() => onSort(col)}>
      {label}{active ? (sort.dir === 'asc' ? ' ↑' : ' ↓') : ''}
    </th>
  )
}

function RoasBadge({ roas }) {
  const r = Number(roas || 0)
  if (!r) return <span style={{ color: 'var(--color-text-secondary)' }}>—</span>
  const color = r >= 3 ? '#22c55e' : r >= 2 ? '#86efac' : r >= 1 ? '#f59e0b' : '#ef4444'
  return <span style={{ color, fontWeight: 600 }}>{fmtR(r)}</span>
}

function MiniBar({ value, max, color = '#7F77DD' }) {
  const pct = max ? Math.min(100, (value / max) * 100) : 0
  return (
    <div style={{ height: 4, background: 'var(--color-border)', borderRadius: 3, marginTop: 3 }}>
      <div style={{ width: pct + '%', height: '100%', background: color, borderRadius: 3 }} />
    </div>
  )
}

export default function MetaCatalog() {
  const { state }     = useData()
  const { dateRange } = useFilters()
  const [search, setSearch]         = useState('')
  const [sort, setSort]             = useState({ col: 'spend', dir: 'desc' })
  const [tab, setTab]               = useState('products')
  const [expandedProduct, setExpanded] = useState(null)

  const raw      = state.metaCatalog || []
  const ga4Items = state.ga4Items    || []

  const inRange = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to) return raw
    return raw.filter(r => { const d = new Date(r.date); return d >= dateRange.from && d <= dateRange.to })
  }, [raw, dateRange])


  // GA4 item lookup: variant_id → { revenue, views, qty }
  const ga4Map = useMemo(() => {
    const map = new Map()
    for (const r of ga4Items) {
      const vid = r.variant_id
      if (!vid) continue
      if (!map.has(vid)) map.set(vid, { ga4Revenue: 0, ga4Views: 0, ga4Qty: 0 })
      const g = map.get(vid)
      g.ga4Revenue += Number(r.item_revenue || 0)
      g.ga4Views   += Number(r.item_views   || 0)
      g.ga4Qty     += Number(r.item_quantity || 0)
    }
    return map
  }, [ga4Items])

  // ── Product aggregation ───────────────────────────────────────────────────
  const products = useMemo(() => {
    const map = new Map()
    for (const r of inRange) {
      const { id, name } = parseProductId(r.product_id)
      if (!map.has(id)) map.set(id, { id, name, spend:0, impressions:0, clicks:0, purchases:0, revenue:0, atc:0, views:0, camps: new Set() })
      const g = map.get(id)
      g.spend       += Number(r.spend || 0)
      g.impressions += Number(r.impressions || 0)
      g.clicks      += Number(r.clicks || 0)
      g.purchases   += Number(r.actions_purchase || 0)
      g.revenue     += Number(r.action_values_purchase || 0)
      g.atc         += Number(r.actions_add_to_cart || 0)
      g.views       += Number(r.actions_view_content || 0)
      g.camps.add(r.campaign || '')
    }
    return Array.from(map.values()).map(g => {
      const ga4 = ga4Map.get(g.id) || { ga4Revenue: 0, ga4Views: 0, ga4Qty: 0 }
      return {
      ...g, campaigns: g.camps.size,
      ga4Revenue: ga4.ga4Revenue,
      ga4Views:   ga4.ga4Views,
      ga4Qty:     ga4.ga4Qty,
      ga4Roas:    g.spend ? ga4.ga4Revenue / g.spend : 0,
      ctr:    g.impressions ? g.clicks / g.impressions * 100 : 0,
      roas:   g.spend ? g.revenue / g.spend : 0,
      cvr:    g.clicks ? g.purchases / g.clicks * 100 : 0,
      atcRate:g.views  ? g.atc / g.views * 100 : 0,
      cpa:    g.purchases ? g.spend / g.purchases : 0,
      v2b:    g.views ? g.purchases / g.views * 100 : 0,
    }})
  }, [inRange, ga4Map])

  // ── Campaign aggregation ──────────────────────────────────────────────────
  const campaigns = useMemo(() => {
    const map = new Map()
    for (const r of inRange) {
      const k = r.campaign || '—'
      if (!map.has(k)) map.set(k, { name:k, spend:0, impressions:0, clicks:0, purchases:0, revenue:0, atc:0, prods: new Set() })
      const g = map.get(k)
      g.spend       += Number(r.spend || 0)
      g.impressions += Number(r.impressions || 0)
      g.clicks      += Number(r.clicks || 0)
      g.purchases   += Number(r.actions_purchase || 0)
      g.revenue     += Number(r.action_values_purchase || 0)
      g.atc         += Number(r.actions_add_to_cart || 0)
      g.prods.add(r.product_id)
    }
    return Array.from(map.values()).map(g => ({
      ...g, products: g.prods.size,
      roas: g.spend ? g.revenue / g.spend : 0,
      ctr:  g.impressions ? g.clicks / g.impressions * 100 : 0,
      cvr:  g.clicks ? g.purchases / g.clicks * 100 : 0,
      cpa:  g.purchases ? g.spend / g.purchases : 0,
    }))
  }, [inRange])

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const totalSpend  = inRange.reduce((s, r) => s + Number(r.spend || 0), 0)
  const totalRev    = inRange.reduce((s, r) => s + Number(r.action_values_purchase || 0), 0)
  const totalPurch  = inRange.reduce((s, r) => s + Number(r.actions_purchase || 0), 0)
  const totalAtc    = inRange.reduce((s, r) => s + Number(r.actions_add_to_cart || 0), 0)
  const totalViews  = inRange.reduce((s, r) => s + Number(r.actions_view_content || 0), 0)
  const blendedRoas = totalSpend ? totalRev / totalSpend : 0
  const uniqueProds = new Set(inRange.map(r => r.product_id)).size

  function onSort(col) { setSort(s => ({ col, dir: s.col === col && s.dir === 'desc' ? 'asc' : 'desc' })) }

  const rows = tab === 'campaigns' ? campaigns : products
  const maxSpend = Math.max(...rows.map(r => r.spend || 0), 1)

  const filtered = useMemo(() => {
    let out = rows
    if (search) { const q = search.toLowerCase(); out = out.filter(r => (r.name || r.id || '').toLowerCase().includes(q)) }
    return [...out].sort((a, b) => {
      const av = a[sort.col] ?? 0, bv = b[sort.col] ?? 0
      return sort.dir === 'asc' ? av - bv : bv - av
    })
  }, [rows, search, sort])

  const TAB = (key, label) => (
    <button onClick={() => { setTab(key); setSort({ col: 'spend', dir: 'desc' }) }} style={{
      padding: '6px 16px', borderRadius: 6, fontSize: 12, cursor: 'pointer', border: 'none',
      background: tab === key ? 'var(--color-accent)' : 'var(--color-background-secondary)',
      color: tab === key ? '#fff' : 'var(--color-text-secondary)',
    }}>{label}</button>
  )

  if (raw.length === 0) return (
    <div style={{ padding: 40, color: 'var(--color-text-secondary)', fontSize: 14 }}>
      No catalog data — click <strong>Sync everything</strong> on the Upload page.
    </div>
  )

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1400 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Meta Catalog / DPA — Product Intelligence</h1>
        <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
          {uniqueProds} unique products · {inRange.length} rows · catalog + DPA only
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12, marginBottom: 28 }}>
        <KpiCard label="Total Spend"     value={fmtC(totalSpend)} />
        <KpiCard label="Revenue"         value={fmtC(totalRev)} />
        <KpiCard label="Blended ROAS"    value={fmtR(blendedRoas)} color={blendedRoas >= 2 ? '#22c55e' : blendedRoas >= 1 ? '#f59e0b' : '#ef4444'} />
        <KpiCard label="Purchases"       value={fmtN(Math.round(totalPurch))} />
        <KpiCard label="Add to Cart"     value={fmtN(Math.round(totalAtc))} sub={totalViews ? fmtP(totalAtc / totalViews * 100) + ' ATC rate' : null} />
        <KpiCard label="Unique Products" value={fmtN(uniqueProds)} />
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16 }}>
        {TAB('products',  'By Product')}
        {TAB('funnel',    'Funnel View')}
        {TAB('campaigns', 'By Campaign')}
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…"
          style={{ marginLeft: 'auto', padding: '6px 12px', borderRadius: 6, border: '0.5px solid var(--color-border)', background: 'var(--color-background-secondary)', color: 'var(--color-text-primary)', fontSize: 12, width: 220 }} />
      </div>

      {/* ── BY PRODUCT ── */}
      {tab === 'products' && (
        <div style={{ background: 'var(--color-background-secondary)', borderRadius: 10, border: '0.5px solid var(--color-border)', overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--color-background-tertiary, #1a1a1a)' }}>
                <th style={{ ...TH, minWidth: 200 }}>Product</th>
                <th style={{ ...TH, width: 90, fontSize: 10 }}>Product ID</th>
                <SortTh col="spend"      label="Spend"      sort={sort} onSort={onSort} />
                <SortTh col="roas"       label="ROAS"       sort={sort} onSort={onSort} />
                <SortTh col="revenue"    label="Revenue"    sort={sort} onSort={onSort} />
                <SortTh col="purchases"  label="Purchases"  sort={sort} onSort={onSort} />
                <SortTh col="cpa"        label="CPA"        sort={sort} onSort={onSort} />
                <SortTh col="atc"        label="ATC"        sort={sort} onSort={onSort} title="Add to Cart" />
                <SortTh col="atcRate"    label="ATC%"       sort={sort} onSort={onSort} title="ATC / Views" />
                <SortTh col="cvr"        label="CVR%"       sort={sort} onSort={onSort} title="Purchases / Clicks" />
                <SortTh col="ctr"        label="CTR%"       sort={sort} onSort={onSort} />
                <SortTh col="campaigns"  label="Camps"      sort={sort} onSort={onSort} title="# campaigns showing this product" />
                <th style={{ ...TH, borderLeft: '1px solid rgba(52,211,153,0.3)', color: '#34d399' }}>GA4 Rev</th>
                <th style={{ ...TH, color: '#34d399' }}>GA4 ROAS</th>
                <th style={{ ...TH, color: '#34d399' }}>GA4 Views</th>
                <th style={{ ...TH, color: '#34d399' }}>GA4 Qty</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && <tr><td colSpan={16} style={{ ...TD, textAlign: 'center', padding: 32, color: 'var(--color-text-secondary)' }}>No products found</td></tr>}
              {filtered.map((p, i) => (
                <React.Fragment key={p.id}>
                  <tr onClick={() => setExpanded(expandedProduct === p.id ? null : p.id)}
                      style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)', cursor: 'pointer' }}>
                    <td style={{ ...TD, maxWidth: 200 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 9, color: 'var(--color-text-secondary)', flexShrink: 0 }}>{expandedProduct === p.id ? '▼' : '▶'}</span>
                        <span title={p.name} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                      </div>
                    </td>
                    <td style={{ ...TDs, fontSize: 10 }}>{p.id}</td>
                    <td style={TD}>
                      <div>{fmtC(p.spend)}</div>
                      <MiniBar value={p.spend} max={maxSpend} />
                    </td>
                    <td style={TD}><RoasBadge roas={p.roas} /></td>
                    <td style={TD}>{fmtC(p.revenue)}</td>
                    <td style={TDs}>{fmtN(Math.round(p.purchases))}</td>
                    <td style={TDs}>{fmtC(p.cpa)}</td>
                    <td style={TDs}>{fmtN(Math.round(p.atc))}</td>
                    <td style={{ ...TD, color: p.atcRate > 10 ? '#22c55e' : p.atcRate > 5 ? '#f59e0b' : undefined }}>{fmtP(p.atcRate)}</td>
                    <td style={{ ...TD, color: p.cvr > 2 ? '#22c55e' : p.cvr > 0.5 ? '#f59e0b' : undefined }}>{fmtP(p.cvr)}</td>
                    <td style={TDs}>{fmtP(p.ctr)}</td>
                    <td style={TDs}>{p.campaigns}</td>
                    <td style={{ ...TD, borderLeft: '1px solid rgba(52,211,153,0.15)', color: p.ga4Revenue > 0 ? '#34d399' : 'var(--color-text-secondary)' }}>{p.ga4Revenue > 0 ? fmtC(p.ga4Revenue) : '—'}</td>
                    <td style={{ ...TD, color: p.ga4Roas >= 2 ? '#22c55e' : p.ga4Roas >= 1 ? '#f59e0b' : p.ga4Roas > 0 ? '#ef4444' : 'var(--color-text-secondary)', fontWeight: p.ga4Roas > 0 ? 600 : 400 }}>{p.ga4Roas > 0 ? fmtR(p.ga4Roas) : '—'}</td>
                    <td style={TDs}>{p.ga4Views > 0 ? fmtN(Math.round(p.ga4Views)) : '—'}</td>
                    <td style={TDs}>{p.ga4Qty > 0 ? fmtN(Math.round(p.ga4Qty)) : '—'}</td>
                  </tr>
                  {expandedProduct === p.id && (
                    <tr>
                      <td colSpan={12} style={{ padding: '0 12px 12px 36px', background: 'rgba(127,119,221,0.05)' }}>
                        <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', margin: '8px 0 6px', fontWeight: 600, letterSpacing: '0.08em' }}>
                          CAMPAIGN BREAKDOWN — {p.name}
                        </div>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                          <thead>
                            <tr>{['Campaign','Spend','ROAS','Revenue','Purchases','ATC','Views'].map(h => (
                              <th key={h} style={{ ...TH, fontSize: 10, padding: '5px 10px' }}>{h}</th>
                            ))}</tr>
                          </thead>
                          <tbody>
                            {inRange
                              .filter(r => parseProductId(r.product_id).id === p.id)
                              .reduce((acc, r) => {
                                const k = r.campaign || '—'
                                const ex = acc.find(x => x.name === k)
                                if (ex) {
                                  ex.spend    += Number(r.spend || 0)
                                  ex.revenue  += Number(r.action_values_purchase || 0)
                                  ex.purchases+= Number(r.actions_purchase || 0)
                                  ex.atc      += Number(r.actions_add_to_cart || 0)
                                  ex.views    += Number(r.actions_view_content || 0)
                                } else {
                                  acc.push({ name: k, spend: Number(r.spend||0), revenue: Number(r.action_values_purchase||0), purchases: Number(r.actions_purchase||0), atc: Number(r.actions_add_to_cart||0), views: Number(r.actions_view_content||0) })
                                }
                                return acc
                              }, [])
                              .sort((a, b) => b.spend - a.spend)
                              .map((c, ci) => (
                                <tr key={ci}>
                                  <td style={{ ...TD, fontSize: 11, maxWidth: 280 }}><span title={c.name} style={{ overflow:'hidden', textOverflow:'ellipsis', display:'block', whiteSpace:'nowrap' }}>{c.name}</span></td>
                                  <td style={{ ...TD, fontSize: 11 }}>{fmtC(c.spend)}</td>
                                  <td style={{ ...TD, fontSize: 11 }}><RoasBadge roas={c.spend ? c.revenue/c.spend : 0} /></td>
                                  <td style={{ ...TD, fontSize: 11 }}>{fmtC(c.revenue)}</td>
                                  <td style={{ ...TDs, fontSize: 11 }}>{fmtN(Math.round(c.purchases))}</td>
                                  <td style={{ ...TDs, fontSize: 11 }}>{fmtN(Math.round(c.atc))}</td>
                                  <td style={{ ...TDs, fontSize: 11 }}>{fmtN(Math.round(c.views))}</td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── FUNNEL VIEW ── */}
      {tab === 'funnel' && (
        <div style={{ background: 'var(--color-background-secondary)', borderRadius: 10, border: '0.5px solid var(--color-border)', overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--color-background-tertiary, #1a1a1a)' }}>
                <th style={{ ...TH, minWidth: 200 }}>Product</th>
                <SortTh col="views"    label="PDP Views"   sort={sort} onSort={onSort} />
                <SortTh col="atc"      label="Add to Cart" sort={sort} onSort={onSort} />
                <SortTh col="atcRate"  label="ATC Rate"    sort={sort} onSort={onSort} title="ATC / Views" />
                <SortTh col="purchases"label="Purchases"   sort={sort} onSort={onSort} />
                <SortTh col="v2b"      label="View→Buy%"   sort={sort} onSort={onSort} title="Purchases / PDP Views" />
                <SortTh col="revenue"  label="Revenue"     sort={sort} onSort={onSort} />
                <SortTh col="spend"    label="Spend"       sort={sort} onSort={onSort} />
                <SortTh col="roas"     label="ROAS"        sort={sort} onSort={onSort} />
              </tr>
            </thead>
            <tbody>
              {filtered.filter(p => p.views > 0).map((p, i) => {
                const maxViews = Math.max(...filtered.map(x => x.views || 0), 1)
                return (
                  <tr key={i} style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                    <td style={{ ...TD, maxWidth: 200 }}><span title={p.name} style={{ overflow:'hidden', textOverflow:'ellipsis', display:'block', whiteSpace:'nowrap' }}>{p.name}</span></td>
                    <td style={TD}><div>{fmtN(Math.round(p.views))}</div><MiniBar value={p.views} max={maxViews} color='#60a5fa' /></td>
                    <td style={TD}><div>{fmtN(Math.round(p.atc))}</div><MiniBar value={p.atc} max={maxViews} color='#a78bfa' /></td>
                    <td style={{ ...TD, color: p.atcRate > 10 ? '#22c55e' : p.atcRate > 5 ? '#f59e0b' : undefined }}>{fmtP(p.atcRate)}</td>
                    <td style={TD}><div>{fmtN(Math.round(p.purchases))}</div><MiniBar value={p.purchases} max={maxViews} color='#34d399' /></td>
                    <td style={{ ...TD, color: p.v2b > 2 ? '#22c55e' : p.v2b > 0.5 ? '#f59e0b' : '#ef4444' }}>{fmtP(p.v2b)}</td>
                    <td style={TD}>{fmtC(p.revenue)}</td>
                    <td style={TDs}>{fmtC(p.spend)}</td>
                    <td style={TD}><RoasBadge roas={p.roas} /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── BY CAMPAIGN ── */}
      {tab === 'campaigns' && (
        <div style={{ background: 'var(--color-background-secondary)', borderRadius: 10, border: '0.5px solid var(--color-border)', overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--color-background-tertiary, #1a1a1a)' }}>
                <th style={{ ...TH, minWidth: 260 }}>Campaign</th>
                <SortTh col="spend"     label="Spend"     sort={sort} onSort={onSort} />
                <SortTh col="roas"      label="ROAS"      sort={sort} onSort={onSort} />
                <SortTh col="revenue"   label="Revenue"   sort={sort} onSort={onSort} />
                <SortTh col="purchases" label="Purchases" sort={sort} onSort={onSort} />
                <SortTh col="cpa"       label="CPA"       sort={sort} onSort={onSort} />
                <SortTh col="atc"       label="ATC"       sort={sort} onSort={onSort} />
                <SortTh col="ctr"       label="CTR%"      sort={sort} onSort={onSort} />
                <SortTh col="cvr"       label="CVR%"      sort={sort} onSort={onSort} />
                <SortTh col="products"  label="Products"  sort={sort} onSort={onSort} />
              </tr>
            </thead>
            <tbody>
              {filtered.map((c, i) => (
                <tr key={i} style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                  <td style={{ ...TD, maxWidth: 320 }}><span title={c.name} style={{ overflow:'hidden', textOverflow:'ellipsis', display:'block', whiteSpace:'nowrap' }}>{c.name}</span></td>
                  <td style={TD}>{fmtC(c.spend)}</td>
                  <td style={TD}><RoasBadge roas={c.roas} /></td>
                  <td style={TD}>{fmtC(c.revenue)}</td>
                  <td style={TDs}>{fmtN(Math.round(c.purchases))}</td>
                  <td style={TDs}>{fmtC(c.cpa)}</td>
                  <td style={TDs}>{fmtN(Math.round(c.atc))}</td>
                  <td style={TDs}>{fmtP(c.ctr)}</td>
                  <td style={TDs}>{fmtP(c.cvr)}</td>
                  <td style={TDs}>{c.products}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ marginTop: 10, fontSize: 11, color: 'var(--color-text-secondary)' }}>
        {filtered.length} {tab === 'campaigns' ? 'campaigns' : 'products'} shown
        {tab === 'products' && ' · click row to expand campaign breakdown'}
      </div>
    </div>
  )
}
