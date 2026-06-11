import React, { useMemo, useState } from 'react'
import { useData } from '../data/store.jsx'
import { useFilters } from '../hooks/useFilters.js'
import FilterBar from '../components/FilterBar.jsx'
import DrillTable from '../components/DrillTable.jsx'

const BUCKETS = [
  { id: 1, label: 'Bucket 1', range: 'Top 265 SKUs',     color: '#1db954', desc: 'Hero — highest volume SKUs' },
  { id: 2, label: 'Bucket 2', range: '266–500 SKUs',     color: '#6366f1', desc: 'Strong performers' },
  { id: 3, label: 'Bucket 3', range: '501–750 SKUs',     color: '#3b82f6', desc: 'Mid-tier' },
  { id: 4, label: 'Bucket 4', range: '751–1000 SKUs',    color: '#f59e0b', desc: 'Developing' },
  { id: 5, label: 'Bucket 5', range: '1001–1250 SKUs',   color: '#e8457a', desc: 'Low volume' },
  { id: 6, label: 'Bucket 6', range: '1251–1500 SKUs',   color: '#8b5cf6', desc: 'Tail' },
  { id: 7, label: 'Bucket 7', range: '1501–1750 SKUs',   color: '#06b6d4', desc: 'Deep tail' },
  { id: 8, label: 'Bucket 8', range: '1751+ SKUs',       color: '#64748b', desc: 'Long tail' },
]

function fmtINR(v) {
  if (!v || isNaN(v)) return '—'
  if (v >= 10000000) return `₹${(v/10000000).toFixed(2)}Cr`
  if (v >= 100000)   return `₹${(v/100000).toFixed(1)}L`
  if (v >= 1000)     return `₹${(v/1000).toFixed(1)}K`
  return `₹${Math.round(v)}`
}
function fmtPct(v) { return v > 0 ? `${(v*100).toFixed(1)}%` : '—' }
function fmtX(v)   { return v > 0 ? `${v.toFixed(2)}x` : '—' }

