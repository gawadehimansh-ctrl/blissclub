import React, { useMemo, useState } from 'react'
import { useData } from '../data/store.jsx'
import CSVUploader from '../components/CSVUploader.jsx'
import DatePicker from '../components/DatePicker.jsx'
import { format, subDays } from 'date-fns'

function parseHour(timeStr) {
  if (!timeStr) return null
  const m = String(timeStr).match(/(\d{1,2}):\d{2}/)
  return m ? parseInt(m[1]) : null
}

function fmtINR(v) {
  if (!v || isNaN(v)) return '—'
  return `₹${Math.round(v).toLocaleString('en-IN')}`
}

function fmtPct(v) {
  if (v == null || isNaN(v)) return '—'
  return `${(v * 100).toFixed(1)}%`
}

function delta(curr, prev) {
  if (!prev || !curr || prev === 0) return null
  return ((curr - prev) / Math.abs(prev)) * 100
}

function DeltaBadge({ curr, prev, lowerBetter = false }) {
  const d = delta(curr, prev)
  if (d === null) return <span style={{ color: 'var(--text3)', fontSize: 11 }}>—</span>
  const good = lowerBetter ? d <= 0 : d >= 0
  const sign = d >= 0 ? '+' : ''
  return (
    <span style={{
      fontSize: 11, fontWeight: 500, padding: '1px 5px', borderRadius: 4,
      background: good ? 'var(--green-dim)' : 'var(--red-dim)',
      color: good ? 'var(--green)' : 'var(--red)',
    }}>
      {sign}{d.toFixed(1)}%
    </span>
  )
}

function getRowsForDate(metaHourly, date) {
  const d = new Date(date); d.setHours(0,0,0,0)
  return metaHourly.filter(r => {
    if (!r.date) return false
    const rd = r.date instanceof Date ? new Date(r.date) : new Date(r.date)
    rd.setHours(0,0,0,0)
    return rd.getTime() === d.getTime()
  })
}

function aggregateByProduct(rows) {
  const map = {}
  for (const r of rows) {
    const k = r.product || r.adsetName || 'Unknown'
    if (!map[k]) map[k] = { product: k, spend: 0, clicks: 0, impressions: 0, fbOrders: 0, fbRevenue: 0 }
    map[k].spend      += r.spend || 0
    map[k].clicks     += r.clicks || 0
    map[k].impressions+= r.impressions || 0
    map[k].fbOrders   += r.fbOrders || 0
    map[k].fbRevenue  += r.fbRevenue || 0
  }
  return Object.values(map)
}

