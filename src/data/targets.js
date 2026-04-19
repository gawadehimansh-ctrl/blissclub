// BlissClub media plan targets — daily benchmarks
// NR targets = monthly / 30 days
// All targets are per-day

export const PACING_CONFIG = {
  startDate:  '2026-04-01',
  totalDays:  30,
  month:      'April 2026',
}

// 20% delta buffer thresholds
export const DELTA_OK   = 0.80   // within 20% = ok
export const DELTA_WARN = 0.60   // 40–60% off = warn

// ── CATEGORY TARGETS (daily) ──────────────────────────────────────────────────
// Monthly totals ÷ 30 days
// ga4Revenue = monthly GA4 tracked / 30
// NR = monthly NR / 30
// Spends, CPC, CPS, ROAS, ECR = direct daily benchmarks from media plan
export const CATEGORY_TARGETS = {
  '5*5 Products': {
    ga4Revenue: 8157,   // 244712 / 30
    nr:         14831,  // 444931 / 30
    spends:     4635,   // 139041 / 30
    ga4ROAS:    1.76,
    cpc:        14.14,
    cps:        17,
    ecr:        0.022,
    spendMix:   0.213,
  },
  'Pareto': {
    ga4Revenue: 2997,   // 89905 / 30
    nr:         5449,
    spends:     1620,
    ga4ROAS:    1.85,
    cpc:        17,
    cps:        19,
    ecr:        0.020,
    spendMix:   0.074,
  },
  'Airmelt': {
    ga4Revenue: 2751,   // 82539 / 30
    nr:         5002,
    spends:     1448,
    ga4ROAS:    1.90,
    cpc:        15,
    cps:        18,
    ecr:        0.015,
    spendMix:   0.066,
  },
  'Outerwear': {
    ga4Revenue: 415,    // 12442 / 30
    nr:         754,
    spends:     224,
    ga4ROAS:    1.85,
    cpc:        17,
    cps:        19,
    ecr:        0.020,
    spendMix:   0.010,
  },
  'Rest': {
    ga4Revenue: 5709,   // 171285 / 30
    nr:         10381,
    spends:     3086,
    ga4ROAS:    1.85,
    cpc:        15,
    cps:        17,
    ecr:        0.020,
    spendMix:   0.142,
  },
  'Sports Bra': {
    ga4Revenue: 694,    // 20830 / 30
    nr:         1262,
    spends:     463,
    ga4ROAS:    1.50,
    cpc:        17,
    cps:        20,
    ecr:        0.020,
    spendMix:   0.021,
  },
  'BB/RS': {
    ga4Revenue: 6417,   // 192500 / 30
    nr:         11667,
    spends:     3469,
    ga4ROAS:    1.85,
    cpc:        23,
    cps:        29,
    ecr:        0.015,
    spendMix:   0.159,
  },
  'Swimwear': {
    ga4Revenue: 927,    // 27812 / 30
    nr:         1686,
    spends:     618,
    ga4ROAS:    1.50,
    cpc:        20,
    cps:        22,
    ecr:        0.020,
    spendMix:   0.028,
  },
  'Topwear': {
    ga4Revenue: 1322,   // 39655 / 30
    nr:         2403,
    spends:     881,
    ga4ROAS:    1.50,
    cpc:        20,
    cps:        22,
    ecr:        0.020,
    spendMix:   0.040,
  },
  'PetalRib': {
    ga4Revenue: 1868,   // 56033 / 30
    nr:         3396,
    spends:     1245,
    ga4ROAS:    1.50,
    cpc:        28,
    cps:        33,
    ecr:        0.020,
    spendMix:   0.057,
  },
  'Innerwear': {
    ga4Revenue: 411,    // 12325 / 30
    nr:         747,
    spends:     274,
    ga4ROAS:    1.50,
    cpc:        20,
    cps:        22,
    ecr:        0.020,
    spendMix:   0.013,
  },
  'Bliss Terry': {
    ga4Revenue: 175,    // 5250 / 30
    nr:         318,
    spends:     97,
    ga4ROAS:    1.80,
    cpc:        18,
    cps:        20,
    ecr:        0.020,
    spendMix:   0.004,
  },
  'Menswear': {
    ga4Revenue: 4662,   // 139868 / 30
    nr:         8477,
    spends:     3730,
    ga4ROAS:    1.25,
    cpc:        16,
    cps:        22,
    ecr:        0.020,
    spendMix:   0.171,
  },
}

// ── PRODUCT TARGETS (daily) ────────────────────────────────────────────────────
// Key = EXACT product name as assigned by parser.js
// alias = display name
// category = must match CATEGORY_TARGETS key exactly
// ga4Revenue, spends = daily targets
// ROAS, CPC, CPS, ECR = daily benchmarks

