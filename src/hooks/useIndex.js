import { useEffect, useState } from 'react';
import { fetchIndex, fetchMeta } from '../lib/api.js';

export function useIndex() {
  const [state, setState] = useState({ status: 'loading' });
  useEffect(() => {
    let alive = true;
    Promise.all([fetchMeta(), fetchIndex()])
      .then(([meta, idx]) => alive && setState({ status: 'ready', meta, items: idx.items, chunkSize: idx.chunkSize }))
      .catch((e) => alive && setState({ status: 'error', error: e.message }));
    return () => { alive = false; };
  }, []);
  return state;
}
