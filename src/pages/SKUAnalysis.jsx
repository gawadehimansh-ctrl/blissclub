import React, { useMemo, useState, useCallback } from 'react'
import { useData } from '../data/store.jsx'
import { useFilters } from '../hooks/useFilters.js'
import FilterBar from '../components/FilterBar.jsx'
import DrillTable from '../components/DrillTable.jsx'
import { fmtINR, fmtINRCompact, fmtX, fmtPct } from '../utils/formatters.js'
import * as XLSX from 'xlsx'

// ── Bucket config (matches Excel exactly) ────────────────────────────────────
const BUCKETS = [
  { id: 1, label: 'Bucket 1', range: 'Top 265',    skuRange: [1, 265],       color: '#1db954' },
  { id: 2, label: 'Bucket 2', range: '266–500',    skuRange: [266, 500],     color: '#6366f1' },
  { id: 3, label: 'Bucket 3', range: '501–1,000',  skuRange: [501, 1000],    color: '#3b82f6' },
  { id: 4, label: 'Bucket 4', range: '1,001–1,500',skuRange: [1001, 1500],   color: '#f59e0b' },
  { id: 5, label: 'Bucket 5', range: '1,501–2,000',skuRange: [1501, 2000],   color: '#e8457a' },
  { id: 6, label: 'Bucket 6', range: '2,001–2,500',skuRange: [2001, 2500],   color: '#8b5cf6' },
  { id: 7, label: 'Bucket 7', range: '2,501–3,000',skuRange: [2501, 3000],   color: '#06b6d4' },
  { id: 8, label: 'Bucket 8', range: '3,001+',     skuRange: [3001, Infinity],color: '#64748b' },
]

const MONTHS = ['Nov-2025', 'Dec-2025', 'Jan-2026', 'Feb-2026', 'Mar-2026', 'Apr-2026', 'May-2026']
const MONTH_LABELS = ['Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May']

const TABS = ['Bucket Overview', 'SKU Master', 'Daily Tracker']

// ── Parse Master sheet ────────────────────────────────────────────────────────
function parseMasterSheet(ws) {
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null })
  // Row index 1 = header1 (months), row 2 = header2 (Revenue/Spend/ROAS), row 3+ = data
  const skus = []
  for (let i = 3; i < rows.length; i++) {
    const r = rows[i]
    if (!r[1]) continue
    const sku = {
      rank: r[0],
      name: r[1],
      top50: r[2] === '✓',
      bucket: r[27] || '',
      months: {},
      total: { revenue: 0, spend: 0, roas: 0 },
    }
    // Months start at col 3, each month = 3 cols (Rev, Spend, ROAS)
    MONTHS.forEach((m, mi) => {
      const base = 3 + mi * 3
      const rev = parseFloat(r[base]) || 0
      const spend = parseFloat(r[base + 1]) || 0
      const roas = parseFloat(r[base + 2]) || 0
      sku.months[m] = { revenue: rev, spend, roas }
    })
    // Total (last 3 cols before bucket)
    sku.total.revenue = parseFloat(r[24]) || 0
    sku.total.spend   = parseFloat(r[25]) || 0
    sku.total.roas    = parseFloat(r[26]) || 0
    skus.push(sku)
  }
  return skus
}

