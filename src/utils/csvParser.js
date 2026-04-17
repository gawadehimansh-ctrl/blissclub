import Papa from 'papaparse'
import { parseCreativeName, parseCampaignType, parseSaleTag, isBrandKeyword } from './parser.js'

export function detectFileType(headers) {
  const h = headers.map(x => String(x).toLowerCase().trim())
  const isMetaExport = h.includes('reporting starts') || h.includes('reporting ends')
  if (isMetaExport) {
    if (h.some(x => x.includes('time of day'))) return 'META_HOURLY'
    return 'META_DB'
  }
  if (h.includes('fb orders') || h.includes('fb revenue') || h.includes('ga orders')) return 'META_DB'
  if ((h.includes('adset name') || h.includes('ad set name')) && h.some(x => x.includes('time'))) return 'META_HOURLY'
  if (h.includes('rowlabels') || (h.includes('cost') && (h.includes('impr.') || h.includes('impressions')) && (h.includes('campaign id') || h.includes('type')))) return 'GOOGLE_DUMP'
  if (h.includes('session campaign') || h.includes('session manual term') || h.includes('ecommerce revenue') || h.includes('purchase revenue')) return 'GA4_DUMP'
  return 'UNKNOWN'
}

function parseMetaDB(rows) {
  return rows.map(r => {
    const adName = r['Ad name'] || r['Ad Name'] || r['AD NAME'] || ''
    const adsetName = r['Ad set name'] || r['Ad Set Name'] || r['Adset name'] || ''
    const parsed = parseCreativeName(adName)
    const dateVal = r['Reporting starts'] || r['Date'] || ''
    const spend = num(r['Amount spent (INR)'] || r['Spends'] || r['Spend'] || 0)
    const fbOrders = num(r['Purchases [1-day click]'] || r['Purchases (1-day click)'] || r['FB Orders'] || r['1DC purchases'] || r['Purchases'] || 0)
    const fbRevenue = num(r['Purchases conversion value [1-day click]'] || r['Purchases conversion value (1-day click)'] || r['FB Revenue'] || r['1dc Revenue'] || r['1DC Revenue'] || r['Purchases conversion value'] || 0)
    const reportedROAS = num(r['Purchase ROAS (return on ad spend)'] || r['ROAS'] || 0)
    const gaOrders = num(r['GA Orders'] || 0)
    const gaRevenue = num(r['GA Revenue'] || 0)
    const sessions = num(r['Sessions'] || 0)
    return {
      date: parseDate(dateVal),
      adsetName,
      adName,
      impressions: num(r['Impressions'] || 0),
      clicks: num(r['Link clicks'] || r['Link Clicks'] || 0),
      spend,
      fbOrders,
      fbRevenue,
      reportedROAS,
      sessions,
      gaOrders,
      gaRevenue,
      week: r['Week'] || '',
      month: r['Month'] || '',
      monthYear: r['Month & Year'] || '',
      year: num(r['Year'] || 0),
      creativeName: r['Creative Name'] || adName,
      cohort: r['Cohort'] || parsed.cohort || '',
      format: r['Format'] || parsed.format || '',
      product: r['Product'] || parsed.product || '',
      contentType: r['Content Type (CCP/ INF/ Tactical/WYLD)'] || parsed.contentType || '',
      creator: r["Creator's Name (NV for Tactical)"] || parsed.creator || '',
      theme: r['Theme'] || '',
      landingPath: r['Landing Path'] || '',
      saleTag: r['LP Sale/BAU'] || parseSaleTag(adsetName),
      category: r['Category'] || '',
      os: parsed.os || 'All',
      _source: 'META_DB'
    }
  }).filter(r => r.date)
}

function parseMetaHourly(rows) {
  return rows.map(r => {
    const adName = r['Ad name'] || r['AD NAME'] || r['Ad Name'] || ''
    const adsetName = r['Ad set name'] || r['Adset name'] || r['Ad Set Name'] || ''
    const parsed = parseCreativeName(adName)
    const dateVal = r['Reporting starts'] || r['Date'] || ''
    const timeSlot = r['Time of day (ad account time zone)'] || r['Time'] || ''
    return {
      date: parseDate(dateVal),
      adsetName,
      adName,
      timeSlot,
      impressions: num(r['Impressions'] || 0),
      clicks: num(r['Link clicks'] || 0),
      spend: num(r['Amount spent (INR)'] || r['Spends'] || 0),
      fbOrders: num(r['Purchases [1-day click]'] || r['Purchases (1-day click)'] || r['1DC purchases'] || r['Purchases'] || 0),
      fbRevenue: num(r['Purchases conversion value [1-day click]'] || r['Purchases conversion value (1-day click)'] || r['1dc Revenue'] || r['Purchases conversion value'] || 0),
      cohort: r['cohort'] || r['Cohort'] || parsed.cohort || '',
      product: r['Product'] || parsed.product || '',
      format: r['Format'] || parsed.format || '',
      _source: 'META_HOURLY'
    }
  }).filter(r => r.date || r.timeSlot)
}

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

function parseGA4Dump(rows) {
  return rows.map(r => {
    const term = r['Session manual term'] || r['Session campaign'] || ''
    const tag = r['Session manual ad content'] || r['Unnamed: 2'] || r['Tags Review'] || ''
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

export function parseCSV(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      let text = e.target.result
      // Strip comment lines at top (GA4 exports have # header block)
      const lines = text.split('\n')
      const firstDataIdx = lines.findIndex(l => !l.trim().startsWith('#') && l.trim().length > 0)
      text = lines.slice(firstDataIdx).join('\n')

      Papa.parse(text, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: false,
        complete: (results) => {
          if (!results.data || !results.data.length) { reject(new Error('Empty file')); return }
          // Filter out grand total / summary rows (first column empty)
          const data = results.data.filter(r => {
            const firstVal = Object.values(r)[0]
            return firstVal && String(firstVal).trim() !== ''
          })
          if (!data.length) { reject(new Error('No data rows found')); return }
          const headers = Object.keys(data[0])
          const fileType = detectFileType(headers)
          let parsed = []
          if (fileType === 'META_DB') parsed = parseMetaDB(data)
          else if (fileType === 'META_HOURLY') parsed = parseMetaHourly(data)
          else if (fileType === 'GOOGLE_DUMP') parsed = parseGoogleDump(data)
          else if (fileType === 'GA4_DUMP') parsed = parseGA4Dump(data)
          else {
            reject(new Error('Unrecognised file format. Headers found: ' + headers.slice(0, 5).join(', ')))
            return
          }
          resolve({ data: parsed, fileType, count: parsed.length })
        },
        error: reject
      })
    }
    reader.onerror = reject
    reader.readAsText(file)
  })
}

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
  if (/^\d{8}$/.test(s)) return new Date(s.slice(0, 4) + '-' + s.slice(4, 6) + '-' + s.slice(6, 8))
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
    const parts = s.split('/')
    return new Date(parts[2] + '-' + parts[1] + '-' + parts[0])
  }
  const d = new Date(s)
  return isNaN(d) ? null : d
}
