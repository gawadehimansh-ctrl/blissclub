// Safe formatters — all functions guard against NaN, Infinity, null, undefined

function safeNum(v) {
  if (v === null || v === undefined || v === '' || v === 'NaN') return 0
  const n = parseFloat(String(v).replace(/[,%\s]/g, ''))
  if (isNaN(n) || !isFinite(n)) return 0
  return n
}

export function fmtINR(val, decimals = 2) {
  const n = safeNum(val)
  if (n === 0 && (val === null || val === undefined || val === '')) return '—'
  if (Math.abs(n) >= 10000000) return `₹${(n / 10000000).toFixed(2)}Cr`
  if (Math.abs(n) >= 100000)   return `₹${(n / 100000).toFixed(2)}L`
  if (Math.abs(n) >= 1000)     return `₹${(n / 1000).toFixed(1)}K`
  return `₹${Math.round(n)}`
}

export function fmtINRCompact(val) {
  const n = safeNum(val)
  if (n === 0 && (val === null || val === undefined || val === '')) return '—'
  if (Math.abs(n) >= 10000000) return `₹${(n / 10000000).toFixed(1)}Cr`
  if (Math.abs(n) >= 100000)   return `₹${(n / 100000).toFixed(1)}L`
  return `₹${Math.round(n).toLocaleString('en-IN')}`
}

export function fmtNum(val, decimals = 0) {
  const n = safeNum(val)
  if (n === 0 && (val === null || val === undefined || val === '')) return '—'
  const d = Math.max(0, Math.min(20, Math.round(safeNum(decimals))))
  return n.toLocaleString('en-IN', { maximumFractionDigits: d })
}

export function fmtPct(val, decimals = 1) {
  const n = safeNum(val)
  if (n === 0 && (val === null || val === undefined || val === '')) return '—'
  const d = Math.max(0, Math.min(20, Math.round(safeNum(decimals))))
  return `${(n * 100).toFixed(d)}%`
}

export function fmtPctRaw(val, decimals = 1) {
  const n = safeNum(val)
  if (n === 0 && (val === null || val === undefined || val === '')) return '—'
  const d = Math.max(0, Math.min(20, Math.round(safeNum(decimals))))
  return `${n.toFixed(d)}%`
}

export function fmtX(val, decimals = 2) {
  const n = safeNum(val)
  if (n === 0 && (val === null || val === undefined || val === '')) return '—'
  const d = Math.max(0, Math.min(20, Math.round(safeNum(decimals))))
  return `${n.toFixed(d)}x`
}

export function fmtDelta(curr, prev, mode = 'pct') {
  const c = safeNum(curr), p = safeNum(prev)
  if (!p || !c) return null
  const delta = mode === 'pct' ? ((c - p) / Math.abs(p)) * 100 : c - p
  return { value: delta, positive: delta >= 0 }
}

export function deltaLabel(curr, prev, lowerIsBetter = false) {
  const c = safeNum(curr), p = safeNum(prev)
  if (!p || !c) return null
  const pct = ((c - p) / Math.abs(p)) * 100
  const positive = lowerIsBetter ? pct <= 0 : pct >= 0
  const sign = pct >= 0 ? '+' : ''
  return { label: `${sign}${pct.toFixed(1)}%`, positive, pct }
}

export function fmtDate(d) {
  if (!d) return '—'
  const date = d instanceof Date ? d : new Date(d)
  if (isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })
}
