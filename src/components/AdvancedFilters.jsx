import React, { useState } from 'react'

const METRICS = [
  { key: 'roas1dc',    label: '1DC ROAS',    unit: 'x',  placeholder: '2.0' },
  { key: 'roasGA4',   label: 'GA4 ROAS',    unit: 'x',  placeholder: '1.5' },
  { key: 'cpc',       label: 'CPC',         unit: '₹',  placeholder: '15' },
  { key: 'cpm',       label: 'CPM',         unit: '₹',  placeholder: '150' },
  { key: 'ctr',       label: 'CTR',         unit: '%',  placeholder: '1.5' },
  { key: 'ecr',       label: 'ECR / CR%',   unit: '%',  placeholder: '1.8' },
  { key: 'cpa',       label: 'CPA',         unit: '₹',  placeholder: '1000' },
  { key: 'spend',     label: 'Spend',       unit: '₹',  placeholder: '5000' },
  { key: 'orders',    label: 'Orders',      unit: '',   placeholder: '5' },
  { key: 'ga4Revenue',label: 'GA4 Revenue', unit: '₹',  placeholder: '10000' },
]

const OPS = [
  { key: 'gt',  label: '>' },
  { key: 'gte', label: '≥' },
  { key: 'lt',  label: '<' },
  { key: 'lte', label: '≤' },
  { key: 'eq',  label: '=' },
]

// Quick presets — same as Meta Ads Manager style
const PRESETS = [
  { label: 'ROAS > 2x',    metric: 'roasGA4',  op: 'gt',  value: 2 },
  { label: 'ROAS > 1.5x',  metric: 'roasGA4',  op: 'gt',  value: 1.5 },
  { label: 'CPC < ₹12',    metric: 'cpc',      op: 'lt',  value: 12 },
  { label: 'CPC < ₹15',    metric: 'cpc',      op: 'lt',  value: 15 },
  { label: 'CTR > 1.5%',   metric: 'ctr',      op: 'gt',  value: 1.5 },
  { label: 'CTR > 2%',     metric: 'ctr',      op: 'gt',  value: 2 },
  { label: 'Spend > ₹5K',  metric: 'spend',    op: 'gt',  value: 5000 },
  { label: 'Orders > 5',   metric: 'orders',   op: 'gt',  value: 5 },
  { label: 'CPA < ₹1K',    metric: 'cpa',      op: 'lt',  value: 1000 },
  { label: 'ECR > 1.8%',   metric: 'ecr',      op: 'gt',  value: 1.8 },
]

