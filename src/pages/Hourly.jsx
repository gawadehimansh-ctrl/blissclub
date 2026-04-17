import React, { useMemo, useState } from 'react'
import { useData } from '../data/store.jsx'
import { useFilters } from '../hooks/useFilters.js'
import DrillTable from '../components/DrillTable.jsx'
import MetricCard from '../components/MetricCard.jsx'
import CSVUploader from '../components/CSVUploader.jsx'
import { fmtINRCompact, fmtPct, fmtNum, deltaLabel } from '../utils/formatters.js'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts'
import { format, subDays } from 'date-fns'

const TIME_SLOTS = [
  '00:00', '01:00', '02:00', '03:00', '04:00', '05:00',
  '06:00', '07:00', '08:00', '09:00', '10:00', '11:00',
  '12:00', '13:00', '14:00', '15:00', '16:00', '17:00',
  '18:00', '19:00', '20:00', '21:00', '22:00', '23:00',
]

function parseHour(timeStr) {
  if (!timeStr) return null
  const m = String(timeStr).match(/(\d{1,2}):\d{2}/)
  return m ? parseInt(m[1]) : null
}

export default function Hourly() {
  const { state } = useData()
  const [viewDate, setViewDate] = useState('today')

  const today = new Date(); today.setHours(0, 0, 0, 0)
  const yesterday = subDays(today, 1)

  const targetDate = viewDate === 'today' ? today : yesterday

  // Hourly rows for selected date
  const hourlyRows = useMemo(() => {
    return state.metaHourly.filter(r => {
      if (!r.date) return viewDate === 'today' // rows with no date = today's upload
      const d = r.date instanceof Date ? r.date : new Date(r.date)
      d.setHours(0, 0, 0, 0)
      return d.getTime() === targetDate.getTime()
    })
  }, [state.metaHourly, viewDate, targetDate])

  const prevDateRows = useMemo(() => {
    const prevTarget = viewDate === 'today' ? yesterday : subDays(yesterday, 1)
    return state.metaHourly.filter(r => {
      if (!r.date) return false
      const d = r.date instanceof Date ? r.date : new Date(r.date)
      d.setHours(0, 0, 0, 0)
      return d.getTime() === prevTarget.getTime()
    })
  }, [state.metaHourly, viewDate])

  // Aggregate by hour
  const byHour = useMemo(() => {
    const map = {}
    for (const r of hourlyRows) {
      const h = parseHour(r.timeSlot)
      if (h === null) continue
      if (!map[h]) map[h] = { hour: h, label: `${String(h).padStart(2, '0')}:00`, spend: 0, clicks: 0, impressions: 0, fbOrders: 0, fbRevenue: 0 }
      map[h].spend += r.spend
      map[h].clicks += r.clicks || 0
      map[h].impressions += r.impressions || 0
      map[h].fbOrders += r.fbOrders || 0
      map[h].fbRevenue += r.fbRevenue || 0
    }
    return Array.from({ length: 24 }, (_, h) => map[h] || { hour: h, label: `${String(h).padStart(2, '0')}:00`, spend: 0, clicks: 0, impressions: 0, fbOrders: 0, fbRevenue: 0 })
  }, [hourlyRows])

  // Adset-level summary
  const byAdset = useMemo(() => {
    const map = {}
    for (const r of hourlyRows) {
      const k = r.adsetName || 'Unknown'
      if (!map[k]) map[k] = { adsetName: k, cohort: r.cohort || '', spend: 0, clicks: 0, impressions: 0, fbOrders: 0 }
      map[k].spend += r.spend
      map[k].clicks += r.clicks || 0
      map[k].impressions += r.impressions || 0
      map[k].fbOrders += r.fbOrders || 0
    }
    const total = Object.values(map).reduce((s, r) => s + r.spend, 0)
    return Object.values(map).map(r => ({
      ...r,
      ctr: r.impressions > 0 ? r.clicks / r.impressions : 0,
      cpc: r.clicks > 0 ? r.spend / r.clicks : 0,
      spendMix: total > 0 ? r.spend / total * 100 : 0,
    })).sort((a, b) => b.spend - a.spend)
  }, [hourlyRows])

  // Prev day same adsets for delta
  const prevByAdset = useMemo(() => {
    const map = {}
    for (const r of prevDateRows) {
      const k = r.adsetName || 'Unknown'
      if (!map[k]) map[k] = { spend: 0, cpc: 0, clicks: 0 }
      map[k].spend += r.spend
      map[k].clicks += r.clicks || 0
    }
    return map
  }, [prevDateRows])

  // Totals
  const totalSpend = hourlyRows.reduce((s, r) => s + r.spend, 0)
  const totalPrevSpend = prevDateRows.reduce((s, r) => s + r.spend, 0)
  const totalOrders = hourlyRows.reduce((s, r) => s + (r.fbOrders || 0), 0)
  const totalClicks = hourlyRows.reduce((s, r) => s + (r.clicks || 0), 0)
  const currentHour = new Date().getHours()
  const spendPerHour = currentHour > 0 ? totalSpend / currentHour : 0
  const projectedDaySpend = spendPerHour * 24

  const maxHourSpend = Math.max(...byHour.map(h => h.spend), 1)

  const adsetCols = [
    { key: 'adsetName', label: 'Ad set', align: 'left', bold: true },
    { key: 'cohort', label: 'Cohort', render: v => v ? <span className="pill pill-meta">{v}</span> : '—' },
    { key: 'spend', label: 'Spend', render: (v, row) => {
      const prev = prevByAdset[row.adsetName]
      const dl = prev ? deltaLabel(v, prev.spend) : null
      return (
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
          {fmtINRCompact(v)}
          {dl && <span className={dl.positive ? 'up' : 'dn'} style={{ fontSize: 10 }}>{dl.label}</span>}
        </span>
      )
    }},
    { key: 'spendMix', label: 'Spend %', render: v => `${v.toFixed(1)}%` },
    { key: 'clicks', label: 'Clicks', render: v => fmtNum(v) },
    { key: 'ctr', label: 'CTR', render: v => fmtPct(v) },
    { key: 'cpc', label: 'CPC', render: (v, row) => {
      const prev = prevByAdset[row.adsetName]
      const prevCPC = prev?.clicks > 0 ? prev.spend / prev.clicks : null
      const dl = prevCPC ? deltaLabel(v, prevCPC, true) : null
      return (
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
          {fmtINRCompact(v)}
          {dl && <span className={dl.positive ? 'up' : 'dn'} style={{ fontSize: 10 }}>{dl.label}</span>}
        </span>
      )
    }},
    { key: 'fbOrders', label: '1DC orders', render: v => fmtNum(v) },
  ]

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 18, fontWeight: 600, marginBottom: 2 }}>Hourly pulse</h1>
        <div style={{ fontSize: 12, color: 'var(--text3)' }}>Intraday spend pacing · ad set CPC delta vs yesterday</div>
      </div>

      {/* Upload strip */}
      <div style={{ background: 'var(--bg2)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', padding: '10px 14px', marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 500 }}>Upload Meta hourly export</div>
          <div style={{ fontSize: 11, color: 'var(--text3)' }}>Drop the hourly CSV from Ads Manager · auto-parsed · do this at 9am, 12pm, 5pm</div>
        </div>
        <CSVUploader compact />
      </div>

      {/* Date toggle */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {['today', 'yesterday'].map(d => (
          <button key={d} onClick={() => setViewDate(d)}
            style={{
              padding: '5px 14px', fontSize: 12, borderRadius: 6, cursor: 'pointer',
              background: viewDate === d ? 'var(--pink-dim)' : 'var(--bg3)',
              color: viewDate === d ? 'var(--pink)' : 'var(--text2)',
              border: `0.5px solid ${viewDate === d ? 'var(--pink-border)' : 'var(--border2)'}`,
              fontWeight: viewDate === d ? 500 : 400,
            }}>
            {d === 'today' ? 'Today' : 'Yesterday'}
          </button>
        ))}
      </div>

      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 10, marginBottom: 16 }}>
        <MetricCard label="Spend so far" value={fmtINRCompact(totalSpend)} accent="var(--pink)"
          delta={deltaLabel(totalSpend, totalPrevSpend)} sublabel="vs same time yesterday" />
        <MetricCard label="Projected day spend" value={fmtINRCompact(projectedDaySpend)} accent="var(--amber)"
          sublabel={`Based on ${currentHour}h run rate`} />
        <MetricCard label="1DC orders" value={fmtNum(totalOrders)} accent="var(--pink)" />
        <MetricCard label="Clicks" value={fmtNum(totalClicks)} accent="var(--pink)"
          sublabel={totalClicks > 0 && totalSpend > 0 ? `CPC ${fmtINRCompact(totalSpend / totalClicks)}` : ''} />
      </div>

      {/* Hourly spend bar chart */}
      <div style={{ background: 'var(--bg2)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '14px 16px', marginBottom: 16 }}>
        <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 10 }}>Spend by hour</div>
        {hourlyRows.length === 0 ? (
          <div style={{ height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', fontSize: 12 }}>
            Upload the Meta hourly CSV to see intraday spend
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={byHour} barSize={18}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--text3)' }} axisLine={false} tickLine={false} interval={2} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--text3)' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: 'var(--bg3)', border: '0.5px solid var(--border2)', fontSize: 12 }}
                formatter={v => [fmtINRCompact(v), 'Spend']} />
              <Bar dataKey="spend" radius={[3, 3, 0, 0]}>
                {byHour.map((h, i) => (
                  <Cell key={i}
                    fill={h.hour === currentHour && viewDate === 'today' ? 'var(--amber)' : h.spend > maxHourSpend * 0.7 ? 'var(--pink)' : 'var(--bg4)'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Adset table */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Ad set breakdown</div>
        <div style={{ fontSize: 12, color: 'var(--text3)' }}>Spend and CPC delta vs yesterday · same time window</div>
      </div>
      <DrillTable columns={adsetCols} data={byAdset} defaultSort={{ key: 'spend', dir: 'desc' }} compact />
    </div>
  )
}
