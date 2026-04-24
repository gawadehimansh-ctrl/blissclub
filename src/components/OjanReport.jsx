import React, { useState } from 'react'

const TIME_SLOTS = ['9 AM', '12 PM', '3 PM', '5 PM']

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
      cpc:    a.clicks > 0 ? a.spend / a.clicks : 0,
      ctr:    a.impressions > 0 ? a.clicks / a.impressions : 0,
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

  return `You are the BlissClub performance marketing co-pilot generating the ${slot} OJAN report.

SLOT: ${slot} | Date: ${new Date().toLocaleDateString('en-IN')}

SUMMARY:
Total Spend: INR ${Math.round(totalSpend).toLocaleString('en-IN')}
Total 1DC Orders: ${totalOrders}
Total 1DC Revenue: INR ${Math.round(totalRev).toLocaleString('en-IN')}
Blended 1DC ROAS: ${blendedROAS}x

TOP ADS BY SPEND:
${adLines}

Generate a complete OJAN report. Format EXACTLY as below for client WhatsApp screenshot:

BlissClub | ${slot} Report | ${new Date().toLocaleDateString('en-IN')}
--------------------------------
Spend: INR X | Orders: X | 1DC ROAS: Xx

P0 - PAUSE IMMEDIATELY
- [Ad name]: CPC INR X vs target INR X | 0 orders at INR X spend -> PAUSE
(list all ads that need immediate action with exact numbers)

P1 - SCALE DOWN 10-15%
- [Ad name]: ROAS Xx (within 15% of benchmark) -> reduce budget 10-15%

GREEN - SCALE UP
- [Ad name]: ROAS Xx, CPC INR X, Orders X -> scale +20%

OJAN:
O: [3 observations with exact numbers]
J: [reason for each observation]
A: [specific action for each - name the ad, state the action]
N: [what to check at next slot]

Rules: Under 300 words. Always use real numbers from data. Name specific ads. Be direct.`
}

export default function OjanReport({ rows }) {
  const [report, setReport]   = useState('')
  const [loading, setLoading] = useState(false)
  const [slot, setSlot]       = useState(null)
  const [copied, setCopied]   = useState(false)

  async function generate(selectedSlot) {
    const apiKey = localStorage.getItem('bc_openrouter_key')
    if (!apiKey) { alert('Set your OpenRouter API key in the Co-pilot page first'); return }
    if (!rows || rows.length === 0) { alert('Upload a CSV first'); return }

    setLoading(true)
    setSlot(selectedSlot)
    setReport('')

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
      setReport(data.choices?.[0]?.message?.content || 'Failed to generate')
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
            AI-generated · ad-level · ready to screenshot & share
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
        <div style={{ position: 'relative', marginTop: 4 }}>
          <button onClick={copyReport} style={{
            position: 'absolute', top: 12, right: 12, zIndex: 1,
            padding: '5px 12px', fontSize: 11, fontWeight: 600,
            borderRadius: 6, cursor: 'pointer',
            background: copied ? 'var(--green-dim)' : 'var(--blue-dim)',
            color: copied ? 'var(--green)' : 'var(--blue)',
            border: `0.5px solid ${copied ? 'rgba(29,185,84,0.3)' : 'var(--blue-border)'}`,
          }}>
            {copied ? '✓ Copied!' : '📋 Copy'}
          </button>

          {/* Report card - dark bg for screenshot */}
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
      )}
    </div>
  )
}