// ── Parse Bucketing sheet ─────────────────────────────────────────────────────
function parseBucketingSheet(ws) {
  const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null })
  // Skip header row, each bucket = 4 rows (Rev%, Spend%, ROAS, blank)
  const buckets = {}
  let currentBucket = null
  const dayHeaders = raw[0] ? raw[0].slice(5) : [] // day columns start at index 5

  for (let i = 1; i < raw.length; i++) {
    const r = raw[i]
    if (r[0]) currentBucket = r[0] // e.g. "Bucket 1"
    if (!currentBucket) continue
    if (!buckets[currentBucket]) buckets[currentBucket] = { days: {} }

    const metric = r[2]
    const avgMo  = parseFloat(r[3]) || 0
    const junTotal = parseFloat(r[4]) || 0

    if (!buckets[currentBucket].days._avg) buckets[currentBucket].days._avg = {}
    if (!buckets[currentBucket].days._total) buckets[currentBucket].days._total = {}

    if (metric === 'Rev %')   { buckets[currentBucket].days._avg.revPct = avgMo;   buckets[currentBucket].days._total.revPct = junTotal }
    if (metric === 'Spend %') { buckets[currentBucket].days._avg.spendPct = avgMo; buckets[currentBucket].days._total.spendPct = junTotal }
    if (metric === 'ROAS')    { buckets[currentBucket].days._avg.roas = avgMo;     buckets[currentBucket].days._total.roas = junTotal }

    // Daily values (col 5 onwards)
    for (let d = 0; d < dayHeaders.length; d++) {
      const dayKey = `${d + 1}-Jun`
      if (!buckets[currentBucket].days[dayKey]) buckets[currentBucket].days[dayKey] = {}
      const val = parseFloat(raw[i][5 + d]) || 0
      if (metric === 'Rev %')   buckets[currentBucket].days[dayKey].revPct = val
      if (metric === 'Spend %') buckets[currentBucket].days[dayKey].spendPct = val
      if (metric === 'ROAS')    buckets[currentBucket].days[dayKey].roas = val
    }
  }
  return buckets
}

// ── Mini sparkline (SVG) ──────────────────────────────────────────────────────
function Spark({ values, color, width = 80, height = 24 }) {
  if (!values?.length) return null
  const valid = values.filter(v => v > 0)
  if (!valid.length) return <span style={{ color: 'var(--text3)', fontSize: 10 }}>—</span>
  const min = Math.min(...valid)
  const max = Math.max(...valid)
  const range = max - min || 1
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * width
    const y = height - ((v - min) / range) * (height - 4) - 2
    return `${x},${y}`
  }).join(' ')
  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ── ROAS color helper ─────────────────────────────────────────────────────────
function roasColor(v) {
  if (!v || v <= 0) return 'var(--text3)'
  if (v >= 3)  return 'var(--green)'
  if (v >= 1.5) return 'var(--amber)'
  return 'var(--red)'
}

