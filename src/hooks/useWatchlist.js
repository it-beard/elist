import { useCallback, useMemo } from 'react';
import { useLocalStorage } from './useLocalStorage.js';
import { checkWatchlist, watchTokens } from '../lib/watch.js';
import { search } from '../lib/search.js';

const norm = (q) => q.trim();

/** Спіс назірання — толькі ў localStorage гэтага браўзера. */
export function useWatchlist(items) {
  const [rawEntries, setEntries] = useLocalStorage('watch', []);
  // міграцыя: у старых зборках id не было, seen мог захавацца як [null, …]
  const entries = useMemo(() => rawEntries.map((e) => (Array.isArray(e.seen) && e.seen.every((x) => typeof x === 'string') ? e : { ...e, seen: [] })), [rawEntries]);
  const [notify, setNotify] = useLocalStorage('watchNotify', false);

  const checks = useMemo(() => (items ? checkWatchlist(items, entries) : []), [items, entries]);

  const has = useCallback((q) => entries.some((e) => e.q === norm(q)), [entries]);
  /** Дадаць запыт; бягучыя супадзенні адразу лічацца бачанымі. */
  /** Бачанымі лічым тое, што панэль сама знойдзе па гэтым запыце (а не вынікі магчыма састарэлага пошуку). */
  const add = useCallback((q) => {
    const v = norm(q);
    if (!v) return;
    const seen = items ? search(items, watchTokens(v)).map((m) => m.id) : [];
    setEntries((list) => (list.some((e) => e.q === v) ? list : [...list, { q: v, seen, at: new Date().toISOString().slice(0, 10) }]));
  }, [setEntries, items]);
  const remove = useCallback((q) => setEntries((list) => list.filter((e) => e.q !== q)), [setEntries]);
  const markSeen = useCallback((q, ids) => setEntries((list) => {
    const e = list.find((x) => x.q === q);
    const seen = Array.isArray(e?.seen) ? e.seen : [];
    const same = e && seen.length === ids.length && ids.every((id) => seen.includes(id));
    // нічога не змянілася — вяртаем той самы масіў, інакш эфект у App зацыкліцца
    return !e || same ? list : list.map((x) => (x.q === q ? { ...x, seen: ids } : x));
  }), [setEntries]);
  const clear = useCallback(() => setEntries([]), [setEntries]);

  return { entries, checks, has, add, remove, markSeen, clear, notify, setNotify };
}
