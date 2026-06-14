import React, { useState, useCallback } from 'react'
import CSVUploader from '../components/CSVUploader.jsx'
import { useWindsor } from '../hooks/useWindsor.js'
import { useData } from '../data/store.jsx'
import { fmtNum } from '../utils/formatters.js'
import { format } from 'date-fns'

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

const EXCEL_SLOTS = [
  {
    key: 'sku',
    label: 'SKU Analysis',
    icon: '📊',
    color: '#1db954',
    hint: 'Master + Bucketing sheets · 8 revenue buckets',
    storeKey: 'SKU_EXCEL',
  },
  {
    key: 'catalog',
    label: 'Meta Catalog',
    icon: '🛍️',
    color: '#e8457a',
    hint: 'Ads Manager → Breakdown by Product ID → Export',
    storeKey: 'CATALOG_EXCEL',
  },
  {
    key: 'audience',
    label: 'Audience Segments',
    icon: '👥',
    color: '#6366f1',
    hint: '60-Day Summary + New / Engaged / Existing / Unknown sheets',
    storeKey: 'AUDIENCE_EXCEL',
  },
  {
    key: 'df_audience',
    label: 'Demi-Fine · Audience',
    icon: '💎',
    color: '#a78bfa',
    hint: 'Breakdown by Age / Audience · must include Ad set name column',
    storeKey: 'DF_AUDIENCE',
  },
  {
    key: 'df_device',
    label: 'Demi-Fine · Device',
    icon: '💎',
    color: '#a78bfa',
    hint: 'Breakdown by Device Platform',
    storeKey: 'DF_DEVICE',
  },
  {
    key: 'df_platform',
    label: 'Demi-Fine · Platform',
    icon: '💎',
    color: '#a78bfa',
    hint: 'Breakdown by Platform (Facebook / Instagram / etc)',
    storeKey: 'DF_PLATFORM',
  },
  {
    key: 'df_placement',
    label: 'Demi-Fine · Placement',
    icon: '💎',
    color: '#a78bfa',
    hint: 'Breakdown by Placement',
    storeKey: 'DF_PLACEMENT',
  },
  {
    key: 'df_product',
    label: 'Demi-Fine · Product ID',
    icon: '💎',
    color: '#a78bfa',
    hint: 'Breakdown by Product ID (catalog / DPA)',
    storeKey: 'DF_PRODUCT',
  },
  {
    key: 'df_creative',
    label: 'Demi-Fine · Creative',
    icon: '💎',
    color: '#a78bfa',
    hint: 'Breakdown by Ad name / Creative level',
    storeKey: 'DF_CREATIVE',
  },
  {
    key: 'gokwik',
    label: 'Gokwik Last-Click',
    icon: '🔁',
    color: '#f59e0b',
    hint: 'Product, Subcategory, Revenue (last-click attribution)',
    storeKey: 'GOKWIK',
  },
]

const DATA_SOURCES = [
  { key: 'metaDB',     label: 'Meta daily',  color: 'var(--pink)' },
  { key: 'metaHourly', label: 'Meta hourly', color: 'var(--pink)' },
  { key: 'google',     label: 'Google',      color: 'var(--blue)' },
]

const SYNC_PRESETS = [
  { value: 'last_7d',    label: 'Last 7 days' },
  { value: 'last_14d',   label: 'Last 14 days' },
  { value: 'last_30d',   label: 'Last 30 days' },
  { value: 'last_90d',   label: 'Last 90 days' },
  { value: 'this_month', label: 'This month' },
]

