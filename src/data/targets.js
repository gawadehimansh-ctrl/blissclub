// Daily targets — Rubans
// All figures are DAILY

export const DELTA_OK   = 0.90
export const DELTA_WARN = 0.75

export const PACING_CONFIG = {
  month:     'June 2026',
  totalDays: 30,
  startDate: '2026-06-01',
  endDate:   '2026-06-30',
}

export const CATEGORY_TARGETS = {
  'Ethnic': {
    ga4Revenue: 10000,
    nr:         15000,
    spends:     5000,
    ga4ROAS:    2.0,
    cpc:        15,
    cps:        18,
    ecr:        0.020,
    spendMix:   0.30,
  },
  'Western': {
    ga4Revenue: 8000,
    nr:         12000,
    spends:     4000,
    ga4ROAS:    2.0,
    cpc:        15,
    cps:        18,
    ecr:        0.020,
    spendMix:   0.25,
  },
  'Demifine': {
    ga4Revenue: 6000,
    nr:         9000,
    spends:     3000,
    ga4ROAS:    2.0,
    cpc:        15,
    cps:        18,
    ecr:        0.020,
    spendMix:   0.20,
  },
  'Silver': {
    ga4Revenue: 4000,
    nr:         6000,
    spends:     2000,
    ga4ROAS:    2.0,
    cpc:        15,
    cps:        18,
    ecr:        0.020,
    spendMix:   0.15,
  },
}

