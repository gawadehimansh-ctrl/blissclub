// BlissClub creative naming convention:
// ACQ_IN_Advantage_230125-Video_LTC_Flare_INF_Fareheen_Styling_040425
// [COHORT]_IN_[CampaignInfo]-[Format]_[Product]_[SubProduct]_[ContentType]_[Creator]_[Theme]_[date]

export function parseCreativeName(name) {
  if (!name) return {}
  const n = String(name)

  const cohortMatch = n.match(/^(ACQ|RET|REM|ALWAYS_ON)/i)
  const cohort = cohortMatch ? cohortMatch[1].toUpperCase() : 'ACQ'

  const afterDash = n.split('-')[1] || ''
  const segs = afterDash.split('_').filter(Boolean)
  const fmtMatch = (segs[0] || '').match(/^(video|static|carousel|reel|ugc|dpa|catalog)/i)
  const format = fmtMatch ? capitalize(fmtMatch[1]) : 'Static'

  let product = 'Other'
  if (segs.length > 1) {
    const rawProd = segs[1]
    const sub = segs[2] || ''
    if (rawProd === 'LTC') {
      const ltcSubs = ['Flare', 'USP', 'Wide', 'AMPM', 'TUL', 'Shorts', 'Tee', 'LiteFlare']
      product = ltcSubs.includes(sub) ? 'LTC ' + sub : 'LTC'
    } else {
      const pm = {
        Men:'Men', MenCol:'Men', BB:'BB', BBCol:'BB',
        BraTopCol:'Bra Top', MaharaniCol:'Maharani',
        CloudKoreanPants:'Cloud Korean Pants',
        EverflowCol:'Everflow', EverflowKnotPants:'Everflow Knot',
        EverflowTank:'Everflow Tank', EverflowCape:'Everflow Cape',
        TravelCollectionMP:'Travel Collection', SumTravelCol:'Summer Travel',
        PetalCol:'Petal', KickFlareLite:'Kick Flare Lite',
        Blissentials:'Blissentials', Airmelt:'Airmelt',
        OTG:'OTG', AMPMCollection:'AMPM', IWR:'IWR',
        RS:'RS', FLP:'FLP', GYM:'Gym', CITY:'City',
        Shopall:'Shop All', Catalog:'Catalog',
        '2at1799':'LTC 2@1799', RSCol:'RS',
        ColorJan26:'Color Jan26', NewLaunches:'New Launches',
      }
      product = pm[rawProd] || rawProd
    }
  }

  const ctMap = { INF:'Influencer', CCP:'CCP', Tactical:'Tactical', WYLD:'WYLD', UGC:'UGC' }
  let contentType = 'Tactical'
  for (const [k, v] of Object.entries(ctMap)) {
    if (n.includes('_' + k + '_')) { contentType = v; break }
  }

  const creatorMatch = n.match(/(?:INF|CCP)_([A-Za-z]+)_/)
  const creator = creatorMatch ? creatorMatch[1] : null

  const os = n.includes('IOS') || n.includes('iOS') ? 'iOS'
    : n.includes('Android') ? 'Android' : 'All'

  return { cohort, format, product, contentType, creator, os }
}

function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : s
}

export function isBrandKeyword(term) {
  if (!term) return false
  const brandTerms = ['blissclub', 'bliss club', 'bliss_club', 'bc ', 'mybl']
  return brandTerms.some(b => String(term).toLowerCase().includes(b))
}

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

export function parseSaleTag(name) {
  if (!name) return 'BAU'
  const n = String(name).toLowerCase()
  if (n.includes('sale') || n.includes('eoss') || n.includes('bfcm') || n.includes('fest')) return 'Sale'
  return 'BAU'
}
