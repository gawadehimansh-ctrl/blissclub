// Daily targets — Meta GA4 tracked revenue only
// Source: Blissclub Dashboard Metrics.xlsx + category sheet shared 19 Apr
// All values are DAILY benchmarks

export const CATEGORY_TARGETS = [
  {
    id: "5star",
    name: "5*5 Products",
    spendMixPct: 45.89,
    ga4Revenue: 768166.08,
    spends: 436458,
    ga4Roas: 1.76,
    cpc: 14.14,
    cps: 17,
    linkClicks: 30867,
    sessions: 25674,
    revenueMixPct: 47.46,
    products: [
      { name: "Ultimate Flare Pants - Lite", alias: "LTC Flare", spendPct: 18, ga4Revenue: 138270, spends: 78562, ga4Roas: 1.76, cpc: 13.5, cps: 16, sessions: 9242 },
      { name: "Ultimate Straight Pants - Lite", alias: "LTC USP", spendPct: 16, ga4Revenue: 122906, spends: 69833, ga4Roas: 1.76, cpc: 14.0, cps: 17, sessions: 8215 },
      { name: "The Ultimate Flare Pants", alias: "LTC Wide", spendPct: 12, ga4Revenue: 92180, spends: 52375, ga4Roas: 1.76, cpc: 14.5, cps: 17, sessions: 6161 },
      { name: "Ultimate Leggings - Lite", alias: "LTC Leg Lite", spendPct: 10, ga4Revenue: 76817, spends: 43646, ga4Roas: 1.76, cpc: 14.0, cps: 17, sessions: 5135 },
      { name: "The Ultimate Leggings", alias: "LTC Leg", spendPct: 8, ga4Revenue: 61453, spends: 34917, ga4Roas: 1.76, cpc: 14.5, cps: 17, sessions: 4108 },
      { name: "Ultimate Straight Pants", alias: "LTC USP Full", spendPct: 7, ga4Revenue: 53772, spends: 30552, ga4Roas: 1.76, cpc: 14.0, cps: 17, sessions: 3594 },
      { name: "Absolute Invisible Bra", alias: "AIB", spendPct: 7, ga4Revenue: 53772, spends: 30552, ga4Roas: 1.76, cpc: 14.5, cps: 17, sessions: 3594 },
    ]
  },
  {
    id: "pareto",
    name: "Pareto",
    spendMixPct: 5.11,
    ga4Revenue: 89904.65,
    spends: 48597,
    ga4Roas: 1.85,
    cpc: 17,
    cps: 19,
    linkClicks: 2859,
    sessions: 2558,
    revenueMixPct: 5.55,
    products: [
      { name: "Pareto Hero Products", alias: "Pareto", spendPct: 100, ga4Revenue: 89904.65, spends: 48597, ga4Roas: 1.85, cpc: 17, cps: 19, sessions: 2558 },
    ]
  },
  {
    id: "airmelt",
    name: "Airmelt",
    spendMixPct: 4.57,
    ga4Revenue: 82539.05,
    spends: 43442,
    ga4Roas: 1.9,
    cpc: 15,
    cps: 18,
    linkClicks: 2896,
    sessions: 2413,
    revenueMixPct: 5.10,
    products: [
      { name: "Airmelt Collection", alias: "Airmelt", spendPct: 100, ga4Revenue: 82539.05, spends: 43442, ga4Roas: 1.9, cpc: 15, cps: 18, sessions: 2413 },
    ]
  },
  {
    id: "outerwear",
    name: "Outerwear",
    spendMixPct: 0.71,
    ga4Revenue: 12442.1,
    spends: 6725,
    ga4Roas: 1.85,
    cpc: 17,
    cps: 19,
    linkClicks: 396,
    sessions: 354,
    revenueMixPct: 0.77,
    products: [
      { name: "Outerwear", alias: "Outerwear", spendPct: 100, ga4Revenue: 12442.1, spends: 6725, ga4Roas: 1.85, cpc: 17, cps: 19, sessions: 354 },
    ]
  },
  {
    id: "rest",
    name: "Rest",
    spendMixPct: 9.73,
    ga4Revenue: 171285.4,
    spends: 92587,
    ga4Roas: 1.85,
    cpc: 15,
    cps: 17,
    linkClicks: 6172,
    sessions: 5446,
    revenueMixPct: 10.58,
    products: [
      { name: "Rest of Catalogue", alias: "Rest", spendPct: 100, ga4Revenue: 171285.4, spends: 92587, ga4Roas: 1.85, cpc: 15, cps: 17, sessions: 5446 },
    ]
  },
  {
    id: "sportsbra",
    name: "Sports Bra",
    spendMixPct: 1.46,
    ga4Revenue: 20829.6,
    spends: 13886,
    ga4Roas: 1.5,
    cpc: 17,
    cps: 20,
    linkClicks: 817,
    sessions: 694,
    revenueMixPct: 1.29,
    products: [
      { name: "Sports Bra", alias: "Sports Bra", spendPct: 100, ga4Revenue: 20829.6, spends: 13886, ga4Roas: 1.5, cpc: 17, cps: 20, sessions: 694 },
    ]
  },
  {
    id: "bbrs",
    name: "BB/RS",
    spendMixPct: 10.94,
    ga4Revenue: 192500,
    spends: 104054,
    ga4Roas: 1.85,
    cpc: 23,
    cps: 29,
    linkClicks: 4524,
    sessions: 3588,
    revenueMixPct: 11.89,
    products: [
      { name: "Bare Butter / Regular Shorts", alias: "BB/RS", spendPct: 100, ga4Revenue: 192500, spends: 104054, ga4Roas: 1.85, cpc: 23, cps: 29, sessions: 3588 },
    ]
  },
  {
    id: "swimwear",
    name: "Swimwear",
    spendMixPct: 1.95,
    ga4Revenue: 27812.4,
    spends: 18542,
    ga4Roas: 1.5,
    cpc: 20,
    cps: 22,
    linkClicks: 927,
    sessions: 843,
    revenueMixPct: 1.72,
    products: [
      { name: "Swimwear", alias: "Swimwear", spendPct: 100, ga4Revenue: 27812.4, spends: 18542, ga4Roas: 1.5, cpc: 20, cps: 22, sessions: 843 },
    ]
  },
  {
    id: "topwear",
    name: "Topwear",
    spendMixPct: 2.78,
    ga4Revenue: 39655,
    spends: 26437,
    ga4Roas: 1.5,
    cpc: 20,
    cps: 22,
    linkClicks: 1322,
    sessions: 1202,
    revenueMixPct: 2.45,
    products: [
      { name: "Topwear", alias: "Topwear", spendPct: 100, ga4Revenue: 39655, spends: 26437, ga4Roas: 1.5, cpc: 20, cps: 22, sessions: 1202 },
    ]
  },
  {
    id: "petalrib",
    name: "PetalRib",
    spendMixPct: 3.93,
    ga4Revenue: 56033.45,
    spends: 37356,
    ga4Roas: 1.5,
    cpc: 28,
    cps: 33,
    linkClicks: 1334,
    sessions: 1132,
    revenueMixPct: 3.46,
    products: [
      { name: "PetalRib Collection", alias: "PetalRib", spendPct: 100, ga4Revenue: 56033.45, spends: 37356, ga4Roas: 1.5, cpc: 28, cps: 33, sessions: 1132 },
    ]
  },
  {
    id: "innerwear",
    name: "Innerwear",
    spendMixPct: 0.86,
    ga4Revenue: 12324.95,
    spends: 8217,
    ga4Roas: 1.5,
    cpc: 20,
    cps: 22,
    linkClicks: 411,
    sessions: 373,
    revenueMixPct: 0.76,
    products: [
      { name: "Innerwear", alias: "Innerwear", spendPct: 100, ga4Revenue: 12324.95, spends: 8217, ga4Roas: 1.5, cpc: 20, cps: 22, sessions: 373 },
    ]
  },
  {
    id: "blissterry",
    name: "Bliss Terry",
    spendMixPct: 0.31,
    ga4Revenue: 5249.75,
    spends: 2917,
    ga4Roas: 1.8,
    cpc: 18,
    cps: 20,
    linkClicks: 162,
    sessions: 146,
    revenueMixPct: 0.32,
    products: [
      { name: "Bliss Terry", alias: "Bliss Terry", spendPct: 100, ga4Revenue: 5249.75, spends: 2917, ga4Roas: 1.8, cpc: 18, cps: 20, sessions: 146 },
    ]
  },
  {
    id: "menswear",
    name: "Menswear",
    spendMixPct: 11.76,
    ga4Revenue: 139867.75,
    spends: 111894,
    ga4Roas: 1.25,
    cpc: 16,
    cps: 22,
    linkClicks: 6993,
    sessions: 5086,
    revenueMixPct: 8.64,
    products: [
      { name: "Menswear", alias: "Menswear", spendPct: 100, ga4Revenue: 139867.75, spends: 111894, ga4Roas: 1.25, cpc: 16, cps: 22, sessions: 5086 },
    ]
  },
];

export const ACCOUNT_TOTALS = {
  ga4Revenue: 1618610.18,
  spends: 951111,
  ga4Roas: 1.7018107,
  cpc: 15.94,
  cps: 19,
  linkClicks: 59680,
  sessions: 49510,
};

// Breakpoint chain order: CPC → CPLPV → Sessions → CR%
// Tolerance: 20% delta before flagging as broken
export const BREAKPOINT_TOLERANCE = 0.20;
export const BREAKPOINT_CHAIN = ['cpc', 'cplpv', 'sessions', 'crPct'];
