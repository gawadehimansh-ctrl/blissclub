import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useData } from '../data/store.jsx'
import { fmtINRCompact, fmtX, fmtPct, fmtNum } from '../utils/formatters.js'
import { aggregateRows } from '../utils/metrics.js'

const OPENROUTER_KEY = 'sk-or-v1-placeholder' // user sets this
const MODEL = 'anthropic/claude-3.5-sonnet:beta'

const SUGGESTED = [
  'Why is ROAS dropping on ACQ campaigns?',
  'Which product should I scale budget on today?',
  'What are the biggest CPC inefficiencies right now?',
  'Compare this week vs last week performance',
  'Which creatives are burning budget?',
  'Where should I shift spend to improve blended ROAS?',
]

function getInsights() {
  try { return JSON.parse(localStorage.getItem('bc_insights') || '[]') } catch { return [] }
}
function saveInsight(insight) {
  const insights = getInsights()
  insights.unshift({ ...insight, id: Date.now(), ts: new Date().toISOString() })
  localStorage.setItem('bc_insights', JSON.stringify(insights.slice(0, 100)))
}

function buildSystemPrompt(dashData, pageContext) {
  const insights = getInsights().slice(0, 20)
  const insightText = insights.length > 0
    ? `\n\nPAST LOGGED INSIGHTS (most recent first):\n${insights.map(i => `[${i.ts?.slice(0,10)}] ${i.text}${i.action ? ` → Action: ${i.action}` : ''}`).join('\n')}`
    : ''

  return `You are a senior performance marketing analyst and co-pilot for BlissClub, an Indian women's activewear D2C brand.

You have deep expertise in:
- Meta Ads (ACQ/REM/RET cohorts, 1DC ROAS, GA4 ROAS, CTR, CPM, CPC, CR%)
- Google Ads (PMax, Shopping, Search, UAC, Awareness/AWR campaigns)
- D2C metrics (blended ROAS, CAC, AOV, ECR, pacing vs targets)
- Indian market context (₹ currency, Indian consumer behavior)

CURRENT DASHBOARD DATA:
${JSON.stringify(dashData, null, 2)}

${pageContext ? `CURRENT PAGE CONTEXT:\n${pageContext}` : ''}
${insightText}

INSTRUCTIONS:
- Be direct and actionable. No fluff.
- Always ground recommendations in the actual numbers shown
- Use ₹ for currency, Indian number formatting (L for lakhs, Cr for crores)
- Flag urgent issues first
- When suggesting budget shifts, be specific about amounts and campaigns
- Reference past insights when relevant to show pattern recognition
- Format responses cleanly with bold headers where helpful
- Keep responses concise but complete — this is a busy media buyer`
}

async function callOpenRouter(messages, systemPrompt, apiKey) {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://blissclub.vercel.app',
      'X-Title': 'BlissClub Co-pilot',
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
      stream: true,
    }),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error?.message || `OpenRouter error ${res.status}`)
  }
  return res.body
}

function MessageBubble({ msg, onSave }) {
  const [saved, setSaved] = useState(false)
  const isUser = msg.role === 'user'

  return (
    <div style={{
      display: 'flex', gap: 10, marginBottom: 20,
      flexDirection: isUser ? 'row-reverse' : 'row',
      alignItems: 'flex-start',
    }}>
      {/* Avatar */}
      <div style={{
        width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
        background: isUser ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : 'linear-gradient(135deg, #1db954, #0ea5e9)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 13, fontWeight: 700, color: '#fff',
      }}>
        {isUser ? 'M' : '✦'}
      </div>

      <div style={{ maxWidth: '85%', display: 'flex', flexDirection: 'column', gap: 4,
        alignItems: isUser ? 'flex-end' : 'flex-start' }}>
        {/* Bubble */}
        <div style={{
          padding: '12px 16px',
          borderRadius: isUser ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
          background: isUser ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : '#1e1e1e',
          border: isUser ? 'none' : '0.5px solid rgba(255,255,255,0.08)',
          fontSize: 13, lineHeight: 1.6, color: '#f0f0f0',
          whiteSpace: 'pre-wrap',
        }}>
          {msg.content}
          {msg.streaming && <span style={{ opacity: 0.5, animation: 'pulse 1s infinite' }}>▋</span>}
        </div>

        {/* Save button for AI messages */}
        {!isUser && !msg.streaming && msg.content && (
          <button onClick={() => { onSave(msg.content); setSaved(true) }} style={{
            fontSize: 11, padding: '3px 8px', borderRadius: 4, cursor: saved ? 'default' : 'pointer',
            background: saved ? 'rgba(29,185,84,0.15)' : 'rgba(255,255,255,0.06)',
            border: `0.5px solid ${saved ? 'rgba(29,185,84,0.3)' : 'rgba(255,255,255,0.1)'}`,
            color: saved ? '#1db954' : 'rgba(255,255,255,0.4)',
            transition: 'all .15s',
          }}>
            {saved ? '✓ Saved as insight' : '+ Save as insight'}
          </button>
        )}
      </div>
    </div>
  )
}

