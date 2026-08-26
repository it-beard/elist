import { useCallback, useMemo } from 'react';
import { useLocalStorage } from './useLocalStorage.js';
import { checkWatchlist } from '../lib/watch.js';

const norm = (q) => q.trim();

/** Сьпіс назіраньня — толькі ў localStorage гэтага браўзэра. */
export function useWatchlist(items) {
  const [entries, setEntries] = useLocalStorage('watch', []);
  const [notify, setNotify] = useLocalStorage('watchNotify', false);

  const checks = useMemo(() => (items ? checkWatchlist(items, entries) : []), [items, entries]);

  const has = useCallback((q) => entries.some((e) => e.q === norm(q)), [entries]);
  /** Дадаць запыт; бягучыя супадзеньні адразу лічацца бачанымі. */
  const add = useCallback((q, seenIds = []) => {
    const v = norm(q);
    if (!v) return;
    setEntries((list) => (list.some((e) => e.q === v) ? list : [...list, { q: v, seen: seenIds, at: new Date().toISOString().slice(0, 10) }]));
  }, [setEntries]);
  const remove = useCallback((q) => setEntries((list) => list.filter((e) => e.q !== q)), [setEntries]);
  const markSeen = useCallback((q, ids) => setEntries((list) => list.map((e) => (e.q === q ? { ...e, seen: ids } : e))), [setEntries]);
  const clear = useCallback(() => setEntries([]), [setEntries]);

  return { entries, checks, has, add, remove, markSeen, clear, notify, setNotify };
}
