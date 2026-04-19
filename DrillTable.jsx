import React, { useState, useMemo, useEffect } from 'react'

const PAGE_SIZE_DEFAULT = 50
const PAGE_SIZE_COMPACT = 25

export default function DrillTable({
  columns, data, onRowClick,
  defaultSort, stickyFirst = true, compact = false,
  emptyMsg = 'No data for selected period',
  // optional: pass addMetricFilter / metricFilters for inline filter buttons
  extras,
}) {
  const [sort, setSort]   = useState(defaultSort || { key: columns[0]?.key, dir: 'desc' })
  const [search, setSearch] = useState('')
  const [page, setPage]   = useState(0)
  const PAGE_SIZE = compact ? PAGE_SIZE_COMPACT : PAGE_SIZE_DEFAULT

  // Reset page when data changes
  useEffect(() => { setPage(0) }, [data])

  const sorted = useMemo(() => {
    let rows = [...data]
    if (search) {
      const q = search.toLowerCase()
      rows = rows.filter(r => columns.some(c => String(r[c.key] ?? '').toLowerCase().includes(q)))
    }
    if (sort.key) {
      rows.sort((a, b) => {
        const av = a[sort.key], bv = b[sort.key]
        const an = Number(av), bn = Number(bv)
        if (!isNaN(an) && !isNaN(bn)) return sort.dir === 'asc' ? an - bn : bn - an
        return sort.dir === 'asc'
          ? String(av ?? '').localeCompare(String(bv ?? ''))
          : String(bv ?? '').localeCompare(String(av ?? ''))
      })
    }
    return rows
  }, [data, sort, search])

  const pages   = Math.ceil(sorted.length / PAGE_SIZE)
  const visible = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  function toggleSort(key) {
    setSort(prev => prev.key === key
      ? { key, dir: prev.dir === 'desc' ? 'asc' : 'desc' }
      : { key, dir: 'desc' }
    )
    setPage(0)
  }

  const thBase = {
    padding: compact ? '6px 10px' : '8px 12px',
    fontSize: 10, fontWeight: 600, color: 'var(--text2)',
    textTransform: 'uppercase', letterSpacing: '0.05em',
    whiteSpace: 'nowrap', cursor: 'pointer', userSelect: 'none',
    background: 'var(--bg3)', borderBottom: '0.5px solid var(--border2)',
    position: 'sticky', top: 0, zIndex: 1,
    transition: 'color .1s',
  }

  const tdBase = {
    padding: compact ? '5px 10px' : '8px 12px',
    fontSize: compact ? 12 : 13,
    borderBottom: '0.5px solid var(--border)',
    whiteSpace: 'nowrap',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <input
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(0) }}
          placeholder="Search..."
          style={{
            background: 'var(--bg3)', border: '0.5px solid var(--border2)',
            borderRadius: 6, padding: '6px 10px', color: 'var(--text)',
            fontSize: 12, width: 200, outline: 'none',
          }}
        />
        {extras}
        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text3)' }}>
          {sorted.length.toLocaleString()} rows
          {pages > 1 && ` · page ${page + 1}/${pages}`}
        </span>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto', borderRadius: 8, border: '0.5px solid var(--border)' }}>
        {data.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
            {emptyMsg}
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'auto' }}>
            <thead>
              <tr>
                {columns.map((col, i) => (
                  <th
                    key={col.key}
                    onClick={() => toggleSort(col.key)}
                    style={{
                      ...thBase,
                      textAlign: col.align || (i === 0 ? 'left' : 'right'),
                      color: sort.key === col.key ? 'var(--text)' : 'var(--text2)',
                      ...(stickyFirst && i === 0 ? { position: 'sticky', left: 0, zIndex: 2 } : {}),
                    }}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                      {col.label}
                      {sort.key === col.key
                        ? <span style={{ color: 'var(--pink)', fontSize: 11 }}>{sort.dir === 'desc' ? '↓' : '↑'}</span>
                        : <span style={{ opacity: 0.2, fontSize: 11 }}>↕</span>
                      }
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((row, ri) => (
                <tr
                  key={ri}
                  onClick={() => onRowClick?.(row)}
                  style={{ cursor: onRowClick ? 'pointer' : 'default' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg3)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  {columns.map((col, i) => (
                    <td
                      key={col.key}
                      title={String(row[col.key] ?? '')}
                      style={{
                        ...tdBase,
                        textAlign: col.align || (i === 0 ? 'left' : 'right'),
                        color: col.color?.(row[col.key], row) || 'var(--text)',
                        fontWeight: col.bold ? 500 : 400,
                        ...(stickyFirst && i === 0 ? { position: 'sticky', left: 0, background: 'var(--bg2)', zIndex: 1 } : {}),
                      }}
                    >
                      {col.render ? col.render(row[col.key], row) : (row[col.key] ?? '—')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div style={{ display: 'flex', gap: 5, justifyContent: 'flex-end', alignItems: 'center' }}>
          <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} style={btnStyle(page === 0)}>← Prev</button>
          {Array.from({ length: Math.min(pages, 7) }, (_, i) => (
            <button key={i} onClick={() => setPage(i)} style={btnStyle(false, page === i)}>{i + 1}</button>
          ))}
          {pages > 7 && <span style={{ fontSize: 12, color: 'var(--text3)' }}>... {pages}</span>}
          <button onClick={() => setPage(p => Math.min(pages - 1, p + 1))} disabled={page === pages - 1} style={btnStyle(page === pages - 1)}>Next →</button>
        </div>
      )}
    </div>
  )
}

function btnStyle(disabled, active) {
  return {
    padding: '4px 10px', fontSize: 12, borderRadius: 6,
    cursor: disabled ? 'default' : 'pointer',
    background: active ? 'var(--pink)' : 'var(--bg3)',
    color: active ? '#fff' : disabled ? 'var(--text3)' : 'var(--text)',
    border: '0.5px solid var(--border2)',
    opacity: disabled ? 0.4 : 1,
  }
}
