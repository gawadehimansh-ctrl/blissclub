import React, { createContext, useContext, useReducer, useCallback } from 'react'
import { enrichMetaWithGA4 } from '../utils/enricher.js'

const DataContext = createContext(null)

const initialState = {
  metaDB: [],
  metaHourly: [],
  googleDump: [],
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
      next = {
        ...state,
        metaDB: action.replace ? action.data : [...state.metaDB, ...action.data],
        lastUpdated: { ...state.lastUpdated, metaDB: new Date() },
        uploadLog: [{ type: 'META_DB', count: action.data.length, time: new Date() }, ...state.uploadLog.slice(0, 9)]
      }
      return enrichState(next)
    case 'LOAD_META_HOURLY':
      return {
        ...state,
        metaHourly: action.data,
        lastUpdated: { ...state.lastUpdated, metaHourly: new Date() },
        uploadLog: [{ type: 'META_HOURLY', count: action.data.length, time: new Date() }, ...state.uploadLog.slice(0, 9)]
      }
    case 'LOAD_GOOGLE':
      return {
        ...state,
        googleDump: action.replace ? action.data : [...state.googleDump, ...action.data],
        lastUpdated: { ...state.lastUpdated, google: new Date() },
        uploadLog: [{ type: 'GOOGLE_DUMP', count: action.data.length, time: new Date() }, ...state.uploadLog.slice(0, 9)]
      }
    case 'LOAD_GA4':
      next = {
        ...state,
        ga4Dump: action.replace ? action.data : [...state.ga4Dump, ...action.data],
        lastUpdated: { ...state.lastUpdated, ga4: new Date() },
        uploadLog: [{ type: 'GA4_DUMP', count: action.data.length, time: new Date() }, ...state.uploadLog.slice(0, 9)]
      }
      return enrichState(next)
    case 'SET_CLM_SPEND':
      return { ...state, clmSpend: action.value }
    case 'SET_RETENTION_SPEND':
      return { ...state, retentionSpend: action.value }
    case 'SET_INCLUDE_UAC':
      return { ...state, includeUAC: action.value }
    case 'CLEAR_ALL':
      return { ...initialState }
    default:
      return state
  }
}

export function DataProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState)

  const loadData = useCallback((data, fileType, replace = false) => {
    if (fileType === 'META_DB') dispatch({ type: 'LOAD_META_DB', data, replace })
    else if (fileType === 'META_HOURLY') dispatch({ type: 'LOAD_META_HOURLY', data, replace })
    else if (fileType === 'GOOGLE_DUMP') dispatch({ type: 'LOAD_GOOGLE', data, replace })
    else if (fileType === 'GA4_DUMP') dispatch({ type: 'LOAD_GA4', data, replace })
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
