import React from 'react'
import CSVUploader from '../components/CSVUploader.jsx'
import { useWindsor } from '../hooks/useWindsor.js'
import { useData } from '../data/store.jsx'
import { fmtNum } from '../utils/formatters.js'
import { format } from 'date-fns'

const ROUTINE = [
  { time: '9:00 AM', label: 'Meta hourly', mandatory: true, color: 'var(--pink)', steps: 'Ads Manager → Campaigns → Breakdown → By Time → Hour of Day → Export CSV' },
  { time: '12:00 PM', label: 'Meta hourly', mandatory: true, color: 'var(--pink)', steps: 'Same as above — updated to 12pm data' },
  { time: '3:00 PM', label: 'Meta hourly', mandatory: true, color: 'var(--pink)', steps: 'Same as above — updated to 3pm data' },
  { time: '5:00 PM', label: 'Meta hourly', mandatory: true, color: 'var(--pink)', steps: 'Same as above — end-of-business check' },
  { time: 'EOD', label: 'Meta daily', mandatory: true, color: 'var(--pink)', steps: 'Ads Manager → Campaigns → Columns: Performance and Clicks → Breakdown: None → Export CSV' },
  { time: 'EOD', label: 'GA4 daily', mandatory: true, color: 'var(--purple)', steps: "GA4 → Explore → saved \"Daily export\" → set today's date → Export CSV" },
  { time: 'EOD', label: 'Google campaigns', mandatory: true, color: 'var(--blue)', steps: 'Google Ads → Reports → Predefined → Basic → Campaigns → Download CSV' },
  { time: 'EOD', label: 'Google search terms', mandatory: true, color: 'var(--blue)', steps: 'Google Ads → Keywords → Search terms → Download CSV' },
  { time: 'EOD', label: 'Google keywords', mandatory: true, color: 'var(--blue)', steps: 'Google Ads → Keywords → Search keywords → Download CSV' },
  { time: 'EOD', label: 'Google device', mandatory: true, color: 'var(--blue)', steps: 'Google Ads → Reports → Predefined → Basic → Campaigns → Segment by Device → Download CSV' },
  { time: 'EOD', label: 'Google awareness/video', mandatory: true, color: 'var(--blue)', steps: 'Google Ads → Campaigns → filter Video campaigns → Date, Campaign, Cost, Impressions, Views, VTR, CPV, Avg CPM → Download CSV' },
  { time: 'Weekly', label: 'Google placement/channel', mandatory: false, color: 'var(--blue)', steps: 'Google Ads → Placements → Where ads showed → Download CSV' },
  { time: 'Weekly', label: 'Google geographic', mandatory: false, color: 'var(--blue)', steps: 'Google Ads → Reports → Predefined → Geographic → Download CSV' },
  { time: 'EOD', label: 'Meta demographics', mandatory: false, color: 'var(--pink)', steps: 'Ads Manager → Campaigns → Breakdown → By Delivery → Age and Gender → Export CSV' },
]

const DATA_SOURCES = [
  { key: 'metaDB', label: 'Meta daily', color: 'var(--pink)' },
  { key: 'metaHourly', label: 'Meta hourly', color: 'var(--pink)' },
  { key: 'google', label: 'Google campaigns', color: 'var(--blue)' },

]

const SYNC_PRESETS = [
  { value: 'last_7d',    label: 'Last 7 days' },
  { value: 'last_14d',   label: 'Last 14 days' },
  { value: 'last_30d',   label: 'Last 30 days' },
  { value: 'last_90d',   label: 'Last 90 days' },
  { value: 'this_month', label: 'This month' },
]

