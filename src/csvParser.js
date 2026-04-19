import Papa from 'papaparse'
import { parseCreativeName, parseCampaignType, parseSaleTag, isBrandKeyword } from './parser.js'

export function detectFileType(headers) {
  const h = headers.map(x => String(x).toLowerCase().trim())

  // ── Windsor Google Sheets formats (detected first — specific column combos) ──
  // Windsor google_daily: campaign_name + cost + roas + ecr
  if (h.includes('campaign_name') && h.includes('cost') && (h.includes('roas') || h.includes('ecr'))) return 'WINDSOR_GOOGLE_DAILY'

  // Windsor google_search_terms: "search terms" column (Windsor writes it with capital S and space)
  if (h.includes('search terms') || (h.includes('search_term') && h.includes('campaign_name'))) return 'WINDSOR_SEARCH_TERMS'

  // Windsor google_keywords: keyword_text + keyword_match_type
  if (h.includes('keyword_text') && h.includes('keyword_match_type')) return 'WINDSOR_KEYWORDS'

  // Windsor meta/GA4 blended: session_manual_term + totalrevenue + datasource
  if (h.includes('session_manual_term') && h.includes('totalrevenue')) return 'WINDSOR_META_GA4'
  if (h.includes('session_manual_term') && h.includes('transactions') && h.includes('datasource')) return 'WINDSOR_META_GA4'

  // ── Meta ──────────────────────────────────────────────────────────────────
  const isMetaExport = h.includes('reporting starts') || h.includes('reporting ends')
  if (isMetaExport) {
    if (h.some(x => x.includes('time of day'))) return 'META_HOURLY'
    return 'META_DB'
  }
  if (h.includes('fb orders') || h.includes('fb revenue') || h.includes('ga orders')) return 'META_DB'
  if ((h.includes('adset name') || h.includes('ad set name')) && h.some(x => x.includes('time'))) return 'META_HOURLY'

  // ── GA4 ───────────────────────────────────────────────────────────────────
  if (h.includes('session campaign') || h.includes('session manual term') || h.includes('ecommerce revenue') || h.includes('purchase revenue')) return 'GA4_DUMP'

  // ── Google Awareness / YouTube ─────────────────────────────────────────────
  // Campaign report with TrueView columns
  const hasTrueView = h.some(x => x.includes('trueview') || x.includes('true view'))
  // Device report with TrueView CPV
  const hasTrueViewCPV = h.some(x => x.includes('trueview avg. cpv') || x.includes('avg. cpv'))
  // Standalone video views column
  const hasVideoViews = h.some(x => x === 'video views' || x === 'views')
  // Video view rate
  const hasVTR = h.some(x => x.includes('video view rate') || x.includes('view rate'))
  // Device breakdown report
  const isDeviceReport = h.includes('device') && (hasTrueView || hasTrueViewCPV)
  // Channel distribution report
  const isChannelReport = h.includes('channels') && h.includes('campaigns')

  if (hasTrueView || hasTrueViewCPV || hasVideoViews || isDeviceReport) return 'GOOGLE_AWARENESS'
  if (isChannelReport) return 'GOOGLE_AWARENESS' // Channel dist maps to awareness

  // ── Google Ad-level report (DemandGen, Pmax, Search ads) ─────────────────
  // Has 'ad name' or 'ad status' column → ad-level report
  const isAdReport = h.includes('ad name') || h.includes('ad status')
  if (isAdReport && h.includes('campaign') && h.includes('cost')) return 'GOOGLE_AD_REPORT'

  // ── Google Keywords / Search Terms ────────────────────────────────────────
  if (h.some(x => x === 'search term' || x === 'search terms') && h.includes('cost')) return 'GOOGLE_SEARCH_TERMS'
  if (h.some(x => x === 'keyword' || x === 'search keyword') && h.includes('cost') && h.some(x => x.includes('quality score') || x.includes('impr.'))) return 'GOOGLE_KEYWORDS'

  // ── Google conversion campaigns dump ─────────────────────────────────────
  // Internal format: RowLabels + Type column
  if (h.includes('rowlabels') && h.includes('cost')) return 'GOOGLE_DUMP'
  // Standard Google Ads campaign export: Campaign + Cost + Impr. + CTR
  if (h.includes('campaign') && h.includes('cost') && (h.includes('impr.') || h.includes('impressions')) && h.includes('ctr')) return 'GOOGLE_DUMP'
  // Conversion action report
  if (h.includes('conversion action') && h.includes('campaign') && h.includes('cost')) return 'GOOGLE_DUMP'

  return 'UNKNOWN'
}

