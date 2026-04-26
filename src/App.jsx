import React from 'react'
import { Routes, Route, NavLink, useLocation } from 'react-router-dom'
import { DataProvider, useData } from './data/store.jsx'

import PacingTracker   from './pages/PacingTracker.jsx'
import Weekly          from './pages/Weekly.jsx'
import BlendedHealth   from './pages/BlendedHealth.jsx'
import Hourly          from './pages/Hourly.jsx'
import MetaCampaigns   from './pages/MetaCampaigns.jsx'
import MetaCreative    from './pages/MetaCreative.jsx'
import MetaCohortMatrix from './pages/MetaCohortMatrix.jsx'
import MetaCatalog     from './pages/MetaCatalog.jsx'
import GoogleCampaigns from './pages/GoogleCampaigns.jsx'
import GoogleKeywords  from './pages/GoogleKeywords.jsx'
import GoogleAwareness from './pages/GoogleAwareness.jsx'
import GoogleProducts  from './pages/GoogleProducts.jsx'
import GoogleDemandGen from './pages/GoogleDemandGen.jsx'
import Upload          from './pages/Upload.jsx'

const NAV = [
  { path: '/',                   label: 'Pacing Tracker',   icon: 'pacing',    group: 'OVERVIEW' },
  { path: '/weekly',             label: 'Weekly',           icon: 'weekly',    group: 'OVERVIEW' },
  { path: '/blended',            label: 'Blended health',   icon: 'blended',   group: 'OVERVIEW' },
  { path: '/hourly',             label: 'Hourly pulse',     icon: 'hourly',    group: 'META' },
  { path: '/meta/campaigns',     label: 'Campaigns',        icon: 'campaigns', group: 'META' },
  { path: '/meta/creative',      label: 'Creative lookback',icon: 'creative',  group: 'META' },
  { path: '/meta/cohort',        label: 'Cohort matrix',    icon: 'cohort',    group: 'META' },
  { path: '/meta/catalog',       label: 'Catalog / DPA',    icon: 'catalog',   group: 'META' },
  { path: '/google/campaigns',   label: 'Campaigns',        icon: 'gcampaigns',group: 'GOOGLE' },
  { path: '/google/keywords',    label: 'Brand vs NB',      icon: 'keywords',  group: 'GOOGLE' },
  { path: '/google/awareness',   label: 'Awareness',        icon: 'awareness', group: 'GOOGLE' },
  { path: '/google/products',    label: 'Products',         icon: 'products',  group: 'GOOGLE' },
  { path: '/google/demandgen',   label: 'Demand Gen',       icon: 'demandgen', group: 'GOOGLE' },
  { path: '/upload',             label: 'Upload data',      icon: 'upload',    group: 'DATA' },
]

const ICONS = {
  pacing:     <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
  weekly:     <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  blended:    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>,
  hourly:     <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  campaigns:  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>,
  creative:   <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><rect x="7" y="7" width="10" height="10" rx="1"/></svg>,
  cohort:     <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>,
  catalog:    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/><path d="M7 8h10M7 12h6"/></svg>,
  gcampaigns: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>,
  keywords:   <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  awareness:  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>,
  products:   <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>,
  demandgen:  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>,
  upload:     <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>,
}

