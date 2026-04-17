import React, { createContext, useContext, useReducer, useCallback } from 'react'

const DataContext = createContext(null)

const initialState = {
  metaDB: [],          // Meta ad-level daily data
  metaHourly: [],      // Meta hourly data
  googleDump: [],      // Google campaign-level data
  ga4Dump: [],         // GA4 sessions + revenue
  lastUpdated: {},     // { metaDB: Date, google: Date, ga4: Date }
  uploadLog: [],       // history of uploads
  clmSpend: 0,         // manual CLM spend input
  retentionSpend: 0,   // manual retention spend input
  includeUAC: false,   // toggle UAC in blended CAC
}

function reducer(state, action) {
  switch (action.type) {
    case 'LOAD_META_DB':
      return {
        ...state,
        metaDB: [...state.metaDB.filter(r => !action.replace), ...action.data],
        lastUpdated: { ...state.lastUpdated, metaDB: new Date() },
        uploadLog: [{ type: 'META_DB', count: action.data.length, time: new Date() }, ...state.uploadLog.slice(0, 9)]
      }
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
        googleDump: [...state.googleDump.filter(r => !action.replace), ...action.data],
        lastUpdated: { ...state.lastUpdated, google: new Date() },
        uploadLog: [{ type: 'GOOGLE_DUMP', count: action.data.length, time: new Date() }, ...state.uploadLog.slice(0, 9)]
      }
    case 'LOAD_GA4':
      return {
        ...state,
        ga4Dump: [...state.ga4Dump.filter(r => !action.replace), ...action.data],
        lastUpdated: { ...state.lastUpdated, ga4: new Date() },
        uploadLog: [{ type: 'GA4_DUMP', count: action.data.length, time: new Date() }, ...state.uploadLog.slice(0, 9)]
      }
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
