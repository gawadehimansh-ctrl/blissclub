import React, { useState, useRef, useEffect } from 'react'
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
         addMonths, subMonths, isSameDay, isSameMonth, isWithinInterval,
         isBefore, isAfter, startOfDay } from 'date-fns'

const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

function buildCalendarDays(month) {
  const start = startOfWeek(startOfMonth(month), { weekStartsOn: 0 })
  const end = endOfWeek(endOfMonth(month), { weekStartsOn: 0 })
  const days = []
  let cur = start
  while (cur <= end) {
    days.push(new Date(cur))
    cur = new Date(cur.getTime() + 86400000)
  }
  return days
}

export default function DatePicker({ from, to, onChange }) {
  const [open, setOpen] = useState(false)
  const [hoverDate, setHoverDate] = useState(null)
  const [selecting, setSelecting] = useState(null) // 'start' | 'end' | null
  const [leftMonth, setLeftMonth] = useState(startOfMonth(from || new Date()))
  const [tempFrom, setTempFrom] = useState(from)
  const [tempTo, setTempTo] = useState(to)
  const ref = useRef()

  const rightMonth = addMonths(leftMonth, 1)

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  useEffect(() => {
    setTempFrom(from)
    setTempTo(to)
  }, [from, to])

  function handleDayClick(day) {
    if (!selecting || selecting === 'start') {
      setTempFrom(day)
      setTempTo(null)
      setSelecting('end')
    } else {
      if (isBefore(day, tempFrom)) {
        setTempFrom(day)
        setTempTo(tempFrom)
      } else {
        setTempTo(day)
      }
      setSelecting(null)
    }
  }

  function applyRange() {
    if (tempFrom && tempTo) {
      onChange(tempFrom, tempTo)
      setOpen(false)
      setSelecting(null)
    }
  }

  function applyPreset(from, to, label) {
    setTempFrom(from)
    setTempTo(to)
    setSelecting(null)
    onChange(from, to, label)
    setOpen(false)
  }

  function getDayStyle(day) {
    const isFrom = tempFrom && isSameDay(day, tempFrom)
    const isTo = tempTo && isSameDay(day, tempTo)
    const isInRange = tempFrom && tempTo && isWithinInterval(day, { start: tempFrom, end: tempTo })
    const isHoverRange = tempFrom && !tempTo && hoverDate && selecting === 'end' &&
      isWithinInterval(day, { start: tempFrom, end: hoverDate > tempFrom ? hoverDate : tempFrom })
    const isCurrentMonth = isSameMonth(day, leftMonth) || isSameMonth(day, rightMonth)
    const isToday = isSameDay(day, new Date())

    return {
      width: 30, height: 30,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 12, borderRadius: 6, cursor: 'pointer',
      fontWeight: (isFrom || isTo) ? 600 : 400,
      color: (isFrom || isTo) ? '#fff'
        : !isCurrentMonth ? 'var(--text3)'
        : isToday ? 'var(--pink)'
        : 'var(--text)',
      background: (isFrom || isTo) ? 'var(--pink)'
        : (isInRange || isHoverRange) ? 'var(--pink-dim)'
        : 'transparent',
      border: isToday && !isFrom && !isTo ? '0.5px solid var(--pink-border)' : 'none',
      transition: 'background .1s',
    }
  }

  const PRESETS = [
    { label: 'Today', fn: () => { const d = new Date(); applyPreset(d, d, 'Today') } },
    { label: 'Yesterday', fn: () => { const d = new Date(Date.now()-86400000); applyPreset(d, d, 'Yesterday') } },
    { label: 'Last 7 days', fn: () => applyPreset(new Date(Date.now()-6*86400000), new Date(), 'Last 7 days') },
    { label: 'Last 14 days', fn: () => applyPreset(new Date(Date.now()-13*86400000), new Date(), 'Last 14 days') },
    { label: 'Last 30 days', fn: () => applyPreset(new Date(Date.now()-29*86400000), new Date(), 'Last 30 days') },
    { label: 'This month', fn: () => applyPreset(startOfMonth(new Date()), new Date(), 'This month') },
    { label: 'Last month', fn: () => {
      const lm = subMonths(new Date(), 1)
      applyPreset(startOfMonth(lm), endOfMonth(lm), 'Last month')
    }},
    { label: 'Last 3 months', fn: () => applyPreset(startOfMonth(subMonths(new Date(), 2)), new Date(), 'Last 3 months') },
  ]

  const displayLabel = from && to
    ? `${format(from, 'd MMM yy')} – ${format(to, 'd MMM yy')}`
    : 'Select date range'

  return (
    <div ref={ref} style={{ position: 'relative', userSelect: 'none' }}>
      <button
        onClick={() => { setOpen(o => !o); setSelecting('start') }}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '6px 12px', fontSize: 13, borderRadius: 8,
          background: open ? 'var(--bg3)' : 'var(--bg2)',
          border: `0.5px solid ${open ? 'var(--pink-border)' : 'var(--border2)'}`,
          color: 'var(--text)', cursor: 'pointer', fontWeight: 500,
          whiteSpace: 'nowrap',
        }}
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ opacity: 0.6 }}>
          <rect x="1" y="3" width="14" height="12" rx="2" stroke="currentColor" strokeWidth="1.2"/>
          <path d="M1 7h14M5 1v4M11 1v4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
        </svg>
        {displayLabel}
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ opacity: 0.4 }}>
          <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
        </svg>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: '100%', right: 0, marginTop: 6,
          background: 'var(--bg2)', border: '0.5px solid var(--border2)',
          borderRadius: 12, zIndex: 1000, boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          display: 'flex', overflow: 'hidden',
        }}>
          {/* Presets sidebar */}
          <div style={{ width: 140, borderRight: '0.5px solid var(--border)', padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: 1 }}>
            <div style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', padding: '4px 8px 8px' }}>Quick select</div>
            {PRESETS.map(p => (
              <button key={p.label} onClick={p.fn}
                style={{
                  padding: '6px 8px', fontSize: 12, borderRadius: 6, cursor: 'pointer',
                  background: 'transparent', border: 'none', color: 'var(--text2)',
                  textAlign: 'left', transition: 'all .1s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg3)'; e.currentTarget.style.color = 'var(--text)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text2)' }}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Calendars */}
          <div style={{ padding: '12px 16px' }}>
            <div style={{ display: 'flex', gap: 24, marginBottom: 12 }}>
              {[leftMonth, rightMonth].map((month, mi) => (
                <div key={mi} style={{ width: 210 }}>
                  {/* Month nav */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    {mi === 0 ? (
                      <button onClick={() => setLeftMonth(m => subMonths(m, 1))} style={navBtn}>←</button>
                    ) : <div style={{ width: 24 }} />}
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{format(month, 'MMM yyyy')}</span>
                    {mi === 1 ? (
                      <button onClick={() => setLeftMonth(m => addMonths(m, 1))} style={navBtn}>→</button>
                    ) : <div style={{ width: 24 }} />}
                  </div>

                  {/* Day headers */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 30px)', gap: 1, marginBottom: 4 }}>
                    {DAYS.map(d => (
                      <div key={d} style={{ fontSize: 10, color: 'var(--text3)', textAlign: 'center', fontWeight: 600, padding: '2px 0' }}>{d}</div>
                    ))}
                  </div>

                  {/* Days grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 30px)', gap: 1 }}>
                    {buildCalendarDays(month).map((day, i) => (
                      <div key={i} style={getDayStyle(day)}
                        onClick={() => handleDayClick(day)}
                        onMouseEnter={() => setHoverDate(day)}
                        onMouseLeave={() => setHoverDate(null)}
                      >
                        {format(day, 'd')}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div style={{ borderTop: '0.5px solid var(--border)', paddingTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 12, color: 'var(--text2)' }}>
                {selecting === 'end' ? 'Now select end date' :
                 tempFrom && tempTo ? `${format(tempFrom, 'd MMM yy')} – ${format(tempTo, 'd MMM yy')}` :
                 'Click a start date'}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setOpen(false)} style={{ ...actionBtn, background: 'var(--bg3)', color: 'var(--text2)' }}>Cancel</button>
                <button
                  onClick={applyRange}
                  disabled={!tempFrom || !tempTo || selecting === 'end'}
                  style={{ ...actionBtn, background: tempFrom && tempTo && selecting !== 'end' ? 'var(--pink)' : 'var(--bg4)', color: tempFrom && tempTo && selecting !== 'end' ? '#fff' : 'var(--text3)', opacity: !tempFrom || !tempTo || selecting === 'end' ? 0.5 : 1 }}
                >
                  Apply
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const navBtn = {
  width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'var(--bg3)', border: '0.5px solid var(--border)', borderRadius: 6,
  cursor: 'pointer', fontSize: 12, color: 'var(--text2)',
}

const actionBtn = {
  padding: '5px 14px', fontSize: 12, borderRadius: 6, cursor: 'pointer',
  border: '0.5px solid var(--border2)', fontWeight: 500,
}
