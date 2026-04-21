import React, { useState } from 'react'
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
import GoogleProducts from './pages/GoogleProducts.jsx'
import GoogleDemandGen from './pages/GoogleDemandGen.jsx'
import Hourly from './pages/Hourly.jsx'
import BlendedHealth from './pages/BlendedHealth.jsx'
import Upload from './pages/Upload.jsx'

const NAV = [
  { path: '/',                  label: 'Pacing Tracker',    icon: '◎', group: 'Overview' },
  { path: '/weekly',            label: 'Weekly',            icon: '⬛', group: 'Overview' },
  { path: '/blended',           label: 'Blended health',    icon: '◈', group: 'Overview' },
  { path: '/hourly',            label: 'Hourly pulse',      icon: '⏱', group: 'Meta' },
  { path: '/meta/campaigns',    label: 'Campaigns',         icon: '▤', group: 'Meta' },
  { path: '/meta/creative',     label: 'Creative lookback', icon: '◧', group: 'Meta' },
  { path: '/meta/cohort',       label: 'Cohort matrix',     icon: '⊞', group: 'Meta' },
  { path: '/google/campaigns',  label: 'Campaigns',         icon: '▤', group: 'Google' },
  { path: '/google/keywords',   label: 'Brand vs NB',       icon: '⌕', group: 'Google' },
  { path: '/google/awareness',  label: 'Awareness',         icon: '▶', group: 'Google' },
  { path: '/google/products',   label: 'Products',          icon: '◫', group: 'Google' },
  { path: '/google/demandgen',  label: 'Demand Gen',        icon: '▣', group: 'Google' },
  { path: '/upload',            label: 'Upload data',       icon: '⬆', group: 'Data' },
]

function Sidebar() {
  const { state } = useData()
  const location = useLocation()

  const groups = [...new Set(NAV.map(n => n.group))]

  const hasData = state.metaDB.length > 0 || state.googleDump.length > 0
  const lastSync = Object.values(state.lastUpdated).filter(Boolean).sort((a, b) => b - a)[0]

  return (
    <aside style={{
      width: 200, flexShrink: 0, background: 'var(--bg2)',
      borderRight: '0.5px solid var(--border)',
      display: 'flex', flexDirection: 'column',
      height: '100vh', position: 'sticky', top: 0,
    }}>
      {/* Brand */}
      <div style={{ padding: '16px 16px 12px', borderBottom: '0.5px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--pink)' }} />
          <span style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-0.02em' }}>BlissClub</span>
        </div>
        <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>Performance dashboard</div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        {groups.map(group => (
          <div key={group} style={{ marginBottom: 4 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '8px 16px 4px' }}>
              {group === 'Meta' ? (
                <span style={{ color: 'var(--pink)' }}>● {group}</span>
              ) : group === 'Google' ? (
                <span style={{ color: 'var(--blue)' }}>● {group}</span>
              ) : group}
            </div>
            {NAV.filter(n => n.group === group).map(item => (
              <NavLink key={item.path} to={item.path} end={item.path === '/'}
                style={({ isActive }) => ({
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '7px 16px', fontSize: 13,
                  color: isActive ? 'var(--text)' : 'var(--text2)',
                  background: isActive ? 'var(--bg3)' : 'transparent',
                  borderLeft: `2px solid ${isActive ? (group === 'Meta' ? 'var(--pink)' : group === 'Google' ? 'var(--blue)' : 'var(--text3)') : 'transparent'}`,
                  textDecoration: 'none',
                  transition: 'all .1s',
                })}>
                <span style={{ fontSize: 11 }}>{item.icon}</span>
                {item.label}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      {/* Status */}
      <div style={{ padding: '10px 16px', borderTop: '0.5px solid var(--border)', fontSize: 11 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: hasData ? 'var(--green)' : 'var(--text3)' }} />
          <span style={{ color: hasData ? 'var(--green)' : 'var(--text3)' }}>
            {hasData ? 'Data loaded' : 'No data'}
          </span>
        </div>
        {lastSync && (
          <div style={{ color: 'var(--text3)', fontSize: 10 }}>
            Last sync: {lastSync.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
          </div>
        )}
        <div style={{ marginTop: 6, display: 'flex', gap: 8 }}>
          {[
            { label: 'M',   count: state.metaDB.length,     color: 'var(--pink)'   },
            { label: 'G',   count: state.googleDump.length,  color: 'var(--blue)'   },
            { label: 'GA4', count: state.ga4Dump.length,     color: 'var(--purple)' },
          ].map(s => (
            <div key={s.label} style={{ fontSize: 10, color: s.count > 0 ? s.color : 'var(--text3)' }}>
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
      <main style={{ flex: 1, overflowX: 'hidden', minWidth: 0 }}>
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
          <Route path="/google/products"  element={<GoogleProducts />} />
          <Route path="/google/demandgen" element={<GoogleDemandGen />} />
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
