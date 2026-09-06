import { isRecent } from './format.js';
import { search, countByList } from './search.js';

export const FALLBACK = 60;

/**
 * Старонка «Новае», чыстая логіка. Дадаліся / зніклі за апошнія NEW_DAYS дзён (тое ж акно, што і лічыльнік
 * на ўкладцы); старыя версіі выпраўленых запісаў (replacedBy) не ўлічваюцца. Пакуль у базе няма гісторыі
 * з’яўлення (added) — fallback: апошнія FALLBACK запісаў па даце рашэння.
 */
export function splitNew(items = []) {
  const added = [], removed = [];
  for (const it of items) {
    if (it.replacedBy) continue;
    if (isRecent(it.added)) added.push(it);
    if (isRecent(it.removed)) removed.push(it);
  }
  removed.sort((a, b) => (b.removed || '').localeCompare(a.removed || ''));
  const fallback = items.some((it) => it.added) ? null : search(items, [], { sort: 'newest' }).slice(0, FALLBACK);
  return { added, removed, fallback };
}

/** Абмежаваць спісам ('' — усе). */
export const inList = (arr, list) => (list ? arr.filter((it) => (it.list || 'm') === list) : arr);

/** Групы па даце з’яўлення, найноўшыя спачатку; у групе — у зваротным парадку індэкса. */
export function groupByDate(added, list = '') {
  const byDate = new Map();
  for (const it of inList(added, list)) (byDate.get(it.added) || byDate.set(it.added, []).get(it.added)).push(it);
  return [...byDate.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([d, l]) => [d, l.sort((a, b) => b.i - a.i)]);
}

/** Лічбы на ўкладках для дададзеных і зніклых. */
export const newCounts = ({ added, removed }) => ({ added: countByList(added), removed: countByList(removed) });
