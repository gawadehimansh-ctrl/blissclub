import React, { useMemo } from 'react'
import { useData } from '../data/store.jsx'
import CoPilot from '../components/CoPilot.jsx'
import { aggregateRows } from '../utils/metrics.js'
import { fmtINRCompact, fmtX, fmtPct, fmtNum } from '../utils/formatters.js'

export default function CoPilotPage() {
  const { state } = useData()

  // Build rich full-dashboard context for the co-pilot page
  const dashData = useMemo(() => {
    const metaRows = state.metaDB || []
    const googleRows = state.googleDump || []
    const ga4Rows = state.ga4Dump || []
    const meta = aggregateRows(metaRows)

    const googleSpend = googleRows.reduce((s,r) => s+r.cost, 0)
    const googleRev = googleRows.reduce((s,r) => s+r.revenue, 0)
    const ga4Rev = ga4Rows.reduce((s,r) => s+r.revenue, 0)
    const ga4Orders = ga4Rows.reduce((s,r) => s+r.transactions, 0)
    const ga4Sessions = ga4Rows.reduce((s,r) => s+r.sessions, 0)
    const totalSpend = meta.spend + googleSpend

    // Top products by meta spend
    const byProduct = {}
    for (const r of metaRows) {
      const p = r.product || 'Other'
      if (!byProduct[p]) byProduct[p] = { spend: 0, gaRevenue: 0, gaOrders: 0 }
      byProduct[p].spend += r.spend
      byProduct[p].gaRevenue += r.gaRevenue
      byProduct[p].gaOrders += r.gaOrders
    }
    const topProducts = Object.entries(byProduct)
      .map(([name, v]) => ({ name, ...v, roas: v.spend > 0 ? v.gaRevenue / v.spend : 0 }))
      .sort((a,b) => b.spend - a.spend).slice(0, 10)

    // Top campaigns by spend
    const byCampaign = {}
    for (const r of metaRows) {
      const c = r.campaignName || 'Unknown'
      if (!byCampaign[c]) byCampaign[c] = { spend: 0, gaRevenue: 0, impressions: 0, clicks: 0 }
      byCampaign[c].spend += r.spend
      byCampaign[c].gaRevenue += r.gaRevenue
      byCampaign[c].impressions += r.impressions
      byCampaign[c].clicks += r.clicks
    }
    const topCampaigns = Object.entries(byCampaign)
      .map(([name, v]) => ({ name, ...v, roas: v.spend > 0 ? v.gaRevenue / v.spend : 0, ctr: v.impressions > 0 ? v.clicks / v.impressions : 0 }))
      .sort((a,b) => b.spend - a.spend).slice(0, 8)

    return {
      period: 'Last 7 days (default)',
      dataAvailability: {
        metaRows: metaRows.length,
        googleRows: googleRows.length,
        ga4Rows: ga4Rows.length,
      },
      blended: {
        totalSpend: fmtINRCompact(totalSpend),
        ga4Revenue: fmtINRCompact(ga4Rev),
        blendedROAS: fmtX(totalSpend > 0 ? ga4Rev / totalSpend : 0),
        blendedCAC: fmtINRCompact(ga4Orders > 0 ? totalSpend / ga4Orders : 0),
        ga4Orders: fmtNum(ga4Orders),
        ga4Sessions: fmtNum(ga4Sessions),
        cvr: fmtPct(ga4Sessions > 0 ? ga4Orders / ga4Sessions : 0),
      },
      meta: {
        spend: fmtINRCompact(meta.spend),
        ga4ROAS: fmtX(meta.roasGA4 || 0),
        reported1DCROAS: fmtX(meta.roas1DC || 0),
        cpa: fmtINRCompact(meta.cpa || 0),
        ctr: fmtPct(meta.ctr || 0),
        cpm: fmtINRCompact(meta.cpm || 0),
        cpc: fmtINRCompact(meta.cpc || 0),
        orders: fmtNum(meta.gaOrders || 0),
        impressions: fmtNum(meta.impressions || 0),
      },
      google: {
        spend: fmtINRCompact(googleSpend),
        revenue: fmtINRCompact(googleRev),
        roas: fmtX(googleSpend > 0 ? googleRev / googleSpend : 0),
        impressions: fmtNum(googleRows.reduce((s,r) => s+r.impressions, 0)),
        clicks: fmtNum(googleRows.reduce((s,r) => s+r.clicks, 0)),
        orders: fmtNum(googleRows.reduce((s,r) => s+r.transactions, 0)),
      },
      topProductsBySpend: topProducts.map(p => ({
        product: p.name,
        spend: fmtINRCompact(p.spend),
        revenue: fmtINRCompact(p.gaRevenue),
        roas: fmtX(p.roas),
        orders: fmtNum(p.gaOrders),
      })),
      topMetaCampaigns: topCampaigns.map(c => ({
        campaign: c.name,
        spend: fmtINRCompact(c.spend),
        revenue: fmtINRCompact(c.gaRevenue),
        roas: fmtX(c.roas),
        ctr: fmtPct(c.ctr),
      })),
    }
  }, [state])

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <CoPilot dashData={dashData} fullscreen={true} />
    </div>
  )
}