export const PRODUCT_TARGETS = {
  // ─── 5*5 Products ────────────────────────────────────────────────────────────
  'LTC Flare': {
    alias: 'Ultimate Flare Pants-Lite',
    category: '5*5 Products',
    ga4Revenue: 3269,   // final_nr 98054 / 30
    spends:     2414,   // proportional
    ga4ROAS:    2.18,
    cpc:        10,
    cps:        12,
    ecr:        0.022,
    aov:        999,
    ncac:       400,
    minOrders:  10,
  },
  'LTC USP': {
    alias: 'Ultimate Straight Pants-Lite',
    category: '5*5 Products',
    ga4Revenue: 1920,
    spends:     1603,
    ga4ROAS:    2.18,
    cpc:        10,
    cps:        12,
    ecr:        0.022,
    aov:        999,
    ncac:       600,
    minOrders:  7,
  },
  'LTC Wide': {
    alias: 'Ultimate Leggings-Lite',
    category: '5*5 Products',
    ga4Revenue: 1237,
    spends:     731,
    ga4ROAS:    2.18,
    cpc:        12,
    cps:        14,
    ecr:        0.022,
    aov:        1600,
    ncac:       700,
    minOrders:  5,
  },
  // map alternate parser names
  'LTC': {
    alias: 'LTC (generic)',
    category: '5*5 Products',
    ga4Revenue: 800,
    spends:     500,
    ga4ROAS:    2.0,
    cpc:        12,
    cps:        14,
    ecr:        0.022,
    aov:        999,
    ncac:       500,
    minOrders:  3,
  },
  // ─── Airmelt ─────────────────────────────────────────────────────────────────
  'Airmelt': {
    alias: 'AirMelt (all)',
    category: 'Airmelt',
    ga4Revenue: 2751,
    spends:     1448,
    ga4ROAS:    2.0,
    cpc:        15,
    cps:        18,
    ecr:        0.015,
    aov:        1299,
    ncac:       700,
    minOrders:  5,
  },
  'AirmeltFLP': {
    alias: 'AirMelt Flare Pants-Lite',
    category: 'Airmelt',
    ga4Revenue: 1743,   // 52290 / 30
    spends:     914,
    ga4ROAS:    2.0,
    cpc:        15,
    cps:        18,
    ecr:        0.015,
    aov:        1499,
    ncac:       700,
    minOrders:  5,
  },
  // ─── BB/RS ───────────────────────────────────────────────────────────────────
  'RS': {
    alias: 'RibSupreme / Bare Butter',
    category: 'BB/RS',
    ga4Revenue: 3208,   // 96250 / 30
    spends:     1735,
    ga4ROAS:    1.85,
    cpc:        23,
    cps:        29,
    ecr:        0.015,
    aov:        2299,
    ncac:       800,
    minOrders:  6,
  },
  'BB Str': {
    alias: 'Bare Butter Straight Pants',
    category: 'BB/RS',
    ga4Revenue: 3083,
    spends:     1667,
    ga4ROAS:    1.9,
    cpc:        23,
    cps:        29,
    ecr:        0.015,
    aov:        2500,
    ncac:       850,
    minOrders:  6,
  },
  'BB': {
    alias: 'Bare Butter (generic)',
    category: 'BB/RS',
    ga4Revenue: 2000,
    spends:     1080,
    ga4ROAS:    1.85,
    cpc:        23,
    cps:        29,
    ecr:        0.015,
    aov:        2299,
    ncac:       800,
    minOrders:  4,
  },
  // ─── Menswear ────────────────────────────────────────────────────────────────
  'Men': {
    alias: 'Menswear (all)',
    category: 'Menswear',
    ga4Revenue: 4662,
    spends:     3730,
    ga4ROAS:    1.25,
    cpc:        16,
    cps:        22,
    ecr:        0.020,
    aov:        1999,
    ncac:       800,
    minOrders:  5,
  },
  // ─── PetalRib ────────────────────────────────────────────────────────────────
  'Petal': {
    alias: 'PetalRib (all)',
    category: 'PetalRib',
    ga4Revenue: 1868,
    spends:     1245,
    ga4ROAS:    1.5,
    cpc:        28,
    cps:        33,
    ecr:        0.020,
    aov:        2299,
    ncac:       1500,
    minOrders:  3,
  },
  // ─── Topwear ─────────────────────────────────────────────────────────────────
  'Bra Top': {
    alias: 'Bra Top Collection',
    category: 'Topwear',
    ga4Revenue: 440,
    spends:     294,
    ga4ROAS:    1.5,
    cpc:        20,
    cps:        22,
    ecr:        0.020,
    aov:        999,
    ncac:       500,
    minOrders:  3,
  },
  // ─── Sports Bra ──────────────────────────────────────────────────────────────
  'Sports Bra': {
    alias: 'Sports Bra (all)',
    category: 'Sports Bra',
    ga4Revenue: 694,
    spends:     463,
    ga4ROAS:    1.5,
    cpc:        17,
    cps:        20,
    ecr:        0.020,
    aov:        999,
    ncac:       500,
    minOrders:  3,
  },
  // ─── Swimwear ────────────────────────────────────────────────────────────────
  'SWIM': {
    alias: 'Swimwear',
    category: 'Swimwear',
    ga4Revenue: 927,
    spends:     618,
    ga4ROAS:    1.5,
    cpc:        20,
    cps:        22,
    ecr:        0.020,
    aov:        1999,
    ncac:       800,
    minOrders:  3,
  },
  // ─── Outerwear ───────────────────────────────────────────────────────────────
  'Outerwear': {
    alias: 'Outerwear (all)',
    category: 'Outerwear',
    ga4Revenue: 415,
    spends:     224,
    ga4ROAS:    1.85,
    cpc:        17,
    cps:        19,
    ecr:        0.020,
    aov:        1999,
    ncac:       800,
    minOrders:  2,
  },
  // ─── Innerwear ───────────────────────────────────────────────────────────────
  'IWR': {
    alias: 'Innerwear',
    category: 'Innerwear',
    ga4Revenue: 411,
    spends:     274,
    ga4ROAS:    1.5,
    cpc:        20,
    cps:        22,
    ecr:        0.020,
    aov:        999,
    ncac:       500,
    minOrders:  2,
  },
  // ─── Bliss Terry ─────────────────────────────────────────────────────────────
  'Bliss Terry': {
    alias: 'Bliss Terry',
    category: 'Bliss Terry',
    ga4Revenue: 175,
    spends:     97,
    ga4ROAS:    1.8,
    cpc:        18,
    cps:        20,
    ecr:        0.020,
    aov:        1299,
    ncac:       600,
    minOrders:  2,
  },
  // ─── Common "catch-all" products parsed from creatives ────────────────────────
  'Cloud Korean Pants': { alias: 'Cloud Korean Pants', category: 'Pareto', ga4Revenue: 1491, spends: 806, ga4ROAS: 1.85, cpc: 17, cps: 19, ecr: 0.02, aov: 1299, ncac: 600, minOrders: 5 },
  'Maharani': { alias: 'Maharani Collection', category: 'Rest', ga4Revenue: 570, spends: 308, ga4ROAS: 1.85, cpc: 15, cps: 17, ecr: 0.02, aov: 999, ncac: 500, minOrders: 3 },
  'Everflow': { alias: 'Everflow', category: 'Rest', ga4Revenue: 500, spends: 270, ga4ROAS: 1.85, cpc: 15, cps: 17, ecr: 0.02, aov: 999, ncac: 500, minOrders: 2 },
  'Everflow Tank': { alias: 'Everflow Tank', category: 'Rest', ga4Revenue: 500, spends: 270, ga4ROAS: 1.85, cpc: 15, cps: 17, ecr: 0.02, aov: 999, ncac: 500, minOrders: 2 },
  'Shop All': { alias: 'Shop All', category: 'Rest', ga4Revenue: 800, spends: 432, ga4ROAS: 1.85, cpc: 15, cps: 17, ecr: 0.02, aov: 999, ncac: 500, minOrders: 3 },
  'New Launches': { alias: 'New Launches', category: 'Rest', ga4Revenue: 600, spends: 324, ga4ROAS: 1.85, cpc: 15, cps: 17, ecr: 0.02, aov: 999, ncac: 500, minOrders: 2 },
  'OTG': { alias: 'OTG Straight', category: 'Rest', ga4Revenue: 400, spends: 216, ga4ROAS: 1.85, cpc: 14, cps: 17, ecr: 0.02, aov: 1499, ncac: 800, minOrders: 2 },
  'Travel Collection': { alias: 'Travel Collection', category: 'BB/RS', ga4Revenue: 3000, spends: 1621, ga4ROAS: 1.85, cpc: 23, cps: 29, ecr: 0.015, aov: 2500, ncac: 850, minOrders: 4 },
  'Summer Travel': { alias: 'Summer Travel', category: 'BB/RS', ga4Revenue: 2800, spends: 1513, ga4ROAS: 1.85, cpc: 23, cps: 29, ecr: 0.015, aov: 2299, ncac: 800, minOrders: 4 },
  'Kick Flare Lite': { alias: 'Kick Flare Lite', category: 'Rest', ga4Revenue: 600, spends: 324, ga4ROAS: 1.85, cpc: 15, cps: 17, ecr: 0.02, aov: 999, ncac: 500, minOrders: 3 },
  'LTC 2@1799': { alias: '2 at 1799', category: '5*5 Products', ga4Revenue: 1200, spends: 649, ga4ROAS: 2.5, cpc: 18, cps: 20, ecr: 0.022, aov: 1799, ncac: 600, minOrders: 6 },
  'Color Jan26': { alias: 'Color Jan 26', category: 'Rest', ga4Revenue: 400, spends: 216, ga4ROAS: 1.85, cpc: 15, cps: 17, ecr: 0.02, aov: 999, ncac: 500, minOrders: 2 },
  'AMPM': { alias: 'AMPM Collection', category: 'Pareto', ga4Revenue: 1000, spends: 541, ga4ROAS: 1.85, cpc: 17, cps: 19, ecr: 0.02, aov: 999, ncac: 500, minOrders: 3 },
  'Bestseller': { alias: 'Bestseller', category: 'Rest', ga4Revenue: 500, spends: 270, ga4ROAS: 1.85, cpc: 15, cps: 17, ecr: 0.02, aov: 999, ncac: 500, minOrders: 2 },
  'Blissentials': { alias: 'Blissentials', category: 'Rest', ga4Revenue: 300, spends: 162, ga4ROAS: 1.85, cpc: 15, cps: 17, ecr: 0.02, aov: 999, ncac: 500, minOrders: 2 },
  'RS Col': { alias: 'RS Collection', category: 'BB/RS', ga4Revenue: 2000, spends: 1081, ga4ROAS: 1.85, cpc: 23, cps: 29, ecr: 0.015, aov: 2299, ncac: 800, minOrders: 4 },
  'Everflow Knot': { alias: 'Everflow Knot', category: 'Rest', ga4Revenue: 400, spends: 216, ga4ROAS: 1.85, cpc: 15, cps: 17, ecr: 0.02, aov: 999, ncac: 500, minOrders: 2 },
  'BB Zip': { alias: 'BB Zip', category: 'BB/RS', ga4Revenue: 1500, spends: 811, ga4ROAS: 1.85, cpc: 23, cps: 29, ecr: 0.015, aov: 2299, ncac: 800, minOrders: 3 },
  'Everflow Cape': { alias: 'Everflow Cape', category: 'Rest', ga4Revenue: 300, spends: 162, ga4ROAS: 1.85, cpc: 15, cps: 17, ecr: 0.02, aov: 999, ncac: 500, minOrders: 2 },
  'RS FLP': { alias: 'RS Flare', category: 'BB/RS', ga4Revenue: 2500, spends: 1351, ga4ROAS: 1.85, cpc: 23, cps: 29, ecr: 0.015, aov: 2299, ncac: 800, minOrders: 5 },
  'Shopall': { alias: 'Shop All', category: 'Rest', ga4Revenue: 800, spends: 432, ga4ROAS: 1.85, cpc: 15, cps: 17, ecr: 0.02, aov: 999, ncac: 500, minOrders: 3 },
}

// Lookup: given a parser product name → category name
export function getCategoryForProduct(parserProductName) {
  const t = PRODUCT_TARGETS[parserProductName]
  if (t) return t.category
  // fallback fuzzy match
  const lower = parserProductName.toLowerCase()
  if (lower.includes('ltc') || lower.includes('legging') || lower.includes('flare')) return '5*5 Products'
  if (lower.includes('men') || lower.includes('polo') || lower.includes('legend')) return 'Menswear'
  if (lower.includes('airmelt') || lower.includes('air melt')) return 'Airmelt'
  if (lower.includes('bb') || lower.includes('butter') || lower.includes('ribsupreme') || lower.includes('rs')) return 'BB/RS'
  if (lower.includes('petal') || lower.includes('rib')) return 'PetalRib'
  if (lower.includes('bra') || lower.includes('sports bra')) return 'Sports Bra'
  if (lower.includes('swim')) return 'Swimwear'
  if (lower.includes('terry')) return 'Bliss Terry'
  if (lower.includes('inner') || lower.includes('freedame') || lower.includes('iwr')) return 'Innerwear'
  if (lower.includes('jacket') || lower.includes('hoodie') || lower.includes('outerwear')) return 'Outerwear'
  return 'Rest'
}
