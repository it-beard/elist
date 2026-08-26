import { isRecent } from './format.js';

/** Фільтруе і сартуе запісы індэкса. Кожны item мае: i, date, added, removed, h (радок для пошуку). */
export function search(items, tokens, { any = false, onlyNew = false, sort = 'source' } = {}) {
  const hit = tokens.length
    ? any
      ? (it) => tokens.some((t) => it.h.includes(t))
      : (it) => tokens.every((t) => it.h.includes(t))
    : () => true;
  const out = items.filter((it) => hit(it) && (!onlyNew || isRecent(it.added)));
  if (sort === 'newest') out.sort((a, b) => b.date.localeCompare(a.date) || a.i - b.i);
  else if (sort === 'oldest') out.sort((a, b) => (a.date || '9').localeCompare(b.date || '9') || a.i - b.i);
  return out;
}