export const PRODUCT_TARGETS = {
  // ── Ethnic ──────────────────────────────────────────────────────────────────
  'Ethnic - Jewellery Sets': {
    alias:      'Jewellery Sets',
    category:   'Ethnic',
    ga4Revenue: 3000, spends: 1500, ga4ROAS: 2.0,
    cpc: 15, cps: 18, ecr: 0.020, aov: 1500, ncac: 700, minOrders: 5,
  },
  'Ethnic - Bangles': {
    alias:      'Bangles',
    category:   'Ethnic',
    ga4Revenue: 2500, spends: 1250, ga4ROAS: 2.0,
    cpc: 15, cps: 18, ecr: 0.020, aov: 1200, ncac: 600, minOrders: 4,
  },
  'Ethnic - Earrings': {
    alias:      'Earrings',
    category:   'Ethnic',
    ga4Revenue: 2000, spends: 1000, ga4ROAS: 2.0,
    cpc: 14, cps: 17, ecr: 0.020, aov: 1000, ncac: 500, minOrders: 4,
  },
  'Ethnic - N&C': {
    alias:      'Necklace & Chains',
    category:   'Ethnic',
    ga4Revenue: 1500, spends: 750, ga4ROAS: 2.0,
    cpc: 14, cps: 17, ecr: 0.020, aov: 1200, ncac: 600, minOrders: 3,
  },
  'Ethnic - Rings': {
    alias:      'Rings',
    category:   'Ethnic',
    ga4Revenue: 1000, spends: 500, ga4ROAS: 2.0,
    cpc: 13, cps: 16, ecr: 0.020, aov: 800, ncac: 400, minOrders: 2,
  },

  // ── Western ──────────────────────────────────────────────────────────────────
  'Western - Jewellery Sets': {
    alias:      'Jewellery Sets',
    category:   'Western',
    ga4Revenue: 2500, spends: 1250, ga4ROAS: 2.0,
    cpc: 15, cps: 18, ecr: 0.020, aov: 1500, ncac: 700, minOrders: 4,
  },
  'Western - Bangles': {
    alias:      'Bangles',
    category:   'Western',
    ga4Revenue: 2000, spends: 1000, ga4ROAS: 2.0,
    cpc: 15, cps: 18, ecr: 0.020, aov: 1200, ncac: 600, minOrders: 3,
  },
  'Western - Earrings': {
    alias:      'Earrings',
    category:   'Western',
    ga4Revenue: 1800, spends: 900, ga4ROAS: 2.0,
    cpc: 14, cps: 17, ecr: 0.020, aov: 1000, ncac: 500, minOrders: 3,
  },
  'Western - N&C': {
    alias:      'Necklace & Chains',
    category:   'Western',
    ga4Revenue: 1200, spends: 600, ga4ROAS: 2.0,
    cpc: 14, cps: 17, ecr: 0.020, aov: 1200, ncac: 600, minOrders: 2,
  },
  'Western - Rings': {
    alias:      'Rings',
    category:   'Western',
    ga4Revenue: 500, spends: 250, ga4ROAS: 2.0,
    cpc: 13, cps: 16, ecr: 0.020, aov: 800, ncac: 400, minOrders: 1,
  },

  // ── Demifine (no Bangles) ────────────────────────────────────────────────────
  'Demifine - Jewellery Sets': {
    alias:      'Jewellery Sets',
    category:   'Demifine',
    ga4Revenue: 2000, spends: 1000, ga4ROAS: 2.0,
    cpc: 15, cps: 18, ecr: 0.020, aov: 2000, ncac: 900, minOrders: 3,
  },
  'Demifine - Earrings': {
    alias:      'Earrings',
    category:   'Demifine',
    ga4Revenue: 1800, spends: 900, ga4ROAS: 2.0,
    cpc: 14, cps: 17, ecr: 0.020, aov: 1500, ncac: 700, minOrders: 3,
  },
  'Demifine - N&C': {
    alias:      'Necklace & Chains',
    category:   'Demifine',
    ga4Revenue: 1200, spends: 600, ga4ROAS: 2.0,
    cpc: 14, cps: 17, ecr: 0.020, aov: 1800, ncac: 800, minOrders: 2,
  },
  'Demifine - Rings': {
    alias:      'Rings',
    category:   'Demifine',
    ga4Revenue: 1000, spends: 500, ga4ROAS: 2.0,
    cpc: 13, cps: 16, ecr: 0.020, aov: 1200, ncac: 600, minOrders: 2,
  },

  // ── Silver ──────────────────────────────────────────────────────────────────
  'Silver - Jewellery Sets': {
    alias:      'Jewellery Sets',
    category:   'Silver',
    ga4Revenue: 1200, spends: 600, ga4ROAS: 2.0,
    cpc: 14, cps: 17, ecr: 0.020, aov: 1500, ncac: 700, minOrders: 2,
  },
  'Silver - Bangles': {
    alias:      'Bangles',
    category:   'Silver',
    ga4Revenue: 1000, spends: 500, ga4ROAS: 2.0,
    cpc: 14, cps: 17, ecr: 0.020, aov: 1000, ncac: 500, minOrders: 2,
  },
  'Silver - Earrings': {
    alias:      'Earrings',
    category:   'Silver',
    ga4Revenue: 900, spends: 450, ga4ROAS: 2.0,
    cpc: 13, cps: 16, ecr: 0.020, aov: 800, ncac: 400, minOrders: 2,
  },
  'Silver - N&C': {
    alias:      'Necklace & Chains',
    category:   'Silver',
    ga4Revenue: 600, spends: 300, ga4ROAS: 2.0,
    cpc: 13, cps: 16, ecr: 0.020, aov: 1000, ncac: 500, minOrders: 1,
  },
  'Silver - Rings': {
    alias:      'Rings',
    category:   'Silver',
    ga4Revenue: 300, spends: 150, ga4ROAS: 2.0,
    cpc: 12, cps: 15, ecr: 0.020, aov: 600, ncac: 300, minOrders: 1,
  },
}

export const BREAKPOINT_CHAIN = ['spend', 'cpc', 'cps', 'sessions', 'crPct', 'orders']

export function getCategoryForProduct(parserProductName) {
  const t = PRODUCT_TARGETS[parserProductName]
  if (t) return t.category
  const lower = parserProductName.toLowerCase()
  if (lower.includes('ethnic'))   return 'Ethnic'
  if (lower.includes('western'))  return 'Western'
  if (lower.includes('demifine')) return 'Demifine'
  if (lower.includes('silver'))   return 'Silver'
  return 'Ethnic'
}
