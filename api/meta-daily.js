export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
 
  const API_KEY = process.env.WINDSOR_API_KEY;
  if (!API_KEY) return res.status(500).json({ ok: false, error: 'WINDSOR_API_KEY not set' });
 
  const { date_from, date_to, date_preset = 'this_monthT' } = req.query;
 
  const fields = [
    'date','campaign','adset_name','ad_name',
    'spend','impressions','clicks','link_clicks',
    'cpc','cpm','ctr','reach','frequency',
    'actions_purchase','action_values_purchase',
    'actions_landing_page_view',
  ].join(',');
 
  const url = new URL('https://connectors.windsor.ai/facebook');
  url.searchParams.set('api_key', API_KEY);
  url.searchParams.set('account_id', '584820145452956');
  url.searchParams.set('fields', fields);
  url.searchParams.set('attribution_window', '1d_click');
  if (date_from) url.searchParams.set('date_from', date_from);
  if (date_to) url.searchParams.set('date_to', date_to);
  if (!date_from) url.searchParams.set('date_preset', date_preset);
 
  try {
    const r = await fetch(url.toString());
    const json = await r.json();
    res.status(200).json({ ok: true, data: json.data || json });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
}
