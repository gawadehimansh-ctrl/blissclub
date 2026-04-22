import React from 'react'
import { Routes, Route, NavLink } from 'react-router-dom'
import { DataProvider, useData } from './data/store.jsx'

import PacingTracker    from './pages/PacingTracker.jsx'
import Weekly           from './pages/Weekly.jsx'
import MetaCampaigns    from './pages/MetaCampaigns.jsx'
import MetaCreative     from './pages/MetaCreative.jsx'
import MetaCohortMatrix from './pages/MetaCohortMatrix.jsx'
import GoogleCampaigns  from './pages/GoogleCampaigns.jsx'
import GoogleKeywords   from './pages/GoogleKeywords.jsx'
import GoogleAwareness  from './pages/GoogleAwareness.jsx'
import GoogleProducts   from './pages/GoogleProducts.jsx'
import GoogleDemandGen  from './pages/GoogleDemandGen.jsx'
import Hourly           from './pages/Hourly.jsx'
import BlendedHealth    from './pages/BlendedHealth.jsx'
import Upload           from './pages/Upload.jsx'

// ── Auth Gate ─────────────────────────────────────────────────────────────────
function AuthGate({ children }) {
  const [authed, setAuthed] = React.useState(() => sessionStorage.getItem('bc_auth') === 'ok')
  const [user, setUser] = React.useState('')
  const [pass, setPass] = React.useState('')
  const [error, setError] = React.useState(false)

  if (authed) return children

  function handleLogin() {
    if (user === 'test' && pass === 'Blissclub1234') {
      sessionStorage.setItem('bc_auth', 'ok')
      setAuthed(true)
    } else {
      setError(true)
      setTimeout(() => setError(false), 2000)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#0d0d0d',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: '#161616', border: '0.5px solid rgba(255,255,255,0.08)',
        borderRadius: 16, padding: '40px 44px', width: 360,
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 32 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
              <rect x="3" y="3" width="7" height="7" rx="1"/>
              <rect x="14" y="3" width="7" height="7" rx="1"/>
              <rect x="3" y="14" width="7" height="7" rx="1"/>
              <rect x="14" y="14" width="7" height="7" rx="1"/>
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>BlissClub</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>Performance dashboard</div>
          </div>
        </div>

        <div style={{ fontSize: 18, fontWeight: 700, color: '#fff', marginBottom: 4 }}>Sign in</div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 28 }}>Enter your credentials to continue</div>

        {/* Username */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.5)', display: 'block', marginBottom: 6 }}>Username</label>
          <input
            value={user}
            onChange={e => setUser(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            placeholder="Enter username"
            style={{
              width: '100%', padding: '10px 14px', fontSize: 13,
              background: '#1e1e1e', border: `0.5px solid ${error ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.1)'}`,
              borderRadius: 8, color: '#fff', outline: 'none',
            }}
          />
        </div>

        {/* Password */}
        <div style={{ marginBottom: 24 }}>
          <label style={{ fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.5)', display: 'block', marginBottom: 6 }}>Password</label>
          <input
            type="password"
            value={pass}
            onChange={e => setPass(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            placeholder="Enter password"
            style={{
              width: '100%', padding: '10px 14px', fontSize: 13,
              background: '#1e1e1e', border: `0.5px solid ${error ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.1)'}`,
              borderRadius: 8, color: '#fff', outline: 'none',
            }}
          />
          {error && <div style={{ fontSize: 11, color: '#ef4444', marginTop: 6 }}>Invalid username or password</div>}
        </div>

        <button
          onClick={handleLogin}
          style={{
            width: '100%', padding: '11px', fontSize: 14, fontWeight: 600,
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer',
          }}
        >
          Sign in
        </button>
      </div>
    </div>
  )
}

// SVG Icons matching Figma sidebar exactly
const Icons = {
  pacing:   <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
  weekly:   <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  blended:  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>,
  hourly:   <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  campaigns:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>,
  creative: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>,
  cohort:   <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>,
  gcampaign:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>,
  keywords: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/></svg>,
  awareness:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/><line x1="12" y1="2" x2="12" y2="5"/><line x1="12" y1="19" x2="12" y2="22"/><line x1="2" y1="12" x2="5" y2="12"/><line x1="19" y1="12" x2="22" y2="12"/></svg>,
  products: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>,
  demandgen:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>,
  upload:   <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>,
}

const NAV = [
  { path: '/',                  label: 'Pacing Tracker',    icon: Icons.pacing,    group: 'Overview' },
  { path: '/weekly',            label: 'Weekly',            icon: Icons.weekly,    group: 'Overview' },
  { path: '/blended',           label: 'Blended health',    icon: Icons.blended,   group: 'Overview' },
  { path: '/hourly',            label: 'Hourly pulse',      icon: Icons.hourly,    group: 'Meta' },
  { path: '/meta/campaigns',    label: 'Campaigns',         icon: Icons.campaigns, group: 'Meta' },
  { path: '/meta/creative',     label: 'Creative lookback', icon: Icons.creative,  group: 'Meta' },
  { path: '/meta/cohort',       label: 'Cohort matrix',     icon: Icons.cohort,    group: 'Meta' },
  { path: '/google/campaigns',  label: 'Campaigns',         icon: Icons.gcampaign, group: 'Google' },
  { path: '/google/keywords',   label: 'Brand vs NB',       icon: Icons.keywords,  group: 'Google' },
  { path: '/google/awareness',  label: 'Awareness',         icon: Icons.awareness, group: 'Google' },
  { path: '/google/products',   label: 'Products',          icon: Icons.products,  group: 'Google' },
  { path: '/google/demandgen',  label: 'Demand Gen',        icon: Icons.demandgen, group: 'Google' },
  { path: '/upload',            label: 'Upload data',       icon: Icons.upload,    group: 'Data' },
]

function Sidebar() {
  const { state } = useData()
  const groups = [...new Set(NAV.map(n => n.group))]
  const hasData = state.metaDB.length > 0 || state.googleDump.length > 0
  const lastSync = Object.values(state.lastUpdated).filter(Boolean).sort((a, b) => b - a)[0]

  return (
    <aside style={{
      width: 220, flexShrink: 0,
      background: '#111111',
      borderRight: '0.5px solid rgba(255,255,255,0.06)',
      display: 'flex', flexDirection: 'column',
      height: '100vh', position: 'sticky', top: 0,
    }}>
      {/* Brand */}
      <div style={{ padding: '20px 16px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
              <rect x="3" y="3" width="7" height="7" rx="1"/>
              <rect x="14" y="3" width="7" height="7" rx="1"/>
              <rect x="3" y="14" width="7" height="7" rx="1"/>
              <rect x="14" y="14" width="7" height="7" rx="1"/>
            </svg>
          </div>
          <span style={{ fontSize: 16, fontWeight: 700, color: '#fff', letterSpacing: '-0.01em' }}>BlissClub</span>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, overflowY: 'auto', padding: '0 8px' }}>
        {groups.map((group, gi) => (
          <div key={group} style={{ marginBottom: 24 }}>
            <div style={{
              fontSize: 11, fontWeight: 600,
              color: 'rgba(255,255,255,0.3)',
              textTransform: 'uppercase', letterSpacing: '0.08em',
              padding: '0 8px', marginBottom: 4,
            }}>
              {group}
            </div>
            {NAV.filter(n => n.group === group).map(item => (
              <NavLink key={item.path} to={item.path} end={item.path === '/'}
                style={({ isActive }) => ({
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '9px 10px',
                  marginBottom: 2,
                  borderRadius: 8,
                  fontSize: 14,
                  color: isActive ? '#fff' : 'rgba(255,255,255,0.45)',
                  background: isActive ? 'rgba(255,255,255,0.08)' : 'transparent',
                  textDecoration: 'none',
                  fontWeight: isActive ? 600 : 400,
                  transition: 'all .12s',
                  '--icon-color': isActive ? (group === 'Google' ? '#6366f1' : group === 'Meta' ? '#e8457a' : '#fff') : 'rgba(255,255,255,0.45)',
                })}>
                <span style={{ color: 'var(--icon-color)', flexShrink: 0, display: 'flex' }}>
                  {item.icon}
                </span>
                {item.label}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      {/* Status */}
      <div style={{ padding: '12px 16px 20px', borderTop: '0.5px solid rgba(255,255,255,0.06)' }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: hasData ? '#fff' : 'rgba(255,255,255,0.3)', marginBottom: 4 }}>
          {hasData ? 'Data loaded' : 'No data'}
        </div>
        {lastSync && (
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 8 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#1db954', display: 'inline-block' }} />
              Last sync: {lastSync.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        )}
        <div style={{ display: 'flex', gap: 12 }}>
          {[
            { label: 'M',   count: state.metaDB.length,    color: '#e8457a' },
            { label: 'G',   count: state.googleDump.length, color: '#6366f1' },
            { label: 'GA4', count: state.ga4Dump.length,    color: '#a78bfa' },
          ].map(s => (
            <span key={s.label} style={{ fontSize: 11, fontWeight: 600, color: s.count > 0 ? s.color : 'rgba(255,255,255,0.2)' }}>
              {s.label} {s.count > 0 ? `${(s.count / 1000).toFixed(0)}K` : '—'}
            </span>
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
    <AuthGate>
      <DataProvider>
        <Layout />
      </DataProvider>
    </AuthGate>
  )
}
