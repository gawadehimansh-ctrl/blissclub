import React, { useMemo, useState } from 'react'
import { useData } from '../data/store.jsx'
import { fmtINRCompact, fmtPct, fmtNum } from '../utils/formatters.js'
import { subDays } from 'date-fns'

const TIME_SLOTS = [
  { key: '09', label: '9 AM upload' },
  { key: '12', label: '12 PM upload' },
  { key: '15', label: '3 PM upload' },
  { key: '17', label: '5 PM upload' },
]

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))

function parseHour(timeStr) {
  if (!timeStr) return null
  const m = String(timeStr).match(/(\d{1,2}):\d{2}/)
  return m ? String(parseInt(m[1])).padStart(2, '0') : null
}

function buildHourly(rows) {
  const byHour = {}
  for (const r of rows) {
    const h = parseHour(r.timeSlot || r.hour)
    if (h === null) continue
    if (!byHour[h]) byHour[h] = { hour: h, spend: 0, clicks: 0, impressions: 0, fbOrders: 0, fbRevenue: 0, sessions: 0, gaOrders: 0 }
    byHour[h].spend       += Number(r.spend || 0)
    byHour[h].clicks      += Number(r.clicks || r.linkClicks || 0)
    byHour[h].impressions += Number(r.impressions || 0)
    byHour[h].fbOrders    += Number(r.fbOrders || r['1dcOrders'] || 0)
    byHour[h].fbRevenue   += Number(r.fbRevenue || r['1dcRevenue'] || 0)
    byHour[h].sessions    += Number(r.sessions || r.ga4Sessions || 0)
    byHour[h].gaOrders    += Number(r.gaOrders || r.ga4Orders || 0)
  }
  return Object.values(byHour).map(h => ({
    ...h,
    cpc:    h.clicks      > 0 ? h.spend / h.clicks      : 0,
    ctr:    h.impressions > 0 ? h.clicks / h.impressions : 0,
    cpm:    h.impressions > 0 ? (h.spend / h.impressions) * 1000 : 0,
    roas1dc:h.fbRevenue   > 0 && h.spend > 0 ? h.fbRevenue / h.spend : 0,
  })).sort((a, b) => a.hour.localeCompare(b.hour))
}

function buildByProduct(rows) {
  const byProd = {}
  const totalSpend = rows.reduce((s, r) => s + Number(r.spend || 0), 0)
  for (const r of rows) {
    const p = r.product || 'Other'
    if (!byProd[p]) byProd[p] = { product: p, spend: 0, clicks: 0, impressions: 0, fbOrders: 0 }
    byProd[p].spend       += Number(r.spend || 0)
    byProd[p].clicks      += Number(r.clicks || r.linkClicks || 0)
    byProd[p].impressions += Number(r.impressions || 0)
    byProd[p].fbOrders    += Number(r.fbOrders || 0)
  }
  return Object.values(byProd).map(p => ({
    ...p,
    spendMix: totalSpend > 0 ? (p.spend / totalSpend) * 100 : 0,
    cpc:      p.clicks > 0 ? p.spend / p.clicks : 0,
    ctr:      p.impressions > 0 ? p.clicks / p.impressions : 0,
  })).sort((a, b) => b.spend - a.spend)
}

// Cumulative up to an hour
function cumulative(hourlyData, upToHour) {
  const h = parseInt(upToHour)
  return hourlyData
    .filter(r => parseInt(r.hour) <= h)
    .reduce((acc, r) => ({
      spend:       acc.spend       + r.spend,
      clicks:      acc.clicks      + r.clicks,
      impressions: acc.impressions + r.impressions,
      fbOrders:    acc.fbOrders    + r.fbOrders,
      fbRevenue:   acc.fbRevenue   + r.fbRevenue,
    }), { spend: 0, clicks: 0, impressions: 0, fbOrders: 0, fbRevenue: 0 })
}

// Mini spend bar (inline)
function SpendBar({ pct, color = '#f472b6' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ width: 60, height: 4, background: 'rgba(255,255,255,0.07)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: `${Math.min(pct, 100)}%`, height: '100%', background: color, borderRadius: 2 }} />
      </div>
      <span style={{ fontSize: 10, color: '#64748b', minWidth: 32 }}>{pct.toFixed(1)}%</span>
    </div>
  )
}

