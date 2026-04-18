import React, { useState } from 'react'

// ── MetricFilter ───────────────────────────────────────────────────────────────
// Usage:
//   const [filters, setFilters] = useState([])
//   <MetricFilter filters={filters} onChange={setFilters} />
//   then in your data pipeline: rows.filter(row => applyMetricFilters(row, filters))

export const FILTER_PRESETS = [
  { label: 'ROAS > 2',   field: 'roasGA4', op: '>',  value: 2 },
  { label: 'ROAS > 3',   field: 'roasGA4', op: '>',  value: 3 },
  { label: 'CPC < ₹10',  field: 'cpc',     op: '<',  value: 10 },
  { label: 'CPC < ₹15',  field: 'cpc',     op: '<',  value: 15 },
  { label: 'CTR > 1.5%', field: 'ctr',     op: '>',  value: 0.015 },
  { label: 'CTR > 2%',   field: 'ctr',     op: '>',  value: 0.02 },
  { label: 'Spend > ₹5K',field: 'spend',   op: '>',  value: 5000 },
  { label: 'ROAS < 1',   field: 'roasGA4', op: '<',  value: 1 },
]

const FIELDS = [
  { key: 'roasGA4',  label: 'GA4 ROAS' },
  { key: 'roas1dc',  label: '1DC ROAS' },
  { key: 'cpc',      label: 'CPC (₹)' },
  { key: 'spend',    label: 'Spend (₹)' },
  { key: 'ctr',      label: 'CTR' },
  { key: 'ecr',      label: 'ECR' },
  { key: 'cpa',      label: 'CPA (₹)' },
  { key: 'gaRevenue',label: 'GA4 Rev (₹)' },
  { key: 'orders',   label: 'Orders' },
]

const OPS = ['>', '<', '>=', '<=', '=']

// Call this to filter a row object against active filters
export function applyMetricFilters(row, filters) {
  return filters.every(f => {
    const val = Number(row[f.field] ?? 0)
    const tgt = Number(f.value)
    switch (f.op) {
      case '>':  return val > tgt
      case '<':  return val < tgt
      case '>=': return val >= tgt
      case '<=': return val <= tgt
      case '=':  return Math.abs(val - tgt) < 0.0001
      default:   return true
    }
  })
}

export default function MetricFilter({ filters, onChange }) {
  const [open, setOpen] = useState(false)
  const [field, setField] = useState('roasGA4')
  const [op, setOp]       = useState('>')
  const [value, setValue] = useState('')

  const addFilter = () => {
    if (!value && value !== 0) return
    onChange([...filters, { field, op, value: Number(value), id: Date.now() }])
    setValue('')
  }

  const removeFilter = (id) => onChange(filters.filter(f => f.id !== id))

  const addPreset = (p) => {
    if (filters.some(f => f.field === p.field && f.op === p.op && f.value === p.value)) return
    onChange([...filters, { ...p, id: Date.now() }])
  }

  const fieldLabel = (key) => FIELDS.find(f => f.key === key)?.label || key

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          background: filters.length > 0 ? 'rgba(244,114,182,0.2)' : 'rgba(255,255,255,0.05)',
          border: filters.length > 0 ? '1px solid rgba(244,114,182,0.5)' : '1px solid rgba(255,255,255,0.1)',
          color: filters.length > 0 ? '#f472b6' : '#94a3b8',
          borderRadius: 8, padding: '6px 14px', fontSize: 12, cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 6,
        }}
      >
        ⚡ Filters {filters.length > 0 ? `(${filters.length} active)` : ''}
      </button>

      {open && (
        <div style={{
          position: 'fixed', zIndex: 999,
          background: '#0f172a', border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 12, padding: 16, width: 360,
          boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
        }}>
          {/* Presets */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Quick presets</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {FILTER_PRESETS.map((p, i) => (
                <button key={i} onClick={() => addPreset(p)} style={{
                  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                  color: '#94a3b8', borderRadius: 16, padding: '3px 10px', fontSize: 11, cursor: 'pointer',
                }}>{p.label}</button>
              ))}
            </div>
          </div>

          {/* Custom filter builder */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Custom filter</div>
            <div style={{ display: 'flex', gap: 6 }}>
              <select value={field} onChange={e => setField(e.target.value)} style={SELECT}>
                {FIELDS.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
              </select>
              <select value={op} onChange={e => setOp(e.target.value)} style={{ ...SELECT, width: 55 }}>
                {OPS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
              <input
                type="number"
                placeholder="value"
                value={value}
                onChange={e => setValue(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addFilter()}
                style={{ ...SELECT, flex: 1 }}
              />
              <button onClick={addFilter} style={{
                background: 'rgba(244,114,182,0.2)', border: '1px solid rgba(244,114,182,0.4)',
                color: '#f472b6', borderRadius: 8, padding: '6px 12px', fontSize: 12, cursor: 'pointer',
              }}>+ Add</button>
            </div>
          </div>

          {/* Active filters */}
          {filters.length > 0 && (
            <div>
              <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Active filters</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {filters.map(f => (
                  <div key={f.id} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    background: 'rgba(244,114,182,0.08)', border: '1px solid rgba(244,114,182,0.2)',
                    borderRadius: 8, padding: '6px 10px',
                  }}>
                    <span style={{ fontSize: 12, color: '#f472b6' }}>
                      {fieldLabel(f.field)} {f.op} {f.value}
                    </span>
                    <button onClick={() => removeFilter(f.id)} style={{
                      background: 'none', border: 'none', color: '#64748b',
                      cursor: 'pointer', fontSize: 14, padding: '0 4px',
                    }}>×</button>
                  </div>
                ))}
                <button onClick={() => onChange([])} style={{
                  background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
                  color: '#f87171', borderRadius: 8, padding: '5px 12px', fontSize: 11,
                  cursor: 'pointer', marginTop: 4,
                }}>Clear all filters</button>
              </div>
            </div>
          )}

          <button onClick={() => setOpen(false)} style={{
            position: 'absolute', top: 10, right: 12,
            background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 16,
          }}>×</button>
        </div>
      )}
    </div>
  )
}

const SELECT = {
  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
  color: '#e2e8f0', borderRadius: 8, padding: '6px 10px', fontSize: 12, outline: 'none',
}
