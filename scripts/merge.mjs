/**
 * Пазнаванне праўак. id запісу лічыцца ад поўнага тэксту, таму выпраўленая ў крыніцы памылка друку
 * ці абрэзаны радок выглядаюць як «зніклы» + «новы» запіс. Калі ў адным абнаўленні знік і з'явіўся
 * запіс з тым жа тыпам, тым жа судом і амаль той жа назвай — гэта адзін запіс з выпраўленым тэкстам:
 * у Telegram, RSS і «Новае» ён не ідзе, а спіс назірання не трывожыць, калі папярэднюю версію бачылі.
 */
import { idNormalize } from '../src/lib/identity.js';
import { levenshtein } from '../src/lib/fuzzy.js';

const MAX_PAIRS = 20;   // калі знікла болей — гэта не праўкі, не спрабуем
const MAX_LEN = 3000;   // Левенштэйн лічым толькі для назваў разумнай даўжыні

const prefixOf = (a, b) => (a.length <= b.length ? b.startsWith(a) : a.startsWith(b));

/** Той жа суд: тэкст супадае або адзін — пачатак другога (абрэзаны радок). */
export function sameCourt(a, b) {
  const ca = idNormalize(a.court || ''), cb = idNormalize(b.court || '');
  if (ca === cb) return true;
  return Math.min(ca.length, cb.length) >= 20 && prefixOf(ca, cb);
}

/** Амаль тая ж назва: абрэзаны радок ці розніца ў некалькі сімвалаў. */
export function similarName(a, b) {
  const na = idNormalize(a.name || ''), nb = idNormalize(b.name || '');
  if (!na || !nb) return false;
  if (na === nb) return true;
  const short = Math.min(na.length, nb.length), long = Math.max(na.length, nb.length);
  if (short >= 30 && short >= long * 0.5 && prefixOf(na, nb)) return true;
  if (long > MAX_LEN) return false;
  const max = Math.max(2, Math.round(long * 0.08));
  return levenshtein(na, nb, max) <= max;
}

export const isEdit = (oldRec, newRec) =>
  idNormalize(oldRec.type || '') === idNormalize(newRec.type || '') && sameCourt(oldRec, newRec) && similarName(oldRec, newRec);

/** Пары [стары, новы] сярод зніклых і новых; кожны ўдзельнічае не болей за раз, неадназначнасць — прапускаем. */
export function pairEdits(removed, added) {
  if (!removed.length || !added.length || removed.length > MAX_PAIRS) return [];
  const pairs = [], used = new Set();
  for (const old of removed) {
    const cand = added.filter((n) => !used.has(n.id) && isEdit(old, n));
    if (cand.length !== 1) continue;
    used.add(cand[0].id);
    pairs.push([old, cand[0]]);
  }
  return pairs;
}
