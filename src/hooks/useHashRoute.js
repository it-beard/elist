import { useCallback, useEffect, useState } from 'react';

/**
 * «#/new» → { name: 'new' }, «#/r/<id>» → { name: 'r', arg: id }, «#/stats/f» → { name: 'stats', arg: 'f' }. Пусты хэш і «#q=…»
 * (запыт з адраснага радка, яго забірае useQuery) — галоўная. Сапсаваная кадоўка не кідае выключэння.
 */
export function parseHash(hash) {
  const [name = '', ...rest] = hash.replace(/^#\/?/, '').split('/');
  let arg = rest.join('/');
  try { arg = decodeURIComponent(arg); } catch { /* пакідаем як ёсць */ }
  return { name: /^q=/.test(name) ? '' : name, arg };
}

/** Маршрут у хэшы: «#/new», «#/r/<id>». Пусты хэш — галоўная (пошук). */
export function useHashRoute() {
  const [hash, setHash] = useState(() => location.hash);
  useEffect(() => {
    const f = () => setHash(location.hash);
    addEventListener('hashchange', f);
    return () => removeEventListener('hashchange', f);
  }, []);
  const { name, arg } = parseHash(hash);
  const go = useCallback((path) => { location.hash = path ? `#/${path}` : '#/'; scrollTo(0, 0); }, []);
  return { name, arg, go };
}

export const href = (path) => (path ? `#/${path}` : '#/');
