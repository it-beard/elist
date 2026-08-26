import { useCallback, useEffect, useState } from 'react';

/** Маршрут у хэшы: «#/new», «#/r/<id>». Пусты хэш — галоўная (пошук). */
export function useHashRoute() {
  const [hash, setHash] = useState(() => location.hash);
  useEffect(() => {
    const f = () => setHash(location.hash);
    addEventListener('hashchange', f);
    return () => removeEventListener('hashchange', f);
  }, []);
  const [name = '', ...rest] = hash.replace(/^#\/?/, '').split('/');
  const go = useCallback((path) => { location.hash = path ? `#/${path}` : '#/'; scrollTo(0, 0); }, []);
  return { name, arg: decodeURIComponent(rest.join('/')), go };
}

export const href = (path) => (path ? `#/${path}` : '#/');
