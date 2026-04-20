import React, { useState, useRef, useEffect } from 'react'
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
         addMonths, subMonths, isSameDay, isSameMonth, subDays } from 'date-fns'

const DAYS = ['Su','Mo','Tu','We','Th','Fr','Sa']

function buildDays(month) {
  const start = startOfWeek(startOfMonth(month), { weekStartsOn: 0 })
  const end   = endOfWeek(endOfMonth(month),     { weekStartsOn: 0 })
  const days  = []
  let cur = new Date(start)
  while (cur <= end) { days.push(new Date(cur)); cur = new Date(cur.getTime() + 86400000) }
  return days
}

function prevPeriod(from, to) {
  const span = to - from
  return { from: new Date(from - span - 86400000), to: new Date(from - 86400000) }
}

const COMP_PRESETS = [
  { label: 'Previous period', fn: (f,t) => prevPeriod(f,t) },
  { label: 'Previous month',  fn: (f,t) => { const lm = subMonths(f,1); return { from: startOfMonth(lm), to: endOfMonth(lm) } } },
  { label: 'Same period last year', fn: (f,t) => ({ from: new Date(f.getFullYear()-1,f.getMonth(),f.getDate()), to: new Date(t.getFullYear()-1,t.getMonth(),t.getDate()) }) },
]

