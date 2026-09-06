import { useCallback, useMemo } from 'react';
import { useLocalStorage } from './useLocalStorage.js';
import { checkWatchlist, watchTokens } from '../lib/watch.js';
import { search } from '../lib/search.js';

const norm = (q) => q.trim();

/**
 * Захаванае значэнне → спіс запісаў { q, seen, at }. localStorage можна сапсаваць (не масіў, запісы без q,
 * null замест аб'екта) — такое адкідаем, каб адзін чужы ключ не клаў увесь сайт.
 * Міграцыя: у старых зборках id не было, seen мог захавацца як [null, …] — тады seen ачышчаем.
 * Чысты ўваход вяртаецца як ёсць (той самы масіў) — ад гэтага залежыць, што markSeen без зменаў не перарэндэрвае App.
 */
export function sanitizeEntries(raw) {
  if (!Array.isArray(raw)) return [];
  let changed = false;
  const out = [];
  for (const e of raw) {
    if (!e || typeof e !== 'object' || typeof e.q !== 'string') { changed = true; continue; }
    if (Array.isArray(e.seen) && e.seen.every((x) => typeof x === 'string')) out.push(e);
    else { out.push({ ...e, seen: [] }); changed = true; }
  }
  return changed ? out : raw;
}

/** Дадаць запіс, калі такога запыту яшчэ няма (інакш — той самы спіс). */
export const withEntry = (list, entry) => (list.some((e) => e.q === entry.q) ? list : [...list, entry]);

/** Пазначыць супадзенні запыту бачанымі. Нічога не змянілася — вяртае той самы масіў, інакш эфект у App зацыкліцца. */
export function withSeen(list, q, ids) {
  const e = list.find((x) => x.q === q);
  const seen = Array.isArray(e?.seen) ? e.seen : [];
  const same = e && seen.length === ids.length && ids.every((id) => seen.includes(id));
  return !e || same ? list : list.map((x) => (x.q === q ? { ...x, seen: ids } : x));
}

/** Спіс назірання — толькі ў localStorage гэтага браўзера. */
export function useWatchlist(items) {
  const [rawEntries, setRaw] = useLocalStorage('watch', []);
  const entries = useMemo(() => sanitizeEntries(rawEntries), [rawEntries]);
  // абнаўленні заўсёды бачаць чысты спіс: сапсаванае сховішча не кладзе «дадаць» ці «бачана», а лечыцца першым запісам
  const setEntries = useCallback((v) => setRaw((prev) => (typeof v === 'function' ? v(sanitizeEntries(prev)) : v)), [setRaw]);
  const [notify, setNotify] = useLocalStorage('watchNotify', false);

  const checks = useMemo(() => (items ? checkWatchlist(items, entries) : []), [items, entries]);

  const has = useCallback((q) => entries.some((e) => e.q === norm(q)), [entries]);
  /** Дадаць запыт; бягучыя супадзенні адразу лічацца бачанымі. */
  /** Бачанымі лічым тое, што панэль сама знойдзе па гэтым запыце (а не вынікі магчыма састарэлага пошуку). */
  const add = useCallback((q) => {
    const v = norm(q);
    if (!v) return;
    const seen = items ? search(items, watchTokens(v)).map((m) => m.id) : [];
    setEntries((list) => withEntry(list, { q: v, seen, at: new Date().toISOString().slice(0, 10) }));
  }, [setEntries, items]);
  const remove = useCallback((q) => setEntries((list) => list.filter((e) => e.q !== q)), [setEntries]);
  const markSeen = useCallback((q, ids) => setEntries((list) => withSeen(list, q, ids)), [setEntries]);
  const clear = useCallback(() => setEntries([]), [setEntries]);

  return { entries, checks, has, add, remove, markSeen, clear, notify, setNotify };
}
