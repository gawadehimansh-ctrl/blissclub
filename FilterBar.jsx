import React from 'react'
import DatePicker from './DatePicker.jsx'
import AdvancedFilters from './AdvancedFilters.jsx'

export default function FilterBar({ filters, extras, showSegment = true, showCohort = true, showSaleTag = true, showAdvanced = false }) {
  const {
    dateFrom, dateTo, setDateFrom, setDateTo,
    segment, setSegment,
    saleTag, setSaleTag,
    cohorts, setCohorts,
    metricFilters, addMetricFilter, removeMetricFilter, clearMetricFilters,
  } = filters

  const cohortsAll = ['ACQ', 'REM', 'RET']

  function handleDateChange(from, to) {
    setDateFrom(from)
    setDateTo(to)
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      flexWrap: 'wrap', padding: '10px 0',
      borderBottom: '0.5px solid var(--border)', marginBottom: 16,
    }}>
      {/* Segment */}
      {showSegment && (
        <div style={{ display: 'flex', gap: 3 }}>
          {[['all', 'All'], ['women', 'Women'], ['men', 'Men']].map(([val, label]) => (
            <button key={val} onClick={() => setSegment(val)}
              style={chip(segment === val, val === 'women' ? 'var(--pink)' : val === 'men' ? 'var(--blue)' : null)}>
              {label}
            </button>
          ))}
        </div>
      )}

      {showSegment && <Divider />}

      {/* Cohort */}
      {showCohort && (
        <div style={{ display: 'flex', gap: 3 }}>
          {cohortsAll.map(c => {
            const active = cohorts.includes(c)
            return (
              <button key={c}
                onClick={() => setCohorts(prev => active ? prev.filter(x => x !== c) : [...prev, c])}
                style={chip(active)}>
                {c}
              </button>
            )
          })}
        </div>
      )}

      {showCohort && <Divider />}

      {/* BAU vs Sale */}
      {showSaleTag && (
        <div style={{ display: 'flex', gap: 3 }}>
          {[['', 'All'], ['BAU', 'BAU'], ['Sale', 'Sale']].map(([val, label]) => (
            <button key={val} onClick={() => setSaleTag(val)}
              style={chip(saleTag === val)}>
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Advanced metric filters */}
      {showAdvanced && (
        <>
          <Divider />
          <AdvancedFilters
            metricFilters={metricFilters || []}
            addMetricFilter={addMetricFilter}
            removeMetricFilter={removeMetricFilter}
            clearMetricFilters={clearMetricFilters}
          />
        </>
      )}

      {extras}

      {/* Date picker — always right */}
      <div style={{ marginLeft: 'auto' }}>
        <DatePicker from={dateFrom} to={dateTo} onChange={handleDateChange} />
      </div>
    </div>
  )
}

function Divider() {
  return <div style={{ width: 1, height: 18, background: 'var(--border2)', margin: '0 2px' }} />
}

function chip(active, color) {
  const c = color || 'var(--text2)'
  return {
    padding: '4px 10px', fontSize: 12, borderRadius: 20,
    border: `0.5px solid ${active ? c : 'var(--border)'}`,
    background: active ? `${c}20` : 'transparent',
    color: active ? c : 'var(--text2)',
    cursor: 'pointer', fontWeight: active ? 500 : 400, transition: 'all .12s',
  }
}
