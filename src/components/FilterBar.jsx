import React, { useState } from 'react'
import { PRESET_RANGES } from '../hooks/useFilters.js'
import { format } from 'date-fns'

const PRESETS = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'last7', label: 'Last 7D' },
  { key: 'last14', label: 'Last 14D' },
  { key: 'last30', label: 'Last 30D' },
  { key: 'thisMonth', label: 'This Month' },
  { key: 'lastMonth', label: 'Last Month' },
]

export default function FilterBar({ filters, extras }) {
  const { dateFrom, dateTo, dateLabel, applyPreset, segment, setSegment, saleTag, setSaleTag, cohorts, setCohorts } = filters

  const cohortsAll = ['ACQ', 'REM', 'RET']

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '10px 0', borderBottom: '0.5px solid var(--border)', marginBottom: 16 }}>
      {/* Date presets */}
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {PRESETS.map(p => (
          <button key={p.key} onClick={() => applyPreset(p.key)}
            style={chip(dateLabel === p.label)}>
            {p.label}
          </button>
        ))}
      </div>

      <div style={{ width: 1, height: 20, background: 'var(--border2)', margin: '0 4px' }} />

      {/* Segment */}
      <div style={{ display: 'flex', gap: 4 }}>
        {['all', 'women', 'men'].map(s => (
          <button key={s} onClick={() => setSegment(s)}
            style={chip(segment === s, s === 'women' ? 'var(--pink)' : s === 'men' ? 'var(--blue)' : null)}>
            {s === 'all' ? 'All' : s === 'women' ? 'Women' : 'Men'}
          </button>
        ))}
      </div>

      <div style={{ width: 1, height: 20, background: 'var(--border2)', margin: '0 4px' }} />

      {/* Cohort */}
      <div style={{ display: 'flex', gap: 4 }}>
        {cohortsAll.map(c => {
          const active = cohorts.includes(c)
          return (
            <button key={c} onClick={() => setCohorts(prev => active ? prev.filter(x => x !== c) : [...prev, c])}
              style={chip(active)}>
              {c}
            </button>
          )
        })}
      </div>

      <div style={{ width: 1, height: 20, background: 'var(--border2)', margin: '0 4px' }} />

      {/* BAU vs Sale */}
      <div style={{ display: 'flex', gap: 4 }}>
        {['', 'BAU', 'Sale'].map(s => (
          <button key={s} onClick={() => setSaleTag(s)}
            style={chip(saleTag === s)}>
            {s === '' ? 'All' : s}
          </button>
        ))}
      </div>

      {/* Date range label */}
      <div style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text3)', whiteSpace: 'nowrap' }}>
        {format(dateFrom, 'd MMM')} – {format(dateTo, 'd MMM yy')}
      </div>

      {extras}
    </div>
  )
}

function chip(active, color) {
  const c = color || 'var(--text2)'
  return {
    padding: '4px 10px',
    fontSize: 12,
    borderRadius: 20,
    border: `0.5px solid ${active ? c : 'var(--border)'}`,
    background: active ? `${c}20` : 'transparent',
    color: active ? c : 'var(--text2)',
    cursor: 'pointer',
    fontWeight: active ? 500 : 400,
    transition: 'all .12s',
  }
}
