import { useCallback, useEffect, useState } from 'react';
import { fetchIndex, fetchMeta } from '../lib/api.js';

export function useIndex() {
  const [state, setState] = useState({ status: 'loading' });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    const fresh = tick > 0;
    if (fresh) setState((s) => ({ ...s, refreshing: true }));
    Promise.all([fetchMeta(fresh), fetchIndex(fresh)])
      .then(([meta, idx]) => alive && setState({ status: 'ready', meta, items: idx.items, chunkSize: idx.chunkSize, checkedAt: Date.now() }))
      .catch((e) => alive && setState((s) => (s.status === 'ready' ? { ...s, refreshing: false, refreshError: e.message } : { status: 'error', error: e.message })));
    return () => { alive = false; };
  }, [tick]);
  const reload = useCallback(() => setTick((n) => n + 1), []);
  return { ...state, reload };
}
