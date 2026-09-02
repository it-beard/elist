import { isRecent } from './format.js';

const has = (h, t) => (Array.isArray(t) ? t.some((v) => v && h.includes(v)) : h.includes(t));

/**
 * Фільтруе і сартуе запісы індэкса. Кожны item мае: i, id, date, added, removed, h (радок для пошуку).
 * Токен — радок або масіў варыянтаў (дастаткова любога з іх).
 * replacedBy — старая версія выпраўленага запісу: у выніках не паказваем (пастаянная спасылка вядзе на новую).
 */
export function search(items, tokens, { any = false, onlyNew = false, sort = 'newest' } = {}) {
  const hit = tokens.length
    ? any
      ? (it) => tokens.some((t) => has(it.h, t))
      : (it) => tokens.every((t) => has(it.h, t))
    : () => true;
  const out = items.filter((it) => !it.replacedBy && hit(it) && (!onlyNew || isRecent(it.added)));
  if (sort === 'newest') out.sort((a, b) => (b.date || '').localeCompare(a.date || '') || b.i - a.i);
  else if (sort === 'oldest') out.sort((a, b) => (a.date || '9').localeCompare(b.date || '9') || a.i - b.i);
  return out;
}
