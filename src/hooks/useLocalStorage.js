import { useCallback, useState } from 'react';

/** Стан, які захоўваецца ў localStorage (толькі налады — нічога асабістага). */
export function useLocalStorage(key, initial) {
  const [value, setValue] = useState(() => {
    try { const v = localStorage.getItem(key); return v === null ? initial : JSON.parse(v); } catch { return initial; }
  });
  const set = useCallback((v) => {
    setValue((prev) => {
      const next = typeof v === 'function' ? v(prev) : v;
      try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* прыватны рэжым і г.д. */ }
      return next;
    });
  }, [key]);
  return [value, set];
}
