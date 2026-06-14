import React, { useState, useCallback, useRef } from 'react'
import CSVUploader from '../components/CSVUploader.jsx'
import { useWindsor } from '../hooks/useWindsor.js'
import { useData } from '../data/store.jsx'
import { fmtNum } from '../utils/formatters.js'
import { format } from 'date-fns'

// ── Page registry for manual Excel uploads ────────────────────────────────────
const EXCEL_UPLOADS = [
  {
    key: 'sku',
    label: 'SKU Analysis',
    icon: '📊',
    color: '#1db954',
    hint: 'Master sheet + Bucketing sheet · 8 revenue buckets',
    accept: '.xlsx,.xls',
    storeKey: null, // stored in page state only (local to SKUAnalysis page)
    note: 'Upload directly on the SKU Analysis page',
  },
  {
    key: 'catalog',
    label: 'Meta Catalog',
    icon: '🛍️',
    color: '#e8457a',
    hint: 'Ads Manager → Breakdown by Product ID → Export',
    accept: '.xlsx,.xls',
    storeKey: null,
    note: 'Upload directly on the Meta Catalog page',
  },
  {
    key: 'audience',
    label: 'Audience Segments',
    icon: '👥',
    color: '#6366f1',
    hint: '60-Day Summary + New/Engaged/Existing/Unknown sheets',
    accept: '.xlsx,.xls',
    storeKey: null,
    note: 'Upload directly on the Audience Segments page',
  },
  {
    key: 'demifine_audience',
    label: 'Demi-Fine · Audience',
    icon: '💎',
    color: '#a78bfa',
    hint: 'Breakdown by Age/Audience · Ad set name column required',
    accept: '.xlsx,.xls',
    storeKey: null,
    note: 'Upload directly on the Demi-Fine Analysis page → Audience tab',
  },
  {
    key: 'demifine_device',
    label: 'Demi-Fine · Device',
    icon: '💎',
    color: '#a78bfa',
    hint: 'Breakdown by Device Platform',
    accept: '.xlsx,.xls',
    storeKey: null,
    note: 'Upload directly on the Demi-Fine Analysis page → Device tab',
  },
  {
    key: 'demifine_placement',
    label: 'Demi-Fine · Placement',
    icon: '💎',
    color: '#a78bfa',
    hint: 'Breakdown by Placement',
    accept: '.xlsx,.xls',
    storeKey: null,
    note: 'Upload directly on the Demi-Fine Analysis page → Placement tab',
  },
  {
    key: 'demifine_product',
    label: 'Demi-Fine · Product ID',
    icon: '💎',
    color: '#a78bfa',
    hint: 'Breakdown by Product ID (catalog/DPA)',
    accept: '.xlsx,.xls',
    storeKey: null,
    note: 'Upload directly on the Demi-Fine Analysis page → Product tab',
  },
  {
    key: 'demifine_creative',
    label: 'Demi-Fine · Creative',
    icon: '💎',
    color: '#a78bfa',
    hint: 'Breakdown by Ad name / Creative',
    accept: '.xlsx,.xls',
    storeKey: null,
    note: 'Upload directly on the Demi-Fine Analysis page → Creative tab',
  },
  {
    key: 'gokwik',
    label: 'Gokwik Last-Click',
    icon: '🔁',
    color: '#f59e0b',
    hint: 'Product, Subcategory, Revenue (last-click)',
    accept: '.xlsx,.xls',
    storeKey: null,
    note: 'Upload directly on the Demi-Fine Analysis page → Gokwik tab',
  },
]

