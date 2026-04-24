import React, { useMemo, useState, useRef } from 'react'
import { useData } from '../data/store.jsx'
import { format, subDays } from 'date-fns'
import { parseCSV } from '../utils/csvParser.js'
import OjanReport from '../components/OjanReport.jsx'

const TIME_SLOTS = [
  { key: '9am',   label: '9 AM',  hour: 9  },
  { key: '12pm',  label: '12 PM', hour: 12 },
  { key: '3pm',   label: '3 PM',  hour: 15 },
  { key: '5pm',   label: '5 PM',  hour: 17 },
]

function parseHour(timeStr) {
  if (!timeStr) return null
  const m = String(timeStr).match(/(\d{1,2}):\d{2}/)
  return m ? parseInt(m[1]) : null
}

function fmtINR(v) {
  if (!v || isNaN(v) || v === 0) return '—'
  return `₹${Math.round(v).toLocaleString('en-IN')}`
}

function DeltaBadge({ curr, prev, lowerBetter = false }) {
  if (!prev || !curr || prev === 0) return <span style={{ color: 'var(--text3)', fontSize: 11 }}>—</span>
  const d = ((curr - prev) / Math.abs(prev)) * 100
  const good = lowerBetter ? d <= 0 : d >= 0
  return (
    <span style={{
      fontSize: 11, fontWeight: 500, padding: '1px 6px', borderRadius: 4,
      background: good ? 'var(--green-dim)' : 'var(--red-dim)',
      color: good ? 'var(--green)' : 'var(--red)',
    }}>
      {d >= 0 ? '+' : ''}{d.toFixed(1)}%
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
    map[k].spend       += r.spend || 0
    map[k].clicks      += r.clicks || 0
    map[k].impressions += r.impressions || 0
    map[k].fbOrders    += r.fbOrders || 0
    map[k].fbRevenue   += r.fbRevenue || 0
  }
  return Object.values(map)
}

