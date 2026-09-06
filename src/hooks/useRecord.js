import { useEffect, useState } from 'react';
import { fetchChunk } from '../lib/api.js';

/**
 * Поўны запіс па яго нумары ў індэксе (ленівая загрузка фрагмента). Індэкс і фрагменты звязаныя пазіцыяй,
 * таму калі сайт абнавіўся падчас сесіі (у адкрытай укладцы стары індэкс, а фрагмент ужо новы), id можа
 * не супасці — тады фрагмент бярэцца свежы, а калі і ён не той, вяртаецца { stale: true }: чужы запіс
 * (асабліва чужыя імя, дата нараджэння і адрас) не паказваецца ніколі.
 */
export function useRecord(i, chunkSize, id) {
  const [rec, setRec] = useState(null);
  useEffect(() => {
    let alive = true;
    setRec(null);
    const n = Math.floor(i / chunkSize), k = i % chunkSize;
    fetchChunk(n)
      .then((rows) => {
        const r = rows[k];
        if (!id || r?.id === id) return r;
        return fetchChunk(n, true).then((fresh) => (fresh[k]?.id === id ? fresh[k] : { stale: true }));
      })
      .then((r) => alive && setRec(r ?? { stale: true }))
      .catch((e) => alive && setRec({ error: e.message }));
    return () => { alive = false; };
  }, [i, chunkSize, id]);
  return rec;
}