export default function CoPilot({ pageContext = null, dashData = null, fullscreen = false }) {
  const { state } = useData()
  const [open, setOpen] = useState(fullscreen)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('bc_openrouter_key') || '')
  const [showKeyInput, setShowKeyInput] = useState(false)
  const [showInsights, setShowInsights] = useState(false)
  const [insights, setInsights] = useState(getInsights)
  const [insightInput, setInsightInput] = useState('')
  const bottomRef = useRef()
  const textareaRef = useRef()

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Build dashboard summary for context
  const builtDashData = dashData || (() => {
    const metaRows = state.metaDB || []
    const googleRows = state.googleDump || []
    const ga4Rows = state.ga4Dump || []
    const meta = aggregateRows(metaRows)
    const totalSpend = meta.spend + googleRows.reduce((s,r) => s+r.cost, 0)
    const ga4Rev = ga4Rows.reduce((s,r) => s+r.revenue, 0)
    return {
      period: 'Last 7 days',
      meta: {
        spend: fmtINRCompact(meta.spend),
        ga4ROAS: fmtX(meta.roasGA4 || 0),
        cpa: fmtINRCompact(meta.cpa || 0),
        ctr: fmtPct(meta.ctr || 0),
        cpm: fmtINRCompact(meta.cpm || 0),
        orders: fmtNum(meta.gaOrders || 0),
      },
      google: {
        spend: fmtINRCompact(googleRows.reduce((s,r) => s+r.cost, 0)),
        revenue: fmtINRCompact(googleRows.reduce((s,r) => s+r.revenue, 0)),
        roas: fmtX(totalSpend > 0 ? googleRows.reduce((s,r) => s+r.revenue, 0) / googleRows.reduce((s,r) => s+r.cost, 0) : 0),
      },
      blended: {
        totalSpend: fmtINRCompact(totalSpend),
        ga4Revenue: fmtINRCompact(ga4Rev),
        blendedROAS: fmtX(totalSpend > 0 ? ga4Rev / totalSpend : 0),
      },
      dataRows: { meta: metaRows.length, google: googleRows.length, ga4: ga4Rows.length },
    }
  })()

  const systemPrompt = buildSystemPrompt(builtDashData, pageContext)

  async function sendMessage(text) {
    if (!text.trim() || loading) return
    if (!apiKey) { setShowKeyInput(true); return }

    const userMsg = { role: 'user', content: text }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setLoading(true)

    // Add streaming placeholder
    const streamId = Date.now()
    setMessages(prev => [...prev, { role: 'assistant', content: '', streaming: true, id: streamId }])

    try {
      const stream = await callOpenRouter(newMessages, systemPrompt, apiKey)
      const reader = stream.getReader()
      const decoder = new TextDecoder()
      let fullContent = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value)
        const lines = chunk.split('\n').filter(l => l.startsWith('data: '))
        for (const line of lines) {
          const data = line.slice(6)
          if (data === '[DONE]') continue
          try {
            const parsed = JSON.parse(data)
            const delta = parsed.choices?.[0]?.delta?.content || ''
            fullContent += delta
            setMessages(prev => prev.map(m =>
              m.id === streamId ? { ...m, content: fullContent } : m
            ))
          } catch {}
        }
      }
      setMessages(prev => prev.map(m =>
        m.id === streamId ? { ...m, streaming: false } : m
      ))
    } catch (e) {
      setMessages(prev => prev.map(m =>
        m.id === streamId ? { role: 'assistant', content: `Error: ${e.message}`, streaming: false } : m
      ))
    }
    setLoading(false)
  }

  function handleSaveInsight(content) {
    const newInsight = { text: content.slice(0, 300) }
    saveInsight(newInsight)
    setInsights(getInsights())
  }

  function handleAddManualInsight() {
    if (!insightInput.trim()) return
    saveInsight({ text: insightInput.trim(), manual: true })
    setInsightInput('')
    setInsights(getInsights())
  }

  // Floating panel mode
  if (!fullscreen) {
    return (
      <>
        {/* Floating toggle button */}
        <button onClick={() => setOpen(o => !o)} style={{
          position: 'fixed', bottom: 24, right: open ? 408 : 24, zIndex: 999,
          width: 48, height: 48, borderRadius: '50%',
          background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
          border: 'none', cursor: 'pointer', transition: 'right .25s ease',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 20px rgba(99,102,241,0.4)',
        }}>
          {open
            ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            : <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/><text x="6" y="16" fontSize="10" fill="white">✦</text></svg>
          }
        </button>

        {/* Slide-in panel */}
        <div style={{
          position: 'fixed', top: 0, right: open ? 0 : -400, bottom: 0,
          width: 400, zIndex: 998,
          background: '#111', borderLeft: '0.5px solid rgba(255,255,255,0.08)',
          display: 'flex', flexDirection: 'column',
          transition: 'right .25s ease',
          boxShadow: '-8px 0 32px rgba(0,0,0,0.4)',
        }}>
          <PanelContent
            messages={messages} input={input} setInput={setInput}
            loading={loading} onSend={sendMessage}
            apiKey={apiKey} setApiKey={setApiKey}
            showKeyInput={showKeyInput} setShowKeyInput={setShowKeyInput}
            showInsights={showInsights} setShowInsights={setShowInsights}
            insights={insights} setInsights={setInsights}
            insightInput={insightInput} setInsightInput={setInsightInput}
            onSaveInsight={handleSaveInsight} onAddInsight={handleAddManualInsight}
            bottomRef={bottomRef} textareaRef={textareaRef}
            compact={true}
          />
        </div>
      </>
    )
  }

  // Full page mode
  return (
    <div style={{ display: 'flex', height: '100vh', background: '#0d0d0d' }}>
      <PanelContent
        messages={messages} input={input} setInput={setInput}
        loading={loading} onSend={sendMessage}
        apiKey={apiKey} setApiKey={setApiKey}
        showKeyInput={showKeyInput} setShowKeyInput={setShowKeyInput}
        showInsights={showInsights} setShowInsights={setShowInsights}
        insights={insights} setInsights={setInsights}
        insightInput={insightInput} setInsightInput={setInsightInput}
        onSaveInsight={handleSaveInsight} onAddInsight={handleAddManualInsight}
        bottomRef={bottomRef} textareaRef={textareaRef}
        compact={false} fullscreen
      />
    </div>
  )
}

