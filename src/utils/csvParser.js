import Papa from 'papaparse'
import { parseCreativeName, parseCampaignType, parseSaleTag, isBrandKeyword } from './parser.js'

// Detect which file type is being uploaded based on column headers
export function detectFileType(headers) {
  const h = headers.map(x => String(x).toLowerCase().trim())
  if (h.includes('fb orders') || h.includes('fb revenue') || h.includes('ga orders')) return 'META_DB'
  if (h.includes('adset name') && h.includes('ad name') && h.includes('time')) return 'META_HOURLY'
  if (h.includes('rowlabels') || (h.includes('cost') && h.includes('impr.') && h.includes('campaign id'))) return 'GOOGLE_DUMP'
  if (h.includes('session campaign') || h.includes('session manual term') || h.includes('ecommerce revenue')) return 'GA4_DUMP'
  return 'UNKNOWN'
}

// Parse Meta DB dump (main daily performance file)
function parseMetaDB(rows) {
  return rows.map(r => {
    const adName = r['Ad Name'] || r['AD NAME'] || ''
    const parsed = parseCreativeName(adName)
    return {
      date: parseDate(r['Date']),
      adsetName: r['Ad Set Name'] || r['Adset name'] || '',
      adName,
      impressions: num(r['Impressions']),
      clicks: num(r['Link clicks'] || r['Link Clicks']),
      spend: num(r['Spends'] || r['Spend']),
      fbOrders: num(r['FB Orders'] || r['1DC purchases']),
      fbRevenue: num(r['FB Revenue'] || r['1dc Revenue'] || r['1DC Revenue']),
      sessions: num(r['Sessions']),
      gaOrders: num(r['GA Orders']),
      gaRevenue: num(r['GA Revenue']),
      week: r['Week'] || '',
      month: r['Month'] || '',
      monthYear: r['Month & Year'] || '',
      year: num(r['Year']),
      creativeName: r['Creative Name'] || adName,
      cohort: r['Cohort'] || parsed.cohort || '',
      format: r['Format'] || parsed.format || '',
      product: r['Product'] || parsed.product || '',
      contentType: r['Content Type (CCP/ INF/ Tactical/WYLD)'] || parsed.contentType || '',
      creator: r["Creator's Name (NV for Tactical)"] || parsed.creator || '',
      theme: r['Theme'] || '',
      landingPath: r['Landing Path'] || '',
      saleTag: r['LP Sale/BAU'] || parseSaleTag(r['Ad Set Name'] || ''),
      category: r['Category'] || '',
      os: parsed.os || 'All',
      _source: 'META_DB'
    }
  }).filter(r => r.date)
}

// Parse Meta hourly dump
function parseMetaHourly(rows) {
  return rows.map(r => {
    const adName = r['AD NAME'] || r['Ad Name'] || ''
    const parsed = parseCreativeName(adName)
    return {
      date: parseDate(r['Date']),
      adsetName: r['Adset name'] || '',
      adName,
      timeSlot: r['Time'] || '',
      impressions: num(r['Impression'] || r['Impressions']),
      clicks: num(r['Link clicks']),
      spend: num(r['Spends']),
      fbOrders: num(r['1DC purchases']),
      fbRevenue: num(r['1dc Revenue']),
      cohort: r['cohort'] || parsed.cohort || '',
      product: r['Product'] || parsed.product || '',
      format: r['Format'] || parsed.format || '',
      _source: 'META_HOURLY'
    }
  }).filter(r => r.date || r.timeSlot)
}

// Parse Google raw dump (campaign-level)
function parseGoogleDump(rows) {
  return rows.map(r => {
    const campaignName = r['RowLabels'] || r['Campaign'] || ''
    return {
      date: parseDate(r['Date']),
      campaignName,
      campaignType: r['Type'] || parseCampaignType(campaignName),
      cost: num(r['Cost']),
      impressions: num(r['Impr.'] || r['Impressions']),
      clicks: num(r['Clicks']),
      cpc: num(r['CPC']),
      ctr: num(r['CTR']),
      sessions: num(r['Session'] || r['Sessions']),
      transactions: num(r['Transaction'] || r['Transactions']),
      revenue: num(r['Revenue']),
      ecr: num(r['ECR']),
      roas: num(r['ROAS']),
      aov: num(r['AOV']),
      cpt: num(r['CPT']),
      cps: num(r['CPS']),
      month: num(r['Month']),
      year: num(r['Year']),
      week: num(r['Week']),
      saleTag: r['Sale Tag'] || parseSaleTag(campaignName),
      campaignId: r['Campaign id'] || '',
      _source: 'GOOGLE_DUMP'
    }
  }).filter(r => r.date && r.campaignName)
}

// Parse GA4 dump (sessions + revenue + brand/NB tagging)
function parseGA4Dump(rows) {
  return rows.map(r => {
    const term = r['Session manual term'] || r['Session campaign'] || ''
    const tag = r['Unnamed: 2'] || r['Tags Review'] || ''
    return {
      date: parseDate(r['Date'] || r['Date.1']),
      sessionCampaign: r['Session campaign'] || term,
      manualTerm: term,
      tag,
      sessions: num(r['Sessions']),
      transactions: num(r['Transactions'] || r['Purchases']),
      revenue: num(r['Ecommerce revenue'] || r['Purchase revenue']),
      isBrand: isBrandKeyword(term) || isBrandKeyword(tag) || tag.toLowerCase().includes('brand'),
      _source: 'GA4_DUMP'
    }
  }).filter(r => r.date)
}

// Master parse function
export function parseCSV(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false,
      complete: (results) => {
        if (!results.data?.length) { reject(new Error('Empty file')); return }
        const headers = Object.keys(results.data[0])
        const fileType = detectFileType(headers)
        let parsed = []
        if (fileType === 'META_DB') parsed = parseMetaDB(results.data)
        else if (fileType === 'META_HOURLY') parsed = parseMetaHourly(results.data)
        else if (fileType === 'GOOGLE_DUMP') parsed = parseGoogleDump(results.data)
        else if (fileType === 'GA4_DUMP') parsed = parseGA4Dump(results.data)
        else { reject(new Error(`Unrecognised file format. Headers found: ${headers.slice(0, 5).join(', ')}`)); return }
        resolve({ data: parsed, fileType, count: parsed.length })
      },
      error: reject
    })
  })
}

// Also parse Excel sheets already converted to JSON (from Windsor)
export function parseWindsorPayload(payload, dataType) {
  if (dataType === 'meta') return parseMetaDB(payload)
  if (dataType === 'google') return parseGoogleDump(payload)
  if (dataType === 'ga4') return parseGA4Dump(payload)
  return payload
}

function num(v) {
  if (v === null || v === undefined || v === '' || v === 'NaN') return 0
  const n = parseFloat(String(v).replace(/,/g, ''))
  return isNaN(n) ? 0 : n
}

function parseDate(v) {
  if (!v) return null
  if (v instanceof Date) return v
  const s = String(v).trim()
  // Handle YYYYMMDD format from GA4
  if (/^\d{8}$/.test(s)) return new Date(`${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`)
  // Handle DD/MM/YYYY
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
    const [d, m, y] = s.split('/')
    return new Date(`${y}-${m}-${d}`)
  }
  const d = new Date(s)
  return isNaN(d) ? null : d
}
