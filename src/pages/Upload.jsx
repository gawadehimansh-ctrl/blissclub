import React from 'react'
import CSVUploader from '../components/CSVUploader.jsx'
import { useWindsor } from '../hooks/useWindsor.js'
import { useData } from '../data/store.jsx'
import { fmtNum } from '../utils/formatters.js'
import { format } from 'date-fns'

const ROUTINE = [
  { time: '9 AM',   label: 'Meta hourly',   mandatory: true,  color: 'var(--pink)',   steps: 'Ads Manager → Campaigns → Breakdown → By Time → Hour of Day → Export CSV', auto: false },
  { time: '12 PM',  label: 'Meta hourly',   mandatory: true,  color: 'var(--pink)',   steps: 'Same as above — updated to 12pm data', auto: false },
  { time: '3 PM',   label: 'Meta hourly',   mandatory: true,  color: 'var(--pink)',   steps: 'Same as above — updated to 3pm data', auto: false },
  { time: '5 PM',   label: 'Meta hourly',   mandatory: true,  color: 'var(--pink)',   steps: 'Same as above — end-of-business check', auto: false },
  { time: 'EOD',    label: 'Meta daily',    mandatory: true,  color: 'var(--pink)',   steps: 'Windsor Auto-Sync ⚡', auto: true },
  { time: 'EOD',    label: 'GA4 daily',     mandatory: true,  color: 'var(--purple)', steps: 'GA4 → Explore → saved "Daily export" → set today\'s date → Export CSV', auto: false },
  { time: 'EOD',    label: 'Google (all)',  mandatory: true,  color: 'var(--blue)',   steps: 'Windsor Auto-Sync ⚡', auto: true },
  { time: 'Weekly', label: 'Google geo',    mandatory: false, color: 'var(--blue)',   steps: 'Windsor Auto-Sync ⚡', auto: true },
]

const DATA_SOURCES = [
  { key: 'metaDB',     label: 'Meta daily',    color: 'var(--pink)' },
  { key: 'metaHourly', label: 'Meta hourly',   color: 'var(--pink)' },
  { key: 'google',     label: 'Google',        color: 'var(--blue)' },
  { key: 'ga4',        label: 'GA4',           color: 'var(--purple)' },
]

const STATUS_LABELS = {
  waking:  { text: '☕ Waking proxy... (~15s)',  color: 'var(--amber, #f59e0b)' },
  syncing: { text: '⏳ Syncing data...',          color: 'var(--amber, #f59e0b)' },
  done:    { text: '✅ Sync complete',            color: 'var(--green)' },
  error:   { text: '❌ Some errors — see below', color: 'var(--red)' },
}