function parseMetaDB(rows) {
  return rows.map(r => {
    const adName    = r['Ad name'] || r['Ad Name'] || r['AD NAME'] || ''
    const adsetName = r['Ad set name'] || r['Ad Set Name'] || r['Adset name'] || ''
    const parsed    = parseCreativeName(adName)
    const dateVal   = r['Reporting starts'] || r['Date'] || ''
    const spend     = num(r['Amount spent (INR)'] || r['Spends'] || r['Spend'] || 0)
    const fbOrders  = num(r['Purchases [1-day click]'] || r['Purchases (1-day click)'] || r['FB Orders'] || r['1DC purchases'] || r['Purchases'] || 0)
    const fbRevenue = num(r['Purchases conversion value [1-day click]'] || r['Purchases conversion value (1-day click)'] || r['FB Revenue'] || r['1dc Revenue'] || r['1DC Revenue'] || r['Purchases conversion value'] || 0)
    return {
      date: parseDate(dateVal),
      adsetName, adName,
      impressions: num(r['Impressions'] || 0),
      clicks: num(r['Link clicks'] || r['Link Clicks'] || 0),
      spend, fbOrders, fbRevenue,
      reportedROAS: num(r['Purchase ROAS (return on ad spend)'] || r['ROAS'] || 0),
      sessions: num(r['Sessions'] || 0),
      gaOrders: num(r['GA Orders'] || 0),
      gaRevenue: num(r['GA Revenue'] || 0),
      week: r['Week'] || '', month: r['Month'] || '',
      creativeName: r['Creative Name'] || adName,
      cohort: r['Cohort'] || parsed.cohort || '',
      format: r['Format'] || parsed.format || '',
      product: r['Product'] || parsed.product || '',
      contentType: r['Content Type (CCP/ INF/ Tactical/WYLD)'] || parsed.contentType || '',
      creator: r["Creator's Name (NV for Tactical)"] || parsed.creator || '',
      saleTag: r['LP Sale/BAU'] || parseSaleTag(adsetName),
      category: r['Category'] || '',
      os: parsed.os || 'All',
      _source: 'META_DB'
    }
  }).filter(r => r.date)
}

function parseMetaHourly(rows) {
  return rows.map(r => {
    const adName    = r['Ad name'] || r['AD NAME'] || r['Ad Name'] || ''
    const adsetName = r['Ad set name'] || r['Adset name'] || r['Ad Set Name'] || ''
    const parsed    = parseCreativeName(adName)
    return {
      date: parseDate(r['Reporting starts'] || r['Date'] || ''),
      adsetName, adName,
      timeSlot: r['Time of day (ad account time zone)'] || r['Time'] || '',
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
      cpc: num(r['Avg. CPC'] || r['CPC']),
      ctr: num(r['CTR']),
      sessions: num(r['Session'] || r['Sessions']),
      transactions: num(r['Transaction'] || r['Transactions']),
      revenue: num(r['Revenue'] || r['Conv. value'] || r['Total conv. value']),
      roas: num(r['ROAS'] || r['Conv. value / cost']),
      cpm: num(r['Avg. CPM']),
      impressionShare: num(r['Search Impr. share'] || r['Search impr. share'] || r['Impr. share'] || 0) / 100,
      adgroupName: r['Ad group'] || r['Ad Group'] || '',
      saleTag: parseSaleTag(campaignName),
      _source: 'GOOGLE_DUMP'
    }
  }).filter(r => r.date && r.campaignName)
}

