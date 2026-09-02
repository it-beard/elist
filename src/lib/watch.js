import { parseQuery } from './normalize.js';
import { variants } from './translit.js';
import { search } from './search.js';

/** Токены запыту са спісу назірання — дакладныя + транслітарацыя (без прыблізнага пошуку, каб не трывожыць дарма). */
export const watchTokens = (q) => parseQuery(q).map(variants);

/**
 * Правярае кожны запыт са спісу назірання па індэксе.
 * entry: { q, seen: [id…], at }. Вяртае { entry, matches, fresh } — fresh = супадзенні, якіх карыстальнік яшчэ не бачыў.
 * Выпраўлены ў крыніцы запіс (editOf) лічыцца бачаным, калі бачылі якую-небудзь з яго папярэдніх версій.
 */
export function checkWatchlist(items, entries) {
  const editOf = new Map();
  for (const it of items) if (it.editOf) editOf.set(it.id, it.editOf);
  const seenVia = (seen, id) => {
    for (let cur = id, i = 0; cur && i < 8; cur = editOf.get(cur), i++) if (seen.has(cur)) return true;
    return false;
  };
  return entries.map((entry) => {
    const tokens = watchTokens(entry.q);
    const matches = tokens.length ? search(items, tokens, { sort: 'newest' }) : [];
    const seen = new Set(entry.seen || []);
    const fresh = matches.filter((m) => !seenVia(seen, m.id));
    return { entry, matches, fresh };
  });
}