// ── Main component ────────────────────────────────────────────────────────────
export default function SKUAnalysis() {
  const { state } = useData()
  const filters   = useFilters('last90')
  const { filterRows } = filters

  const [tab, setTab]         = useState(0)
  const [skuData, setSkuData] = useState(null)      // parsed master sheet
  const [bktData, setBktData] = useState(null)      // parsed bucketing sheet
  const [fileName, setFileName] = useState('')
  const [activeBucket, setActiveBucket] = useState(null)
  const [selectedMonth, setSelectedMonth] = useState('total')
  const [search, setSearch]   = useState('')
  const [uploading, setUploading] = useState(false)

  // ── Windsor live data (fallback when no Excel) ────────────────────────────
  const liveRows = useMemo(() => filterRows(state.metaDB || []), [state.metaDB, filters])
  const liveByProduct = useMemo(() => {
    const map = {}
    for (const r of liveRows) {
      const k = r.product || r.adName || 'Unknown'
      if (!map[k]) map[k] = { product: k, spend: 0, revenue: 0, orders: 0 }
      map[k].spend   += r.spend || 0
      map[k].revenue += r.revenue || r.gaRevenue || 0
      map[k].orders  += r.orders || r.gaOrders || 0
    }
    return Object.values(map).sort((a, b) => b.revenue - a.revenue)
  }, [liveRows])

  // ── File upload handler ───────────────────────────────────────────────────
  const handleFile = useCallback((file) => {
    if (!file) return
    setUploading(true)
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'binary' })
        const masterWs = wb.Sheets['Master']
        const bktWs    = wb.Sheets['Bucketing']
        if (masterWs) setSkuData(parseMasterSheet(masterWs))
        if (bktWs)    setBktData(parseBucketingSheet(bktWs))
      } catch(err) {
        console.error('Parse error:', err)
      }
      setUploading(false)
    }
    reader.readAsBinaryString(file)
  }, [])

  const onDrop = useCallback((e) => {
    e.preventDefault()
    const file = e.dataTransfer?.files?.[0] || e.target?.files?.[0]
    if (file) handleFile(file)
  }, [handleFile])

  // ── Derive bucket stats from Excel or live data ───────────────────────────
  const bucketStats = useMemo(() => {
    if (skuData) {
      return BUCKETS.map(b => {
        const bSkus = skuData.filter(s => {
          const rank = s.rank
          return rank >= b.skuRange[0] && rank <= b.skuRange[1]
        })
        const getMetric = (s) => {
          if (selectedMonth === 'total') return s.total
          return s.months[selectedMonth] || { revenue: 0, spend: 0, roas: 0 }
        }
        const totalRev   = bSkus.reduce((sum, s) => sum + getMetric(s).revenue, 0)
        const totalSpend = bSkus.reduce((sum, s) => sum + getMetric(s).spend, 0)
        const allRevs    = MONTHS.map(m => bSkus.reduce((sum, s) => sum + (s.months[m]?.revenue || 0), 0))
        return {
          ...b,
          skuCount: bSkus.length,
          revenue: totalRev,
          spend: totalSpend,
          roas: totalSpend > 0 ? totalRev / totalSpend : 0,
          trend: allRevs,
          avgRoas: bSkus.length > 0
            ? bSkus.reduce((sum, s) => sum + (getMetric(s).roas || 0), 0) / bSkus.filter(s => getMetric(s).roas > 0).length
            : 0,
        }
      })
    }
    // Live Windsor fallback
    const totalRev   = liveByProduct.reduce((s, r) => s + r.revenue, 0)
    const totalSpend = liveByProduct.reduce((s, r) => s + r.spend, 0)
    const bucketRanges = [0, 265, 500, 1000, 1500, 2000, 2500, 3000, Infinity]
    return BUCKETS.map((b, bi) => {
      const bRows = liveByProduct.filter((_, i) => {
        const rank = i + 1
        return rank >= bucketRanges[bi] + 1 && rank <= bucketRanges[bi + 1]
      })
      const rev   = bRows.reduce((s, r) => s + r.revenue, 0)
      const spend = bRows.reduce((s, r) => s + r.spend, 0)
      return { ...b, skuCount: bRows.length, revenue: rev, spend, roas: spend > 0 ? rev / spend : 0, trend: [], avgRoas: 0 }
    })
  }, [skuData, liveByProduct, selectedMonth])

  // ── SKU master table rows ─────────────────────────────────────────────────
  const masterRows = useMemo(() => {
    if (!skuData) return []
    return skuData
      .filter(s => !search || s.name?.toLowerCase().includes(search.toLowerCase()))
      .filter(s => !activeBucket || (s.rank >= BUCKETS[activeBucket-1]?.skuRange[0] && s.rank <= BUCKETS[activeBucket-1]?.skuRange[1]))
      .slice(0, 300)
  }, [skuData, search, activeBucket])

  // ── Daily tracker data ────────────────────────────────────────────────────
  const juneDays = useMemo(() => {
    if (!bktData) return []
    const b1 = bktData['Bucket 1']
    if (!b1) return []
    return Object.keys(b1.days).filter(k => k.includes('-Jun')).sort((a, b) => parseInt(a) - parseInt(b))
  }, [bktData])

  const S = {
    page:    { padding: '24px 28px' },
    header:  { marginBottom: 20 },
    h1:      { fontSize: 22, fontWeight: 700, marginBottom: 4 },
    sub:     { fontSize: 12, color: 'var(--text3)' },
    tabBar:  { display: 'flex', gap: 4, marginBottom: 20, borderBottom: '0.5px solid var(--border)' },
    tab:     (active) => ({
      padding: '8px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
      color: active ? 'var(--text)' : 'var(--text3)',
      borderBottom: active ? '2px solid var(--blue)' : '2px solid transparent',
      background: 'transparent', border: 'none', borderBottom: active ? '2px solid var(--blue)' : '2px solid transparent',
    }),
    uploadBox: {
      border: '1.5px dashed var(--border2)', borderRadius: 12, padding: '32px 24px',
      textAlign: 'center', cursor: 'pointer', marginBottom: 20,
      background: 'var(--bg2)', transition: 'border-color .15s',
    },
    grid4:   { display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 10, marginBottom: 20 },
    grid8:   { display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 8, marginBottom: 20 },
    card:    (active, color) => ({
      background: active ? `${color}14` : 'var(--bg2)',
      border: `1px solid ${active ? color : 'var(--border)'}`,
      borderRadius: 10, padding: '14px 16px', cursor: 'pointer', transition: 'all .15s',
    }),
    tbl:     { width: '100%', borderCollapse: 'collapse', fontSize: 12 },
    th:      { padding: '8px 12px', fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' },
    td:      { padding: '8px 12px', borderBottom: '0.5px solid var(--border)' },
  }

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={S.header}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <h1 style={S.h1}>SKU Analysis</h1>
            <div style={S.sub}>
              {skuData
                ? `${skuData.length} SKUs loaded from ${fileName} · ${MONTHS.length} months of data`
                : 'Upload SKU bucketing Excel to analyse historical performance'}
            </div>
          </div>
          {skuData && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: 'var(--text3)' }}>Month</span>
              <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}
                style={{ fontSize: 11, padding: '4px 8px', borderRadius: 6, background: 'var(--bg3)', border: '0.5px solid var(--border2)', color: 'var(--text)', cursor: 'pointer' }}>
                <option value="total">7-Month Total</option>
                {MONTHS.map((m, i) => <option key={m} value={m}>{MONTH_LABELS[i]} {m.slice(-4)}</option>)}
              </select>
              <label style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, background: 'var(--bg3)', border: '0.5px solid var(--border2)', color: 'var(--text2)', cursor: 'pointer' }}>
                Replace file
                <input type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={e => handleFile(e.target.files?.[0])} />
              </label>
            </div>
          )}
        </div>
      </div>

      {/* Upload zone (shown when no file) */}
      {!skuData && (
        <label style={S.uploadBox} onDrop={onDrop} onDragOver={e => e.preventDefault()}>
          <input type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={e => handleFile(e.target.files?.[0])} />
          <div style={{ fontSize: 28, marginBottom: 8 }}>📊</div>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
            {uploading ? 'Parsing Excel…' : 'Drop SKU Bucketing Excel here'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text3)' }}>
            Needs a Master sheet (SKU × Month) and a Bucketing sheet (8 buckets × daily)
          </div>
          <div style={{ fontSize: 11, color: 'var(--blue)', marginTop: 8 }}>or click to browse</div>
        </label>
      )}

      {/* Tabs */}
      <div style={S.tabBar}>
        {TABS.map((t, i) => (
          <button key={t} style={S.tab(tab === i)} onClick={() => setTab(i)}>{t}</button>
        ))}
      </div>

      {/* ── TAB 0: Bucket Overview ── */}
      {tab === 0 && (
        <>
          {/* Bucket cards */}
          <div style={S.grid8}>
            {bucketStats.map(b => (
              <div key={b.id} style={S.card(activeBucket === b.id, b.color)}
                onClick={() => setActiveBucket(activeBucket === b.id ? null : b.id)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: b.color }}>{b.label}</span>
                  <span style={{ fontSize: 10, color: 'var(--text3)' }}>{b.skuCount} SKUs</span>
                </div>
                <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 10 }}>{b.range}</div>
                <div style={{ marginBottom: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                    <span style={{ fontSize: 10, color: 'var(--text3)' }}>Revenue</span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: b.color }}>{fmtINRCompact(b.revenue)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 10, color: 'var(--text3)' }}>Spend</span>
                    <span style={{ fontSize: 11, color: 'var(--text2)' }}>{fmtINRCompact(b.spend)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 10, color: 'var(--text3)' }}>ROAS</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: roasColor(b.roas) }}>{fmtX(b.roas)}</span>
                  </div>
                </div>
                {b.trend?.length > 0 && (
                  <Spark values={b.trend} color={b.color} width={110} height={22} />
                )}
              </div>
            ))}
          </div>

          {/* Summary table */}
          <div style={{ overflowX: 'auto', borderRadius: 8, border: '0.5px solid var(--border)', marginBottom: 20 }}>
            <table style={S.tbl}>
              <thead>
                <tr style={{ background: 'var(--bg3)', borderBottom: '0.5px solid var(--border2)' }}>
                  {['Bucket', 'SKU Range', 'SKUs', 'Revenue', 'Spend', 'ROAS', '7-Mo Avg ROAS', 'Rev Trend'].map((h, i) => (
                    <th key={h} style={{ ...S.th, textAlign: i < 2 ? 'left' : 'right' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bucketStats.map(b => (
                  <tr key={b.id} style={{ borderBottom: '0.5px solid var(--border)', cursor: 'pointer' }}
                    onClick={() => { setActiveBucket(b.id); setTab(1) }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg3)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <td style={{ ...S.td, fontWeight: 700, color: b.color }}>{b.label}</td>
                    <td style={{ ...S.td, color: 'var(--text3)', fontSize: 11 }}>{b.range}</td>
                    <td style={{ ...S.td, textAlign: 'right' }}>{b.skuCount}</td>
                    <td style={{ ...S.td, textAlign: 'right', color: 'var(--purple)' }}>{fmtINR(b.revenue)}</td>
                    <td style={{ ...S.td, textAlign: 'right' }}>{fmtINR(b.spend)}</td>
                    <td style={{ ...S.td, textAlign: 'right', fontWeight: 600, color: roasColor(b.roas) }}>{fmtX(b.roas)}</td>
                    <td style={{ ...S.td, textAlign: 'right', color: 'var(--text2)' }}>
                      {b.avgRoas > 0 ? fmtX(b.avgRoas) : '—'}
                    </td>
                    <td style={{ ...S.td, textAlign: 'right' }}>
                      <Spark values={b.trend} color={b.color} width={80} height={20} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Monthly breakdown per bucket (if Excel loaded) */}
          {skuData && activeBucket && (
            <div style={{ background: 'var(--bg2)', border: '0.5px solid var(--border)', borderRadius: 10, padding: 16, marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, color: BUCKETS[activeBucket-1]?.color }}>
                {BUCKETS[activeBucket-1]?.label} — Monthly Breakdown
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={S.tbl}>
                  <thead>
                    <tr style={{ background: 'var(--bg3)' }}>
                      <th style={{ ...S.th, textAlign: 'left' }}>Month</th>
                      <th style={{ ...S.th, textAlign: 'right' }}>Revenue</th>
                      <th style={{ ...S.th, textAlign: 'right' }}>Spend</th>
                      <th style={{ ...S.th, textAlign: 'right' }}>ROAS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {MONTHS.map((m, i) => {
                      const bSkus = skuData.filter(s => s.rank >= BUCKETS[activeBucket-1].skuRange[0] && s.rank <= BUCKETS[activeBucket-1].skuRange[1])
                      const rev   = bSkus.reduce((sum, s) => sum + (s.months[m]?.revenue || 0), 0)
                      const spend = bSkus.reduce((sum, s) => sum + (s.months[m]?.spend || 0), 0)
                      const roas  = spend > 0 ? rev / spend : 0
                      return (
                        <tr key={m} style={{ borderBottom: '0.5px solid var(--border)' }}>
                          <td style={{ ...S.td, fontWeight: 600 }}>{MONTH_LABELS[i]} {m.slice(-4)}</td>
                          <td style={{ ...S.td, textAlign: 'right', color: 'var(--purple)' }}>{fmtINR(rev)}</td>
                          <td style={{ ...S.td, textAlign: 'right' }}>{fmtINR(spend)}</td>
                          <td style={{ ...S.td, textAlign: 'right', fontWeight: 600, color: roasColor(roas) }}>{fmtX(roas)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── TAB 1: SKU Master ── */}
      {tab === 1 && (
        <>
          <div style={{ display: 'flex', gap: 10, marginBottom: 14, alignItems: 'center', flexWrap: 'wrap' }}>
            <input placeholder="Search SKU name…" value={search} onChange={e => setSearch(e.target.value)}
              style={{ flex: 1, minWidth: 200, padding: '7px 12px', borderRadius: 8, background: 'var(--bg3)', border: '0.5px solid var(--border2)', color: 'var(--text)', fontSize: 12 }} />
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button onClick={() => setActiveBucket(null)}
                style={{ padding: '5px 10px', fontSize: 11, borderRadius: 6, background: !activeBucket ? 'var(--blue)' : 'var(--bg3)', border: '0.5px solid var(--border2)', color: !activeBucket ? '#fff' : 'var(--text2)', cursor: 'pointer' }}>All</button>
              {BUCKETS.map(b => (
                <button key={b.id} onClick={() => setActiveBucket(activeBucket === b.id ? null : b.id)}
                  style={{ padding: '5px 10px', fontSize: 11, borderRadius: 6, background: activeBucket === b.id ? b.color : 'var(--bg3)', border: `0.5px solid ${activeBucket === b.id ? b.color : 'var(--border2)'}`, color: activeBucket === b.id ? '#fff' : 'var(--text2)', cursor: 'pointer' }}>
                  {b.label}
                </button>
              ))}
            </div>
          </div>

          {!skuData ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>Upload an Excel file to see SKU data</div>
          ) : (
            <div style={{ overflowX: 'auto', borderRadius: 8, border: '0.5px solid var(--border)' }}>
              <table style={S.tbl}>
                <thead>
                  <tr style={{ background: 'var(--bg3)', borderBottom: '0.5px solid var(--border2)', position: 'sticky', top: 0 }}>
                    <th style={{ ...S.th, textAlign: 'right', width: 40 }}>#</th>
                    <th style={{ ...S.th, textAlign: 'left' }}>Product Name</th>
                    <th style={{ ...S.th, textAlign: 'center' }}>Bucket</th>
                    <th style={{ ...S.th, textAlign: 'right' }}>Total Rev</th>
                    <th style={{ ...S.th, textAlign: 'right' }}>Total Spend</th>
                    <th style={{ ...S.th, textAlign: 'right' }}>Total ROAS</th>
                    {MONTH_LABELS.map((m, i) => (
                      <th key={m} style={{ ...S.th, textAlign: 'right', minWidth: 70 }}>{m}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {masterRows.map((s, idx) => {
                    const bkt = BUCKETS.find(b => s.rank >= b.skuRange[0] && s.rank <= b.skuRange[1])
                    return (
                      <tr key={idx} style={{ borderBottom: '0.5px solid var(--border)' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg3)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <td style={{ ...S.td, textAlign: 'right', color: 'var(--text3)', fontSize: 11 }}>{s.rank}</td>
                        <td style={{ ...S.td, maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}>
                          {s.top50 && <span style={{ fontSize: 9, background: 'var(--green-dim)', color: 'var(--green)', padding: '1px 4px', borderRadius: 3, marginRight: 6 }}>TOP</span>}
                          {s.name}
                        </td>
                        <td style={{ ...S.td, textAlign: 'center' }}>
                          <span style={{ fontSize: 10, color: bkt?.color, fontWeight: 600 }}>{bkt?.label}</span>
                        </td>
                        <td style={{ ...S.td, textAlign: 'right', color: 'var(--purple)' }}>{fmtINR(s.total.revenue)}</td>
                        <td style={{ ...S.td, textAlign: 'right' }}>{fmtINR(s.total.spend)}</td>
                        <td style={{ ...S.td, textAlign: 'right', fontWeight: 600, color: roasColor(s.total.roas) }}>{fmtX(s.total.roas)}</td>
                        {MONTHS.map(m => (
                          <td key={m} style={{ ...S.td, textAlign: 'right', fontSize: 11 }}>
                            <div style={{ color: roasColor(s.months[m]?.roas) }}>{fmtX(s.months[m]?.roas) || '—'}</div>
                            <div style={{ color: 'var(--text3)', fontSize: 10 }}>{fmtINRCompact(s.months[m]?.revenue) || '—'}</div>
                          </td>
                        ))}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {masterRows.length === 300 && (
                <div style={{ textAlign: 'center', padding: 10, fontSize: 11, color: 'var(--text3)' }}>Showing top 300 results · use search to filter</div>
              )}
            </div>
          )}
        </>
      )}

      {/* ── TAB 2: Daily Tracker (June) ── */}
      {tab === 2 && (
        <>
          {!bktData ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>Upload an Excel file with a Bucketing sheet to see daily data</div>
          ) : (
            <>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 16 }}>
                Daily Rev %, Spend %, and ROAS per bucket — June 2026 · vs Nov–Apr average
              </div>
              <div style={{ overflowX: 'auto', borderRadius: 8, border: '0.5px solid var(--border)' }}>
                <table style={S.tbl}>
                  <thead>
                    <tr style={{ background: 'var(--bg3)', borderBottom: '0.5px solid var(--border2)' }}>
                      <th style={{ ...S.th, textAlign: 'left', width: 90 }}>Bucket</th>
                      <th style={{ ...S.th, textAlign: 'right', width: 60 }}>Metric</th>
                      <th style={{ ...S.th, textAlign: 'right', background: 'rgba(66,133,244,0.08)' }}>Nov–Apr Avg</th>
                      <th style={{ ...S.th, textAlign: 'right', background: 'rgba(66,133,244,0.08)' }}>Jun 1–9</th>
                      {juneDays.map(d => (
                        <th key={d} style={{ ...S.th, textAlign: 'right', minWidth: 52 }}>{d.replace('-Jun', '')}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {BUCKETS.map(b => {
                      const bData = bktData[b.label]
                      if (!bData) return null
                      const metrics = [
                        { key: 'revPct', label: 'Rev %', fmt: v => `${(v*100).toFixed(1)}%`, color: b.color },
                        { key: 'spendPct', label: 'Spend %', fmt: v => `${(v*100).toFixed(1)}%`, color: 'var(--blue)' },
                        { key: 'roas', label: 'ROAS', fmt: v => `${v.toFixed(2)}x`, color: (v) => roasColor(v) },
                      ]
                      return metrics.map((m, mi) => (
                        <tr key={`${b.id}-${m.key}`} style={{
                          borderBottom: mi === 2 ? '1px solid var(--border2)' : '0.5px solid var(--border)',
                          background: mi === 0 ? 'rgba(255,255,255,0.01)' : 'transparent',
                        }}>
                          {mi === 0 && (
                            <td rowSpan={3} style={{ ...S.td, fontWeight: 700, color: b.color, verticalAlign: 'middle', borderRight: '0.5px solid var(--border2)' }}>
                              <div>{b.label}</div>
                              <div style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 400 }}>{b.range}</div>
                            </td>
                          )}
                          <td style={{ ...S.td, textAlign: 'right', color: 'var(--text3)', fontSize: 11, whiteSpace: 'nowrap' }}>{m.label}</td>
                          <td style={{ ...S.td, textAlign: 'right', background: 'rgba(66,133,244,0.04)', fontWeight: 600 }}>
                            <span style={{ color: typeof m.color === 'function' ? m.color(bData.days._avg?.[m.key] || 0) : m.color }}>
                              {m.fmt(bData.days._avg?.[m.key] || 0)}
                            </span>
                          </td>
                          <td style={{ ...S.td, textAlign: 'right', background: 'rgba(66,133,244,0.04)' }}>
                            <span style={{ color: typeof m.color === 'function' ? m.color(bData.days._total?.[m.key] || 0) : m.color, fontWeight: 600 }}>
                              {m.fmt(bData.days._total?.[m.key] || 0)}
                            </span>
                          </td>
                          {juneDays.map(d => {
                            const val = bData.days[d]?.[m.key] || 0
                            return (
                              <td key={d} style={{ ...S.td, textAlign: 'right', fontSize: 11 }}>
                                <span style={{ color: typeof m.color === 'function' ? m.color(val) : m.color }}>
                                  {m.fmt(val)}
                                </span>
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
          )}
        </>
      )}
    </div>
  )
}
