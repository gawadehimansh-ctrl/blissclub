import { useState, useCallback } from 'react'
import { useData } from '../data/store.jsx'
import { parseWindsorPayload } from '../utils/csvParser.js'

// Windsor.ai MCP connector
// Account ID for BlissClub Meta: 584820145452956
const BLISSCLUB_META_ACCOUNT = '584820145452956'

export function useWindsor() {
  const { loadData } = useData()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [lastSync, setLastSync] = useState(null)

  const syncMeta = useCallback(async (dateFrom, dateTo) => {
    setLoading(true)
    setError(null)
    try {
      // Windsor MCP call for Meta ad-level data
      // Fields match BlissClub DB dump structure
      const response = await fetch('/api/windsor/meta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account_id: BLISSCLUB_META_ACCOUNT,
          date_from: dateFrom,
          date_to: dateTo,
          fields: [
            'date', 'ad_name', 'adset_name', 'campaign_name',
            'spend', 'impressions', 'link_clicks',
            'purchase_roas', 'purchases', 'purchase_value',
            'video_3_sec_watched_actions', 'video_thruplay_watched_actions',
            'website_purchase_roas'
          ],
          breakdown: ['age', 'gender', 'placement', 'device_platform']
        })
      })
      if (!response.ok) throw new Error('Windsor API error')
      const raw = await response.json()
      const parsed = parseWindsorPayload(raw.data || [], 'meta')
      loadData(parsed, 'META_DB', false)
      setLastSync(new Date())
      return { success: true, count: parsed.length }
    } catch (e) {
      setError(e.message)
      return { success: false, error: e.message }
    } finally {
      setLoading(false)
    }
  }, [loadData])

  const syncGoogle = useCallback(async (dateFrom, dateTo) => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/windsor/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date_from: dateFrom,
          date_to: dateTo,
          fields: [
            'date', 'campaign_name', 'campaign_id',
            'cost', 'impressions', 'clicks', 'ctr', 'average_cpc',
            'conversions', 'conversion_value', 'roas',
            'search_impression_share', 'search_rank_lost_impression_share'
          ]
        })
      })
      if (!response.ok) throw new Error('Windsor Google API error')
      const raw = await response.json()
      const parsed = parseWindsorPayload(raw.data || [], 'google')
      loadData(parsed, 'GOOGLE_DUMP', false)
      setLastSync(new Date())
      return { success: true, count: parsed.length }
    } catch (e) {
      setError(e.message)
      return { success: false, error: e.message }
    } finally {
      setLoading(false)
    }
  }, [loadData])

  return { syncMeta, syncGoogle, loading, error, lastSync }
}
