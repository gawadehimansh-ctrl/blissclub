import React, { useState } from 'react'

const TIME_SLOTS = ['9 AM', '12 PM', '3 PM', '5 PM']

function getInsights() {
  try { return JSON.parse(localStorage.getItem('bc_insights') || '[]') } catch { return [] }
}
function saveInsight(text) {
  const insights = getInsights()
  insights.unshift({ text, ts: new Date().toISOString(), id: Date.now(), source: 'ojan_action' })
  localStorage.setItem('bc_insights', JSON.stringify(insights.slice(0, 200)))
}

function parseReportLines(report) {
  if (!report) return []
  const lines = report.split('\n')
  const actionLines = []
  let currentSection = ''
  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.includes('P0') || trimmed.includes('PAUSE')) currentSection = 'P0'
    else if (trimmed.includes('P1') || trimmed.includes('SCALE DOWN')) currentSection = 'P1'
    else if (trimmed.includes('GREEN') || trimmed.includes('SCALE UP')) currentSection = 'GREEN'
    if (trimmed.startsWith('-') && trimmed.length > 5 && currentSection) {
      actionLines.push({ line: trimmed.slice(1).trim(), section: currentSection })
    }
  }
  return actionLines
}

function ActionLine({ item, slot, date }) {
  const [status, setStatus] = useState(null) // null | 'done' | 'skipped' | 'modified'
  const [note, setNote] = useState('')
  const [showNote, setShowNote] = useState(false)
  const [logged, setLogged] = useState(false)

  function logAction(action, extraNote = '') {
    const text = `[${date} ${slot}] ${action}: ${item.line}${extraNote ? ` | Note: ${extraNote}` : ''}`
    saveInsight(text)
    setStatus(action === 'Done' ? 'done' : action === 'Skipped' ? 'skipped' : 'modified')
    setLogged(true)
    setShowNote(false)
  }

  const sectionColor = item.section === 'P0' ? '#ef4444' : item.section === 'P1' ? '#f59e0b' : '#1db954'
  const sectionBg = item.section === 'P0' ? 'rgba(239,68,68,0.08)' : item.section === 'P1' ? 'rgba(245,158,11,0.08)' : 'rgba(29,185,84,0.08)'

  return (
    <div style={{
      padding: '10px 12px', marginBottom: 6, borderRadius: 8,
      background: logged ? 'rgba(255,255,255,0.03)' : sectionBg,
      border: `0.5px solid ${logged ? 'rgba(255,255,255,0.06)' : sectionColor}30`,
      opacity: logged ? 0.7 : 1, transition: 'all .2s',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, justifyContent: 'space-between' }}>
        <div style={{ flex: 1 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: sectionColor, marginRight: 6 }}>
            {item.section === 'P0' ? '🔴 P0' : item.section === 'P1' ? '🟡 P1' : '🟢 GO'}
          </span>
          <span style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.5 }}>{item.line}</span>
        </div>

        {!logged ? (
          <div style={{ display: 'flex', gap: 4, flexShrink: 0, marginTop: 2 }}>
            <button onClick={() => logAction('Done')} style={{
              padding: '3px 8px', fontSize: 11, borderRadius: 5, cursor: 'pointer', fontWeight: 600,
              background: 'rgba(29,185,84,0.15)', color: '#1db954', border: '0.5px solid rgba(29,185,84,0.3)',
            }}>✅ Done</button>
            <button onClick={() => setShowNote(s => !s)} style={{
              padding: '3px 8px', fontSize: 11, borderRadius: 5, cursor: 'pointer', fontWeight: 600,
              background: 'rgba(99,102,241,0.15)', color: '#6366f1', border: '0.5px solid rgba(99,102,241,0.3)',
            }}>✏️ Modified</button>
            <button onClick={() => logAction('Skipped')} style={{
              padding: '3px 8px', fontSize: 11, borderRadius: 5, cursor: 'pointer', fontWeight: 600,
              background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '0.5px solid rgba(239,68,68,0.2)',
            }}>❌ Skip</button>
          </div>
        ) : (
          <span style={{ fontSize: 11, fontWeight: 600, color: status === 'done' ? '#1db954' : status === 'skipped' ? '#ef4444' : '#6366f1', flexShrink: 0 }}>
            {status === 'done' ? '✅ Logged' : status === 'skipped' ? '❌ Skipped' : '✏️ Modified'}
          </span>
        )}
      </div>

      {showNote && !logged && (
        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
          <input
            value={note} onChange={e => setNote(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && note.trim() && logAction('Modified', note)}
            placeholder="What did you do instead? (e.g. scaled 10% not 20%, inventory low...)"
            style={{ flex: 1, padding: '6px 10px', fontSize: 12, borderRadius: 6, background: '#1a1a1a', border: '0.5px solid rgba(255,255,255,0.1)', color: '#fff', outline: 'none' }}
            autoFocus
          />
          <button onClick={() => note.trim() && logAction('Modified', note)} style={{
            padding: '6px 12px', fontSize: 12, borderRadius: 6, cursor: 'pointer',
            background: '#6366f1', color: '#fff', border: 'none', fontWeight: 600,
          }}>Log</button>
        </div>
      )}
    </div>
  )
}