const ROUTINE = [
  { time: '9 AM',    label: 'Meta hourly',            mandatory: true,  color: 'var(--pink)',   steps: 'Ads Manager → Breakdown → By Time → Hour of Day → Export CSV' },
  { time: '12 PM',   label: 'Meta hourly',            mandatory: true,  color: 'var(--pink)',   steps: 'Same — updated to 12pm data' },
  { time: '3 PM',    label: 'Meta hourly',            mandatory: true,  color: 'var(--pink)',   steps: 'Same — updated to 3pm data' },
  { time: '5 PM',    label: 'Meta hourly',            mandatory: true,  color: 'var(--pink)',   steps: 'End-of-business check' },
  { time: 'EOD',     label: 'Meta daily',             mandatory: true,  color: 'var(--pink)',   steps: 'Ads Manager → Performance and Clicks → No breakdown → Export CSV' },
  { time: 'EOD',     label: 'Google campaigns',       mandatory: true,  color: 'var(--blue)',   steps: 'Google Ads → Reports → Basic → Campaigns → Download CSV' },
  { time: 'EOD',     label: 'Google search terms',    mandatory: true,  color: 'var(--blue)',   steps: 'Google Ads → Keywords → Search terms → Download CSV' },
  { time: 'EOD',     label: 'Google keywords',        mandatory: true,  color: 'var(--blue)',   steps: 'Google Ads → Keywords → Search keywords → Download CSV' },
  { time: 'EOD',     label: 'Google device',          mandatory: true,  color: 'var(--blue)',   steps: 'Google Ads → Reports → Campaigns → Segment by Device → Download CSV' },
  { time: 'EOD',     label: 'Google awareness',       mandatory: true,  color: 'var(--blue)',   steps: 'Google Ads → Video campaigns → Date, Cost, Impressions, Views, VTR, CPV → Download CSV' },
  { time: 'EOD',     label: 'Meta Catalog (XLSX)',    mandatory: false, color: 'var(--pink)',   steps: 'Ads Manager → Breakdown → Product ID → Export XLSX → upload here' },
  { time: 'EOD',     label: 'Audience Segments',      mandatory: false, color: 'var(--purple)', steps: '60-Day Summary workbook → upload here' },
  { time: 'EOD',     label: 'Demi-Fine breakdowns',   mandatory: false, color: 'var(--purple)', steps: 'Separate XLSX per breakdown (Audience, Device, Placement, Product, Creative) → upload here' },
  { time: 'EOD',     label: 'SKU Bucketing',          mandatory: false, color: 'var(--green)',  steps: 'Master + Bucketing sheets XLSX → upload here' },
  { time: 'Weekly',  label: 'Google placement',       mandatory: false, color: 'var(--blue)',   steps: 'Google Ads → Placements → Where ads showed → Download CSV' },
  { time: 'Weekly',  label: 'Google geographic',      mandatory: false, color: 'var(--blue)',   steps: 'Google Ads → Reports → Geographic → Download CSV' },
]

