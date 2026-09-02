import { useCallback, useEffect, useState } from 'react';
import { parseEntryUrl, rememberQuery } from '../lib/entry.js';

/**
 * Пошукавы запыт. Жыве ў стане і ў history.state укладкі (перажывае перазагрузку),
 * але не ў адрасным радку — каб не заставацца ў гісторыі браўзера і на серверы.
 * Уваходны запыт (?q= / #q=) забірае takeEntryQuery() у main.jsx яшчэ да рэндэру.
 */
export function useQuery() {
  const [value, setValue] = useState(() => history.state?.q ?? '');
  const set = useCallback((v) => { setValue(v); rememberQuery(v); }, []);
  // «#q=…» ужо ў адкрытай укладцы (пошук з адраснага радка браўзера)
  useEffect(() => {
    const f = () => {
      const { q, url } = parseEntryUrl(location.href);
      if (q === null) return;
      history.replaceState({ ...history.state, q }, '', url);
      setValue(q);
    };
    addEventListener('hashchange', f);
    return () => removeEventListener('hashchange', f);
  }, []);
  return [value, set];
}