function buildPrompt(slot, rows) {
  const byAd = {}
  for (const r of rows) {
    const k = r.adName || r.adsetName || 'Unknown'
    if (!byAd[k]) byAd[k] = { adName: k, product: r.product || '', cohort: r.cohort || '', format: r.format || '', spend: 0, clicks: 0, impressions: 0, fbOrders: 0, fbRevenue: 0 }
    byAd[k].spend       += r.spend || 0
    byAd[k].clicks      += r.clicks || 0
    byAd[k].impressions += r.impressions || 0
    byAd[k].fbOrders    += r.fbOrders || 0
    byAd[k].fbRevenue   += r.fbRevenue || 0
  }

  const ads = Object.values(byAd)
    .map(a => ({
      ...a,
      cpc:     a.clicks > 0 ? a.spend / a.clicks : 0,
      ctr:     a.impressions > 0 ? a.clicks / a.impressions : 0,
      roas1dc: a.spend > 0 ? a.fbRevenue / a.spend : 0,
    }))
    .sort((a, b) => b.spend - a.spend)
    .slice(0, 25)

  const totalSpend  = ads.reduce((s, a) => s + a.spend, 0)
  const totalOrders = ads.reduce((s, a) => s + a.fbOrders, 0)
  const totalRev    = ads.reduce((s, a) => s + a.fbRevenue, 0)
  const blendedROAS = totalSpend > 0 ? (totalRev / totalSpend).toFixed(2) : '0'

  const adLines = ads.slice(0, 20).map(a =>
    `${a.adName} | Spend: INR ${Math.round(a.spend).toLocaleString('en-IN')} | CPC: INR ${Math.round(a.cpc)} | CTR: ${(a.ctr*100).toFixed(1)}% | 1DC ROAS: ${a.roas1dc.toFixed(2)}x | Orders: ${a.fbOrders} | Product: ${a.product} | Cohort: ${a.cohort}`
  ).join('\n')

  // Get past logged insights for context
  const insights = JSON.parse(localStorage.getItem('bc_insights') || '[]').slice(0, 10)
  const insightContext = insights.length > 0
    ? `\nPAST ACTIONS (use to improve recommendations):\n${insights.map(i => `- ${i.text}`).join('\n')}`
    : ''

  return `You are the BlissClub performance marketing co-pilot generating the ${slot} OJAN report.

SLOT: ${slot} | Date: ${new Date().toLocaleDateString('en-IN')}

SUMMARY:
Total Spend: INR ${Math.round(totalSpend).toLocaleString('en-IN')}
Total 1DC Orders: ${totalOrders}
Total 1DC Revenue: INR ${Math.round(totalRev).toLocaleString('en-IN')}
Blended 1DC ROAS: ${blendedROAS}x

TOP ADS BY SPEND:
${adLines}
${insightContext}

CRITICAL RULES:
1. ALL actions at AD LEVEL only — never adset level
2. Use EXACT full ad name from data above for every action
3. Min spend before pausing: INR 2000 for 5*5 products, INR 1500 for others
4. CPC targets: LTC/TUL INR 10-15 | Others INR 15-20 | Men's INR 20-25
5. 1DC ROAS targets: LTC/TUL 2.5x | BB/RS 2.15x | Men's 0.4x | Others 2x
6. P0 = CPC > 2x target AND 0 orders AND spend above minimum
7. Learn from past actions above — if team skipped a recommendation before, explain why differently

Format EXACTLY:

BlissClub | ${slot} Report | ${new Date().toLocaleDateString('en-IN')}
--------------------------------
Spend: INR X | Orders: X | 1DC ROAS: Xx

🔴 P0 - PAUSE AD IMMEDIATELY
- [exact ad name]: CPC INR X vs target INR X | Orders: X at INR X spend -> PAUSE

🟡 P1 - SCALE DOWN 10-15%
- [exact ad name]: ROAS Xx vs target Xx -> reduce budget 10-15%

🟢 SCALE UP +20%
- [exact ad name]: ROAS Xx, CPC INR X, Orders X -> scale +20%

📋 OJAN:
O: [3 observations with exact numbers]
J: [specific reason each]
A: [ad-level action — full ad name + exact action]
N: [what to check next slot]

Under 300 words. Real numbers. Full ad names. Ad-level only.`
}