// Google Awareness / YouTube campaigns
function parseGoogleAwareness(rows) {
  return rows.map(r => {
    const campaignName = r['Campaign'] || r['RowLabels'] || ''
    return {
      date: parseDate(r['Date'] || r['Reporting starts']),
      campaignName,
      campaignType: 'Awareness',
      cost: num(r['Cost']),
      impressions: num(r['Impressions'] || r['Impr.']),
      clicks: num(r['Clicks']),
      ctr: num(r['CTR']),
      cpc: num(r['Avg. CPC']),
      cpm: num(r['Avg. CPM']),
      videoViews: num(r['Video views'] || r['Views']),
      cpv: num(r['Avg. CPV']),
      vtr: num(r['Video view rate'] || r['View rate']),
      videoPlayed25: num(r['Video played to 25%'] || r['Video quartile p25 rate'] || 0),
      videoPlayed50: num(r['Video played to 50%'] || r['Video quartile p50 rate'] || 0),
      videoPlayed75: num(r['Video played to 75%'] || r['Video quartile p75 rate'] || 0),
      videoPlayed100: num(r['Video played to 100%'] || r['Video quartile p100 rate'] || 0),
      videoTitle: r['Video title'] || r['Video'] || '',
      device: r['Device'] || '',
      ageGroup: r['Age'] || '',
      location: r['City'] || r['Location'] || '',
      adgroupName: r['Ad group'] || '',
      _source: 'GOOGLE_AWARENESS'
    }
  }).filter(r => r.date && r.campaignName)
}

// Google Keywords
function parseGoogleKeywords(rows) {
  return rows.map(r => {
    const keyword = r['Keyword'] || r['Search keyword'] || ''
    const campaignName = r['Campaign'] || ''
    return {
      date: parseDate(r['Date'] || new Date()),
      keyword,
      matchType: r['Match type'] || '',
      campaignName,
      adgroupName: r['Ad group'] || r['Ad Group'] || '',
      cost: num(r['Cost']),
      impressions: num(r['Impressions'] || r['Impr.']),
      clicks: num(r['Clicks']),
      ctr: num(r['CTR']),
      cpc: num(r['Avg. CPC']),
      transactions: num(r['Conversions'] || r['Conv.']),
      revenue: num(r['Conv. value'] || r['Conversion value']),
      roas: num(r['Conv. value / cost'] || r['ROAS']),
      impressionShare: num(r['Search Impr. share'] || r['Impr. share'] || 0) / 100,
      qualityScore: num(r['Quality Score'] || r['Qual. score'] || 0),
      isBrand: isBrandKeyword(keyword) || isBrandKeyword(campaignName),
      _source: 'GOOGLE_KEYWORDS'
    }
  }).filter(r => r.keyword)
}

// Google Search Terms
function parseGoogleSearchTerms(rows) {
  return rows.map(r => {
    const term = r['Search term'] || r['Search Term'] || ''
    const campaignName = r['Campaign'] || ''
    const keyword = r['Keyword'] || r['Added/Excluded'] || ''
    return {
      date: parseDate(r['Date'] || new Date()),
      term,
      matchType: r['Match type'] || '',
      campaignName,
      adgroupName: r['Ad group'] || r['Ad Group'] || '',
      keyword,
      cost: num(r['Cost']),
      impressions: num(r['Impressions'] || r['Impr.']),
      clicks: num(r['Clicks']),
      ctr: num(r['CTR']),
      cpc: num(r['Avg. CPC']),
      transactions: num(r['Conversions'] || r['Conv.']),
      revenue: num(r['Conv. value'] || r['Conversion value']),
      roas: num(r['Conv. value / cost'] || r['ROAS']),
      isBrand: isBrandKeyword(term),
      _source: 'GOOGLE_SEARCH_TERMS'
    }
  }).filter(r => r.term)
}

