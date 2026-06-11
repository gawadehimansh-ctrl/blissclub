// ── Rubans Jewellery — Pacing Targets ────────────────────────────────────────

export const PACING_CONFIG = {
  month:      'June 2026',
  startDate:  '2026-06-01',
  totalDays:  30,
}

export const DELTA_OK   = 0.10  // within 10% = OK
export const DELTA_WARN = 0.20  // within 20% = warn

// ── Category structure ────────────────────────────────────────────────────────
// Main categories: Ethnic, Western, Demifine
// Sub-categories per category:
//   Ethnic:   Bangles, Jewellery Sets, Necklace & Chains, Earrings, Bracelet
//   Western:  Bangles, Jewellery Sets, Necklace & Chains, Earrings, Bracelet
//   Demifine: Jewellery Sets, Necklace & Chains, Earrings, Bracelet  (no Bangles)

export const CATEGORY_TARGETS = [
  {
    category: 'Ethnic',
    revenueTarget:  3000000,  // ₹30L/month placeholder
    spendTarget:    1500000,
    roasTarget:     2.0,
    cpcTarget:      15,
    crTarget:       0.02,
    color:          '#e8457a',
    products: ['Bangles', 'Jewellery Sets', 'Necklace & Chains', 'Earrings', 'Bracelet'],
  },
  {
    category: 'Western',
    revenueTarget:  2000000,
    spendTarget:    1000000,
    roasTarget:     2.0,
    cpcTarget:      15,
    crTarget:       0.02,
    color:          '#6366f1',
    products: ['Bangles', 'Jewellery Sets', 'Necklace & Chains', 'Earrings', 'Bracelet'],
  },
  {
    category: 'Demifine',
    revenueTarget:  1500000,
    spendTarget:    700000,
    roasTarget:     2.15,
    cpcTarget:      20,
    crTarget:       0.015,
    color:          '#f59e0b',
    products: ['Jewellery Sets', 'Necklace & Chains', 'Earrings', 'Bracelet'],
  },
]

export const PRODUCT_TARGETS = {}
for (const cat of CATEGORY_TARGETS) {
  for (const prod of cat.products) {
    PRODUCT_TARGETS[`${cat.category}__${prod}`] = {
      category:      cat.category,
      product:       prod,
      roasTarget:    cat.roasTarget,
      cpcTarget:     cat.cpcTarget,
      crTarget:      cat.crTarget,
      revenueTarget: cat.revenueTarget / cat.products.length,
      spendTarget:   cat.spendTarget / cat.products.length,
    }
  }
}

export function getCategoryForProduct(productName) {
  if (!productName) return null
  const p = productName.toLowerCase()
  if (p.includes('ethnic'))   return 'Ethnic'
  if (p.includes('western'))  return 'Western'
  if (p.includes('demifine')) return 'Demifine'
  // Sub-category matching
  if (p.includes('bangle'))   return 'Ethnic'
  if (p.includes('earring'))  return 'Ethnic'
  if (p.includes('necklace') || p.includes('chain')) return 'Western'
  if (p.includes('bracelet')) return 'Western'
  if (p.includes('set'))      return 'Ethnic'
  return 'Other'
}
