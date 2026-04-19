import React from 'react'
import { Routes, Route, NavLink, useLocation } from 'react-router-dom'
import { DataProvider, useData } from './data/store.jsx'

import PacingTracker from './pages/PacingTracker.jsx'
import Weekly from './pages/Weekly.jsx'
import MetaCampaigns from './pages/MetaCampaigns.jsx'
import MetaCreative from './pages/MetaCreative.jsx'
import MetaCohortMatrix from './pages/MetaCohortMatrix.jsx'
import GoogleCampaigns from './pages/GoogleCampaigns.jsx'
import GoogleKeywords from './pages/GoogleKeywords.jsx'
import GoogleAwareness from './pages/GoogleAwareness.jsx'
import Hourly from './pages/Hourly.jsx'
import BlendedHealth from './pages/BlendedHealth.jsx'
import Upload from './pages/Upload.jsx'

const NAV = [
  { path: '/',                  label: 'Pacing Tracker',    group: 'Overview' },
  { path: '/weekly',            label: 'Weekly',            group: 'Overview' },
  { path: '/blended',           label: 'Blended Health',    group: 'Overview' },
  { path: '/hourly',            label: 'Hourly Pulse',      group: 'Meta' },
  { path: '/meta/campaigns',    label: 'Campaigns',         group: 'Meta' },
  { path: '/meta/creative',     label: 'Creative Lookback', group: 'Meta' },
  { path: '/meta/cohort',       label: 'Cohort Matrix',     group: 'Meta' },
  { path: '/google/campaigns',  label: 'Campaigns',         group: 'Google' },
  { path: '/google/keywords',   label: 'Brand vs NB',       group: 'Google' },
  { path: '/google/awareness',  label: 'Awareness',         group: 'Google' },
  { path: '/upload',            label: 'Upload Data',       group: 'Data' },
]

const GROUP_ACCENT = {
  Meta:    '#be185d',
  Google:  '#1a56db',
  Overview:'#6b6b65',
  Data:    '#6b6b65',
}

function Sidebar() {
  const { state } = useData()

  const groups = [...new Set(NAV.map(n => n.group))]
  const hasData = state.metaDB.length > 0 || state.googleDump.length > 0
  const lastSync = Object.values(state.lastUpdated).filter(Boolean).sort((a, b) => b - a)[0]

  return (
    <aside style={{
      width: 216, flexShrink: 0,
      background: 'var(--sidebar)',
      display: 'flex', flexDirection: 'column',
      height: '100vh', position: 'sticky', top: 0,
    }}>
      {/* Brand */}
      <div style={{
        padding: '20px 20px 16px',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 26, height: 26, borderRadius: 6,
            background: '#be185d',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 700, color: '#fff', letterSpacing: 0,
          }}>B</div>
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: '#f5f5f0', letterSpacing: '-0.02em' }}>BlissClub</div>
            <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.35)', marginTop: 0 }}>Performance</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, overflowY: 'auto', padding: '12px 0 8px' }}>
        {groups.map(group => (
          <div key={group} style={{ marginBottom: 20 }}>
            {/* Group label */}
            <div style={{
              fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.28)',
              textTransform: 'uppercase', letterSpacing: '0.09em',
              padding: '0 20px 6px',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              {(group === 'Meta' || group === 'Google') && (
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: GROUP_ACCENT[group], display: 'inline-block', flexShrink: 0 }} />
              )}
              {group}
            </div>
            {NAV.filter(n => n.group === group).map(item => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/'}
                style={({ isActive }) => ({
                  display: 'flex', alignItems: 'center',
                  padding: '6px 20px',
                  fontSize: 13,
                  color: isActive ? '#f5f5f0' : 'rgba(255,255,255,0.45)',
                  background: isActive ? 'rgba(255,255,255,0.07)' : 'transparent',
                  borderLeft: `2px solid ${isActive ? GROUP_ACCENT[group] : 'transparent'}`,
                  textDecoration: 'none',
                  transition: 'color .1s, background .1s',
                  fontWeight: isActive ? 500 : 400,
                })}
              >
                {item.label}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      {/* Status footer */}
      <div style={{
        padding: '12px 20px 16px',
        borderTop: '1px solid rgba(255,255,255,0.07)',
        fontSize: 11,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
          <div style={{
            width: 6, height: 6, borderRadius: '50%',
            background: hasData ? '#16a34a' : 'rgba(255,255,255,0.2)',
          }} />
          <span style={{ color: hasData ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.25)', fontSize: 11 }}>
            {hasData ? 'Data loaded' : 'No data'}
          </span>
        </div>
        {lastSync && (
          <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: 10, marginBottom: 6 }}>
            Synced {lastSync.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
          </div>
        )}
        <div style={{ display: 'flex', gap: 10 }}>
          {[
            { label: 'Meta',  count: state.metaDB.length,     color: '#be185d' },
            { label: 'Gads',  count: state.googleDump.length,  color: '#1a56db' },
            { label: 'GA4',   count: state.ga4Dump.length,     color: '#6d28d9' },
          ].map(s => (
            <div key={s.label} style={{
              fontSize: 10, fontWeight: 500,
              color: s.count > 0 ? s.color : 'rgba(255,255,255,0.2)',
            }}>
              {s.label} {s.count > 0 ? `${Math.round(s.count / 1000)}K` : '—'}
            </div>
          ))}
        </div>
      </div>
    </aside>
  )
}

function Layout() {
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <main style={{ flex: 1, overflowX: 'hidden', minWidth: 0, background: 'var(--bg)' }}>
        <Routes>
          <Route path="/"                 element={<PacingTracker />} />
          <Route path="/weekly"           element={<Weekly />} />
          <Route path="/blended"          element={<BlendedHealth />} />
          <Route path="/hourly"           element={<Hourly />} />
          <Route path="/meta/campaigns"   element={<MetaCampaigns />} />
          <Route path="/meta/creative"    element={<MetaCreative />} />
          <Route path="/meta/cohort"      element={<MetaCohortMatrix />} />
          <Route path="/google/campaigns" element={<GoogleCampaigns />} />
          <Route path="/google/keywords"  element={<GoogleKeywords />} />
          <Route path="/google/awareness" element={<GoogleAwareness />} />
          <Route path="/upload"           element={<Upload />} />
        </Routes>
      </main>
    </div>
  )
}

export default function App() {
  return (
    <DataProvider>
      <Layout />
    </DataProvider>
  )
}