export default function OjanReport({ rows }) {
  const [report, setReport]     = useState('')
  const [loading, setLoading]   = useState(false)
  const [slot, setSlot]         = useState(null)
  const [copied, setCopied]     = useState(false)
  const [actionLines, setActionLines] = useState([])
  const reportDate = new Date().toLocaleDateString('en-IN')

  async function generate(selectedSlot) {
    const apiKey = localStorage.getItem('bc_openrouter_key')
    if (!apiKey) { alert('Set your OpenRouter API key in the Co-pilot page first'); return }
    if (!rows || rows.length === 0) { alert('Upload a CSV first'); return }

    setLoading(true)
    setSlot(selectedSlot)
    setReport('')
    setActionLines([])

    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://blissclub.vercel.app',
          'X-Title': 'BlissClub OJAN Report',
        },
        body: JSON.stringify({
          model: localStorage.getItem('bc_model') || 'openai/gpt-4o-mini',
          messages: [{ role: 'user', content: buildPrompt(selectedSlot, rows) }],
          max_tokens: 1200,
        })
      })
      const data = await res.json()
      const text = data.choices?.[0]?.message?.content || 'Failed to generate'
      setReport(text)
      setActionLines(parseReportLines(text))
    } catch(e) {
      setReport('Error: ' + e.message)
    }
    setLoading(false)
  }

  function copyReport() {
    navigator.clipboard.writeText(report)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const loggedCount = actionLines.filter((_, i) => {
    // can't easily track from outside ActionLine, just show total
    return false
  }).length

  return (
    <div style={{
      marginTop: 24,
      background: 'var(--bg2)',
      border: '0.5px solid var(--border)',
      borderRadius: 12,
      padding: '18px 20px',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 18 }}>⚡</span> Auto OJAN Report
          </div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
            AI-generated · ad-level · log actions to train the model
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {TIME_SLOTS.map(s => (
            <button key={s} onClick={() => generate(s)} disabled={loading}
              style={{
                padding: '8px 14px', fontSize: 12, fontWeight: 600,
                borderRadius: 8, cursor: loading ? 'not-allowed' : 'pointer',
                background: slot === s && (loading || report) ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : 'var(--bg3)',
                color: slot === s && (loading || report) ? '#fff' : 'var(--text2)',
                border: '0.5px solid var(--border2)',
                opacity: loading && slot !== s ? 0.4 : 1,
                transition: 'all .15s',
              }}>
              {loading && slot === s ? '⏳ Generating...' : `${s} Report`}
            </button>
          ))}
        </div>
      </div>

      {!rows?.length && (
        <div style={{ fontSize: 12, color: 'var(--text3)', textAlign: 'center', padding: '20px 0', borderTop: '0.5px solid var(--border)' }}>
          Upload a CSV above to generate OJAN report
        </div>
      )}

      {report && (
        <div style={{ marginTop: 4 }}>
          {/* Action items with log buttons */}
          {actionLines.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 8 }}>
                📋 Log your actions — trains the model for next time
              </div>
              {actionLines.map((item, i) => (
                <ActionLine key={i} item={item} slot={slot} date={reportDate} />
              ))}
            </div>
          )}

          {/* Full report card */}
          <div style={{ position: 'relative' }}>
            <button onClick={copyReport} style={{
              position: 'absolute', top: 12, right: 12, zIndex: 1,
              padding: '5px 12px', fontSize: 11, fontWeight: 600,
              borderRadius: 6, cursor: 'pointer',
              background: copied ? 'var(--green-dim)' : 'var(--blue-dim)',
              color: copied ? 'var(--green)' : 'var(--blue)',
              border: `0.5px solid ${copied ? 'rgba(29,185,84,0.3)' : 'var(--blue-border)'}`,
            }}>
              {copied ? '✓ Copied!' : '📋 Copy for WhatsApp'}
            </button>
            <div style={{
              background: '#0a0a0a',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 10,
              padding: '20px 24px',
              fontFamily: "'SF Mono', 'Fira Code', monospace",
              fontSize: 12.5,
              lineHeight: 1.75,
              color: '#e8e8e8',
              whiteSpace: 'pre-wrap',
              overflowX: 'auto',
            }}>
              {report}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
