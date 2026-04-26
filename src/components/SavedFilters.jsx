import { useState } from 'react'
import { useSavedFilters } from '../hooks/useSavedFilters.js'
import { format } from 'date-fns'

export default function SavedFilters({ page, filters, onLoad }) {
  const { saved, save, remove } = useSavedFilters(page)
  const [saving, setSaving]   = useState(false)
  const [name, setName]       = useState('')
  const [showInput, setShowInput] = useState(false)
  const [msg, setMsg]         = useState('')

  async function handleSave() {
    if (!name.trim()) return
    setSaving(true)
    try {
      await save(name.trim(), {
        dateFrom: filters.dateFrom?.toISOString(),
        dateTo:   filters.dateTo?.toISOString(),
        dateLabel: filters.dateLabel,
        cohorts:  filters.cohorts,
        segment:  filters.segment,
        saleTag:  filters.saleTag,
        formats:  filters.formats,
        products: filters.products,
      })
      setName('')
      setShowInput(false)
      flash('Filter saved')
    } finally { setSaving(false) }
  }

  function handleLoad(f) {
    const fil = f.filters
    if (fil.dateFrom) onLoad({
      dateFrom:  new Date(fil.dateFrom),
      dateTo:    new Date(fil.dateTo),
      dateLabel: fil.dateLabel,
      cohorts:   fil.cohorts || [],
      segment:   fil.segment || 'all',
      saleTag:   fil.saleTag || '',
      formats:   fil.formats || [],
      products:  fil.products || [],
    })
    flash(`Loaded: ${f.name}`)
  }

  function flash(m) { setMsg(m); setTimeout(() => setMsg(''), 2500) }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>

      {/* Saved presets */}
      {saved.map(f => (
        <div key={f.id} style={{
          display: 'flex', alignItems: 'center', gap: 4,
          padding: '3px 10px', borderRadius: 20, fontSize: 11,
          background: 'rgba(127,119,221,0.1)', border: '0.5px solid rgba(127,119,221,0.3)',
          color: '#7F77DD',
        }}>
          <button onClick={() => handleLoad(f)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontSize: 11, padding: 0 }}>
            ⚡ {f.name}
          </button>
          <button onClick={() => remove(f.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(127,119,221,0.5)', fontSize: 10, padding: '0 0 0 4px', lineHeight: 1 }}>
            ×
          </button>
        </div>
      ))}

      {/* Save current */}
      {showInput ? (
        <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
          <input
            value={name} onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSave()}
            placeholder="Filter name…" autoFocus
            style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, border: '0.5px solid var(--border2)', background: 'var(--bg2)', color: 'var(--text)', outline: 'none', width: 130 }}
          />
          <button onClick={handleSave} disabled={saving} style={{ padding: '4px 10px', fontSize: 11, borderRadius: 6, background: '#7F77DD', color: '#fff', border: 'none', cursor: 'pointer' }}>
            {saving ? '...' : 'Save'}
          </button>
          <button onClick={() => setShowInput(false)} style={{ padding: '4px 8px', fontSize: 11, borderRadius: 6, background: 'var(--bg3)', color: 'var(--text2)', border: '0.5px solid var(--border)', cursor: 'pointer' }}>
            ✕
          </button>
        </div>
      ) : (
        <button onClick={() => setShowInput(true)} style={{
          padding: '3px 10px', borderRadius: 20, fontSize: 11, cursor: 'pointer',
          background: 'transparent', border: '0.5px dashed var(--border2)', color: 'var(--text3)',
        }}>
          + Save filter
        </button>
      )}

      {msg && <span style={{ fontSize: 11, color: '#22c55e' }}>✓ {msg}</span>}
    </div>
  )
}
