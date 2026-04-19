import React, { useRef, useState } from 'react'
import { parseCSV } from '../utils/csvParser.js'
import { useData } from '../data/store.jsx'

const FILE_LABELS = {
  META_DB: { label: 'Meta daily data', color: 'var(--pink)' },
  META_HOURLY: { label: 'Meta hourly data', color: 'var(--pink)' },
  GOOGLE_DUMP: { label: 'Google campaign data', color: 'var(--blue)' },
  GA4_DUMP: { label: 'GA4 export', color: 'var(--purple)' },
}

export default function CSVUploader({ compact = false }) {
  const { loadData, state } = useData()
  const inputRef = useRef()
  const [dragging, setDragging] = useState(false)
  const [status, setStatus] = useState(null) // null | 'loading' | { type, count } | { error }

  async function handleFiles(files) {
    const file = files[0]
    if (!file) return
    setStatus('loading')
    try {
      const result = await parseCSV(file)
      loadData(result.data, result.fileType, false)
      setStatus({ type: result.fileType, count: result.count })
      setTimeout(() => setStatus(null), 4000)
    } catch (e) {
      setStatus({ error: e.message })
      setTimeout(() => setStatus(null), 6000)
    }
  }

  if (compact) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button
          onClick={() => inputRef.current.click()}
          style={{
            padding: '6px 14px', fontSize: 12, borderRadius: 6,
            background: 'var(--bg3)', border: '1px solid var(--border2)',
            color: 'var(--text)', cursor: 'pointer', fontWeight: 500
          }}>
          + Upload CSV
        </button>
        {status === 'loading' && <span style={{ fontSize: 12, color: 'var(--text2)' }}>Parsing...</span>}
        {status?.type && (
          <span style={{ fontSize: 12, color: FILE_LABELS[status.type]?.color }}>
            ✓ {FILE_LABELS[status.type]?.label} — {status.count.toLocaleString()} rows loaded
          </span>
        )}
        {status?.error && <span style={{ fontSize: 12, color: 'var(--red)' }}>✗ {status.error}</span>}
        <input ref={inputRef} type="file" accept=".csv,.xlsx" style={{ display: 'none' }}
          onChange={e => handleFiles(e.target.files)} />
      </div>
    )
  }

  return (
    <div>
      <div
        onDragEnter={() => setDragging(true)}
        onDragLeave={() => setDragging(false)}
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files) }}
        onClick={() => inputRef.current.click()}
        style={{
          border: `1.5px dashed ${dragging ? 'var(--pink)' : 'var(--border2)'}`,
          borderRadius: 'var(--radius-lg)',
          padding: '28px 20px',
          textAlign: 'center',
          cursor: 'pointer',
          background: dragging ? 'var(--pink-dim)' : 'var(--bg2)',
          transition: 'all .15s',
        }}
      >
        <div style={{ fontSize: 28, marginBottom: 8 }}>⬆</div>
        <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>Drop CSV here or click to upload</div>
        <div style={{ fontSize: 12, color: 'var(--text2)' }}>
          Auto-detects: Meta daily · Meta hourly · Google campaigns · GA4 export
        </div>
      </div>

      {status === 'loading' && (
        <div style={{ marginTop: 10, fontSize: 13, color: 'var(--text2)', textAlign: 'center' }}>
          Parsing file...
        </div>
      )}

      {status?.type && (
        <div style={{ marginTop: 10, padding: '10px 14px', borderRadius: 'var(--radius)', background: 'var(--green-dim)', border: '0.5px solid rgba(29,185,84,0.3)', fontSize: 13, color: 'var(--green)' }}>
          ✓ {FILE_LABELS[status.type]?.label} loaded — {status.count.toLocaleString()} rows
        </div>
      )}

      {status?.error && (
        <div style={{ marginTop: 10, padding: '10px 14px', borderRadius: 'var(--radius)', background: 'var(--red-dim)', border: '0.5px solid rgba(239,68,68,0.3)', fontSize: 13, color: 'var(--red)' }}>
          ✗ {status.error}
        </div>
      )}

      {/* Recent uploads */}
      {state.uploadLog.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Recent uploads</div>
          {state.uploadLog.slice(0, 4).map((log, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0', fontSize: 12, borderBottom: '1px solid var(--border)' }}>
              <span style={{ color: FILE_LABELS[log.type]?.color }}>{FILE_LABELS[log.type]?.label}</span>
              <span style={{ color: 'var(--text3)' }}>{log.count.toLocaleString()} rows · {log.time.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          ))}
        </div>
      )}

      <input ref={inputRef} type="file" accept=".csv" style={{ display: 'none' }}
        onChange={e => handleFiles(e.target.files)} />
    </div>
  )
}