function parseGA4Dump(rows) {
  return rows.map(r => {
    // Handle both CSV export format and Windsor API format
    const term = r['session_manual_term'] || r['Session manual term'] || r['Session campaign'] || r['campaign'] || ''
    const adContent = r['session_manual_ad_content'] || r['Session manual ad content'] || ''
    return {
      date: parseDate(r['date'] || r['Date'] || r['Date.1']),
      sessionCampaign: r['campaign'] || r['Session campaign'] || term,
      manualTerm: term,
      tag: adContent || r['Unnamed: 2'] || r['Tags Review'] || '',
      sessions: num(r['sessions'] || r['Sessions']),
      transactions: num(r['transactions'] || r['Transactions'] || r['Purchases']),
      revenue: num(r['totalrevenue'] || r['Ecommerce revenue'] || r['Purchase revenue']),
      isBrand: isBrandKeyword(term),
      _source: 'GA4_DUMP'
    }
  }).filter(r => r.date)
}


// Google Ad-level report (DemandGen, Pmax, Search ads)
function parseGoogleAdReport(rows) {
  return rows.map(r => {
    const adName      = r['Ad name'] || ''
    const campaignName = r['Campaign'] || ''
    return {
      date: parseDate(r['Date'] || new Date()),
      adName,
      campaignName,
      adgroupName: r['Ad group'] || '',
      adType: r['Ad type'] || '',
      adStatus: r['Status'] || r['Ad status'] || '',
      campaignType: r['Campaign type'] || parseCampaignType(campaignName),
      cost: num(r['Cost']),
      impressions: num(r['Impr.'] || r['Impressions']),
      clicks: num(r['Clicks']),
      ctr: num(r['CTR']),
      cpc: num(r['Avg. CPC']),
      cpm: num(r['Avg. CPM']),
      transactions: num(r['Conversions'] || r['Conv.'] || 0),
      revenue: num(r['Conv. value'] || r['Conv. value/cost'] || 0),
      roas: num(r['Conv. value / cost'] || r['ROAS'] || 0),
      adStrength: r['Ad strength'] || '',
      _source: 'GOOGLE_AD_REPORT',
    }
  }).filter(r => r.campaignName)
}

// Google Channel distribution report
function parseGoogleChannelReport(rows) {
  return rows.map(r => {
    const campaignName = r['Campaigns'] || r['Campaign'] || ''
    return {
      date: new Date(),
      channel: r['Channels'] || r['Channel'] || '',
      campaignName,
      campaignType: parseCampaignType(campaignName),
      cost: num(r['Cost']),
      impressions: num(r['Impr.'] || r['Impressions']),
      clicks: num(r['Clicks'] || r['Interactions']),
      transactions: num(r['Conversions'] || r['Conv.']),
      revenue: num(r['Conv. value']),
      _source: 'GOOGLE_AWARENESS',
    }
  }).filter(r => r.campaignName || r.channel)
}

// Google Device report (awareness)
function parseGoogleDeviceReport(rows) {
  return rows.map(r => {
    const campaignName = r['Campaign'] || ''
    return {
      date: new Date(),
      device: r['Device'] || '',
      campaignName,
      adgroupName: r['Ad group'] || '',
      cost: num(r['Cost']),
      impressions: num(r['Impr.'] || r['Impressions']),
      videoViews: num(r['TrueView views'] || r['Video views'] || 0),
      cpv: num(r['TrueView avg. CPV'] || r['Avg. CPV'] || 0),
      cpm: num(r['Avg. CPM'] || 0),
      vtr: num(r['TrueView view rate (in-stream)'] || r['Video view rate'] || 0),
      _source: 'GOOGLE_AWARENESS',
    }
  }).filter(r => r.campaignName || r.device)
}