const ROUTINE = [
  { time: '9:00 AM',  label: 'Meta hourly',           mandatory: true,  color: 'var(--pink)',   steps: 'Ads Manager → Campaigns → Breakdown → By Time → Hour of Day → Export CSV' },
  { time: '12:00 PM', label: 'Meta hourly',           mandatory: true,  color: 'var(--pink)',   steps: 'Same as above — updated to 12pm data' },
  { time: '3:00 PM',  label: 'Meta hourly',           mandatory: true,  color: 'var(--pink)',   steps: 'Same as above — updated to 3pm data' },
  { time: '5:00 PM',  label: 'Meta hourly',           mandatory: true,  color: 'var(--pink)',   steps: 'Same as above — end-of-business check' },
  { time: 'EOD',      label: 'Meta daily',            mandatory: true,  color: 'var(--pink)',   steps: 'Ads Manager → Campaigns → Columns: Performance and Clicks → Breakdown: None → Export CSV' },
  { time: 'EOD',      label: 'Google campaigns',      mandatory: true,  color: 'var(--blue)',   steps: 'Google Ads → Reports → Predefined → Basic → Campaigns → Download CSV' },
  { time: 'EOD',      label: 'Google search terms',   mandatory: true,  color: 'var(--blue)',   steps: 'Google Ads → Keywords → Search terms → Download CSV' },
  { time: 'EOD',      label: 'Google keywords',       mandatory: true,  color: 'var(--blue)',   steps: 'Google Ads → Keywords → Search keywords → Download CSV' },
  { time: 'EOD',      label: 'Google device',         mandatory: true,  color: 'var(--blue)',   steps: 'Google Ads → Reports → Predefined → Basic → Campaigns → Segment by Device → Download CSV' },
  { time: 'EOD',      label: 'Google awareness/video',mandatory: true,  color: 'var(--blue)',   steps: 'Google Ads → Campaigns → filter Video campaigns → Date, Campaign, Cost, Impressions, Views, VTR, CPV, Avg CPM → Download CSV' },
  { time: 'EOD',      label: 'Meta Catalog',          mandatory: false, color: 'var(--pink)',   steps: 'Ads Manager → Breakdown → By Delivery → Product ID → Export XLSX → upload on Meta Catalog page' },
  { time: 'EOD',      label: 'Audience Segments',     mandatory: false, color: 'var(--purple)', steps: 'Custom export → 60-Day Summary + segment sheets → upload on Audience Segments page' },
  { time: 'EOD',      label: 'Demi-Fine breakdowns',  mandatory: false, color: 'var(--purple)', steps: 'Separate exports per breakdown (Audience, Device, Placement, Product, Creative) → upload on Demi-Fine page' },
  { time: 'EOD',      label: 'SKU Bucketing',         mandatory: false, color: 'var(--green)',  steps: 'Master sheet + Bucketing sheet XLSX → upload on SKU Analysis page' },
  { time: 'Weekly',   label: 'Google placement',      mandatory: false, color: 'var(--blue)',   steps: 'Google Ads → Placements → Where ads showed → Download CSV' },
  { time: 'Weekly',   label: 'Google geographic',     mandatory: false, color: 'var(--blue)',   steps: 'Google Ads → Reports → Predefined → Geographic → Download CSV' },
]

const DATA_SOURCES = [
  { key: 'metaDB',    label: 'Meta daily',    color: 'var(--pink)' },
  { key: 'metaHourly',label: 'Meta hourly',   color: 'var(--pink)' },
  { key: 'google',    label: 'Google',        color: 'var(--blue)' },
]

const SYNC_PRESETS = [
  { value: 'last_7d',    label: 'Last 7 days' },
  { value: 'last_14d',   label: 'Last 14 days' },
  { value: 'last_30d',   label: 'Last 30 days' },
  { value: 'last_90d',   label: 'Last 90 days' },
  { value: 'this_month', label: 'This month' },
]

const PAGE_LINKS = {
  sku:                 '/sku',
  catalog:             '/meta/catalog',
  audience:            '/meta/audience',
  demifine_audience:   '/meta/demifine',
  demifine_device:     '/meta/demifine',
  demifine_placement:  '/meta/demifine',
  demifine_product:    '/meta/demifine',
  demifine_creative:   '/meta/demifine',
  gokwik:              '/meta/demifine',
}