const TH = {
  padding: '8px 12px', fontSize: 10, fontWeight: 600, color: '#64748b',
  textTransform: 'uppercase', letterSpacing: 0.6, whiteSpace: 'nowrap',
  textAlign: 'right', borderBottom: '1px solid rgba(255,255,255,0.07)',
  position: 'sticky', top: 0, background: 'rgba(9,14,26,0.97)', zIndex: 2,
}
const TD = { padding: '9px 12px', whiteSpace: 'nowrap', textAlign: 'right', fontSize: 12, color: '#94a3b8' }

export default function Hourly() {
  const { state } = useData()
  const [selectedSlot, setSelectedSlot] = useState('17')
  const [viewDate, setViewDate] = useState('today')

  const today = new Date(); today.setHours(0, 0, 0, 0)
  const yesterday = subDays(today, 1)
  const targetDate = viewDate === 'today' ? today : yesterday

  const hourlyRows = useMemo(() => {
    return state.metaHourly.filter(r => {
      if (!r.date) return viewDate === 'today'
      const d = r.date instanceof Date ? r.date : new Date(r.date)
      d.setHours(0, 0, 0, 0)
      return d.getTime() === targetDate.getTime()
    })
  }, [state.metaHourly, viewDate, targetDate])

  const prevRows = useMemo(() => {
    const prev = subDays(targetDate, 1)
    return state.metaHourly.filter(r => {
      if (!r.date) return false
      const d = r.date instanceof Date ? r.date : new Date(r.date)
      d.setHours(0, 0, 0, 0)
      return d.getTime() === prev.getTime()
    })
  }, [state.metaHourly, viewDate, targetDate])

  const hourlyData     = useMemo(() => buildHourly(hourlyRows), [hourlyRows])
  const prevHourlyData = useMemo(() => buildHourly(prevRows),   [prevRows])
  const byProduct      = useMemo(() => buildByProduct(hourlyRows), [hourlyRows])

  // Cumulative up to selected time slot
  const cum     = useMemo(() => cumulative(hourlyData, selectedSlot),     [hourlyData, selectedSlot])
  const prevCum = useMemo(() => cumulative(prevHourlyData, selectedSlot), [prevHourlyData, selectedSlot])

  const hasData = state.metaHourly.length > 0

  // Delta vs previous
  const delta = (cur, prev) => {
    if (!prev || prev === 0) return null
    const d = ((cur - prev) / prev) * 100
    return { pct: d, up: d >= 0 }
  }

  function DeltaBadge({ cur, prev }) {
    const d = delta(cur, prev)
    if (!d) return null
    return (
      <span style={{
        fontSize: 10, marginLeft: 6,
        color: d.up ? '#22c55e' : '#ef4444',
        background: d.up ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
        borderRadius: 8, padding: '1px 6px',
      }}>
        {d.up ? '▲' : '▼'} {Math.abs(d.pct).toFixed(1)}%
      </span>
    )
  }

  return (
    <div style={{ padding: '24px 28px', background: '#090e1a', minHeight: '100vh', color: '#e2e8f0', fontFamily: 'system-ui, sans-serif' }}>

      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Hourly Pulse</h1>
        <div style={{ fontSize: 13, color: '#64748b' }}>Upload Meta hourly CSV 4x daily — 9AM · 12PM · 3PM · 5PM</div>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Date toggle */}
        <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', borderRadius: 8, padding: 2 }}>
          {['today', 'yesterday'].map(d => (
            <button key={d} onClick={() => setViewDate(d)} style={{
              background: viewDate === d ? 'rgba(244,114,182,0.2)' : 'transparent',
              border: viewDate === d ? '1px solid rgba(244,114,182,0.4)' : '1px solid transparent',
              color: viewDate === d ? '#f472b6' : '#64748b',
              borderRadius: 6, padding: '5px 14px', fontSize: 12, cursor: 'pointer',
            }}>{d === 'today' ? 'Today' : 'Yesterday'}</button>
          ))}
        </div>

        {/* Time slot toggles */}
        <div style={{ display: 'flex', gap: 6 }}>
          {TIME_SLOTS.map(slot => (
            <button key={slot.key} onClick={() => setSelectedSlot(slot.key)} style={{
              background: selectedSlot === slot.key ? 'rgba(244,114,182,0.2)' : 'rgba(255,255,255,0.05)',
              border: selectedSlot === slot.key ? '1px solid rgba(244,114,182,0.5)' : '1px solid rgba(255,255,255,0.1)',
              color: selectedSlot === slot.key ? '#f472b6' : '#94a3b8',
              borderRadius: 20, padding: '5px 14px', fontSize: 12, cursor: 'pointer',
            }}>{slot.label}</button>
          ))}
        </div>
      </div>

      {!hasData && (
        <div style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)', borderRadius: 10, padding: '14px 18px', marginBottom: 24, color: '#fbbf24', fontSize: 13 }}>
          ⚠️ No hourly data yet — upload a Meta hourly CSV (Breakdown → By Time → Hour of Day)
        </div>
      )}

      {/* Cumulative snapshot cards */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 28, flexWrap: 'wrap' }}>
        {[
          { label: `Spend (cumul. to ${selectedSlot}:00)`, cur: cum.spend,      prev: prevCum.spend,      fmt: fmtINRCompact },
          { label: 'Impressions',  cur: cum.impressions, prev: prevCum.impressions, fmt: fmtNum },
          { label: 'Clicks',       cur: cum.clicks,      prev: prevCum.clicks,      fmt: fmtNum },
          { label: '1DC Orders',   cur: cum.fbOrders,    prev: prevCum.fbOrders,    fmt: v => fmtNum(Math.round(v)) },
          { label: '1DC Revenue',  cur: cum.fbRevenue,   prev: prevCum.fbRevenue,   fmt: fmtINRCompact },
        ].map(({ label, cur, prev, fmt }) => (
          <div key={label} style={{
            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 10, padding: '14px 18px', flex: 1, minWidth: 140,
          }}>
            <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>{label}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 0 }}>
              <span style={{ fontSize: 18, fontWeight: 700, color: '#f1f5f9' }}>{fmt(cur)}</span>
              <DeltaBadge cur={cur} prev={prev} />
            </div>
            {prev > 0 && <div style={{ fontSize: 10, color: '#475569', marginTop: 3 }}>Prev: {fmt(prev)}</div>}
          </div>
        ))}
      </div>

      {/* Two columns: hourly table + product spend mix */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20, alignItems: 'start' }}>

        {/* Hourly breakdown table */}
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)', fontSize: 13, fontWeight: 600, color: '#94a3b8' }}>
            Hour-by-hour breakdown
          </div>
          <div style={{ overflowX: 'auto', maxHeight: 600, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ ...TH, textAlign: 'left', paddingLeft: 16 }}>Hour</th>
                  <th style={TH}>Spend</th>
                  <th style={TH}>Impr.</th>
                  <th style={TH}>Clicks</th>
                  <th style={TH}>CTR</th>
                  <th style={TH}>CPC</th>
                  <th style={TH}>CPM</th>
                  <th style={TH}>1DC Orders</th>
                  <th style={TH}>1DC Rev</th>
                  <th style={TH}>1DC ROAS</th>
                </tr>
              </thead>
              <tbody>
                {hourlyData.length === 0 ? (
                  <tr><td colSpan={10} style={{ padding: 32, textAlign: 'center', color: '#475569' }}>No hourly data</td></tr>
                ) : hourlyData.map((h, i) => {
                  const isCurrent = h.hour === selectedSlot
                  const prevH = prevHourlyData.find(p => p.hour === h.hour)
                  return (
                    <tr key={h.hour} style={{
                      borderBottom: '1px solid rgba(255,255,255,0.04)',
                      background: isCurrent ? 'rgba(244,114,182,0.06)' : i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
                    }}>
                      <td style={{ ...TD, textAlign: 'left', paddingLeft: 16, fontWeight: isCurrent ? 700 : 400 }}>
                        <span style={{ color: isCurrent ? '#f472b6' : '#94a3b8' }}>
                          {h.hour}:00 {isCurrent ? '◀' : ''}
                        </span>
                      </td>
                      <td style={{ ...TD, color: '#e2e8f0' }}>
                        {fmtINRCompact(h.spend)}
                        {prevH && <div style={{ fontSize: 10, color: '#475569' }}>Prev: {fmtINRCompact(prevH.spend)}</div>}
                      </td>
                      <td style={TD}>{fmtNum(h.impressions)}</td>
                      <td style={TD}>{fmtNum(h.clicks)}</td>
                      <td style={{ ...TD, color: h.ctr >= 0.02 ? '#22c55e' : h.ctr >= 0.01 ? '#fbbf24' : '#94a3b8' }}>
                        {h.ctr > 0 ? fmtPct(h.ctr) : '—'}
                      </td>
                      <td style={TD}>{h.cpc > 0 ? fmtINRCompact(h.cpc) : '—'}</td>
                      <td style={TD}>{h.cpm > 0 ? fmtINRCompact(h.cpm) : '—'}</td>
                      <td style={TD}>{h.fbOrders > 0 ? fmtNum(h.fbOrders) : '—'}</td>
                      <td style={TD}>{h.fbRevenue > 0 ? fmtINRCompact(h.fbRevenue) : '—'}</td>
                      <td style={{ ...TD, color: h.roas1dc >= 3 ? '#22c55e' : h.roas1dc >= 1.5 ? '#fbbf24' : h.roas1dc > 0 ? '#ef4444' : '#475569' }}>
                        {h.roas1dc > 0 ? `${h.roas1dc.toFixed(2)}x` : '—'}
                      </td>
                    </tr>
                  )
                })}
                {/* Totals row */}
                {hourlyData.length > 0 && (() => {
                  const tot = hourlyData.reduce((acc, h) => ({
                    spend:       acc.spend + h.spend,
                    impressions: acc.impressions + h.impressions,
                    clicks:      acc.clicks + h.clicks,
                    fbOrders:    acc.fbOrders + h.fbOrders,
                    fbRevenue:   acc.fbRevenue + h.fbRevenue,
                  }), { spend: 0, impressions: 0, clicks: 0, fbOrders: 0, fbRevenue: 0 })
                  const totCtr  = tot.impressions > 0 ? tot.clicks / tot.impressions : 0
                  const totCpc  = tot.clicks > 0 ? tot.spend / tot.clicks : 0
                  const totRoas = tot.fbRevenue > 0 && tot.spend > 0 ? tot.fbRevenue / tot.spend : 0
                  return (
                    <tr style={{ background: 'rgba(244,114,182,0.06)', borderTop: '1px solid rgba(244,114,182,0.2)' }}>
                      <td style={{ ...TD, textAlign: 'left', paddingLeft: 16, color: '#f472b6', fontWeight: 700 }}>TOTAL</td>
                      <td style={{ ...TD, color: '#f1f5f9', fontWeight: 700 }}>{fmtINRCompact(tot.spend)}</td>
                      <td style={{ ...TD, fontWeight: 600 }}>{fmtNum(tot.impressions)}</td>
                      <td style={{ ...TD, fontWeight: 600 }}>{fmtNum(tot.clicks)}</td>
                      <td style={{ ...TD, fontWeight: 600 }}>{totCtr > 0 ? fmtPct(totCtr) : '—'}</td>
                      <td style={{ ...TD, fontWeight: 600 }}>{totCpc > 0 ? fmtINRCompact(totCpc) : '—'}</td>
                      <td style={TD}>—</td>
                      <td style={{ ...TD, fontWeight: 600 }}>{tot.fbOrders > 0 ? fmtNum(tot.fbOrders) : '—'}</td>
                      <td style={{ ...TD, fontWeight: 600 }}>{tot.fbRevenue > 0 ? fmtINRCompact(tot.fbRevenue) : '—'}</td>
                      <td style={{ ...TD, fontWeight: 600 }}>{totRoas > 0 ? `${totRoas.toFixed(2)}x` : '—'}</td>
                    </tr>
                  )
                })()}
              </tbody>
            </table>
          </div>
        </div>

        {/* Product spend mix */}
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)', fontSize: 13, fontWeight: 600, color: '#94a3b8' }}>
            Spend mix by product
          </div>
          <div style={{ padding: '8px 0' }}>
            {byProduct.length === 0 ? (
              <div style={{ padding: '24px 16px', textAlign: 'center', color: '#475569', fontSize: 13 }}>No data</div>
            ) : byProduct.map((p, i) => (
              <div key={p.product} style={{
                display: 'flex', flexDirection: 'column', gap: 4,
                padding: '10px 16px',
                borderBottom: i < byProduct.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: '#cbd5e1', fontWeight: 500 }}>{p.product}</span>
                  <span style={{ fontSize: 12, color: '#f1f5f9', fontWeight: 600 }}>{fmtINRCompact(p.spend)}</span>
                </div>
                <SpendBar pct={p.spendMix} color={i === 0 ? '#f472b6' : i === 1 ? '#3b82f6' : i === 2 ? '#22c55e' : '#64748b'} />
                <div style={{ display: 'flex', gap: 12, fontSize: 10, color: '#475569' }}>
                  <span>CPC {p.cpc > 0 ? fmtINRCompact(p.cpc) : '—'}</span>
                  <span>CTR {p.ctr > 0 ? fmtPct(p.ctr) : '—'}</span>
                  <span>{fmtNum(p.clicks)} clicks</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