export default function Hourly() {
  const { state, dispatch } = useData()
  const fileRef = useRef()

  const [primaryDate, setPrimaryDate] = useState(() => { const d = new Date(); d.setHours(0,0,0,0); return d })
  const [compareDate, setCompareDate] = useState(() => { const d = new Date(); d.setHours(0,0,0,0); return subDays(d,1) })
  const [compareOn, setCompareOn]     = useState(true)
  const [showComp, setShowComp]       = useState(false)
  const [pickerOpen, setPickerOpen]   = useState(false)
  const [uploading, setUploading]     = useState(false)
  const [activeSlot, setActiveSlot]   = useState(null) // which slot is being uploaded
  // Hour filter: null = all hours, or { from, to }
  const [hourFrom, setHourFrom] = useState(0)
  const [hourTo, setHourTo]     = useState(23)
  const [hourFilterOn, setHourFilterOn] = useState(false)


  // All rows for primary date
  const allPrimaryRows = useMemo(() => getRowsForDate(state.metaHourly, primaryDate), [state.metaHourly, primaryDate])
  const allCompareRows = useMemo(() => getRowsForDate(state.metaHourly, compareDate), [state.metaHourly, compareDate])

  // Which upload slots exist for primary date
  const uploadedSlots = useMemo(() => {
    const slots = new Set(allPrimaryRows.map(r => r.uploadSlot).filter(Boolean))
    return slots
  }, [allPrimaryRows])

  // Latest upload time for primary date
  const lastUploadTime = useMemo(() => {
    const times = allPrimaryRows.map(r => r.uploadTime).filter(Boolean)
    if (!times.length) return null
    return times.sort((a,b) => b - a)[0]
  }, [allPrimaryRows])

  // Filtered by hour range
  const primaryRows = useMemo(() => {
    if (!hourFilterOn) return allPrimaryRows
    return allPrimaryRows.filter(r => {
      const h = parseHour(r.timeSlot)
      if (h === null) return true
      return h >= hourFrom && h <= hourTo
    })
  }, [allPrimaryRows, hourFilterOn, hourFrom, hourTo])

  const compareRows = useMemo(() => {
    if (!hourFilterOn) return allCompareRows
    return allCompareRows.filter(r => {
      const h = parseHour(r.timeSlot)
      if (h === null) return true
      return h >= hourFrom && h <= hourTo
    })
  }, [allCompareRows, hourFilterOn, hourFrom, hourTo])

  const primaryByProd = useMemo(() => aggregateByProduct(primaryRows), [primaryRows])
  const compareByProd = useMemo(() => {
    const map = {}
    for (const r of aggregateByProduct(compareRows)) map[r.product] = r
    return map
  }, [compareRows])

  const totalPrimary = useMemo(() => primaryByProd.reduce((s,r) => s+r.spend, 0), [primaryByProd])
  const totalCompare = useMemo(() => compareRows.reduce((s,r) => s+(r.spend||0), 0), [compareRows])

  const tableRows = useMemo(() => primaryByProd
    .map(r => ({
      ...r,
      spendMix: totalPrimary > 0 ? r.spend / totalPrimary * 100 : 0,
      cpc: r.clicks > 0 ? r.spend / r.clicks : 0,
      comp: compareByProd[r.product] || null,
    }))
    .sort((a,b) => b.spend - a.spend),
  [primaryByProd, compareByProd, totalPrimary])

  const hasData = primaryRows.length > 0
  const currentHour = new Date().getHours()
  const effectiveHours = hourFilterOn ? (hourTo - hourFrom + 1) : currentHour || 1
  const spendPerHour = effectiveHours > 0 ? totalPrimary / effectiveHours : 0
  const projectedSpend = spendPerHour * 24

  const primaryLabel = format(primaryDate, 'd MMM yyyy')
  const compareLabel = format(compareDate, 'd MMM yyyy')

  // Upload handler — tagged with slot
  async function handleUpload(slot, file) {
    if (!file) return
    setUploading(true)
    setActiveSlot(slot.key)
    try {
      const result = await parseCSV(file)
      if (result?.data && result.fileType === 'META_HOURLY') {
        dispatch({ type: 'LOAD_META_HOURLY', data: result.data, slot: slot.label })
      }
    } catch(e) { console.error(e) }
    setUploading(false)
    setActiveSlot(null)
  }

  return (
    <div style={{ padding: '24px 28px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 2 }}>Hourly pulse</h1>
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>
            Intraday product spend · 1DC orders · CSV upload only · Last upload
            {lastUploadTime && (
              <span style={{ marginLeft: 8, color: 'var(--green)' }}>
                · Last upload {format(lastUploadTime, 'h:mm a')}
                {uploadedSlots.size > 0 && ` (${[...uploadedSlots].join(', ')})`}
              </span>
            )}
          </div>
        </div>
        {/* Date picker button */}
        <div style={{ position: 'relative' }}>
          <button onClick={() => setPickerOpen(o => !o)} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
            fontSize: 12, fontWeight: 500, borderRadius: 8, cursor: 'pointer',
            background: 'var(--bg2)', border: '0.5px solid var(--border2)', color: 'var(--text)', whiteSpace: 'nowrap',
          }}>
            📅 {primaryLabel}
            {compareOn && <span style={{ color: 'var(--blue)', fontWeight: 400 }}> vs {compareLabel}</span>}
            {' '}▾
          </button>
          {pickerOpen && (
            <HourlyDatePanel
              primaryDate={primaryDate} compareDate={compareDate} compareOn={compareOn}
              onApply={(p, c, cOn) => { setPrimaryDate(p); setCompareDate(c); setCompareOn(cOn); setPickerOpen(false) }}
              onClose={() => setPickerOpen(false)}
            />
          )}
        </div>
      </div>

      {/* Upload strip — one button per time slot */}
      <div style={{ background: 'var(--bg2)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', padding: '12px 16px', marginBottom: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 8 }}>Upload Meta hourly CSV</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {TIME_SLOTS.map(slot => {
            const uploaded = uploadedSlots.has(slot.label)
            return (
              <label key={slot.key} style={{ cursor: 'pointer' }}>
                <input type="file" accept=".csv" style={{ display: 'none' }}
                  onChange={e => { if (e.target.files[0]) handleUpload(slot, e.target.files[0]); e.target.value = '' }}
                />
                <div style={{
                  padding: '6px 14px', fontSize: 12, borderRadius: 6, cursor: 'pointer',
                  background: uploaded ? 'var(--green-dim)' : activeSlot === slot.key && uploading ? 'var(--amber-dim)' : 'var(--bg3)',
                  border: `0.5px solid ${uploaded ? 'rgba(29,185,84,0.3)' : activeSlot === slot.key ? 'var(--amber)' : 'var(--border2)'}`,
                  color: uploaded ? 'var(--green)' : activeSlot === slot.key && uploading ? 'var(--amber)' : 'var(--text2)',
                  fontWeight: uploaded ? 500 : 400,
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  {uploaded ? '✓' : activeSlot === slot.key && uploading ? '…' : '↑'} {slot.label} upload
                </div>
              </label>
            )
          })}
          <div style={{ fontSize: 11, color: 'var(--text3)', alignSelf: 'center', marginLeft: 4 }}>
            Each slot stacks — existing hours are preserved
          </div>
        </div>
      </div>

      {/* Hour range filter */}
      <div style={{ background: 'var(--bg2)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', padding: '10px 16px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12 }}>
          <input type="checkbox" checked={hourFilterOn} onChange={e => setHourFilterOn(e.target.checked)} style={{ accentColor: 'var(--pink)' }} />
          <span style={{ color: 'var(--text2)', fontWeight: 500 }}>Filter by hour range</span>
        </label>
        {hourFilterOn && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 11, color: 'var(--text3)' }}>From</span>
              <select value={hourFrom} onChange={e => setHourFrom(Number(e.target.value))} style={selectStyle}>
                {Array.from({length: 24}, (_,h) => (
                  <option key={h} value={h}>{String(h).padStart(2,'0')}:00</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 11, color: 'var(--text3)' }}>To</span>
              <select value={hourTo} onChange={e => setHourTo(Number(e.target.value))} style={selectStyle}>
                {Array.from({length: 24}, (_,h) => (
                  <option key={h} value={h}>{String(h).padStart(2,'0')}:59</option>
                ))}
              </select>
            </div>
            <span style={{ fontSize: 11, color: 'var(--text3)' }}>
              Showing {hourFrom.toString().padStart(2,'0')}:00 – {hourTo.toString().padStart(2,'0')}:59
              ({hourTo - hourFrom + 1}h window)
            </span>
          </>
        )}
        {!hourFilterOn && (
          <span style={{ fontSize: 11, color: 'var(--text3)' }}>Showing all uploaded hours</span>
        )}
      </div>

      {/* KPI strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 10, marginBottom: 16 }}>
        {[
          { label: 'Spend so far', val: totalPrimary, comp: totalCompare },
          { label: 'Projected day', val: projectedSpend, comp: null, sub: `Based on ${effectiveHours}h run rate` },

          { label: 'Clicks', val: primaryRows.reduce((s,r)=>s+(r.clicks||0),0), comp: compareRows.reduce((s,r)=>s+(r.clicks||0),0), isNum: true },
        ].map(({ label, val, comp, sub, isNum }) => (
          <div key={label} style={{ background: 'var(--bg2)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', padding: '12px 14px' }}>
            <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4, fontWeight: 600 }}>{label}</div>
            <div style={{ fontSize: 22, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
              {isNum ? (val > 0 ? Math.round(val).toLocaleString('en-IN') : '0') : fmtINR(val)}
            </div>
            {comp != null && compareOn ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 11, color: 'var(--text3)' }}>
                  {isNum ? (comp > 0 ? Math.round(comp).toLocaleString('en-IN') : '0') : fmtINR(comp)}
                </span>
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
          Upload a CSV using one of the time slot buttons above
        </div>
      ) : (
        <div style={{ overflowX: 'auto', borderRadius: 8, border: '0.5px solid var(--border)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={th({ align: 'left' })}>Product</th>
                <th style={th()}>Spend ({primaryLabel}{hourFilterOn ? ` · ${hourFrom.toString().padStart(2,'0')}–${hourTo.toString().padStart(2,'0')}h` : ''})</th>
                <th style={th()}>Spend Mix</th>
                <th style={th()}>CPC</th>

                {showComp && compareOn && <>
                  <th style={th({ comp: true })}>Spend ({compareLabel})</th>
                  <th style={th({ comp: true })}>Mix</th>
                  <th style={th({ comp: true })}>CPC</th>
                  <th style={th({ comp: true })}>Δ Spend</th>
                  <th style={th({ comp: true })}>Δ CPC</th>
                </>}
              </tr>
            </thead>
            <tbody>
              {tableRows.map(r => {
                const compRow  = r.comp
                const compMix  = compRow && totalCompare > 0 ? compRow.spend / totalCompare * 100 : null
                const compCpc  = compRow?.clicks > 0 ? compRow.spend / compRow.clicks : null
                return (
                  <tr key={r.product}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg3)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={td({ align: 'left', bold: true })}>{r.product}</td>
                    <td style={td()}>{fmtINR(r.spend)}</td>
                    <td style={td()}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
                        <div style={{ width: 48, height: 4, background: 'var(--bg4)', borderRadius: 2, overflow: 'hidden' }}>
                          <div style={{ width: `${Math.min(r.spendMix, 100)}%`, height: '100%', background: 'var(--pink)', borderRadius: 2 }} />
                        </div>
                        {r.spendMix.toFixed(1)}%
                      </div>
                    </td>
                    <td style={td()}>₹{r.cpc > 0 ? Math.round(r.cpc).toLocaleString('en-IN') : '—'}</td>

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
                <td style={td()}>{(() => { const tc = primaryRows.reduce((s,r)=>s+(r.clicks||0),0); return tc > 0 ? `₹${Math.round(totalPrimary/tc).toLocaleString('en-IN')}` : '—' })()}</td>

                {showComp && compareOn && <>
                  <td style={td({ comp: true, bold: true })}>{fmtINR(totalCompare)}</td>
                  <td style={td({ comp: true })}>100%</td>
                  <td style={td({ comp: true })}>{(() => { const tc = compareRows.reduce((s,r)=>s+(r.clicks||0),0); return tc > 0 ? `₹${Math.round(totalCompare/tc).toLocaleString('en-IN')}` : '—' })()}</td>
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

      <OjanReport rows={allPrimaryRows} />

    </div>
  )
}
