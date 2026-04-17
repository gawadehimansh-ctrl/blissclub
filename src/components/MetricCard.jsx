import React from 'react'

export default function MetricCard({ label, value, delta, deltaLabel: dl, sublabel, accent, small, onClick }) {
  const deltaPositive = delta?.positive
  const cls = deltaPositive === true ? 'up' : deltaPositive === false ? 'dn' : 'neu'

  return (
    <div
      onClick={onClick}
      style={{
        background: accent ? `${accent}18` : 'var(--bg2)',
        border: `0.5px solid ${accent ? `${accent}40` : 'var(--border)'}`,
        borderRadius: 'var(--radius)',
        padding: small ? '10px 12px' : '14px 16px',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'border-color .15s',
      }}
    >
      <div style={{ fontSize: 11, color: accent || 'var(--text2)', marginBottom: 4, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </div>
      <div style={{ fontSize: small ? 20 : 24, fontWeight: 600, color: 'var(--text)', lineHeight: 1.2, marginBottom: 4 }}>
        {value ?? '—'}
      </div>
      {(delta || dl) && (
        <div className={cls} style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
          <span>{deltaPositive === true ? '▲' : deltaPositive === false ? '▼' : '—'}</span>
          <span>{dl || delta?.label}</span>
          {sublabel && <span style={{ color: 'var(--text3)', marginLeft: 2 }}>vs {sublabel}</span>}
        </div>
      )}
      {!delta && !dl && sublabel && (
        <div style={{ fontSize: 11, color: 'var(--text3)' }}>{sublabel}</div>
      )}
    </div>
  )
}
