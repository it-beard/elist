import { useCallback, useRef, useState } from 'react';

/**
 * Стан, які захоўваецца ў localStorage (толькі налады — нічога асабістага).
 * Запіс робіцца адразу пры выкліку set (не ўнутры апдэйтара React): так яго відаць і па-за рэндэрам,
 * а паслядоўныя функцыянальныя абнаўленні бачаць апошняе значэнне праз ref.
 */
export function useLocalStorage(key, initial) {
  const [value, setValue] = useState(() => {
    try { const v = localStorage.getItem(key); return v === null ? initial : JSON.parse(v); } catch { return initial; }
  });
  const ref = useRef(value);
  const set = useCallback((v) => {
    const next = typeof v === 'function' ? v(ref.current) : v;
    ref.current = next;
    try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* прыватны рэжым і г.д. */ }
    setValue(next);
  }, [key]);
  return [value, set];
}