// Google Campaign report (awareness - TrueView)
function parseGoogleCampaignReport(rows) {
  return rows.map(r => {
    const campaignName = r['Campaign'] || ''
    const hasTrueView = r['TrueView views'] !== undefined
    return {
      date: new Date(),
      campaignName,
      campaignType: r['Campaign type'] || parseCampaignType(campaignName),
      cost: num(r['Cost']),
      impressions: num(r['Impr.'] || r['Impressions']),
      clicks: num(r['Clicks']),
      ctr: num(r['CTR']),
      cpc: num(r['Avg. CPC']),
      cpm: num(r['Avg. CPM'] || r['CPM']),
      videoViews: num(r['TrueView views'] || r['Video views'] || 0),
      vtr: num(r['TrueView view rate (in-stream)'] || r['Video view rate'] || 0),
      uniqueUsers: num(r['Unique users'] || 0),
      avgFreq: num(r['Avg. impr. freq. / user'] || 0),
      transactions: num(r['Conversions'] || r['Conv.'] || 0),
      revenue: num(r['Conv. value'] || 0),
      _source: 'GOOGLE_AWARENESS',
    }
  }).filter(r => r.campaignName)
}


// ── Windsor Google Sheets parsers ────────────────────────────────────────────
// These handle CSVs downloaded from the BlissClub Windsor Google Sheet

// Windsor: google_daily tab
// Headers: account_name, ad_name, campaign_name, date, impressions, spend,
//          average_cpm, clicks, conversion_value, conversions, cost, cpc, ctr,
//          roas, conv value/cost, ecr
function parseWindsorGoogleDaily(rows) {
  return rows.map(r => {
    const campaignName = r['campaign_name'] || r['campaign'] || ''
    return {
      date: parseDate(r['date']),
      campaignName,
      campaignType: parseCampaignType(campaignName),
      cost:         num(r['cost'] || r['spend']),
      impressions:  num(r['impressions']),
      clicks:       num(r['clicks']),
      cpc:          num(r['cpc']),
      ctr:          num(r['ctr']),
      cpm:          num(r['average_cpm'] || r['cpm']),
      transactions: num(r['conversions']),
      revenue:      num(r['conversion_value']),
      roas:         num(r['roas'] || r['conv value/cost']),
      ecr:          num(r['ecr']),
      adgroupName:  r['ad_group_name'] || '',
      saleTag:      parseSaleTag(campaignName),
      _source: 'WINDSOR_GOOGLE_DAILY',
    }
  }).filter(r => r.date && r.campaignName)
}

// Windsor: google_search_terms tab
// Headers: account_name, ad_name, campaign_name, date, impressions, spend,
//          ad_group_name, clicks, conversions, Cost, Search Terms
function parseWindsorSearchTerms(rows) {
  return rows.map(r => {
    // Windsor returns column as 'Search Terms' (capital) or 'search_term' depending on version
    const term = r['Search Terms'] || r['search_term'] || r['Search Term'] || r['search terms'] || ''
    const campaignName = r['campaign_name'] || r['campaign'] || ''
    return {
      date:         parseDate(r['date'] || new Date()),
      term,
      campaignName,
      adgroupName:  r['ad_group_name'] || '',
      cost:         num(r['Cost'] || r['cost'] || r['spend']),
      impressions:  num(r['impressions']),
      clicks:       num(r['clicks']),
      ctr:          num(r['ctr'] || 0),
      cpc:          num(r['cpc'] || 0),
      transactions: num(r['conversions']),
      revenue:      num(r['conversion_value'] || 0),
      isBrand:      isBrandKeyword(term),
      _source: 'WINDSOR_SEARCH_TERMS',
    }
  }).filter(r => r.term)
}