function Sidebar() {
  const { state } = useData()
  const location  = useLocation()

  const groups = [...new Set(NAV.map(n => n.group))]

  const metaRows   = (state.metaDB      || state.metaDaily      || []).length
  const googleRows = (state.googleDump  || state.googleCampaigns|| []).length
  const ga4Rows    = (state.ga4Dump     || state.ga4            || []).length

  const lastUpdated = Object.values(state.lastUpdated || {}).filter(Boolean).sort((a, b) => b - a)[0]
  const lastSync    = lastUpdated ? new Date(lastUpdated).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : null

  const hasData = metaRows > 0 || googleRows > 0 || ga4Rows > 0

  return (
    <aside style={{
      width: 220, flexShrink: 0,
      background: '#0e0e0e',
      borderRight: '0.5px solid rgba(255,255,255,0.08)',
      display: 'flex', flexDirection: 'column',
      height: '100vh', position: 'sticky', top: 0, overflowY: 'auto',
    }}>
      {/* App icon + name */}
      <div style={{ padding: '20px 16px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: 'linear-gradient(135deg, #7F77DD, #a855f7)',
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3, padding: 6,
        }}>
          {[0,1,2,3].map(i => <div key={i} style={{ background: 'rgba(255,255,255,0.85)', borderRadius: 2 }} />)}
        </div>
        <span style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>BlissClub</span>
      </div>

      {/* Nav groups */}
      <nav style={{ flex: 1, padding: '4px 8px' }}>
        {groups.map(group => (
          <div key={group} style={{ marginBottom: 4 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.1em', padding: '10px 8px 4px' }}>
              {group}
            </div>
            {NAV.filter(n => n.group === group).map(item => {
              const isActive = item.path === '/'
                ? location.pathname === '/'
                : location.pathname.startsWith(item.path)

              const accentColor = group === 'META' ? '#f472b6'
                : group === 'GOOGLE' ? '#60a5fa'
                : 'rgba(255,255,255,0.7)'

              return (
                <NavLink key={item.path} to={item.path} style={{ textDecoration: 'none' }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 9,
                    padding: '7px 8px', borderRadius: 7, marginBottom: 1,
                    background: isActive ? 'rgba(255,255,255,0.08)' : 'transparent',
                    color: isActive ? '#fff' : 'rgba(255,255,255,0.45)',
                    fontSize: 13, fontWeight: isActive ? 500 : 400,
                    transition: 'background 0.15s, color 0.15s',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = 'rgba(255,255,255,0.75)' }}
                  onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; if (!isActive) e.currentTarget.style.color = 'rgba(255,255,255,0.45)' }}
                  >
                    <span style={{ color: isActive ? accentColor : 'inherit', flexShrink: 0 }}>
                      {ICONS[item.icon]}
                    </span>
                    {item.label}
                  </div>
                </NavLink>
              )
            })}
          </div>
        ))}
      </nav>

      {/* Status footer */}
      <div style={{ padding: '12px 16px', borderTop: '0.5px solid rgba(255,255,255,0.07)', fontSize: 11 }}>
        {hasData ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', flexShrink: 0 }} />
              <span style={{ color: '#fff', fontWeight: 600 }}>Data loaded</span>
            </div>
            {lastSync && <div style={{ color: 'rgba(255,255,255,0.35)', marginBottom: 6 }}>Last sync {lastSync}</div>}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {metaRows   > 0 && <span style={{ color: '#f472b6', fontSize: 10 }}>M {(metaRows/1000).toFixed(0)}K</span>}
              {googleRows > 0 && <span style={{ color: '#60a5fa', fontSize: 10 }}>G {(googleRows/1000).toFixed(0)}K</span>}
              {ga4Rows    > 0 && <span style={{ color: '#34d399', fontSize: 10 }}>GA4 {(ga4Rows/1000).toFixed(0)}K</span>}
            </div>
          </>
        ) : (
          <div style={{ color: 'rgba(255,255,255,0.3)' }}>No data loaded</div>
        )}
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
          <Route path="/"                   element={<PacingTracker />} />
          <Route path="/weekly"             element={<Weekly />} />
          <Route path="/blended"            element={<BlendedHealth />} />
          <Route path="/hourly"             element={<Hourly />} />
          <Route path="/meta/campaigns"     element={<MetaCampaigns />} />
          <Route path="/meta/creative"      element={<MetaCreative />} />
          <Route path="/meta/cohort"        element={<MetaCohortMatrix />} />
          <Route path="/meta/catalog"       element={<MetaCatalog />} />
          <Route path="/google/campaigns"   element={<GoogleCampaigns />} />
          <Route path="/google/keywords"    element={<GoogleKeywords />} />
          <Route path="/google/awareness"   element={<GoogleAwareness />} />
          <Route path="/google/products"    element={<GoogleProducts />} />
          <Route path="/google/demandgen"   element={<GoogleDemandGen />} />
          <Route path="/upload"             element={<Upload />} />
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
