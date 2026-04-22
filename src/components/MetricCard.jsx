import React from 'react'

export default function MetricCard({ label, value, delta, deltaLabel: dl, sublabel, accent, small, onClick }) {
  const deltaPositive = delta?.positive

  return (
    <div onClick={onClick} style={{
      background: 'var(--bg2)',
      border: '0.5px solid var(--border)',
      borderRadius: 'var(--radius-lg)',
      padding: small ? '14px 16px' : '22px 24px',
      minHeight: small ? 'auto' : 130,
      cursor: onClick ? 'pointer' : 'default',
      display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
    }}>
      {/* Colored label on top */}
      <div style={{
        fontSize: 11, fontWeight: 700,
        color: accent || 'var(--text3)',
        textTransform: 'uppercase', letterSpacing: '0.07em',
        marginBottom: 8,
      }}>{label}</div>

      {/* Big value */}
      <div style={{
        fontSize: small ? 20 : 30,
        fontWeight: 700,
        color: 'var(--text)',
        letterSpacing: '-0.02em',
        lineHeight: 1.1,
        marginBottom: 6,
        fontVariantNumeric: 'tabular-nums',
      }}>{value ?? '—'}</div>

      {/* Delta */}
      {(delta || dl) && (
        <div style={{ fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, marginBottom: sublabel ? 4 : 0 }}>
          <span style={{ color: deltaPositive === true ? 'var(--green)' : deltaPositive === false ? 'var(--red)' : 'var(--text3)' }}>
            {deltaPositive === true ? '▲' : deltaPositive === false ? '▼' : '—'} {dl || delta?.label}
          </span>
        </div>
      )}

      {/* Sublabel */}
      {sublabel && (
        <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: delta ? 0 : 2 }}>{sublabel}</div>
      )}
    </div>
  )
}
