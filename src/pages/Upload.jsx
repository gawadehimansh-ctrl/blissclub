import React from 'react'
import CSVUploader from '../components/CSVUploader.jsx'
import { useData } from '../data/store.jsx'
import { fmtNum } from '../utils/formatters.js'
import { format } from 'date-fns'

const SOURCES = [
  {
    key: 'metaDB',
    label: 'Meta daily data',
    color: 'var(--pink)',
    source: 'Windsor.ai (auto) or Meta Ads Manager CSV export',
    howTo: 'Ads Manager → Campaigns → Export → CSV. Columns needed: Date, Ad Set Name, Ad Name, Impressions, Link clicks, Spends, FB Orders, FB Revenue, Sessions, GA Orders, GA Revenue.',
    auto: true,
  },
  {
    key: 'metaHourly',
    label: 'Meta hourly data',
    color: 'var(--pink)',
    source: 'Manual CSV export · 3x per day (9am, 12pm, 5pm)',
    howTo: 'Ads Manager → Breakdown → By Time → Hourly → Export. Drop here. App auto-detects and appends to today\'s hourly data.',
    auto: false,
  },
  {
    key: 'google',
    label: 'Google campaign data',
    color: 'var(--blue)',
    source: 'Windsor.ai (auto) or Google Ads report export',
    howTo: 'Google Ads → Reports → Custom report: Date, Campaign, Cost, Impr, Clicks, Sessions, Transactions, Revenue. Export as CSV.',
    auto: true,
  },
  {
    key: 'ga4',
    label: 'GA4 export',
    color: 'var(--purple)',
    source: 'Manual export · once per day (EOD)',
    howTo: 'GA4 → Explore → Free-form: Dimension = Session manual term, Date. Metrics = Sessions, Transactions, Revenue. Export as CSV. This is the only daily manual step.',
    auto: false,
  },
]

export default function Upload() {
  const { state, dispatch } = useData()

  const counts = {
    metaDB: state.metaDB.length,
    metaHourly: state.metaHourly.length,
    google: state.googleDump.length,
    ga4: state.ga4Dump.length,
  }

  const lastUpdated = state.lastUpdated

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 18, fontWeight: 600, marginBottom: 2 }}>Data upload</h1>
        <div style={{ fontSize: 12, color: 'var(--text3)' }}>
          Windsor.ai handles Meta + Google automatically. Only GA4 needs a daily manual drop.
        </div>
      </div>

      {/* The one thing to do each day */}
      <div style={{ background: 'rgba(167,139,250,0.1)', border: '0.5px solid rgba(167,139,250,0.3)', borderRadius: 'var(--radius-lg)', padding: '14px 16px', marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--purple)', marginBottom: 6 }}>
          Your daily 10-minute routine
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[
            { time: '9:00 AM', task: 'Drop Meta hourly CSV here', note: 'Ads Manager → Hourly breakdown → Export', manual: true },
            { time: '12:00 PM', task: 'Drop Meta hourly CSV here', note: 'Same as above, updated to 12pm', manual: true },
            { time: '5:00 PM', task: 'Drop Meta hourly CSV here', note: 'End-of-business intraday check', manual: true },
            { time: 'EOD', task: 'Drop GA4 daily export here', note: 'GA4 Explore → Session term report → CSV', manual: true },
            { time: 'Auto', task: 'Windsor syncs Meta + Google overnight', note: 'No action needed — auto at 6am daily', manual: false },
          ].map((step, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
              <span style={{ minWidth: 70, color: step.manual ? 'var(--amber)' : 'var(--green)', fontWeight: 500 }}>{step.time}</span>
              <span style={{ color: 'var(--text)', fontWeight: step.manual ? 400 : 400 }}>{step.task}</span>
              <span style={{ color: 'var(--text3)' }}>— {step.note}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Upload zone */}
      <div style={{ marginBottom: 20 }}>
        <CSVUploader />
      </div>

      {/* Data source status */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 12, marginBottom: 20 }}>
        {SOURCES.map(src => {
          const count = counts[src.key]
          const updated = lastUpdated[src.key]
          const hasData = count > 0
          return (
            <div key={src.key} style={{ background: 'var(--bg2)', border: `0.5px solid ${hasData ? src.color + '40' : 'var(--border)'}`, borderRadius: 'var(--radius-lg)', padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: hasData ? src.color : 'var(--bg4)' }} />
                  <span style={{ fontSize: 13, fontWeight: 500, color: hasData ? src.color : 'var(--text2)' }}>{src.label}</span>
                </div>
                <span style={{ fontSize: 11, color: hasData ? 'var(--green)' : 'var(--text3)' }}>
                  {hasData ? `${fmtNum(count)} rows` : 'no data'}
                </span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>
                <span style={{ color: src.auto ? 'var(--green)' : 'var(--amber)' }}>
                  {src.auto ? '⬤ Auto via Windsor' : '⬤ Manual upload'}
                </span>
                {' · '}{src.source}
              </div>
              {updated && (
                <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                  Last updated: {format(updated, 'd MMM, h:mm a')}
                </div>
              )}
              <details style={{ marginTop: 8 }}>
                <summary style={{ fontSize: 11, color: 'var(--text3)', cursor: 'pointer', userSelect: 'none' }}>How to export →</summary>
                <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text2)', lineHeight: 1.6 }}>{src.howTo}</div>
              </details>
            </div>
          )
        })}
      </div>

      {/* Clear data */}
      <div style={{ borderTop: '0.5px solid var(--border)', paddingTop: 16 }}>
        <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8 }}>Danger zone</div>
        <button
          onClick={() => { if (window.confirm('Clear all loaded data?')) dispatch({ type: 'CLEAR_ALL' }) }}
          style={{ padding: '6px 14px', fontSize: 12, borderRadius: 6, cursor: 'pointer', background: 'var(--red-dim)', color: 'var(--red)', border: '0.5px solid rgba(239,68,68,0.3)' }}>
          Clear all data
        </button>
      </div>
    </div>
  )
}