export default function Upload() {
  const { state, dispatch } = useData()
  const { syncAll } = useWindsor()
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState(null)
  const [syncPreset, setSyncPreset] = useState('last_90d')
  const [activeSection, setActiveSection] = useState('windsor')

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

  const counts = {
    metaDB:    state.metaDB.length,
    metaHourly:state.metaHourly.length,
    google:    state.googleDump.length,
  }
  const lastUpdated = state.lastUpdated

  const sectionBtn = (key, label) => ({
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
          Windsor auto-syncs Meta + Google · Manual Excel uploads go to each page directly
        </div>
      </div>

      {/* Section switcher */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <button style={sectionBtn('windsor', 'Windsor')} onClick={() => setActiveSection('windsor')}>
          ⚡ Windsor Auto-Sync
        </button>
        <button style={sectionBtn('manual', 'Manual')} onClick={() => setActiveSection('manual')}>
          📁 Manual Excel Uploads
        </button>
        <button style={sectionBtn('csv', 'CSV')} onClick={() => setActiveSection('csv')}>
          📄 CSV Upload
        </button>
        <button style={sectionBtn('routine', 'Routine')} onClick={() => setActiveSection('routine')}>
          📋 Daily Routine
        </button>
      </div>

      {/* ── WINDSOR AUTO-SYNC ── */}
      {activeSection === 'windsor' && (
        <div>
          <div style={{
            background: 'rgba(34,197,94,0.06)',
            border: '0.5px solid rgba(34,197,94,0.25)',
            borderRadius: 10, padding: '20px 24px', marginBottom: 20,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 3, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>⚡</span>
                  Windsor Auto-Sync
                  <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 10, fontWeight: 500, background: 'rgba(34,197,94,0.15)', color: 'var(--green)', border: '0.5px solid rgba(34,197,94,0.3)' }}>
                    Connected
                  </span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text3)' }}>
                  Pulls Meta + Google in one click · catalog + GA4 removed
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <select value={syncPreset} onChange={e => setSyncPreset(e.target.value)}
                  style={{ background: 'var(--bg3)', border: '0.5px solid var(--border2)', borderRadius: 6, padding: '6px 10px', color: 'var(--text)', fontSize: 12, outline: 'none', cursor: 'pointer' }}>
                  {SYNC_PRESETS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
                <button onClick={handleSync} disabled={syncing} style={{
                  padding: '7px 18px', fontSize: 13, fontWeight: 600, borderRadius: 8,
                  border: 'none', cursor: syncing ? 'default' : 'pointer',
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

          {/* Status cards */}
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
            These files are uploaded directly on their respective pages. Click <b>Go to page</b> to navigate there and upload.
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 10 }}>
            {EXCEL_UPLOADS.map(u => (
              <div key={u.key} style={{
                background: 'var(--bg2)', border: '0.5px solid var(--border)',
                borderRadius: 10, padding: '14px 16px',
                borderLeft: '3px solid ' + u.color,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 18 }}>{u.icon}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: u.color }}>{u.label}</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 10, lineHeight: 1.5 }}>{u.hint}</div>
                <a href={PAGE_LINKS[u.key]} style={{
                  fontSize: 11, padding: '4px 10px', borderRadius: 6,
                  background: 'var(--bg3)', border: '0.5px solid var(--border2)',
                  color: 'var(--text2)', textDecoration: 'none', display: 'inline-block',
                }}>
                  Go to page →
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── CSV UPLOAD ── */}
      {activeSection === 'csv' && (
        <div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 16 }}>
            Drop any Meta/Google CSV — auto-detected by column headers.
          </div>
          <CSVUploader />
        </div>
      )}

      {/* ── DAILY ROUTINE ── */}
      {activeSection === 'routine' && (
        <div>
          <div style={{ background: 'var(--bg2)', border: '0.5px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '80px 160px 1fr 90px', padding: '7px 14px', background: 'var(--bg3)', borderBottom: '0.5px solid var(--border)' }}>
              {['Time', 'Report', 'How to export', 'Status'].map(h => (
                <div key={h} style={{ fontSize: 10, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</div>
              ))}
            </div>
            {ROUTINE.map((item, i) => (
              <div key={i} style={{
                display: 'grid', gridTemplateColumns: '80px 160px 1fr 90px',
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
        </div>
      )}

      {/* Danger zone */}
      <div style={{ borderTop: '0.5px solid var(--border)', paddingTop: 16, marginTop: 24 }}>
        <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 8 }}>Danger zone</div>
        <button
          onClick={() => { if (window.confirm('Clear all loaded data? This cannot be undone.')) dispatch({ type: 'CLEAR_ALL' }) }}
          style={{ padding: '6px 14px', fontSize: 12, borderRadius: 6, cursor: 'pointer', background: 'var(--red-dim)', color: 'var(--red)', border: '0.5px solid rgba(239,68,68,0.3)' }}>
          Clear all data
        </button>
      </div>

    </div>
  )
}