export default function SKUBuckets() {
  const { state }  = useData()
  const filters    = useFilters('last90')
  const { filterRows } = filters
  const [activeBucket, setActiveBucket] = useState(null)

  const rows = useMemo(() => filterRows(state.metaDB || []), [state.metaDB, filters])

  // Aggregate by SKU/product
  const byProduct = useMemo(() => {
    const map = {}
    for (const r of rows) {
      const k = r.product || r.adName || 'Unknown'
      if (!map[k]) map[k] = { product: k, spend: 0, revenue: 0, orders: 0, clicks: 0, impressions: 0 }
      map[k].spend       += r.spend || 0
      map[k].revenue     += r.revenue || r.gaRevenue || 0
      map[k].orders      += r.orders || r.gaOrders || 0
      map[k].clicks      += r.clicks || 0
      map[k].impressions += r.impressions || 0
    }
    return Object.values(map).sort((a, b) => b.revenue - a.revenue)
  }, [rows])

  const totalRevenue = byProduct.reduce((s, r) => s + r.revenue, 0)
  const totalSpend   = byProduct.reduce((s, r) => s + r.spend, 0)

  // Assign buckets based on rank
  const bucketRanges = [0, 265, 500, 750, 1000, 1250, 1500, 1750, Infinity]
  const withBucket = byProduct.map((p, i) => {
    const rank = i + 1
    const bucketIdx = bucketRanges.findIndex((end, j) => rank > bucketRanges[j] && rank <= bucketRanges[j+1])
    return { ...p, rank, bucketId: bucketIdx >= 0 ? bucketIdx + 1 : 8, roas: p.spend > 0 ? p.revenue / p.spend : 0, cpc: p.clicks > 0 ? p.spend / p.clicks : 0 }
  })

  // Aggregate by bucket
  const bucketStats = BUCKETS.map(b => {
    const bRows = withBucket.filter(r => r.bucketId === b.id)
    const spend   = bRows.reduce((s, r) => s + r.spend, 0)
    const revenue = bRows.reduce((s, r) => s + r.revenue, 0)
    const orders  = bRows.reduce((s, r) => s + r.orders, 0)
    const skus    = bRows.length
    return {
      ...b, skus, spend, revenue, orders,
      roas:        spend > 0 ? revenue / spend : 0,
      spendPct:    totalSpend > 0 ? spend / totalSpend : 0,
      revenuePct:  totalRevenue > 0 ? revenue / totalRevenue : 0,
    }
  })

  const drillRows = activeBucket ? withBucket.filter(r => r.bucketId === activeBucket) : []

  const cols = [
    { key: 'product',    label: 'Product / SKU', align: 'left', bold: true },
    { key: 'rank',       label: 'Rank',           render: v => `#${v}` },
    { key: 'spend',      label: 'Spend',          render: fmtINR },
    { key: 'revenue',    label: 'Revenue',        render: fmtINR, color: () => 'var(--purple)' },
    { key: 'roas',       label: 'ROAS',           render: fmtX, color: v => v>=2?'var(--green)':v>=1?'var(--amber)':'var(--red)' },
    { key: 'orders',     label: 'Orders',         render: v => v > 0 ? Math.round(v).toLocaleString('en-IN') : '—' },
    { key: 'cpc',        label: 'CPC',            render: fmtINR },
  ]

  return (
    <div style={{ padding: '24px 28px' }}>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 2 }}>SKU Bucket Performance</h1>
        <div style={{ fontSize: 12, color: 'var(--text3)' }}>
          Revenue % · Spend % · ROAS by bucket · {byProduct.length} total SKUs ranked by revenue
        </div>
      </div>

      <FilterBar filters={filters} showAdvanced={false} showCohort={false} showSaleTag={false} />

      {/* Bucket cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 10, marginBottom: 20 }}>
        {bucketStats.map(b => (
          <div key={b.id} onClick={() => setActiveBucket(activeBucket === b.id ? null : b.id)}
            style={{
              background: activeBucket === b.id ? `${b.color}18` : 'var(--bg2)',
              border: `1px solid ${activeBucket === b.id ? b.color : 'var(--border)'}`,
              borderRadius: 10, padding: '14px 16px', cursor: 'pointer', transition: 'all .15s',
            }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: b.color }}>{b.label}</span>
              <span style={{ fontSize: 10, color: 'var(--text3)', background: 'var(--bg3)', padding: '2px 6px', borderRadius: 4 }}>
                {b.skus} SKUs
              </span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 10 }}>{b.range}</div>

            {/* Revenue % bar */}
            <div style={{ marginBottom: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                <span style={{ fontSize: 10, color: 'var(--text3)' }}>Revenue %</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: b.color }}>{(b.revenuePct*100).toFixed(1)}%</span>
              </div>
              <div style={{ height: 4, background: 'var(--bg4)', borderRadius: 2 }}>
                <div style={{ width: `${Math.min(b.revenuePct*100,100)}%`, height: '100%', background: b.color, borderRadius: 2 }} />
              </div>
            </div>

            {/* Spend % bar */}
            <div style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                <span style={{ fontSize: 10, color: 'var(--text3)' }}>Spend %</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text2)' }}>{(b.spendPct*100).toFixed(1)}%</span>
              </div>
              <div style={{ height: 4, background: 'var(--bg4)', borderRadius: 2 }}>
                <div style={{ width: `${Math.min(b.spendPct*100,100)}%`, height: '100%', background: 'var(--blue)', borderRadius: 2, opacity: 0.6 }} />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 10, color: 'var(--text3)' }}>Revenue</div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{fmtINR(b.revenue)}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 10, color: 'var(--text3)' }}>ROAS</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: b.roas>=2?'var(--green)':b.roas>=1?'var(--amber)':'var(--red)' }}>{fmtX(b.roas)}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Summary table */}
      <div style={{ overflowX: 'auto', borderRadius: 8, border: '0.5px solid var(--border)', marginBottom: 20 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: 'var(--bg3)', borderBottom: '0.5px solid var(--border2)' }}>
              {['Bucket', 'Range', 'SKUs', 'Spend', 'Spend %', 'Revenue', 'Revenue %', 'ROAS', 'Orders'].map((h, i) => (
                <th key={h} style={{ padding: '8px 12px', fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: i < 2 ? 'left' : 'right', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {bucketStats.map(b => (
              <tr key={b.id} onClick={() => setActiveBucket(activeBucket === b.id ? null : b.id)}
                style={{ borderBottom: '0.5px solid var(--border)', cursor: 'pointer', background: activeBucket === b.id ? `${b.color}0d` : 'transparent' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg3)'}
                onMouseLeave={e => e.currentTarget.style.background = activeBucket === b.id ? `${b.color}0d` : 'transparent'}>
                <td style={{ padding: '8px 12px', fontWeight: 700, color: b.color }}>{b.label}</td>
                <td style={{ padding: '8px 12px', color: 'var(--text3)', fontSize: 11 }}>{b.range}</td>
                <td style={{ padding: '8px 12px', textAlign: 'right' }}>{b.skus}</td>
                <td style={{ padding: '8px 12px', textAlign: 'right' }}>{fmtINR(b.spend)}</td>
                <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--blue)' }}>{(b.spendPct*100).toFixed(1)}%</td>
                <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--purple)' }}>{fmtINR(b.revenue)}</td>
                <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: b.color }}>{(b.revenuePct*100).toFixed(1)}%</td>
                <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: b.roas>=2?'var(--green)':b.roas>=1?'var(--amber)':'var(--red)' }}>{fmtX(b.roas)}</td>
                <td style={{ padding: '8px 12px', textAlign: 'right' }}>{b.orders > 0 ? Math.round(b.orders).toLocaleString('en-IN') : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* SKU drill-down */}
      {activeBucket && (
        <div style={{ marginTop: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div>
              <span style={{ fontSize: 14, fontWeight: 700, color: BUCKETS.find(b=>b.id===activeBucket)?.color }}>
                {BUCKETS.find(b=>b.id===activeBucket)?.label}
              </span>
              <span style={{ fontSize: 12, color: 'var(--text3)', marginLeft: 8 }}>
                → {drillRows.length} SKUs · click another bucket to switch
              </span>
            </div>
            <button onClick={() => setActiveBucket(null)} style={{ padding: '4px 10px', fontSize: 11, borderRadius: 6, background: 'var(--bg3)', border: '0.5px solid var(--border2)', color: 'var(--text2)', cursor: 'pointer' }}>✕ Close</button>
          </div>
          <DrillTable columns={cols} data={drillRows} defaultSort={{ key: 'revenue', dir: 'desc' }} />
        </div>
      )}

      {!rows.length && (
        <div style={{ background: 'var(--bg2)', border: '0.5px solid var(--border)', borderRadius: 8, padding: '40px', textAlign: 'center', color: 'var(--text3)' }}>
          Sync Windsor data to see SKU bucket performance
        </div>
      )}
    </div>
  )
}
