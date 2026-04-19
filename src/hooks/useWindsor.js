import { useCallback, useState } from 'react';
import { useData } from '../data/store.jsx';

// Vercel serverless functions — same origin, no proxy URL needed
const ENDPOINTS = {
  metaDaily:    '/api/meta-daily',
  metaHourly:   '/api/meta-hourly',
  googleDaily:  '/api/google-campaigns',
  ga4Daily:     '/api/ga4-daily',
};

export function useWindsor() {
  const { loadData } = useData();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastSync, setLastSync] = useState(null);

  const fetchAndLoad = useCallback(async (endpoint, fileType, params = {}) => {
    const url = new URL(endpoint, window.location.origin);
    Object.entries(params).forEach(([k, v]) => v && url.searchParams.set(k, v));
    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`API error ${res.status}`);
    const json = await res.json();
    if (!json.ok) throw new Error(json.error);
    loadData(json.data, fileType, true);
    return true;
  }, [loadData]);

  const syncAll = useCallback(async (dateParams = {}) => {
    setLoading(true); setError(null);
    try {
      await Promise.all([
        fetchAndLoad(ENDPOINTS.metaDaily, 'META_DB', dateParams),
        fetchAndLoad(ENDPOINTS.googleDaily, 'GOOGLE_DUMP', dateParams),
        fetchAndLoad(ENDPOINTS.ga4Daily, 'GA4_DUMP', dateParams),
      ]);
      setLastSync(new Date());
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [fetchAndLoad]);

  const syncMeta = useCallback(async (dateParams = {}) => {
    setLoading(true); setError(null);
    try { await fetchAndLoad(ENDPOINTS.metaDaily, 'META_DB', dateParams); setLastSync(new Date()); }
    catch (e) { setError(e.message); } finally { setLoading(false); }
  }, [fetchAndLoad]);

  const syncMetaHourly = useCallback(async () => {
    setLoading(true); setError(null);
    try { await fetchAndLoad(ENDPOINTS.metaHourly, 'META_HOURLY', {}); setLastSync(new Date()); }
    catch (e) { setError(e.message); } finally { setLoading(false); }
  }, [fetchAndLoad]);

  const syncGoogle = useCallback(async (dateParams = {}) => {
    setLoading(true); setError(null);
    try { await fetchAndLoad(ENDPOINTS.googleDaily, 'GOOGLE_DUMP', dateParams); setLastSync(new Date()); }
    catch (e) { setError(e.message); } finally { setLoading(false); }
  }, [fetchAndLoad]);

  const syncGA4 = useCallback(async (dateParams = {}) => {
    setLoading(true); setError(null);
    try { await fetchAndLoad(ENDPOINTS.ga4Daily, 'GA4_DUMP', dateParams); setLastSync(new Date()); }
    catch (e) { setError(e.message); } finally { setLoading(false); }
  }, [fetchAndLoad]);

  return { loading, error, lastSync, proxyAvailable: true, syncAll, syncMeta, syncMetaHourly, syncGoogle, syncGA4 };
}