export default function Upload() {
  const { state, dispatch } = useData()
  const { syncAll } = useWindsor()
  const [syncing, setSyncing] = React.useState(false)
  const [syncResult, setSyncResult] = React.useState(null)
  const [syncPreset, setSyncPreset] = React.useState('last_90d')

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
    metaDB: state.metaDB.length,
    metaHourly: state.metaHourly.length,
    google: state.googleDump.length,
    ga4: state.ga4Dump.length,
  }
  const lastUpdated = state.lastUpdated

  return (
    <div style={{ padding: '24px 28px', width: '100%' }}>

      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 2 }}>Data upload</h1>
        <div style={{ fontSize: 12, color: 'var(--text3)' }}>
          Drop any CSV — app auto-detects the file type. Windsor handles Meta + Google automatically once connected.
        </div>
      </div>

      {/* Windsor Auto-Sync */}
      <div style={{
        background: PROXY_URL ? 'rgba(34,197,94,0.06)' : 'var(--bg2)',
        border: `0.5px solid ${PROXY_URL ? 'rgba(34,197,94,0.25)' : 'var(--border)'}`,
        borderRadius: 10, padding: '20px 24px', marginBottom: 20,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 3, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 16 }}>⚡</span>
              Windsor Auto-Sync
              <span style={{
                fontSize: 10, padding: '2px 7px', borderRadius: 10, fontWeight: 500,
                background: PROXY_URL ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.06)',
                color: PROXY_URL ? 'var(--green)' : 'var(--text3)',
                border: `0.5px solid ${PROXY_URL ? 'rgba(34,197,94,0.3)' : 'var(--border)'}`,
              }}>
                {PROXY_URL ? 'Connected' : 'Not configured'}
              </span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>
              {PROXY_URL
                ? 'Proxy connected — pulls Meta + Google + GA4 automatically'
                : 'Add VITE_WINDSOR_PROXY_URL to Vercel environment variables to enable'}
            </div>
          </div>

          {PROXY_URL && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <select
                value={syncPreset}
                onChange={e => setSyncPreset(e.target.value)}
                style={{ background: 'var(--bg3)', border: '0.5px solid var(--border2)', borderRadius: 6, padding: '6px 10px', color: 'var(--text)', fontSize: 12, outline: 'none', cursor: 'pointer' }}>
                {SYNC_PRESETS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
              <button
                onClick={handleSync}
                disabled={syncing}
                style={{
                  padding: '7px 18px', fontSize: 13, fontWeight: 600, borderRadius: 8,
                  border: 'none', cursor: syncing ? 'default' : 'pointer',
                  background: syncing ? 'var(--bg3)' : 'var(--green)',
                  color: syncing ? 'var(--text3)' : '#000',
                  opacity: syncing ? 0.7 : 1, transition: 'all .15s',
                }}>
                {syncing ? '⏳ Syncing…' : '🔄 Sync everything'}
              </button>
            </div>
          )}
        </div>

        {syncResult && (
          <div style={{ fontSize: 12, marginTop: 12, paddingTop: 12, borderTop: '0.5px solid var(--border)' }}>
            {syncResult.success?.length > 0 && (
              <div style={{ color: 'var(--green)', marginBottom: 4 }}>
                ✅ Synced: {syncResult.success.join(', ')}
              </div>
            )}
            {syncResult.errors?.length > 0 && (
              <div style={{ color: 'var(--red)' }}>
                ❌ Failed: {syncResult.errors.join(', ')}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Status bar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        {DATA_SOURCES.map(src => {
          const count = counts[src.key]
          const updated = lastUpdated?.[src.key]
          const hasData = count > 0
          return (
            <div key={src.key} style={{
              flex: 1, minWidth: 140,
              background: 'var(--bg2)',
              border: `0.5px solid ${hasData ? src.color + '40' : 'var(--border)'}`,
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
                {updated ? `Updated ${format(updated, 'h:mm a')}` : 'No data'}
              </div>
            </div>
          )
        })}
      </div>

      {/* Upload zone */}
      <div style={{ marginBottom: 24 }}>
        <CSVUploader />
      </div>

      {/* Daily routine */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Daily routine</div>
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
                  border: `0.5px solid ${item.mandatory ? 'rgba(232,69,122,0.3)' : 'var(--border)'}`,
                }}>
                  {item.mandatory ? 'Required' : 'Optional'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Danger zone */}
      <div style={{ borderTop: '0.5px solid var(--border)', paddingTop: 16 }}>
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
