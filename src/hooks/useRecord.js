import { useEffect, useState } from 'react';
import { fetchChunk } from '../lib/api.js';

/** Поўны запіс па яго нумары ў індэксе (ленівая загрузка фрагмента). */
export function useRecord(i, chunkSize) {
  const [rec, setRec] = useState(null);
  useEffect(() => {
    let alive = true;
    setRec(null);
    fetchChunk(Math.floor(i / chunkSize))
      .then((rows) => alive && setRec(rows[i % chunkSize]))
      .catch((e) => alive && setRec({ error: e.message }));
    return () => { alive = false; };
  }, [i, chunkSize]);
  return rec;
}