function PanelContent({
  messages, input, setInput, loading, onSend,
  apiKey, setApiKey, showKeyInput, setShowKeyInput,
  showInsights, setShowInsights, insights, setInsights,
  insightInput, setInsightInput, onSaveInsight, onAddInsight,
  bottomRef, textareaRef, compact, fullscreen,
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', maxWidth: fullscreen ? 800 : '100%', margin: '0 auto', width: '100%' }}>

      {/* Header */}
      <div style={{
        padding: compact ? '14px 16px' : '20px 28px',
        borderBottom: '0.5px solid rgba(255,255,255,0.08)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 10,
            background: 'linear-gradient(135deg, #1db954, #0ea5e9)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16,
          }}>✦</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>Co-pilot</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>BlissClub · Performance AI</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => setShowInsights(s => !s)} style={{
            padding: '5px 10px', fontSize: 11, borderRadius: 6, cursor: 'pointer',
            background: showInsights ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.06)',
            border: `0.5px solid ${showInsights ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.1)'}`,
            color: showInsights ? '#6366f1' : 'rgba(255,255,255,0.4)',
          }}>
            📌 {insights.length} insights
          </button>
          <button onClick={() => setShowKeyInput(s => !s)} style={{
            padding: '5px 10px', fontSize: 11, borderRadius: 6, cursor: 'pointer',
            background: apiKey ? 'rgba(29,185,84,0.1)' : 'rgba(239,68,68,0.1)',
            border: `0.5px solid ${apiKey ? 'rgba(29,185,84,0.3)' : 'rgba(239,68,68,0.3)'}`,
            color: apiKey ? '#1db954' : '#ef4444',
          }}>
            {apiKey ? '🔑 Connected' : '🔑 Set API key'}
          </button>
        </div>
      </div>

      {/* API key input */}
      {showKeyInput && (
        <div style={{ padding: '12px 16px', background: 'rgba(99,102,241,0.05)', borderBottom: '0.5px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>OpenRouter API key — get it from openrouter.ai</div>
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              type="password" value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder="sk-or-v1-..."
              style={{ flex: 1, padding: '7px 10px', fontSize: 12, borderRadius: 6, background: '#1e1e1e', border: '0.5px solid rgba(255,255,255,0.12)', color: '#fff', outline: 'none' }}
            />
            <button onClick={() => { localStorage.setItem('bc_openrouter_key', apiKey); setShowKeyInput(false) }} style={{
              padding: '7px 14px', fontSize: 12, borderRadius: 6, cursor: 'pointer',
              background: '#6366f1', color: '#fff', border: 'none', fontWeight: 600,
            }}>Save</button>
          </div>
        </div>
      )}

      {/* Insights panel */}
      {showInsights && (
        <div style={{ padding: '12px 16px', background: '#161616', borderBottom: '0.5px solid rgba(255,255,255,0.06)', maxHeight: 260, overflowY: 'auto', flexShrink: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>Logged insights</div>
          {/* Add manual insight */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
            <input value={insightInput} onChange={e => setInsightInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && onAddInsight()}
              placeholder="Log a decision or observation..."
              style={{ flex: 1, padding: '6px 10px', fontSize: 12, borderRadius: 6, background: '#1e1e1e', border: '0.5px solid rgba(255,255,255,0.1)', color: '#fff', outline: 'none' }}
            />
            <button onClick={onAddInsight} style={{ padding: '6px 12px', fontSize: 12, borderRadius: 6, background: '#6366f1', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600 }}>+ Log</button>
          </div>
          {insights.length === 0
            ? <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)', textAlign: 'center', padding: '12px 0' }}>No insights yet — save AI responses or log decisions manually</div>
            : insights.map(ins => (
              <div key={ins.id} style={{ padding: '8px 10px', marginBottom: 6, borderRadius: 6, background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.06)', fontSize: 12, color: 'rgba(255,255,255,0.7)', lineHeight: 1.4 }}>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', marginBottom: 3 }}>{ins.ts?.slice(0,16).replace('T',' ')} {ins.manual ? '· Manual' : '· AI'}</div>
                {ins.text}
              </div>
            ))
          }
        </div>
      )}

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: compact ? '16px 14px' : '24px 28px' }}>
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', padding: fullscreen ? '60px 20px' : '30px 16px' }}>
            <div style={{ fontSize: fullscreen ? 40 : 28, marginBottom: 12 }}>✦</div>
            <div style={{ fontSize: fullscreen ? 20 : 16, fontWeight: 700, color: '#fff', marginBottom: 6 }}>
              BlissClub Co-pilot
            </div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 28, lineHeight: 1.6 }}>
              Your performance marketing second brain.<br/>Ask anything about your campaigns, spend, ROAS, or strategy.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 360, margin: '0 auto' }}>
              {SUGGESTED.map(s => (
                <button key={s} onClick={() => onSend(s)} style={{
                  padding: '10px 14px', fontSize: 12, borderRadius: 10, cursor: 'pointer',
                  background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.08)',
                  color: 'rgba(255,255,255,0.6)', textAlign: 'left', lineHeight: 1.4,
                  transition: 'all .12s',
                }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(99,102,241,0.1)'; e.currentTarget.style.borderColor = 'rgba(99,102,241,0.3)'; e.currentTarget.style.color = '#fff' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = 'rgba(255,255,255,0.6)' }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((msg, i) => (
          <MessageBubble key={i} msg={msg} onSave={onSaveInsight} />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{
        padding: compact ? '12px 14px' : '16px 28px',
        borderTop: '0.5px solid rgba(255,255,255,0.08)', flexShrink: 0,
        background: '#111',
      }}>
        <div style={{
          display: 'flex', gap: 8, alignItems: 'flex-end',
          background: '#1a1a1a', border: '0.5px solid rgba(255,255,255,0.1)',
          borderRadius: 14, padding: '10px 14px',
        }}>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => { setInput(e.target.value); e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px' }}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend(input) } }}
            placeholder="Ask about campaigns, ROAS, budget decisions..."
            rows={1}
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              color: '#f0f0f0', fontSize: 13, lineHeight: 1.5, resize: 'none',
              fontFamily: 'inherit', maxHeight: 120,
            }}
          />
          <button
            onClick={() => onSend(input)}
            disabled={!input.trim() || loading}
            style={{
              width: 32, height: 32, borderRadius: 8, border: 'none', cursor: input.trim() && !loading ? 'pointer' : 'default',
              background: input.trim() && !loading ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : 'rgba(255,255,255,0.06)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              transition: 'all .15s',
            }}
          >
            {loading
              ? <div style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              : <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M22 2L11 13M22 2L15 22L11 13L2 9L22 2Z"/></svg>
            }
          </button>
        </div>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', marginTop: 6, textAlign: 'center' }}>
          Enter to send · Shift+Enter for new line · Powered by OpenRouter
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes pulse { 0%,100% { opacity: 1 } 50% { opacity: 0 } }
      `}</style>
    </div>
  )
}
