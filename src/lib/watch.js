import { parseQuery } from './normalize.js';
import { variants } from './translit.js';
import { search } from './search.js';

/** Токены запыту са сьпісу назіраньня — дакладныя + трансьлітарацыя (без прыблізнага пошуку, каб не трывожыць дарма). */
export const watchTokens = (q) => parseQuery(q).map(variants);

/**
 * Правярае кожны запыт са сьпісу назіраньня па індэксе.
 * entry: { q, seen: [id…], at }. Вяртае { entry, matches, fresh } — fresh = супадзеньні, якіх карыстальнік яшчэ ня бачыў.
 */
export function checkWatchlist(items, entries) {
  return entries.map((entry) => {
    const tokens = watchTokens(entry.q);
    const matches = tokens.length ? search(items, tokens, { sort: 'newest' }) : [];
    const seen = new Set(entry.seen || []);
    const fresh = matches.filter((m) => !seen.has(m.id));
    return { entry, matches, fresh };
  });
}
