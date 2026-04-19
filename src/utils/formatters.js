// All monetary values stored in raw INR (paise/rupees)
// Display in L (lakhs) or Cr (crores)

export function fmtINR(val, decimals = 2) {
  if (val == null || isNaN(val)) return '—'
  const n = Number(val)
  if (Math.abs(n) >= 10000000) return `₹${(n / 10000000).toFixed(decimals)}Cr`
  if (Math.abs(n) >= 100000) return `₹${(n / 100000).toFixed(decimals)}L`
  if (Math.abs(n) >= 1000) return `₹${(n / 1000).toFixed(1)}K`
  return `₹${Math.round(n)}`
}

export function fmtINRCompact(val) {
  if (val == null || isNaN(val) || !isFinite(val)) return '—'
  const n = Number(val)
  if (Math.abs(n) >= 10000000) return `₹${(n / 10000000).toFixed(1)}Cr`
  if (Math.abs(n) >= 100000) return `₹${(n / 100000).toFixed(1)}L`
  return `₹${Math.round(n).toLocaleString('en-IN')}`
}

export function fmtNum(val, decimals = 0) {
  if (val == null || isNaN(val) || !isFinite(val)) return '—'
  const d = Math.max(0, Math.min(20, Math.round(decimals))) // clamp 0-20
  return Number(val).toLocaleString('en-IN', { maximumFractionDigits: d })
}

export function fmtPct(val, decimals = 1) {
  if (val == null || isNaN(val) || !isFinite(val)) return '—'
  return `${(Number(val) * 100).toFixed(Math.max(0, decimals))}%`
}

export function fmtPctRaw(val, decimals = 1) {
  if (val == null || isNaN(val) || !isFinite(val)) return '—'
  return `${Number(val).toFixed(Math.max(0, decimals))}%`
}

export function fmtX(val, decimals = 2) {
  if (val == null || isNaN(val) || !isFinite(val)) return '—'
  return `${Number(val).toFixed(Math.max(0, decimals))}x`
}

export function fmtDelta(curr, prev, mode = 'pct') {
  if (!prev || !curr || isNaN(curr) || isNaN(prev)) return null
  const delta = mode === 'pct'
    ? ((curr - prev) / Math.abs(prev)) * 100
    : curr - prev
  return { value: delta, positive: delta >= 0 }
}

export function deltaLabel(curr, prev, lowerIsBetter = false) {
  if (!prev || !curr || isNaN(Number(curr)) || isNaN(Number(prev))) return null
  const pct = ((Number(curr) - Number(prev)) / Math.abs(Number(prev))) * 100
  const positive = lowerIsBetter ? pct <= 0 : pct >= 0
  const sign = pct >= 0 ? '+' : ''
  return { label: `${sign}${pct.toFixed(1)}%`, positive, pct }
}

export function fmtDate(d) {
  if (!d) return '—'
  const date = d instanceof Date ? d : new Date(d)
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })
}
