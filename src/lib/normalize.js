/**
 * Нармалізацыя тэксту для пошуку. ЗАХОЎВАЕ ДАЎЖЫНЮ радка —
 * дзякуючы гэтаму індэксы супадзеньняў у нармалізаваным тэксьце
 * можна напрамую выкарыстоўваць для падсьветкі ў арыгінале.
 */
const QUOTES = /[«»“”„‟"‘’‚‛']/;

export function normalize(text) {
  let out = '';
  for (const ch of text) {
    let c = ch.toLowerCase();
    if (c.length !== ch.length) c = ch; // рэдкія сымбалі, што мяняюць даўжыню
    if (c === 'ё') c = 'е';
    else if (c === 'i') c = 'і'; // лацінская i → беларуская і
    else if (QUOTES.test(c)) c = '"';
    else if (/\s/.test(c)) c = ' ';
    out += c;
  }
  return out;
}

/** Кампактная нармалізацыя для індэкса (прабелы сьціснутыя). */
export const normalizeCompact = (text) => normalize(text).replace(/ {2,}/g, ' ').trim();

/**
 * Прыбірае «шум» са спасылак і нікаў, каб «https://t.me/foo/», «www.foo.by»,
 * «@foo» шукаліся як «t.me/foo», «foo.by», «foo».
 */
export function cleanToken(t) {
  const s = t
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/^@/, '')
    .replace(/[/.,;:!?)]+$/, '');
  return s || t;
}

/** Разьбівае запыт на токены; фраза ў лапках — адзін токен. */
export function parseQuery(query) {
  const tokens = [];
  const re = /"([^"]+)"|(\S+)/g;
  let m;
  while ((m = re.exec(normalizeCompact(query)))) tokens.push(cleanToken((m[1] || m[2]).trim()));
  return tokens.filter(Boolean);
}

/**
 * Дыяпазоны [пачатак, канец) супадзеньняў токенаў у тэксьце (зьлітыя).
 * Токен можа быць радком або масівам варыянтаў (трансьлітарацыя, прыблізныя словы).
 */
export function matchRanges(text, tokens) {
  const n = normalize(text);
  const ranges = [];
  for (const t of tokens.flat()) {
    if (!t) continue;
    let i = 0;
    while ((i = n.indexOf(t, i)) !== -1) { ranges.push([i, i + t.length]); i += t.length; }
  }
  ranges.sort((a, b) => a[0] - b[0]);
  const merged = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else merged.push(r);
  }
  return merged;
}