export default function Hourly() {
  const { state } = useData()

  const today     = new Date(); today.setHours(0,0,0,0)
  const yesterday = subDays(today, 1)

  // Primary date
  const [primaryDate, setPrimaryDate] = useState(today)
  // Compare date
  const [compareDate, setCompareDate] = useState(yesterday)
  const [compareOn, setCompareOn]     = useState(true)
  // Show comparison columns
  const [showComp, setShowComp]       = useState(false)
  // Picker open state
  const [pickerOpen, setPickerOpen]   = useState(false)

  const primaryRows = useMemo(() => getRowsForDate(state.metaHourly, primaryDate), [state.metaHourly, primaryDate])
  const compareRows = useMemo(() => getRowsForDate(state.metaHourly, compareDate), [state.metaHourly, compareDate])

  const primaryByProd = useMemo(() => aggregateByProduct(primaryRows), [primaryRows])
  const compareByProd = useMemo(() => {
    const map = {}
    for (const r of aggregateByProduct(compareRows)) map[r.product] = r
    return map
  }, [compareRows])

  const totalPrimary = useMemo(() => primaryByProd.reduce((s,r) => s + r.spend, 0), [primaryByProd])
  const totalCompare = useMemo(() => compareRows.reduce((s,r) => s + (r.spend||0), 0), [compareRows])

  const tableRows = useMemo(() => {
    return primaryByProd
      .map(r => ({
        ...r,
        spendMix: totalPrimary > 0 ? r.spend / totalPrimary * 100 : 0,
        cpc: r.clicks > 0 ? r.spend / r.clicks : 0,
        comp: compareByProd[r.product] || null,
      }))
      .sort((a,b) => b.spend - a.spend)
  }, [primaryByProd, compareByProd, totalPrimary])

  const hasData = primaryRows.length > 0

  const currentHour   = new Date().getHours()
  const spendPerHour  = currentHour > 0 ? totalPrimary / currentHour : 0
  const projectedSpend = spendPerHour * 24

  const primaryLabel  = format(primaryDate, 'd MMM yyyy')
  const compareLabel  = format(compareDate, 'd MMM yyyy')

  return (
    <div style={{ padding: '20px 24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 600, marginBottom: 2 }}>Hourly pulse</h1>
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>Intraday product spend pacing · 1DC orders · CSV upload only</div>
        </div>
        {/* Date controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Primary date picker */}
          <div style={{ position: 'relative' }}>
            <button onClick={() => setPickerOpen(o => !o)} style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
              fontSize: 12, fontWeight: 500, borderRadius: 8, cursor: 'pointer',
              background: 'var(--bg2)', border: '0.5px solid var(--border2)', color: 'var(--text)',
            }}>
              📅 {primaryLabel} ▾
            </button>
            {pickerOpen && (
              <HourlyDatePanel
                primaryDate={primaryDate} compareDate={compareDate}
                compareOn={compareOn}
                onApply={(p, c, cOn) => { setPrimaryDate(p); setCompareDate(c); setCompareOn(cOn); setPickerOpen(false) }}
                onClose={() => setPickerOpen(false)}
              />
            )}
          </div>
          {/* Compare toggle */}
          {compareOn && (
            <div style={{ fontSize: 12, color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: 4 }}>
              vs <span style={{ color: 'var(--blue)' }}>{compareLabel}</span>
            </div>
          )}
        </div>
      </div>

      {/* Upload strip */}
      <div style={{ background: 'var(--bg2)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', padding: '10px 14px', marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 500 }}>Upload Meta hourly export</div>
          <div style={{ fontSize: 11, color: 'var(--text3)' }}>Drop hourly CSV from Ads Manager · do this at 9 AM, 12 PM, 5 PM</div>
        </div>
        <CSVUploader compact />
      </div>

      {/* KPI strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 10, marginBottom: 16 }}>
        {[
          { label: 'Spend so far', val: totalPrimary, comp: totalCompare, fmt: fmtINR },
          { label: 'Projected day', val: projectedSpend, comp: null, fmt: fmtINR, sub: `Based on ${currentHour}h run rate` },
          { label: '1DC Orders', val: primaryRows.reduce((s,r) => s+(r.fbOrders||0),0), comp: compareRows.reduce((s,r)=>s+(r.fbOrders||0),0), fmt: v => v ? Math.round(v).toLocaleString('en-IN') : '0' },
          { label: 'Clicks', val: primaryRows.reduce((s,r) => s+(r.clicks||0),0), comp: compareRows.reduce((s,r)=>s+(r.clicks||0),0), fmt: v => v ? Math.round(v).toLocaleString('en-IN') : '0' },
        ].map(({ label, val, comp, fmt, sub }) => (
          <div key={label} style={{ background: 'var(--bg2)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', padding: '12px 14px' }}>
            <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4, fontWeight: 600 }}>{label}</div>
            <div style={{ fontSize: 22, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>{fmt(val)}</div>
            {comp != null && compareOn ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 11, color: 'var(--text3)' }}>{fmt(comp)}</span>
                <DeltaBadge curr={val} prev={comp} />
              </div>
            ) : sub ? (
              <div style={{ fontSize: 11, color: 'var(--text3)' }}>{sub}</div>
            ) : null}
          </div>
        ))}
      </div>

      {/* Table header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>Product breakdown</div>
        {compareOn && (
          <button onClick={() => setShowComp(o => !o)} style={{
            padding: '4px 10px', fontSize: 11, borderRadius: 5, cursor: 'pointer',
            background: showComp ? 'var(--blue-dim)' : 'var(--bg3)',
            color: showComp ? 'var(--blue)' : 'var(--text2)',
            border: `0.5px solid ${showComp ? 'var(--blue-border)' : 'var(--border2)'}`,
            fontWeight: showComp ? 500 : 400,
          }}>
            {showComp ? '▼ Hide comparison' : '▶ Show comparison'}
          </button>
        )}
      </div>

      {/* Table */}
      {!hasData ? (
        <div style={{ background: 'var(--bg2)', border: '0.5px solid var(--border)', borderRadius: 8, padding: '40px 20px', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
          Upload the Meta hourly CSV to see intraday product spend
        </div>
      ) : (
        <div style={{ overflowX: 'auto', borderRadius: 8, border: '0.5px solid var(--border)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={th({ align: 'left' })}>Product</th>
                <th style={th()}>Spend ({primaryLabel})</th>
                <th style={th()}>Spend Mix</th>
                <th style={th()}>CPC</th>
                <th style={th()}>1DC Orders</th>
                {showComp && compareOn && <>
                  <th style={th({ comp: true })}>Spend ({compareLabel})</th>
                  <th style={th({ comp: true })}>Spend Mix</th>
                  <th style={th({ comp: true })}>CPC</th>
                  <th style={th({ comp: true })}>Δ Spend</th>
                  <th style={th({ comp: true })}>Δ CPC</th>
                </>}
              </tr>
            </thead>
            <tbody>
              {tableRows.map((r, i) => {
                const compRow = r.comp
                const compMix = compRow && totalCompare > 0 ? compRow.spend / totalCompare * 100 : null
                const compCpc = compRow?.clicks > 0 ? compRow.spend / compRow.clicks : null
                return (
                  <tr key={r.product}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg3)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={td({ align: 'left', bold: true })}>{r.product}</td>
                    <td style={td()}>{fmtINR(r.spend)}</td>
                    <td style={td()}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
                        <div style={{ width: 40, height: 4, background: 'var(--bg4)', borderRadius: 2, overflow: 'hidden' }}>
                          <div style={{ width: `${Math.min(r.spendMix, 100)}%`, height: '100%', background: 'var(--pink)', borderRadius: 2 }} />
                        </div>
                        <span>{r.spendMix.toFixed(1)}%</span>
                      </div>
                    </td>
                    <td style={td()}>₹{r.cpc > 0 ? Math.round(r.cpc).toLocaleString('en-IN') : '—'}</td>
                    <td style={td()}>{r.fbOrders > 0 ? r.fbOrders.toLocaleString('en-IN') : '—'}</td>
                    {showComp && compareOn && <>
                      <td style={td({ comp: true })}>{compRow ? fmtINR(compRow.spend) : '—'}</td>
                      <td style={td({ comp: true })}>{compMix != null ? `${compMix.toFixed(1)}%` : '—'}</td>
                      <td style={td({ comp: true })}>{compCpc ? `₹${Math.round(compCpc).toLocaleString('en-IN')}` : '—'}</td>
                      <td style={td({ comp: true })}><DeltaBadge curr={r.spend} prev={compRow?.spend} /></td>
                      <td style={td({ comp: true })}><DeltaBadge curr={r.cpc} prev={compCpc} lowerBetter /></td>
                    </>}
                  </tr>
                )
              })}
              {/* Grand total */}
              <tr style={{ borderTop: '1px solid var(--border2)', background: 'var(--bg3)' }}>
                <td style={td({ align: 'left', bold: true })}>Grand Total</td>
                <td style={td({ bold: true })}>{fmtINR(totalPrimary)}</td>
                <td style={td()}>100%</td>
                <td style={td()}>
                  {(() => { const tc = primaryRows.reduce((s,r)=>s+(r.clicks||0),0); return tc > 0 ? `₹${Math.round(totalPrimary/tc).toLocaleString('en-IN')}` : '—' })()}
                </td>
                <td style={td({ bold: true })}>{primaryRows.reduce((s,r)=>s+(r.fbOrders||0),0).toLocaleString('en-IN')}</td>
                {showComp && compareOn && <>
                  <td style={td({ comp: true, bold: true })}>{fmtINR(totalCompare)}</td>
                  <td style={td({ comp: true })}>100%</td>
                  <td style={td({ comp: true })}>
                    {(() => { const tc = compareRows.reduce((s,r)=>s+(r.clicks||0),0); return tc > 0 ? `₹${Math.round(totalCompare/tc).toLocaleString('en-IN')}` : '—' })()}
                  </td>
                  <td style={td({ comp: true })}><DeltaBadge curr={totalPrimary} prev={totalCompare} /></td>
                  <td style={td({ comp: true })}>—</td>
                </>}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// Simple inline date panel for hourly page
function HourlyDatePanel({ primaryDate, compareDate, compareOn, onApply, onClose }) {
  const [pDate, setPDate] = useState(primaryDate)
  const [cDate, setCDate] = useState(compareDate)
  const [cOn, setCOn]     = useState(compareOn)

  const QUICK = [
    { label: 'Today',     fn: () => { setPDate(new Date()); setCDate(subDays(new Date(),1)) } },
    { label: 'Yesterday', fn: () => { const y=subDays(new Date(),1); setPDate(y); setCDate(subDays(new Date(),2)) } },
    { label: '2 days ago',fn: () => { const d=subDays(new Date(),2); setPDate(d); setCDate(subDays(new Date(),3)) } },
  ]

  return (
    <div style={{
      position: 'absolute', top: '100%', right: 0, marginTop: 4, zIndex: 9999,
      background: 'var(--bg2)', border: '0.5px solid var(--border2)', borderRadius: 10,
      boxShadow: '0 8px 30px rgba(0,0,0,0.5)', padding: 14, minWidth: 240,
    }}>
      <div style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Quick select</div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
        {QUICK.map(q => (
          <button key={q.label} onClick={q.fn} style={{
            padding: '4px 8px', fontSize: 11, borderRadius: 4, cursor: 'pointer',
            background: 'var(--bg3)', border: '0.5px solid var(--border2)', color: 'var(--text2)',
          }}
            onMouseEnter={e=>e.currentTarget.style.color='var(--text)'}
            onMouseLeave={e=>e.currentTarget.style.color='var(--text2)'}
          >{q.label}</button>
        ))}
      </div>
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Primary date</div>
        <input type="date" value={format(pDate, 'yyyy-MM-dd')}
          onChange={e => setPDate(new Date(e.target.value + 'T00:00:00'))}
          style={{ width: '100%', padding: '5px 8px', fontSize: 12, borderRadius: 5, background: 'var(--bg3)', border: '0.5px solid var(--border2)', color: 'var(--text)', outline: 'none' }}
        />
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer', marginBottom: 8 }}>
        <input type="checkbox" checked={cOn} onChange={e=>setCOn(e.target.checked)} style={{ accentColor: 'var(--blue)' }} />
        <span style={{ color: 'var(--text2)' }}>Compare with</span>
      </label>
      {cOn && (
        <div style={{ marginBottom: 8 }}>
          <input type="date" value={format(cDate, 'yyyy-MM-dd')}
            onChange={e => setCDate(new Date(e.target.value + 'T00:00:00'))}
            style={{ width: '100%', padding: '5px 8px', fontSize: 12, borderRadius: 5, background: 'var(--bg3)', border: '0.5px solid var(--border2)', color: 'var(--text)', outline: 'none' }}
          />
        </div>
      )}
      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
        <button onClick={onClose} style={{ padding: '4px 10px', fontSize: 12, borderRadius: 5, background: 'var(--bg3)', border: '0.5px solid var(--border2)', color: 'var(--text2)', cursor: 'pointer' }}>Cancel</button>
        <button onClick={() => onApply(pDate, cDate, cOn)} style={{ padding: '4px 10px', fontSize: 12, borderRadius: 5, background: 'var(--pink)', border: 'none', color: '#fff', cursor: 'pointer', fontWeight: 500 }}>Apply</button>
      </div>
    </div>
  )
}

function th({ align = 'right', comp = false } = {}) {
  return {
    padding: '8px 12px', fontSize: 10, fontWeight: 600, color: comp ? 'var(--blue)' : 'var(--text3)',
    textTransform: 'uppercase', letterSpacing: '0.05em',
    borderBottom: '0.5px solid var(--border2)',
    background: comp ? 'var(--blue-dim)' : 'var(--bg3)',
    textAlign: align, whiteSpace: 'nowrap',
    borderLeft: comp ? '1px solid var(--blue-border)' : 'none',
  }
}

function td({ align = 'right', bold = false, comp = false } = {}) {
  return {
    padding: '8px 12px', fontSize: 13, borderBottom: '0.5px solid var(--border)',
    textAlign: align, fontWeight: bold ? 600 : 400, color: 'var(--text)',
    borderLeft: comp ? '1px solid rgba(66,133,244,0.1)' : 'none',
  }
}
