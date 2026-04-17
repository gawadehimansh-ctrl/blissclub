// BlissClub creative naming convention:
// ACQ_IN_Advantage_230125-video_LTC_Flare_INF_Fareheen_Styling_040425
// [COHORT]_IN_[CampaignInfo]-[format]_[product]_[contentType]_[creator]_[theme]_[date]

export function parseCreativeName(name) {
  if (!name) return {}
  const n = String(name)

  // Cohort: first segment before first underscore
  const cohortMap = { ACQ: 'ACQ', RET: 'RET', REM: 'REM', ALWAYS_ON: 'ACQ' }
  const cohortMatch = n.match(/^(ACQ|RET|REM|ALWAYS_ON)/i)
  const cohort = cohortMatch ? cohortMatch[1].toUpperCase() : 'ACQ'

  // Format: after dash, first segment
  const afterDash = n.split('-')[1] || ''
  const fmtMatch = afterDash.match(/^(video|static|carousel|reel|ugc|dpa)/i)
  const format = fmtMatch ? capitalize(fmtMatch[1]) : 'Static'

  // Product: known BlissClub product codes
  const products = [
    'LTC_Flare', 'LTC_USP', 'LTC_AMPM', 'LTC_Wide',
    'BB_Str', 'BB_Fit', 'LTC_LiteFlare',
    'TravelCollectionMP', 'LTC_Shorts', 'LTC_Tee',
    'CloudSoft', 'Unstoppable', 'MoveEase', 'FlexShorts'
  ]
  let product = 'Other'
  for (const p of products) {
    if (n.includes(p)) { product = p; break }
  }

  // Content type
  const ctMap = { INF: 'Influencer', CCP: 'CCP', Tactical: 'Tactical', WYLD: 'WYLD', UGC: 'UGC' }
  let contentType = 'Tactical'
  for (const [k, v] of Object.entries(ctMap)) {
    if (n.includes(`_${k}_`)) { contentType = v; break }
  }

  // Creator
  const creatorMatch = n.match(/(?:INF|CCP)_([A-Za-z]+)_/)
  const creator = creatorMatch ? creatorMatch[1] : null

  // OS
  const os = n.includes('IOS') || n.includes('iOS') ? 'iOS'
    : n.includes('Android') ? 'Android'
    : 'All'

  return { cohort, format, product, contentType, creator, os }
}

function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : s
}

// Tag brand vs non-brand for GA4 / Google keyword data
export function isBrandKeyword(term) {
  if (!term) return false
  const brandTerms = ['blissclub', 'bliss club', 'bliss_club', 'bc ', 'mybl']
  return brandTerms.some(b => String(term).toLowerCase().includes(b))
}

// Parse campaign type from Google campaign name
export function parseCampaignType(name) {
  if (!name) return 'Other'
  const n = String(name).toLowerCase()
  if (n.includes('uac') || n.includes('appinstall')) return 'UAC'
  if (n.includes('pmax') || n.includes('performancemax')) return 'Pmax'
  if (n.includes('discovery') || n.includes('demandgen') || n.includes('demand_gen')) return 'Discovery'
  if (n.includes('vac') || n.includes('video_awareness') || n.includes('awareness')) return 'Awareness'
  if (n.includes('shopping')) return 'Shopping'
  if (n.includes('search')) return 'Search'
  return 'Other'
}

// Parse BAU vs Sale from campaign/adset name
export function parseSaleTag(name) {
  if (!name) return 'BAU'
  const n = String(name).toLowerCase()
  if (n.includes('sale') || n.includes('eoss') || n.includes('bfcm') || n.includes('fest')) return 'Sale'
  return 'BAU'
}
