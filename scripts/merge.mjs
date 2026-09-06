/**
 * Зліццё разабранага спісу з базай (mergeList) і пазнаванне праўак (pairEdits). id запісу лічыцца ад тэксту, таму
 * выпраўленая ў крыніцы памылка друку ці абрэзаны радок выглядаюць як «зніклы» + «новы» запіс. Калі ў адным
 * абнаўленні знік і з'явіўся запіс, які isEdit лічыць тым жа (матэрыялы: той жа тып, суд і амаль тая ж назва —
 * isEdit ніжэй; фізічныя асобы — isPersonEdit у parse-persons.mjs), гэта адзін запіс з выпраўленым тэкстам:
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

/** Праўка матэрыялу: той жа тып, той жа суд, амаль тая ж назва. */
const isMaterialEdit = (oldRec, newRec) =>
  idNormalize(oldRec.type || '') === idNormalize(newRec.type || '') && sameCourt(oldRec, newRec) && similarName(oldRec, newRec);
export { isMaterialEdit as isEdit };

/** Пары [стары, новы] сярод зніклых і новых; кожны ўдзельнічае не болей за раз, неадназначнасць — прапускаем. */
export function pairEdits(removed, added, isEdit = isMaterialEdit, maxPairs = MAX_PAIRS) {
  if (!removed.length || !added.length || removed.length > maxPairs) return [];
  const pairs = [], used = new Set();
  for (const old of removed) {
    const cand = added.filter((n) => !used.has(n.id) && isEdit(old, n));
    if (cand.length !== 1) continue;
    used.add(cand[0].id);
    pairs.push([old, cand[0]]);
  }
  return pairs;
}

const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/**
 * Зліццё разабраных запісаў з базай (запісы базы мяняюцца на месцы). Дублі id у крыніцы — застаецца апошні
 * (на сваім месцы), каб сталы дубль не пазначаўся праўкай кожны запуск. Той жа id — праўка палёў fields моўчкі
 * (edited = today; без fields палі не параўноўваюцца), свежы парадак (order), запіс, які вярнуўся ў асноўную
 * крыніцу, зноў жывы. Новы id — added = today (пры першым імпарце null: нічога не «новае»). Зніклы — removed = today,
 * толькі для асноўнай крыніцы (primary): запасное люстэрка можа быць старэйшым за базу. «Зніклы» + «новы», якіх
 * isEdit лічыць тым жа запісам, — праўка: новы наследуе added і атрымлівае edited/editOf, стары — removed/replacedBy.
 * Засцярогі: знікла больш за max(minRemoved, 5 % базы) — памылка заўсёды (змянілася формула id ці фармат файла);
 * дадалося больш за maxAdded — памылка без force. База пры памылцы не змяняецца (нічога не запісана).
 * Вяртае { out, added, removed, edited, edits, initial }; out — паводле парадку крыніцы.
 */
export function mergeList(db, parsed, {
  today, force = false, maxAdded = Infinity, fields = null, isEdit = null, maxPairs = MAX_PAIRS, minRemoved = 20, primary = true,
} = {}) {
  const lastAt = new Map(parsed.map((it, i) => [it.id, i]));
  const byId = new Map(db.map((x) => [x.id, x]));
  const initial = db.length === 0;
  const addedRecs = [];
  let edited = 0;
  const seen = new Set();
  parsed.forEach((it, i) => {
    if (lastAt.get(it.id) !== i) return; // дубль: бярэм апошні
    seen.add(it.id);
    const ex = byId.get(it.id);
    if (ex) {
      if (fields && fields.some((k) => !same(ex[k], it[k]))) { Object.assign(ex, it); ex.edited = today; edited++; }
      ex.order = i;
      if (primary && ex.removed) { delete ex.removed; delete ex.replacedBy; } // запіс вярнуўся ў крыніцу
    } else {
      const rec = { ...it, order: i, added: initial ? null : today };
      byId.set(it.id, rec);
      addedRecs.push(rec);
    }
  });
  const removedRecs = [];
  if (primary) for (const it of byId.values()) if (!seen.has(it.id) && !it.removed) removedRecs.push(it);
  const edits = initial || !isEdit ? [] : pairEdits(removedRecs, addedRecs, isEdit, maxPairs);
  const paired = new Set();
  for (const [old, rec] of edits) {
    rec.added = old.added; rec.edited = today; rec.editOf = old.id;
    old.removed = today; old.replacedBy = rec.id;
    paired.add(old.id); paired.add(rec.id);
  }
  const added = addedRecs.filter((r) => !paired.has(r.id)).length;
  const removedList = removedRecs.filter((r) => !paired.has(r.id));
  if (!initial && removedList.length > Math.max(minRemoved, db.length * 0.05)) {
    throw new Error(`Падазрона: ${removedList.length} запісаў знікла з крыніцы, ${added} дададзена. Абнаўленне спынена — праверце файл крыніцы / формулу id.`);
  }
  if (!initial && !force && added > maxAdded) {
    throw new Error(`Падазрона: ${added} новых запісаў за адзін раз (ліміт ${maxAdded}). Абнаўленне спынена; каб прыняць, задайце UPDATE_FORCE=1.`);
  }
  for (const it of removedList) it.removed = today;
  const out = [...byId.values()].sort((a, b) => a.order - b.order);
  return { out, added, removed: removedList.length, edited, edits, initial };
}