// Windsor: google_keywords tab
// Headers: account_name, ad_group_name, campaign_name, clicks, conversions,
//          cost, date, impressions, keyword_match_type, keyword_text
function parseWindsorKeywords(rows) {
  return rows.map(r => {
    const keyword = r['keyword_text'] || r['keyword'] || ''
    const campaignName = r['campaign_name'] || r['campaign'] || ''
    return {
      date:          parseDate(r['date'] || new Date()),
      keyword,
      matchType:     r['keyword_match_type'] || r['match_type'] || '',
      campaignName,
      adgroupName:   r['ad_group_name'] || '',
      cost:          num(r['cost'] || r['spend']),
      impressions:   num(r['impressions']),
      clicks:        num(r['clicks']),
      ctr:           num(r['ctr'] || 0),
      cpc:           num(r['cpc'] || 0),
      transactions:  num(r['conversions']),
      revenue:       num(r['conversion_value'] || 0),
      roas:          num(r['roas'] || 0),
      impressionShare: num(r['impression_share'] || r['search_impr_share'] || 0),
      qualityScore:  num(r['quality_score'] || 0),
      isBrand:       isBrandKeyword(keyword) || isBrandKeyword(campaignName),
      _source: 'WINDSOR_KEYWORDS',
    }
  }).filter(r => r.keyword)
}

// Windsor: meta_daily tab (GA4 data joined with Meta)
// Headers: account_name, campaign, clicks, cost_per_action_type_landing_page_view,
//          cpc, datasource, date, purchase_roas_omni_purchase,
//          session_manual_ad_content, session_manual_term, sessions, source,
//          spend, totalrevenue, transactions
function parseWindsorMetaGA4(rows) {
  return rows.map(r => {
    // Windsor field names differ from CSV: adset_name, ad_name (snake_case)
    const term      = r['session_manual_term'] || r['adset_name'] || r['campaign'] || ''
    const adContent = r['ad_name'] || r['session_manual_ad_content'] || ''
    // Parse creative name from ad_name (contains full creative naming convention)
    const parsed    = parseCreativeName(adContent || term)
    const isGA4 = (r['datasource'] || '') === 'googleanalytics4'
    const isMeta = (r['datasource'] || '') === 'facebook' || num(r['spend']) > 0

    return {
      date:           parseDate(r['date']),
      adsetName:      term,
      adName:         adContent,
      campaignName:   r['campaign'] || '',
      spend:          num(r['spend']),
      clicks:         num(r['clicks']),
      impressions:    num(r['impressions']),
      cpc:            num(r['cpc']),
      sessions:       num(r['sessions']),
      gaOrders:       num(r['transactions']),
      gaRevenue:      num(r['totalrevenue']),
      fbRevenue:      isMeta ? num(r['purchase_roas_omni_purchase']) * num(r['spend']) : num(r['totalrevenue']),
      fbOrders:       num(r['transactions']),
      reportedROAS:   num(r['purchase_roas_omni_purchase']),
      cplpv:          num(r['cost_per_action_type_landing_page_view']),
      datasource:     r['datasource'] || '',
      source:         r['source'] || '',
      manualTerm:     r['session_manual_term'] || '',
      cohort:         parsed.cohort || '',
      format:         parsed.format || '',
      product:        parsed.product || '',
      contentType:    parsed.contentType || '',
      creator:        parsed.creator || '',
      saleTag:        parseSaleTag(term),
      _source: 'WINDSOR_META_GA4',
    }
  }).filter(r => r.date && (r.adsetName || r.campaignName))
}

// Windsor: Sheet1 (blended Meta + GA4 dump)
// Same structure as meta_daily — just different sheet name
function parseWindsorSheet1(rows) {
  return parseWindsorMetaGA4(rows)
}

