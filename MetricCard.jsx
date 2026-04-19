import React from 'react'

export default function MetricCard({ label, value, delta, deltaLabel: dl, sublabel, accent, small, onClick }) {
  const deltaPositive = delta?.positive
  const cls = deltaPositive === true ? 'up' : deltaPositive === false ? 'dn' : 'neu'

  return (
    <div
      onClick={onClick}
      style={{
        background: 'var(--bg2)',
        border: `1px solid ${accent ? `${accent}22` : 'var(--border)'}`,
        borderTop: accent ? `3px solid ${accent}` : `1px solid var(--border)`,
        borderRadius: 'var(--radius)',
        padding: small ? '12px 14px' : '16px 18px',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'box-shadow .15s, border-color .15s',
      }}
      onMouseEnter={onClick ? e => e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)' : undefined}
      onMouseLeave={onClick ? e => e.currentTarget.style.boxShadow = 'none' : undefined}
    >
      <div style={{
        fontSize: 11,
        color: 'var(--text3)',
        marginBottom: 6,
        fontWeight: 500,
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
      }}>
        {label}
      </div>
      <div style={{
        fontSize: small ? 20 : 24,
        fontWeight: 600,
        color: 'var(--text)',
        lineHeight: 1.15,
        letterSpacing: '-0.02em',
        marginBottom: (delta || dl || sublabel) ? 6 : 0,
        fontVariantNumeric: 'tabular-nums',
      }}>
        {value ?? '—'}
      </div>
      {(delta || dl) && (
        <div className={cls} style={{ fontSize: 11.5, display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 10 }}>{deltaPositive === true ? '▲' : deltaPositive === false ? '▼' : '—'}</span>
          <span>{dl || delta?.label}</span>
          {sublabel && <span style={{ color: 'var(--text3)', marginLeft: 2 }}>vs {sublabel}</span>}
        </div>
      )}
      {!delta && !dl && sublabel && (
        <div style={{ fontSize: 11.5, color: 'var(--text3)' }}>{sublabel}</div>
      )}
    </div>
  )
}
