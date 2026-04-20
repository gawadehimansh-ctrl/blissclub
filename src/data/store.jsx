import React, { createContext, useContext, useReducer, useCallback } from 'react'
import { enrichMetaWithGA4 } from '../utils/enricher.js'

const DataContext = createContext(null)

const initialState = {
  metaDB: [],
  metaHourly: [],
  googleDump: [],
  googleAwareness: [],
  googleKeywords: [],
  googleSearchTerms: [],
  googleAdReport: [],
  ga4Dump: [],
  lastUpdated: {},
  uploadLog: [],
  clmSpend: 0,
  retentionSpend: 0,
  includeUAC: false,
}

function enrichState(state) {
  if (!state.ga4Dump.length || !state.metaDB.length) return state
  return { ...state, metaDB: enrichMetaWithGA4(state.metaDB, state.ga4Dump) }
}

function reducer(state, action) {
  let next
  switch (action.type) {
    case 'LOAD_META_DB':
      next = { ...state, metaDB: action.replace ? action.data : [...state.metaDB, ...action.data], lastUpdated: { ...state.lastUpdated, metaDB: new Date() }, uploadLog: [{ type: 'META_DB', count: action.data.length, time: new Date() }, ...state.uploadLog.slice(0, 9)] }
      return enrichState(next)
    case 'LOAD_META_HOURLY': {
      const incoming = action.data.map(r => ({ ...r, uploadSlot: action.slot || 'manual', uploadTime: new Date() }))
      const existing = state.metaHourly.filter(r => {
        const incomingDates = new Set(incoming.map(i => i.date instanceof Date ? i.date.toDateString() : new Date(i.date).toDateString()))
        const rDate = r.date instanceof Date ? r.date.toDateString() : new Date(r.date).toDateString()
        return !incomingDates.has(rDate)
      })
      const merged = [...existing, ...incoming]
      return { ...state, metaHourly: merged, lastUpdated: { ...state.lastUpdated, metaHourly: new Date() }, uploadLog: [{ type: 'META_HOURLY', count: incoming.length, slot: action.slot, time: new Date() }, ...state.uploadLog.slice(0, 9)] }
    }
    case 'LOAD_GOOGLE':
      return { ...state, googleDump: action.replace ? action.data : [...state.googleDump, ...action.data], lastUpdated: { ...state.lastUpdated, google: new Date() }, uploadLog: [{ type: 'GOOGLE_DUMP', count: action.data.length, time: new Date() }, ...state.uploadLog.slice(0, 9)] }
    case 'LOAD_GOOGLE_AWARENESS':
      return { ...state, googleAwareness: action.replace ? action.data : [...state.googleAwareness, ...action.data], lastUpdated: { ...state.lastUpdated, googleAwareness: new Date() }, uploadLog: [{ type: 'GOOGLE_AWARENESS', count: action.data.length, time: new Date() }, ...state.uploadLog.slice(0, 9)] }
    case 'LOAD_GOOGLE_AD_REPORT':
      return { ...state, googleAdReport: action.replace ? action.data : [...state.googleAdReport, ...action.data], lastUpdated: { ...state.lastUpdated, googleAdReport: new Date() }, uploadLog: [{ type: 'GOOGLE_AD_REPORT', count: action.data.length, time: new Date() }, ...state.uploadLog.slice(0, 9)] }
    case 'LOAD_GOOGLE_KEYWORDS':
      return { ...state, googleKeywords: action.replace ? action.data : [...state.googleKeywords, ...action.data], lastUpdated: { ...state.lastUpdated, googleKeywords: new Date() }, uploadLog: [{ type: 'GOOGLE_KEYWORDS', count: action.data.length, time: new Date() }, ...state.uploadLog.slice(0, 9)] }
    case 'LOAD_GOOGLE_SEARCH_TERMS':
      return { ...state, googleSearchTerms: action.replace ? action.data : [...state.googleSearchTerms, ...action.data], lastUpdated: { ...state.lastUpdated, googleSearchTerms: new Date() }, uploadLog: [{ type: 'GOOGLE_SEARCH_TERMS', count: action.data.length, time: new Date() }, ...state.uploadLog.slice(0, 9)] }
    case 'LOAD_GA4':
      next = { ...state, ga4Dump: action.replace ? action.data : [...state.ga4Dump, ...action.data], lastUpdated: { ...state.lastUpdated, ga4: new Date() }, uploadLog: [{ type: 'GA4_DUMP', count: action.data.length, time: new Date() }, ...state.uploadLog.slice(0, 9)] }
      return enrichState(next)
    case 'SET_CLM_SPEND': return { ...state, clmSpend: action.value }
    case 'SET_RETENTION_SPEND': return { ...state, retentionSpend: action.value }
    case 'SET_INCLUDE_UAC': return { ...state, includeUAC: action.value }
    case 'CLEAR_ALL': return { ...initialState }
    default: return state
  }
}

export function DataProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState)

  const loadData = useCallback((data, fileType, replace = false) => {
    if (fileType === 'META_DB')               dispatch({ type: 'LOAD_META_DB', data, replace })
    else if (fileType === 'META_HOURLY')      dispatch({ type: 'LOAD_META_HOURLY', data, replace })
    else if (fileType === 'GOOGLE_DUMP')      dispatch({ type: 'LOAD_GOOGLE', data, replace })
    else if (fileType === 'GOOGLE_AWARENESS') dispatch({ type: 'LOAD_GOOGLE_AWARENESS', data, replace })
    else if (fileType === 'WINDSOR_META_GA4')     dispatch({ type: 'LOAD_GA4', data, replace })
    else if (fileType === 'WINDSOR_GOOGLE_DAILY') dispatch({ type: 'LOAD_GOOGLE', data, replace })
    else if (fileType === 'WINDSOR_SEARCH_TERMS') dispatch({ type: 'LOAD_GOOGLE_SEARCH_TERMS', data, replace })
    else if (fileType === 'WINDSOR_KEYWORDS')     dispatch({ type: 'LOAD_GOOGLE_KEYWORDS', data, replace })
    else if (fileType === 'GOOGLE_AD_REPORT') dispatch({ type: 'LOAD_GOOGLE_AD_REPORT', data, replace })
    else if (fileType === 'GOOGLE_KEYWORDS')  dispatch({ type: 'LOAD_GOOGLE_KEYWORDS', data, replace })
    else if (fileType === 'GOOGLE_SEARCH_TERMS') dispatch({ type: 'LOAD_GOOGLE_SEARCH_TERMS', data, replace })
    else if (fileType === 'GA4_DUMP')         dispatch({ type: 'LOAD_GA4', data, replace })
  }, [])

  return (
    <DataContext.Provider value={{ state, dispatch, loadData }}>
      {children}
    </DataContext.Provider>
  )
}

export function useData() {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData must be inside DataProvider')
  return ctx
}