export function parseCSV(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      let text = e.target.result
      const lines = text.split('\n')

      // Strategy: find the real header row — the first row with 3+ comma-separated values
      // that looks like column headers (not a title/date-range row).
      // Google Ads exports have 2 garbage rows at top: "Report name" + "date range"
      // GA4 exports have # comment lines at top
      // Meta exports start directly with real headers
      let headerIdx = 0
      for (let i = 0; i < Math.min(lines.length, 10); i++) {
        const line = lines[i].trim()
        if (!line || line.startsWith('#')) continue
        // Count comma-separated values — real header rows have many columns
        const cols = line.split(',').length
        if (cols >= 3) {
          // Extra check: if it looks like a report title (single word + "report") or date range, skip it
          const lc = line.toLowerCase()
          const isTitle = cols <= 3 && (lc.includes('report') || lc.match(/\d+ \w+ \d{4}/))
          if (!isTitle) {
            headerIdx = i
            break
          }
        }
      }
      text = lines.slice(headerIdx).join('\n')

      Papa.parse(text, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: false,
        complete: (results) => {
          if (!results.data || !results.data.length) { reject(new Error('Empty file')); return }
          const data = results.data.filter(r => {
            const firstVal = Object.values(r)[0]
            return firstVal && String(firstVal).trim() !== ''
          })
          if (!data.length) { reject(new Error('No data rows found')); return }
          const headers = Object.keys(data[0])
          const fileType = detectFileType(headers)
          let parsed = []
          if (fileType === 'META_DB')               parsed = parseMetaDB(data)
          else if (fileType === 'META_HOURLY')      parsed = parseMetaHourly(data)
          else if (fileType === 'WINDSOR_META_GA4') parsed = parseWindsorMetaGA4(data)
          else if (fileType === 'WINDSOR_GOOGLE_DAILY') parsed = parseWindsorGoogleDaily(data)
          else if (fileType === 'WINDSOR_SEARCH_TERMS') parsed = parseWindsorSearchTerms(data)
          else if (fileType === 'WINDSOR_KEYWORDS')     parsed = parseWindsorKeywords(data)
          else if (fileType === 'GOOGLE_DUMP')      parsed = parseGoogleDump(data)
          else if (fileType === 'GOOGLE_AD_REPORT') parsed = parseGoogleAdReport(data)
          else if (fileType === 'GOOGLE_AWARENESS') {
            // Route to specific parser based on columns
            const hh = headers.map(x => x.toLowerCase())
            if (hh.includes('device')) parsed = parseGoogleDeviceReport(data)
            else if (hh.includes('channels') || hh.includes('channel')) parsed = parseGoogleChannelReport(data)
            else if (hh.some(x => x.includes('trueview') || x.includes('unique users'))) parsed = parseGoogleCampaignReport(data)
            else parsed = parseGoogleAwareness(data)
          }
          else if (fileType === 'GOOGLE_KEYWORDS')      parsed = parseGoogleKeywords(data)
          else if (fileType === 'GOOGLE_SEARCH_TERMS')  parsed = parseGoogleSearchTerms(data)
          else if (fileType === 'GA4_DUMP')             parsed = parseGA4Dump(data)
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


// ── Windsor API payload parsers (called from useWindsor.js) ───────────────────
// These parse raw JSON from the Railway proxy, not CSV

export function parseWindsorPayload(rows, dataType) {
  if (!Array.isArray(rows)) rows = []
  switch (dataType) {
    case 'windsor_meta_ga4':    return parseWindsorMetaGA4(rows)
    case 'windsor_google':      return parseWindsorGoogleDaily(rows)
    case 'windsor_search_terms':return parseWindsorSearchTerms(rows)
    case 'windsor_keywords':    return parseWindsorKeywords(rows)
    case 'meta':                return parseMetaDB(rows)
    case 'google':              return parseGoogleDump(rows)
    case 'ga4':                 return parseGA4Dump(rows)
    default:                    return rows
  }
}


function num(v) {
  if (v === null || v === undefined || v === '' || v === 'NaN') return 0
  const n = parseFloat(String(v).replace(/[,%]/g, ''))
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
