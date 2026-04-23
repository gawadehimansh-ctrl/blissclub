import React, { useMemo, useState } from 'react'
import { useData } from '../data/store.jsx'
import { useFilters } from '../hooks/useFilters.js'
import FilterBar from '../components/FilterBar.jsx'
import DrillTable from '../components/DrillTable.jsx'
import MetricCard from '../components/MetricCard.jsx'
import { aggregateRows, calcROAS, calcROASGap } from '../utils/metrics.js'
import { fmtINRCompact, fmtX, fmtPct, fmtNum, deltaLabel } from '../utils/formatters.js'

const LEVELS = ['Campaign', 'Ad set', 'Ad']

function groupBy(rows, key) {
  const map = {}
  for (const r of rows) {
    const k = r[key] || 'Unknown'
    if (!map[k]) map[k] = []
    map[k].push(r)
  }
  return map
}

export default function MetaCampaigns() {
  const { state } = useData()
  const filters = useFilters('last7')
  const { filterRows, segment } = filters
  const [level, setLevel] = useState('Campaign')
  const [drillKey, setDrillKey] = useState(null) // selected campaign or adset

  const rows = useMemo(() => {
    let r = filterRows(state.metaDB || [])
    // Women/Men filter via adset name
    if (segment === 'women') r = r.filter(x => !x.adsetName.toLowerCase().includes('men') || x.category?.toLowerCase().includes('women'))
    if (segment === 'men') r = r.filter(x => x.adsetName.toLowerCase().includes('men') || x.adsetName.toLowerCase().includes("men's"))
    return r
  }, [state.metaDB, filters, segment])

  // Summary totals
  const totals = useMemo(() => aggregateRows(rows), [rows])

  // Campaign groups — group by actual campaign name
  const campaignGroups = useMemo(() => {
    const g = groupBy(rows, 'campaignName')
    return Object.entries(g).map(([campaignName, rs]) => {
      const agg = aggregateRows(rs)
      const cohorts = [...new Set(rs.map(r => r.cohort).filter(Boolean))]
      return { ...agg, campaignName, cohort: cohorts.join('/'), _rows: rs }
    }).sort((a, b) => b.spend - a.spend)
  }, [rows])

  // Adset groups
  const adsetGroups = useMemo(() => {
    const source = drillKey && level === 'Ad set' ? rows.filter(r => r.campaignName === drillKey) : rows
    const g = groupBy(source, 'adsetName')
    return Object.entries(g).map(([name, rs]) => {
      const agg = aggregateRows(rs)
      return { ...agg, adsetName: name, _rows: rs }
    }).sort((a, b) => b.spend - a.spend)
  }, [rows, drillKey, level])

  // Ad level
  const adRows = useMemo(() => {
    const source = drillKey && level === 'Ad' ? rows.filter(r => r.adsetName === drillKey) : rows
    return source.map(r => ({
      ...r,
      roasGA4: calcROAS(r.gaRevenue, r.spend),
      ctr: r.impressions > 0 ? r.clicks / r.impressions : 0,
      cpm: r.impressions > 0 ? (r.spend / r.impressions) * 1000 : 0,
      cpc: r.clicks > 0 ? r.spend / r.clicks : 0,
      cpa: r.gaOrders > 0 ? r.spend / r.gaOrders : 0,
    })).sort((a, b) => b.spend - a.spend)
  }, [rows, drillKey, level])

  const campaignCols = [
    { key: 'campaignName', label: 'Campaign', align: 'left', bold: true },
    { key: 'spend', label: 'Spend', render: v => fmtINRCompact(v) },
    { key: 'reach',       label: 'Reach', render: v => v > 0 ? fmtNum(v) : '—' },
    { key: 'impressions', label: 'Impr.', render: v => fmtNum(v) },
    { key: 'clicks', label: 'Clicks', render: v => fmtNum(v) },
    { key: 'ctr', label: 'CTR', render: v => fmtPct(v) },
    { key: 'cpm', label: 'CPM', render: v => fmtINRCompact(v) },
    { key: 'gaRevenue', label: 'GA4 Rev', render: v => fmtINRCompact(v), color: () => 'var(--purple)' },
    { key: 'roasGA4', label: 'GA4 ROAS', render: v => fmtX(v), color: v => v >= 4 ? 'var(--green)' : v >= 2 ? 'var(--amber)' : 'var(--red)' },
    { key: 'roasGap', label: 'Gap %', render: v => v != null ? `+${v?.toFixed(1)}%` : '—', color: v => v > 30 ? 'var(--red)' : v > 15 ? 'var(--amber)' : 'var(--text2)' },
    { key: 'gaOrders', label: 'Orders', render: v => fmtNum(v) },
    { key: 'cpa', label: 'CPA', render: v => fmtINRCompact(v) },
  ]

  const adsetCols = [
    { key: 'adsetName', label: 'Ad set', align: 'left', bold: true },
    ...campaignCols.slice(1)
  ]

  const adCols = [
    { key: 'adName', label: 'Ad name', align: 'left', bold: true },
    { key: 'cohort', label: 'Cohort', render: v => v ? <span className="pill pill-meta">{v}</span> : '—' },
    { key: 'format', label: 'Format' },
    { key: 'product', label: 'Product' },
    { key: 'contentType', label: 'Type' },
    { key: 'creator', label: 'Creator' },
    { key: 'spend', label: 'Spend', render: v => fmtINRCompact(v) },
    { key: 'reach',       label: 'Reach', render: v => v > 0 ? fmtNum(v) : '—' },
    { key: 'impressions', label: 'Impr.', render: v => fmtNum(v) },
    { key: 'ctr', label: 'CTR', render: v => fmtPct(v), color: v => v > 0.02 ? 'var(--green)' : v > 0.01 ? 'var(--amber)' : 'var(--red)' },
    { key: 'cpc', label: 'CPC', render: v => fmtINRCompact(v) },
    { key: 'cpm', label: 'CPM', render: v => fmtINRCompact(v) },
    { key: 'roasGA4', label: 'GA4 ROAS', render: v => fmtX(v), color: v => v >= 4 ? 'var(--green)' : v >= 2 ? 'var(--amber)' : 'var(--red)' },
    { key: 'roasGap', label: 'Gap %', render: v => v != null ? `+${v?.toFixed(1)}%` : '—', color: v => v > 30 ? 'var(--red)' : v > 15 ? 'var(--amber)' : 'var(--text2)' },
    { key: 'reach',     label: 'Reach',   render: v => v > 0 ? fmtNum(v) : '—' },
    { key: 'gaRevenue', label: 'GA4 Rev', render: v => fmtINRCompact(v) },
    { key: 'gaOrders', label: 'Orders', render: v => fmtNum(v) },
    { key: 'cpa', label: 'CPA', render: v => fmtINRCompact(v) },
    { key: 'saleTag', label: 'Tag' },
  ]

  const [adView, setAdView] = useState('table') // 'table' | 'manager'
  const tableData = level === 'Campaign' ? campaignGroups : level === 'Ad set' ? adsetGroups : adRows
  const tableCols = level === 'Campaign' ? campaignCols : level === 'Ad set' ? adsetCols : adCols

  return (
    <div style={{ padding: '24px 28px', width: '100%' }}>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 2 }}>Meta campaigns</h1>
        <div style={{ fontSize: 12, color: 'var(--text3)' }}>GA4 ROAS — source of truth</div>
      </div>
      <FilterBar filters={filters} showAdvanced />

      {/* Totals */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0,1fr))', gap: 10, marginBottom: 16 }}>
        <MetricCard label="Spend" value={fmtINRCompact(totals.spend)} accent="var(--pink)" />
        <MetricCard label="GA4 ROAS" value={fmtX(totals.roasGA4)} accent="var(--purple)" sublabel="Source of truth" />
        <MetricCard label="CPA (GA4)" value={fmtINRCompact(totals.cpa)} accent="var(--pink)" />
      </div>

      {/* Level switcher */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        {LEVELS.map(l => (
          <button key={l} onClick={() => { setLevel(l); setDrillKey(null) }}
            style={{
              padding: '5px 14px', fontSize: 12, borderRadius: 6, cursor: 'pointer',
              background: level === l ? 'var(--pink)' : 'var(--bg3)',
              color: level === l ? '#fff' : 'var(--text2)',
              border: `0.5px solid ${level === l ? 'var(--pink)' : 'var(--border2)'}`,
              fontWeight: level === l ? 500 : 400
            }}>
            {l}
          </button>
        ))}
        {drillKey && (
          <span style={{ fontSize: 12, color: 'var(--text3)', marginLeft: 8 }}>
            Filtering: <strong style={{ color: 'var(--text)' }}>{drillKey}</strong>
            <button onClick={() => setDrillKey(null)} style={{ marginLeft: 6, fontSize: 11, color: 'var(--text3)', background: 'none', border: 'none', cursor: 'pointer' }}>✕ clear</button>
          </span>
        )}
      </div>

      {/* View toggle for Ad level */}
      {level === 'Ad' && (
        <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
          {[['table', 'Table view'], ['manager', 'Manager view']].map(([v, l]) => (
            <button key={v} onClick={() => setAdView(v)} style={{
              padding: '4px 12px', fontSize: 12, borderRadius: 6, cursor: 'pointer',
              background: adView === v ? 'var(--pink-dim)' : 'var(--bg3)',
              color: adView === v ? 'var(--pink)' : 'var(--text2)',
              border: `0.5px solid ${adView === v ? 'var(--pink-border)' : 'var(--border)'}`,
            }}>{l}</button>
          ))}
        </div>
      )}

      {/* Meta Ads Manager style view */}
      {level === 'Ad' && adView === 'manager' ? (
        <div style={{ overflowX: 'auto', borderRadius: 8, border: '0.5px solid var(--border)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: 'var(--bg3)', borderBottom: '0.5px solid var(--border2)' }}>
                {['Ad', 'Delivery', 'Budget', 'Reach', 'Impr.', 'Spend', 'CTR', 'CPM', 'GA4 Rev', 'ROAS', 'Orders', 'CPA'].map((h, i) => (
                  <th key={h} style={{ padding: '8px 10px', fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: i <= 1 ? 'left' : 'right', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableData.map((r, i) => {
                const roas = r.gaRevenue > 0 && r.spend > 0 ? r.gaRevenue / r.spend : 0
                const ctr = r.impressions > 0 ? r.clicks / r.impressions : 0
                const cpm = r.impressions > 0 ? (r.spend / r.impressions) * 1000 : 0
                const cpa = r.gaOrders > 0 ? r.spend / r.gaOrders : 0
                return (
                  <tr key={i} style={{ borderBottom: '0.5px solid var(--border)' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg3)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    {/* Ad thumbnail + name */}
                    <td style={{ padding: '8px 10px', maxWidth: 320, minWidth: 200 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 4, background: 'var(--bg4)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>
                          {r.format === 'Video' ? '▶' : '🖼'}
                        </div>
                        <div style={{ overflow: 'hidden' }}>
                          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 260 }}>{r.adName || '—'}</div>
                          <div style={{ display: 'flex', gap: 4, marginTop: 2 }}>
                            {r.format && <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: 'var(--blue-dim)', color: 'var(--blue)' }}>{r.format}</span>}
                            {r.product && <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: 'var(--pink-dim)', color: 'var(--pink)' }}>{r.product}</span>}
                            {r.cohort && <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: 'var(--bg4)', color: 'var(--text3)' }}>{r.cohort}</span>}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '8px 10px' }}><span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 10, background: 'rgba(29,185,84,0.12)', color: 'var(--green)', fontWeight: 600 }}>● Active</span></td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--text3)' }}>—</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right' }}>{r.reach > 0 ? fmtNum(r.reach) : '—'}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right' }}>{fmtNum(r.impressions)}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600 }}>₹{Math.round(r.spend).toLocaleString('en-IN')}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', color: ctr>=0.02?'var(--green)':ctr>=0.01?'var(--amber)':'var(--red)' }}>{fmtPct(ctr)}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right' }}>{fmtINRCompact(cpm)}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--purple)' }}>{fmtINRCompact(r.gaRevenue)}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600, color: roas>=4?'var(--green)':roas>=2?'var(--amber)':'var(--red)' }}>{roas > 0 ? `${roas.toFixed(2)}x` : '—'}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right' }}>{r.gaOrders > 0 ? Math.round(r.gaOrders) : '—'}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right' }}>{cpa > 0 ? fmtINRCompact(cpa) : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
      <DrillTable
        columns={tableCols}
        data={tableData}
        defaultSort={{ key: 'spend', dir: 'desc' }}
        onRowClick={row => {
          if (level === 'Campaign') { setDrillKey(row.campaignName); setLevel('Ad set') }
          if (level === 'Ad set') { setDrillKey(row.adsetName); setLevel('Ad') }
        }}
      />
      )}
    </div>
  )
}