export default function DatePicker({ from, to, onChange, compFrom, compTo, onCompChange, showComp = true }) {
  const [open, setOpen]           = useState(false)
  const [hover, setHover]         = useState(null)
  const [stage, setStage]         = useState('start')
  const [leftMonth, setLeftMonth] = useState(startOfMonth(from || new Date()))
  const [tempFrom, setTempFrom]   = useState(from)
  const [tempTo, setTempTo]       = useState(to)
  const [compOn, setCompOn]       = useState(!!(compFrom && compTo))
  const [compStage, setCompStage] = useState('start')
  const [cFrom, setCFrom]         = useState(compFrom || null)
  const [cTo, setCTo]             = useState(compTo || null)
  const [cHover, setCHover]       = useState(null)
  const [activePane, setActivePane] = useState('primary')
  const ref = useRef()

  useEffect(() => {
    function onDown(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  useEffect(() => { setTempFrom(from); setTempTo(to) }, [from, to])
  useEffect(() => { setCFrom(compFrom || null); setCTo(compTo || null) }, [compFrom, compTo])
  useEffect(() => { setCompOn(!!(compFrom && compTo)) }, [compFrom, compTo])

  const rightMonth = addMonths(leftMonth, 1)

  function clickDay(day) {
    if (activePane === 'primary') {
      if (stage === 'start') { setTempFrom(day); setTempTo(null); setStage('end') }
      else { if (day < tempFrom) { setTempFrom(day); setTempTo(tempFrom) } else setTempTo(day); setStage('start') }
    } else {
      if (compStage === 'start') { setCFrom(day); setCTo(null); setCompStage('end') }
      else { if (day < cFrom) { setCFrom(day); setCTo(cFrom) } else setCTo(day); setCompStage('start') }
    }
  }

  function apply() {
    if (!tempFrom || !tempTo) return
    onChange(tempFrom, tempTo)
    if (onCompChange) onCompChange(compOn && cFrom && cTo ? cFrom : null, compOn && cFrom && cTo ? cTo : null)
    setOpen(false)
  }

  function preset(f, t) {
    setTempFrom(f); setTempTo(t); setStage('start')
    const comp = prevPeriod(f, t)
    if (compOn) { setCFrom(comp.from); setCTo(comp.to) }
    onChange(f, t)
    if (onCompChange) onCompChange(compOn ? comp.from : null, compOn ? comp.to : null)
    setOpen(false)
  }

  const PRESETS = [
    { label: 'Today',         fn: () => { const d = new Date(); preset(d, d) } },
    { label: 'Yesterday',     fn: () => { const d = subDays(new Date(),1); preset(d,d) } },
    { label: 'Last 7 days',   fn: () => preset(subDays(new Date(),6), new Date()) },
    { label: 'Last 14 days',  fn: () => preset(subDays(new Date(),13), new Date()) },
    { label: 'Last 30 days',  fn: () => preset(subDays(new Date(),29), new Date()) },
    { label: 'This month',    fn: () => preset(startOfMonth(new Date()), new Date()) },
    { label: 'Last month',    fn: () => { const lm = subMonths(new Date(),1); preset(startOfMonth(lm), endOfMonth(lm)) } },
    { label: 'Last 3 months', fn: () => preset(startOfMonth(subMonths(new Date(),2)), new Date()) },
  ]

  function dayStyle(day, month) {
    const isPrimary = activePane === 'primary'
    const f = isPrimary ? tempFrom : cFrom
    const t = isPrimary ? tempTo   : cTo
    const hov = isPrimary ? hover  : cHover
    const st  = isPrimary ? stage  : compStage
    const isF = f && isSameDay(day,f), isT = t && isSameDay(day,t)
    const inRange = f && t && day >= f && day <= t
    const inHover = f && !t && hov && st==='end' && day >= f && day <= hov
    const inComp  = isPrimary && cFrom && cTo && compOn && day >= cFrom && day <= cTo
    const inMonth = isSameMonth(day, month)
    const isToday = isSameDay(day, new Date())
    return {
      width:30, height:30, display:'flex', alignItems:'center', justifyContent:'center',
      fontSize:12, borderRadius:6, cursor:'pointer', userSelect:'none',
      fontWeight: (isF||isT) ? 600 : 400,
      color: (isF||isT) ? '#fff' : !inMonth ? '#444' : isToday ? 'var(--pink)' : 'var(--text)',
      background: (isF||isT) ? (isPrimary?'var(--pink)':'var(--blue)')
        : (inRange||inHover) ? (isPrimary?'rgba(232,69,122,0.18)':'rgba(66,133,244,0.15)')
        : inComp ? 'rgba(66,133,244,0.08)' : 'transparent',
    }
  }

  const mainLabel = from && to ? `${format(from,'d MMM yy')} – ${format(to,'d MMM yy')}` : 'Select range'

  return (
    <div ref={ref} style={{ position:'relative' }}>
      <button onClick={() => { setOpen(o=>!o); setStage('start'); setActivePane('primary') }} style={{
        display:'flex', alignItems:'center', gap:6, padding:'6px 12px',
        fontSize:12, fontWeight:500, borderRadius:8, cursor:'pointer',
        background: open ? 'var(--bg3)' : 'var(--bg2)',
        border:`0.5px solid ${open?'var(--pink-border)':'var(--border2)'}`,
        color:'var(--text)', whiteSpace:'nowrap',
      }}>
        📅 {mainLabel}
        {compOn && cFrom && cTo && <span style={{ color:'var(--blue)', fontSize:11, fontWeight:400 }}> vs {format(cFrom,'d MMM')}–{format(cTo,'d MMM yy')}</span>}
        {' '}▾
      </button>

      {open && (
        <div style={{
          position:'fixed',
          top: ref.current ? ref.current.getBoundingClientRect().bottom+6 : 60,
          right:20, background:'var(--bg2)', border:'0.5px solid var(--border2)',
          borderRadius:12, zIndex:99999, boxShadow:'0 12px 40px rgba(0,0,0,0.6)',
          display:'flex', overflow:'hidden', minWidth:580,
        }}>
          {/* Presets */}
          <div style={{ width:140, borderRight:'0.5px solid var(--border)', padding:'10px 6px', display:'flex', flexDirection:'column', gap:1 }}>
            <div style={{ fontSize:10, color:'var(--text3)', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.06em', padding:'2px 8px 8px' }}>Quick select</div>
            {PRESETS.map(p => (
              <button key={p.label} onClick={p.fn} style={{ padding:'6px 8px', fontSize:12, borderRadius:6, cursor:'pointer', background:'transparent', border:'none', color:'var(--text2)', textAlign:'left' }}
                onMouseEnter={e=>{e.currentTarget.style.background='var(--bg3)';e.currentTarget.style.color='var(--text)'}}
                onMouseLeave={e=>{e.currentTarget.style.background='transparent';e.currentTarget.style.color='var(--text2)'}}
              >{p.label}</button>
            ))}
          </div>

          {/* Calendar + comparison */}
          <div style={{ padding:'12px 16px', display:'flex', flexDirection:'column', gap:10 }}>

            {/* Pane switcher */}
            {showComp && compOn && (
              <div style={{ display:'flex', gap:4 }}>
                {[['primary','Primary period'],['compare','Compare period']].map(([p,lbl]) => (
                  <button key={p} onClick={()=>setActivePane(p)} style={{
                    padding:'4px 10px', fontSize:11, borderRadius:5, cursor:'pointer', border:'none',
                    background: activePane===p ? (p==='primary'?'var(--pink-dim)':'var(--blue-dim)') : 'var(--bg3)',
                    color: activePane===p ? (p==='primary'?'var(--pink)':'var(--blue)') : 'var(--text2)',
                    fontWeight: activePane===p ? 600 : 400,
                  }}>{lbl}</button>
                ))}
              </div>
            )}

            {/* Two-month calendar */}
            <div style={{ display:'flex', gap:20 }}>
              {[leftMonth, rightMonth].map((month, mi) => (
                <div key={mi} style={{ width:210 }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
                    {mi===0 ? <button onClick={()=>setLeftMonth(m=>subMonths(m,1))} style={nb}>‹</button> : <div style={{width:24}}/>}
                    <span style={{ fontSize:13, fontWeight:500 }}>{format(month,'MMM yyyy')}</span>
                    {mi===1 ? <button onClick={()=>setLeftMonth(m=>addMonths(m,1))} style={nb}>›</button> : <div style={{width:24}}/>}
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(7,30px)', gap:1, marginBottom:4 }}>
                    {DAYS.map(d=><div key={d} style={{ fontSize:10, color:'var(--text3)', textAlign:'center', fontWeight:600 }}>{d}</div>)}
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(7,30px)', gap:1 }}>
                    {buildDays(month).map((day,i)=>(
                      <div key={i} style={dayStyle(day,month)}
                        onClick={()=>clickDay(day)}
                        onMouseEnter={()=>activePane==='primary'?setHover(day):setCHover(day)}
                        onMouseLeave={()=>activePane==='primary'?setHover(null):setCHover(null)}
                      >{format(day,'d')}</div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Compare toggle */}
            {showComp && (
              <div style={{ borderTop:'0.5px solid var(--border)', paddingTop:10 }}>
                <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', fontSize:12, marginBottom: compOn ? 8 : 0 }}>
                  <input type="checkbox" checked={compOn} onChange={e => {
                    const on = e.target.checked
                    setCompOn(on)
                    if (!on) { setCFrom(null); setCTo(null) }
                    else {
                      const { from:cf, to:ct } = prevPeriod(tempFrom||from, tempTo||to)
                      setCFrom(cf); setCTo(ct); setActivePane('compare')
                    }
                  }} style={{ accentColor:'var(--blue)' }} />
                  <span style={{ color:'var(--text2)' }}>Compare</span>
                  {compOn && cFrom && cTo && (
                    <span style={{ color:'var(--blue)', fontSize:11 }}>{format(cFrom,'d MMM')} – {format(cTo,'d MMM yy')}</span>
                  )}
                </label>
                {compOn && (
                  <div style={{ display:'flex', gap:4 }}>
                    {COMP_PRESETS.map(cp=>(
                      <button key={cp.label} onClick={()=>{ const r=cp.fn(tempFrom||from,tempTo||to); setCFrom(r.from); setCTo(r.to) }} style={{
                        padding:'3px 8px', fontSize:11, borderRadius:4, cursor:'pointer',
                        background:'var(--bg3)', border:'0.5px solid var(--border2)', color:'var(--text2)',
                      }}
                        onMouseEnter={e=>e.currentTarget.style.color='var(--text)'}
                        onMouseLeave={e=>e.currentTarget.style.color='var(--text2)'}
                      >{cp.label}</button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Footer */}
            <div style={{ borderTop:'0.5px solid var(--border)', paddingTop:10, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <div style={{ fontSize:11, color:'var(--text2)' }}>
                {activePane==='primary'
                  ? (stage==='end' ? 'Select end date' : tempFrom&&tempTo ? `${format(tempFrom,'d MMM')} – ${format(tempTo,'d MMM yy')}` : 'Click start date')
                  : (compStage==='end' ? 'Select compare end' : cFrom&&cTo ? `${format(cFrom,'d MMM')} – ${format(cTo,'d MMM yy')}` : 'Click compare start')
                }
              </div>
              <div style={{ display:'flex', gap:8 }}>
                <button onClick={()=>setOpen(false)} style={{...ab, background:'var(--bg3)', color:'var(--text2)'}}>Cancel</button>
                <button onClick={apply} style={{...ab, background:tempFrom&&tempTo?'var(--pink)':'var(--bg4)', color:tempFrom&&tempTo?'#fff':'var(--text3)', opacity:!tempFrom||!tempTo?0.5:1, cursor:!tempFrom||!tempTo?'default':'pointer'}}>Apply</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const nb = { width:24, height:24, display:'flex', alignItems:'center', justifyContent:'center', background:'var(--bg3)', border:'0.5px solid var(--border)', borderRadius:6, cursor:'pointer', fontSize:14, color:'var(--text2)' }
const ab = { padding:'5px 14px', fontSize:12, borderRadius:6, border:'0.5px solid var(--border2)', fontWeight:500, cursor:'pointer' }
