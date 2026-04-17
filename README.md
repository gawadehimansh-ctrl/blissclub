# BlissClub Performance Dashboard

React + Vite app. Dark theme. Deploys to Railway.

## Local setup

```bash
npm install
npm run dev
# Opens at http://localhost:3000
```

## Deploy to Railway

1. Push this folder to a GitHub repo
2. New project in Railway → Deploy from GitHub repo
3. Railway auto-detects Dockerfile — no config needed
4. Done. URL is live in ~2 minutes.

## Daily workflow (10 min total)

| Time | Action | Who |
|------|--------|-----|
| 9am | Drop Meta hourly CSV on Upload page | Media buyer |
| 12pm | Drop Meta hourly CSV on Upload page | Media buyer |
| 5pm | Drop Meta hourly CSV on Upload page | Media buyer |
| EOD | Drop GA4 daily export on Upload page | Media buyer |
| 6am auto | Windsor syncs Meta + Google | Automated |

## Data sources

### Auto (Windsor.ai)
- Meta ad-level daily data (account: 584820145452956)
- Google campaign-level data

### Manual drop (CSV)
- **Meta hourly**: Ads Manager → Breakdown: Hourly → Export CSV
- **GA4**: GA4 Explore → Session manual term + Sessions + Transactions + Revenue → Export CSV

## Pages

| Page | What it shows |
|------|--------------|
| Weekly | Combined Meta + Google + GA4 summary, blended ROAS, top products |
| Blended health | True blended CAC/ROAS with CLM toggle, DOD + MoM trends |
| Hourly pulse | Intraday spend pacing, adset CPC delta vs yesterday |
| Meta → Campaigns | Campaign → Adset → Ad drill-down, 1DC vs GA4 ROAS gap |
| Meta → Creative lookback | Product / format / content type / creator pivot |
| Google → Campaigns | 5 account cuts, campaign type breakdown, daily trend |
| Google → Brand vs NB | GA4 brand/NB split, top non-brand terms, MoM trend |

## Key metric definitions

- **1DC ROAS**: Meta-reported, 1-day click window only
- **GA4 ROAS**: GA4 revenue ÷ channel spend — source of truth
- **Gap %**: How much Meta is over-reporting vs GA4
- **Blended ROAS**: GA4 total revenue ÷ all paid spend (Meta + Google ± CLM/UAC)
- **Blended CAC**: Total paid spend ÷ GA4 orders
