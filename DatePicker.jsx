import React, { useState, useRef, useEffect } from 'react'
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
         addMonths, subMonths, isSameDay, isSameMonth, isWithinInterval } from 'date-fns'

const DAYS = ['Su','Mo','Tu','We','Th','Fr','Sa']

function buildDays(month) {
  const start = startOfWeek(startOfMonth(month), { weekStartsOn: 0 })
  const end = endOfWeek(endOfMonth(month), { weekStartsOn: 0 })
  const days = []
  let cur = new Date(start)
  while (cur <= end) { days.push(new Date(cur)); cur = new Date(cur.getTime() + 86400000) }
  return days
}

export default function DatePicker({ from, to, onChange }) {
  const [open, setOpen] = useState(false)
  const [hover, setHover] = useState(null)
  const [stage, setStage] = useState('start')
  const [leftMonth, setLeftMonth] = useState(startOfMonth(from || new Date()))
  const [tempFrom, setTempFrom] = useState(from)
  const [tempTo, setTempTo] = useState(to)
  const ref = useRef()

  useEffect(() => {
    function onDown(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  useEffect(() => { setTempFrom(from); setTempTo(to) }, [from, to])

  const rightMonth = addMonths(leftMonth, 1)

  function clickDay(day) {
    if (stage === 'start') { setTempFrom(day); setTempTo(null); setStage('end') }
    else {
      if (day < tempFrom) { setTempFrom(day); setTempTo(tempFrom) }
      else setTempTo(day)
      setStage('start')
    }
  }

  function apply() {
    if (tempFrom && tempTo) { onChange(tempFrom, tempTo); setOpen(false) }
  }

  function preset(f, t) { setTempFrom(f); setTempTo(t); setStage('start'); onChange(f, t); setOpen(false) }

  const PRESETS = [
    { label: 'Today', fn: () => { const d = new Date(); preset(d, d) } },
    { label: 'Yesterday', fn: () => { const d = new Date(Date.now()-86400000); preset(d, d) } },
    { label: 'Last 7 days', fn: () => preset(new Date(Date.now()-6*86400000), new Date()) },
    { label: 'Last 14 days', fn: () => preset(new Date(Date.now()-13*86400000), new Date()) },
    { label: 'Last 30 days', fn: () => preset(new Date(Date.now()-29*86400000), new Date()) },
    { label: 'This month', fn: () => preset(startOfMonth(new Date()), new Date()) },
    { label: 'Last month', fn: () => { const lm = subMonths(new Date(),1); preset(startOfMonth(lm), endOfMonth(lm)) } },
    { label: 'Last 3 months', fn: () => preset(startOfMonth(subMonths(new Date(),2)), new Date()) },
  ]

  function dayStyle(day, month) {
    const isF = tempFrom && isSameDay(day, tempFrom)
    const isT = tempTo && isSameDay(day, tempTo)
    const inRange = tempFrom && tempTo && day >= tempFrom && day <= tempTo
    const inHover = tempFrom && !tempTo && hover && stage === 'end' && day >= tempFrom && day <= hover
    const inMonth = isSameMonth(day, month)
    const isToday = isSameDay(day, new Date())
    return {
      width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 12, borderRadius: 6, cursor: 'pointer', userSelect: 'none',
      fontWeight: (isF || isT) ? 600 : 400,
      color: (isF || isT) ? '#fff' : !inMonth ? 'var(--text3)' : isToday ? 'var(--accent)' : 'var(--text)',
      background: (isF || isT) ? 'var(--accent)' : (inRange || inHover) ? 'var(--accent-dim)' : 'transparent',
    }
  }

  const label = from && to ? `${format(from,'d MMM yy')} – ${format(to,'d MMM yy')}` : 'Select range'

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => { setOpen(o => !o); setStage('start') }} style={{
        display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
        fontSize: 12, fontWeight: 500, borderRadius: 8, cursor: 'pointer',
        background: open ? 'var(--bg3)' : 'var(--bg2)',
        border: `1px solid ${open ? 'var(--accent-border)' : 'var(--border2)'}`,
        color: 'var(--text)', whiteSpace: 'nowrap',
      }}>
        {label} ▾
      </button>

      {open && (
        <div style={{
          position: 'fixed',
          top: ref.current ? ref.current.getBoundingClientRect().bottom + 6 : 60,
          right: 20,
          background: 'var(--bg2)', border: '1px solid var(--border)',
          borderRadius: 12, zIndex: 99999,
          boxShadow: '0 8px 32px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.06)',
          display: 'flex', overflow: 'hidden',
        }}>
          {/* Presets */}
          <div style={{ width: 130, borderRight: '1px solid var(--border)', padding: '10px 6px', display: 'flex', flexDirection: 'column', gap: 1 }}>
            <div style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', padding: '2px 8px 8px' }}>Quick select</div>
            {PRESETS.map(p => (
              <button key={p.label} onClick={p.fn} style={{
                padding: '6px 8px', fontSize: 12, borderRadius: 6, cursor: 'pointer',
                background: 'transparent', border: 'none', color: 'var(--text2)', textAlign: 'left',
              }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg3)'; e.currentTarget.style.color = 'var(--text)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text2)' }}
              >{p.label}</button>
            ))}
          </div>

          {/* Calendars */}
          <div style={{ padding: '12px 16px' }}>
            <div style={{ display: 'flex', gap: 20, marginBottom: 10 }}>
              {[leftMonth, rightMonth].map((month, mi) => (
                <div key={mi} style={{ width: 210 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    {mi === 0
                      ? <button onClick={() => setLeftMonth(m => subMonths(m,1))} style={nb}>‹</button>
                      : <div style={{ width: 24 }} />}
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{format(month, 'MMM yyyy')}</span>
                    {mi === 1
                      ? <button onClick={() => setLeftMonth(m => addMonths(m,1))} style={nb}>›</button>
                      : <div style={{ width: 24 }} />}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,30px)', gap: 1, marginBottom: 4 }}>
                    {DAYS.map(d => <div key={d} style={{ fontSize: 10, color: 'var(--text3)', textAlign: 'center', fontWeight: 600 }}>{d}</div>)}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,30px)', gap: 1 }}>
                    {buildDays(month).map((day, i) => (
                      <div key={i} style={dayStyle(day, month)}
                        onClick={() => clickDay(day)}
                        onMouseEnter={() => setHover(day)}
                        onMouseLeave={() => setHover(null)}
                      >{format(day,'d')}</div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 11, color: 'var(--text2)' }}>
                {stage === 'end' ? 'Select end date' : tempFrom && tempTo ? `${format(tempFrom,'d MMM')} – ${format(tempTo,'d MMM yy')}` : 'Click start date'}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setOpen(false)} style={{ ...ab, background: 'var(--bg3)', color: 'var(--text2)' }}>Cancel</button>
                <button onClick={apply} disabled={!tempFrom || !tempTo || stage === 'end'} style={{
                  ...ab,
                  background: tempFrom && tempTo && stage !== 'end' ? 'var(--accent)' : 'var(--bg4)',
                  color: tempFrom && tempTo && stage !== 'end' ? '#fff' : 'var(--text3)',
                  opacity: !tempFrom || !tempTo || stage === 'end' ? 0.5 : 1,
                  cursor: !tempFrom || !tempTo || stage === 'end' ? 'default' : 'pointer',
                }}>Apply</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const nb = { width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', fontSize: 14, color: 'var(--text2)' }
const ab = { padding: '5px 14px', fontSize: 12, borderRadius: 6, border: '1px solid var(--border)', fontWeight: 500, cursor: 'pointer' }