export default function Upload() {
  const { state, dispatch, loadData } = useData()
  const { syncAll } = useWindsor()
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState(null)
  const [syncPreset, setSyncPreset] = useState('last_90d')
  const [activeSection, setActiveSection] = useState('windsor')
  const [excelFiles, setExcelFiles] = useState({}) // { [key]: { name, rowCount } }
  const [parsing, setParsing] = useState(null)

  const PROXY_URL = import.meta.env.VITE_WINDSOR_PROXY_URL || 'https://blissclub-proxy-mgua.onrender.com'

  async function handleSync() {
    setSyncing(true)
    setSyncResult(null)
    try {
      const result = await syncAll(syncPreset)
      setSyncResult(result)
    } catch (e) {
      setSyncResult({ errors: [e.message], success: [] })
    }
    setSyncing(false)
  }

  const handleExcelFile = useCallback(async (slot, file) => {
    if (!file) return
    setParsing(slot.key)
    const XLSX = await loadXLSX()
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'binary' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json(ws, { defval: null })
        // Dispatch to global store so analysis pages can read it immediately
        loadData({ wb, fileName: file.name, sheetNames: wb.SheetNames, rowCount: rows.length }, slot.storeKey)
        setExcelFiles(prev => ({ ...prev, [slot.key]: { name: file.name, rowCount: rows.length, sheets: wb.SheetNames } }))
      } catch(err) { console.error(err) }
      setParsing(null)
    }
    reader.readAsBinaryString(file)
  }, [])

  const counts = {
    metaDB:     state.metaDB.length,
    metaHourly: state.metaHourly.length,
    google:     state.googleDump.length,
  }
  const lastUpdated = state.lastUpdated

  const tabBtn = (key, label) => ({
    padding: '7px 16px', fontSize: 12, fontWeight: 600, borderRadius: 8, cursor: 'pointer',
    background: activeSection === key ? 'var(--blue)' : 'var(--bg3)',
    border: '0.5px solid ' + (activeSection === key ? 'var(--blue)' : 'var(--border2)'),
    color: activeSection === key ? '#fff' : 'var(--text2)',
  })

  return (
    <div style={{ padding: '24px 28px', width: '100%' }}>

      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 2 }}>Data upload</h1>
        <div style={{ fontSize: 12, color: 'var(--text3)' }}>
          Windsor auto-syncs Meta + Google · upload all Excel reports here in one place
        </div>
      </div>

      {/* Section tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        <button style={tabBtn('windsor', 'Windsor')} onClick={() => setActiveSection('windsor')}>⚡ Windsor Sync</button>
        <button style={tabBtn('manual', 'Manual')} onClick={() => setActiveSection('manual')}>📁 Excel Uploads</button>
        <button style={tabBtn('csv', 'CSV')} onClick={() => setActiveSection('csv')}>📄 CSV Upload</button>
        <button style={tabBtn('routine', 'Routine')} onClick={() => setActiveSection('routine')}>📋 Daily Routine</button>
      </div>

      {/* ── WINDSOR ── */}
      {activeSection === 'windsor' && (
        <div>
          <div style={{ background: 'rgba(34,197,94,0.06)', border: '0.5px solid rgba(34,197,94,0.25)', borderRadius: 10, padding: '20px 24px', marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 3, display: 'flex', alignItems: 'center', gap: 8 }}>
                  ⚡ Windsor Auto-Sync
                  <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 10, fontWeight: 500, background: 'rgba(34,197,94,0.15)', color: 'var(--green)', border: '0.5px solid rgba(34,197,94,0.3)' }}>Connected</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text3)' }}>Pulls Meta + Google in one click</div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <select value={syncPreset} onChange={e => setSyncPreset(e.target.value)}
                  style={{ background: 'var(--bg3)', border: '0.5px solid var(--border2)', borderRadius: 6, padding: '6px 10px', color: 'var(--text)', fontSize: 12, outline: 'none', cursor: 'pointer' }}>
                  {SYNC_PRESETS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
                <button onClick={handleSync} disabled={syncing} style={{
                  padding: '7px 18px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: 'none',
                  cursor: syncing ? 'default' : 'pointer',
                  background: syncing ? 'var(--bg3)' : 'var(--green)',
                  color: syncing ? 'var(--text3)' : '#000',
                  opacity: syncing ? 0.7 : 1,
                }}>
                  {syncing ? '⏳ Syncing…' : '🔄 Sync everything'}
                </button>
              </div>
            </div>
            {syncResult && (
              <div style={{ fontSize: 12, marginTop: 12, paddingTop: 12, borderTop: '0.5px solid var(--border)' }}>
                {syncResult.success && syncResult.success.length > 0 && (
                  <div style={{ color: 'var(--green)', marginBottom: 4 }}>✅ Synced: {syncResult.success.join(', ')}</div>
                )}
                {syncResult.errors && syncResult.errors.length > 0 && (
                  <div style={{ color: 'var(--red)' }}>❌ Failed: {syncResult.errors.join(', ')}</div>
                )}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {DATA_SOURCES.map(src => {
              const count = counts[src.key]
              const updated = lastUpdated?.[src.key]
              const hasData = count > 0
              return (
                <div key={src.key} style={{
                  flex: 1, minWidth: 140, background: 'var(--bg2)',
                  border: '0.5px solid ' + (hasData ? src.color + '40' : 'var(--border)'),
                  borderRadius: 8, padding: '10px 14px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: hasData ? src.color : 'var(--bg4)' }} />
                    <span style={{ fontSize: 12, fontWeight: 500, color: hasData ? src.color : 'var(--text2)' }}>{src.label}</span>
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: hasData ? 'var(--text)' : 'var(--text3)' }}>
                    {hasData ? fmtNum(count) : '—'}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>
                    {updated ? 'Updated ' + format(updated, 'h:mm a') : 'No data'}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── MANUAL EXCEL UPLOADS ── */}
      {activeSection === 'manual' && (
        <div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 16 }}>
            Upload all your daily Excel exports here. Files are stored in the browser session and picked up automatically by each analysis page.
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 12 }}>
            {EXCEL_SLOTS.map(slot => {
              const uploaded = excelFiles[slot.key]
              const isLoading = parsing === slot.key
              return (
                <label key={slot.key} style={{
                  display: 'block', cursor: 'pointer',
                  background: uploaded ? 'var(--bg2)' : 'var(--bg2)',
                  border: '0.5px solid ' + (uploaded ? slot.color + '60' : 'var(--border)'),
                  borderLeft: '3px solid ' + slot.color,
                  borderRadius: 10, padding: '14px 16px',
                  transition: 'border-color .15s',
                }}>
                  <input type="file" accept=".xlsx,.xls" style={{ display: 'none' }}
                    onChange={e => handleExcelFile(slot, e.target.files?.[0])} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 18 }}>{slot.icon}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: slot.color }}>{slot.label}</span>
                    </div>
                    {uploaded && (
                      <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 6, background: slot.color + '20', color: slot.color, fontWeight: 600 }}>
                        ✓ LOADED
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 10 }}>{slot.hint}</div>
                  {isLoading ? (
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>Parsing…</div>
                  ) : uploaded ? (
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--text)', fontWeight: 500, marginBottom: 2 }}>📄 {uploaded.name}</div>
                      <div style={{ fontSize: 10, color: 'var(--text3)' }}>
                        {fmtNum(uploaded.rowCount)} rows · {uploaded.sheets.length} sheet{uploaded.sheets.length > 1 ? 's' : ''}: {uploaded.sheets.join(', ')}
                      </div>
                    </div>
                  ) : (
                    <div style={{ fontSize: 11, color: 'var(--blue)' }}>+ Click to upload XLSX</div>
                  )}
                </label>
              )
            })}
          </div>

          {Object.keys(excelFiles).length > 0 && (
            <div style={{ marginTop: 16, padding: '12px 16px', background: 'rgba(29,185,84,0.06)', border: '0.5px solid rgba(29,185,84,0.2)', borderRadius: 8, fontSize: 12 }}>
              ✅ {Object.keys(excelFiles).length} of {EXCEL_SLOTS.length} files uploaded · Navigate to any analysis page to use the data
            </div>
          )}
        </div>
      )}

      {/* ── CSV UPLOAD ── */}
      {activeSection === 'csv' && (
        <div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 16 }}>
            Drop any Meta or Google CSV — auto-detected by column headers.
          </div>
          <CSVUploader />
        </div>
      )}

      {/* ── DAILY ROUTINE ── */}
      {activeSection === 'routine' && (
        <div style={{ background: 'var(--bg2)', border: '0.5px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '70px 160px 1fr 80px', padding: '7px 14px', background: 'var(--bg3)', borderBottom: '0.5px solid var(--border)' }}>
            {['Time', 'Report', 'How to export', 'Status'].map(h => (
              <div key={h} style={{ fontSize: 10, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</div>
            ))}
          </div>
          {ROUTINE.map((item, i) => (
            <div key={i} style={{
              display: 'grid', gridTemplateColumns: '70px 160px 1fr 80px',
              padding: '9px 14px',
              borderBottom: i < ROUTINE.length - 1 ? '0.5px solid var(--border)' : 'none',
              background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
            }}>
              <div style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 500 }}>{item.time}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: item.color, flexShrink: 0 }} />
                <span style={{ fontSize: 12, fontWeight: 500, color: item.color }}>{item.label}</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text3)', lineHeight: 1.5, paddingRight: 12 }}>{item.steps}</div>
              <div>
                <span style={{
                  fontSize: 10, padding: '2px 8px', borderRadius: 10, fontWeight: 500,
                  background: item.mandatory ? 'rgba(232,69,122,0.15)' : 'var(--bg3)',
                  color: item.mandatory ? 'var(--pink)' : 'var(--text3)',
                  border: '0.5px solid ' + (item.mandatory ? 'rgba(232,69,122,0.3)' : 'var(--border)'),
                }}>
                  {item.mandatory ? 'Required' : 'Optional'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Danger zone */}
      <div style={{ borderTop: '0.5px solid var(--border)', paddingTop: 16, marginTop: 24 }}>
        <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 8 }}>Danger zone</div>
        <button
          onClick={() => {
            if (window.confirm('Clear all loaded data? This cannot be undone.')) {
              dispatch({ type: 'CLEAR_ALL' })
              setExcelFiles({})
            }
          }}
          style={{ padding: '6px 14px', fontSize: 12, borderRadius: 6, cursor: 'pointer', background: 'var(--red-dim)', color: 'var(--red)', border: '0.5px solid rgba(239,68,68,0.3)' }}>
          Clear all data
        </button>
      </div>

    </div>
  )
}