export default function AdvancedFilters({ metricFilters, addMetricFilter, removeMetricFilter, clearMetricFilters }) {
  const [open, setOpen] = useState(false)
  const [newMetric, setNewMetric] = useState('roasGA4')
  const [newOp, setNewOp]        = useState('gt')
  const [newValue, setNewValue]  = useState('')

  const activeCount = metricFilters.length

  function handleAdd() {
    const v = parseFloat(newValue)
    if (isNaN(v)) return
    addMetricFilter({ metric: newMetric, op: newOp, value: v })
    setNewValue('')
  }

  function handlePreset(p) {
    addMetricFilter(p)
  }

  const metaInfo = METRICS.find(m => m.key === newMetric)

  return (
    <div style={{ position: 'relative' }}>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '5px 12px', fontSize: 12, borderRadius: 8, cursor: 'pointer',
          background: open || activeCount > 0 ? 'rgba(232,69,122,0.12)' : 'var(--bg2)',
          border: `0.5px solid ${open || activeCount > 0 ? 'var(--pink-border)' : 'var(--border2)'}`,
          color: open || activeCount > 0 ? 'var(--pink)' : 'var(--text2)',
          fontWeight: 500,
        }}
      >
        <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
          <path d="M1 3h12M3 7h8M5 11h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
        </svg>
        Filters
        {activeCount > 0 && (
          <span style={{
            background: 'var(--pink)', color: '#fff',
            fontSize: 10, fontWeight: 700, padding: '1px 5px',
            borderRadius: 8, minWidth: 16, textAlign: 'center',
          }}>{activeCount}</span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0, zIndex: 9998,
        }} onClick={() => setOpen(false)}>
          <div
            style={{
              position: 'absolute',
              top: 44, right: 0,
              background: 'var(--bg2)', border: '0.5px solid var(--border2)',
              borderRadius: 12, zIndex: 9999, width: 340,
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Active filters */}
            {activeCount > 0 && (
              <div style={{ padding: '10px 14px', borderBottom: '0.5px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Active filters</span>
                  <button onClick={clearMetricFilters} style={{ fontSize: 11, color: 'var(--red)', background: 'none', border: 'none', cursor: 'pointer' }}>Clear all</button>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {metricFilters.map(f => {
                    const m = METRICS.find(x => x.key === f.metric)
                    const o = OPS.find(x => x.key === f.op)
                    return (
                      <div key={f.id} style={{
                        display: 'flex', alignItems: 'center', gap: 4,
                        background: 'rgba(232,69,122,0.12)', border: '0.5px solid var(--pink-border)',
                        borderRadius: 6, padding: '3px 8px', fontSize: 12, color: 'var(--pink)',
                      }}>
                        <span>{m?.label} {o?.label} {m?.unit}{f.value}</span>
                        <button onClick={() => removeMetricFilter(f.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--pink)', fontSize: 14, lineHeight: 1, padding: 0, marginLeft: 2 }}>×</button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Quick presets */}
            <div style={{ padding: '10px 14px', borderBottom: '0.5px solid var(--border)' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Quick filters</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {PRESETS.map(p => {
                  const already = metricFilters.some(f => f.metric === p.metric && f.op === p.op && f.value === p.value)
                  return (
                    <button key={p.label} onClick={() => !already && handlePreset(p)} style={{
                      padding: '3px 9px', fontSize: 11, borderRadius: 6, cursor: already ? 'default' : 'pointer',
                      background: already ? 'rgba(232,69,122,0.15)' : 'var(--bg3)',
                      border: `0.5px solid ${already ? 'var(--pink-border)' : 'var(--border)'}`,
                      color: already ? 'var(--pink)' : 'var(--text2)',
                      opacity: already ? 0.7 : 1,
                    }}>{p.label}</button>
                  )
                })}
              </div>
            </div>

            {/* Custom filter builder */}
            <div style={{ padding: '10px 14px' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Custom filter</div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                {/* Metric selector */}
                <select
                  value={newMetric}
                  onChange={e => setNewMetric(e.target.value)}
                  style={{
                    flex: 2, padding: '6px 8px', fontSize: 12, borderRadius: 6,
                    background: 'var(--bg3)', border: '0.5px solid var(--border2)',
                    color: 'var(--text)', outline: 'none',
                  }}
                >
                  {METRICS.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
                </select>

                {/* Operator */}
                <select
                  value={newOp}
                  onChange={e => setNewOp(e.target.value)}
                  style={{
                    flex: 0, padding: '6px 6px', fontSize: 12, borderRadius: 6,
                    background: 'var(--bg3)', border: '0.5px solid var(--border2)',
                    color: 'var(--text)', outline: 'none', minWidth: 48,
                  }}
                >
                  {OPS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
                </select>

                {/* Value */}
                <div style={{ flex: 1, position: 'relative' }}>
                  {metaInfo?.unit && metaInfo.unit !== '%' && (
                    <span style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: 'var(--text3)' }}>
                      {metaInfo.unit}
                    </span>
                  )}
                  <input
                    type="number"
                    value={newValue}
                    onChange={e => setNewValue(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAdd()}
                    placeholder={metaInfo?.placeholder || '0'}
                    style={{
                      width: '100%', padding: `6px 8px 6px ${metaInfo?.unit && metaInfo.unit !== '%' ? '20px' : '8px'}`,
                      fontSize: 12, borderRadius: 6,
                      background: 'var(--bg3)', border: '0.5px solid var(--border2)',
                      color: 'var(--text)', outline: 'none',
                    }}
                  />
                  {metaInfo?.unit === '%' && (
                    <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: 'var(--text3)' }}>%</span>
                  )}
                </div>

                {/* Add button */}
                <button
                  onClick={handleAdd}
                  disabled={!newValue}
                  style={{
                    padding: '6px 12px', fontSize: 12, borderRadius: 6, cursor: newValue ? 'pointer' : 'default',
                    background: newValue ? 'var(--pink)' : 'var(--bg4)',
                    color: newValue ? '#fff' : 'var(--text3)',
                    border: 'none', fontWeight: 500,
                  }}
                >Add</button>
              </div>
              <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 6 }}>
                Press Enter or click Add · Multiple filters = AND condition
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