export default function Upload() {
  const { state, dispatch }               = useData()
  const { syncAll, syncStatus }           = useWindsor()
  const [syncing, setSyncing]             = React.useState(false)
  const [syncResult, setSyncResult]       = React.useState(null)
  const [syncPreset, setSyncPreset]       = React.useState('last_30d')

  const PROXY_URL = import.meta.env.VITE_WINDSOR_PROXY_URL

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
    metaDB:     state.metaDB.length,
    metaHourly: state.metaHourly.length,
    google:     state.googleDump.length,
    ga4:        state.ga4Dump.length,
  }
  const lastUpdated = state.lastUpdated

  const statusInfo = syncing && syncStatus ? STATUS_LABELS[syncStatus] : null

  return (
    <div style={{ padding: '24px 28px', background: '#090e1a', minHeight: '100vh', color: 'var(--text)', fontFamily: 'system-ui, sans-serif' }}>

      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Data sync</h1>
        <div style={{ fontSize: 12, color: 'var(--text3)' }}>Windsor handles Meta + Google automatically. GA4 and Meta hourly are manual CSV uploads.</div>
      </div>

      {/* Windsor Auto-Sync panel */}
      <div style={{
        background: PROXY_URL ? 'rgba(34,197,94,0.06)' : 'rgba(255,255,255,0.03)',
        border: `1px solid ${PROXY_URL ? 'rgba(34,197,94,0.25)' : 'rgba(255,255,255,0.08)'}`,
        borderRadius: 12, padding: '18px 20px', marginBottom: 24,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>
              ⚡ Windsor Auto-Sync
              {PROXY_URL && <span style={{ fontSize: 11, color: 'var(--green)', marginLeft: 8, fontWeight: 400 }}>● Proxy connected</span>}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>
              {PROXY_URL
                ? 'Pulls Meta daily + all Google data automatically. First click may take ~30s to wake the proxy.'
                : 'Set VITE_WINDSOR_PROXY_URL in Vercel env vars to enable.'}
            </div>
          </div>

          {PROXY_URL && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <select
                value={syncPreset}
                onChange={e => setSyncPreset(e.target.value)}
                style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, padding: '6px 10px', color: 'var(--text)', fontSize: 12, outline: 'none' }}
              >
                <option value="last_7d">Last 7 days</option>
                <option value="last_14d">Last 14 days</option>
                <option value="last_30d">Last 30 days</option>
                <option value="this_month">This month</option>
              </select>
              <button
                onClick={handleSync}
                disabled={syncing}
                style={{
                  padding: '8px 20px', fontSize: 13, fontWeight: 700,
                  borderRadius: 8, border: 'none',
                  cursor: syncing ? 'not-allowed' : 'pointer',
                  background: syncing ? 'var(--bg3)' : 'var(--green)',
                  color: syncing ? 'var(--text3)' : '#fff',
                  minWidth: 160,
                }}
              >
                {syncing ? (statusInfo?.text || '⏳ Syncing...') : '🔄 Sync everything'}
              </button>
            </div>
          )}
        </div>

        {/* Status message while syncing */}
        {syncing && statusInfo && (
          <div style={{ marginTop: 12, fontSize: 13, color: statusInfo.color, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>{statusInfo.text}</span>
            {syncStatus === 'waking' && (
              <span style={{ fontSize: 11, color: 'var(--text3)' }}>— Render.com free tier sleeps after inactivity, waking up now...</span>
            )}
          </div>
        )}

        {/* Sync result */}
        {!syncing && syncResult && (
          <div style={{ marginTop: 12, fontSize: 12 }}>
            {syncResult.success?.length > 0 && (
              <div style={{ color: 'var(--green)', marginBottom: 6 }}>
                ✅ {syncResult.success.join(' · ')}
              </div>
            )}
            {syncResult.errors?.length > 0 && (
              <div style={{ color: 'var(--red)' }}>
                ❌ {syncResult.errors.join(' · ')}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Data status cards */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 24, flexWrap: 'wrap' }}>
        {DATA_SOURCES.map(src => {
          const count   = counts[src.key]
          const updated = lastUpdated[src.key]
          const hasData = count > 0
          return (
            <div key={src.key} style={{
              flex: 1, minWidth: 130,
              background: 'rgba(255,255,255,0.03)',
              border: `1px solid ${hasData ? src.color + '40' : 'rgba(255,255,255,0.08)'}`,
              borderRadius: 10, padding: '12px 16px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: hasData ? src.color : '#334155' }} />
                <span style={{ fontSize: 11, color: hasData ? src.color : 'var(--text3)', fontWeight: 500 }}>{src.label}</span>
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, color: hasData ? 'var(--text)' : 'var(--text3)' }}>
                {hasData ? fmtNum(count) : '—'}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 3 }}>
                {updated ? `Synced ${format(updated, 'h:mm a')}` : 'No data yet'}
              </div>
            </div>
          )
        })}
      </div>

      {/* Manual CSV uploader */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text2)', marginBottom: 10 }}>
          Manual uploads (Meta hourly + GA4)
        </div>
        <CSVUploader />
      </div>

      {/* Daily routine */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Daily routine</div>
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '80px 160px 1fr 100px', padding: '8px 16px', background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            {['Time', 'Report', 'How', 'Status'].map(h => (
              <div key={h} style={{ fontSize: 10, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 1 }}>{h}</div>
            ))}
          </div>
          {ROUTINE.map((item, i) => (
            <div key={i} style={{
              display: 'grid', gridTemplateColumns: '80px 160px 1fr 100px',
              padding: '10px 16px',
              borderBottom: i < ROUTINE.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
              background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
            }}>
              <div style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 500 }}>{item.time}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: item.color }} />
                <span style={{ fontSize: 12, fontWeight: 500, color: item.color }}>{item.label}</span>
              </div>
              <div style={{ fontSize: 11, color: item.auto ? 'var(--green)' : 'var(--text3)', lineHeight: 1.5, paddingRight: 12 }}>{item.steps}</div>
              <span style={{
                fontSize: 10, padding: '2px 8px', borderRadius: 10, fontWeight: 500, alignSelf: 'center',
                background: item.mandatory ? 'rgba(232,69,122,0.15)' : 'rgba(255,255,255,0.05)',
                color: item.mandatory ? 'var(--pink)' : 'var(--text3)',
                border: `1px solid ${item.mandatory ? 'rgba(232,69,122,0.3)' : 'rgba(255,255,255,0.1)'}`,
              }}>
                {item.mandatory ? 'Required' : 'Optional'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Clear data */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 16 }}>
        <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 8 }}>Danger zone</div>
        <button
          onClick={() => { if (window.confirm('Clear all loaded data?')) dispatch({ type: 'CLEAR_ALL' }) }}
          style={{ padding: '6px 14px', fontSize: 12, borderRadius: 6, cursor: 'pointer', background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}
        >
          Clear all data
        </button>
      </div>
    </div>
  )
}
