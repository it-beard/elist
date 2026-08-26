/**
 * Варыянты напісаньня токена: кірыліца ↔ лацінка (расейская трансьлітарацыя
 * і беларуская лацінка без дыякрытыкі), і ↔ и. Усе радкі — у нармалізаваным
 * выглядзе (лацінская i ўжо ператвораная ў «і»), як і індэкс.
 */
const I = 'і'; // нармалізаваная «i»

const CYR_RU = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ж: 'zh', з: 'z', і: I, и: I, й: 'y', к: 'k', л: 'l', м: 'm',
  н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ў: 'u', ф: 'f', х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh',
  щ: 'shch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya', ґ: 'g', "'": '', ʼ: '',
};
const CYR_LAC = { ...CYR_RU, г: 'h', ж: 'z', й: 'j', х: 'ch', ц: 'c', ч: 'c', ш: 's', щ: 'sc', ю: 'ju', я: 'ja' };

// лацінка → кірыліца: спачатку двух-трохлітарныя спалучэньні
const LAT_RU = [
  ['shch', 'щ'], ['zh', 'ж'], ['kh', 'х'], ['ts', 'ц'], ['ch', 'ч'], ['sh', 'ш'], ['yu', 'ю'], ['ya', 'я'], ['yo', 'е'], ['ye', 'е'],
  ['a', 'а'], ['b', 'б'], ['c', 'ц'], ['d', 'д'], ['e', 'е'], ['f', 'ф'], ['g', 'г'], ['h', 'х'], [I, I], ['j', 'й'], ['k', 'к'],
  ['l', 'л'], ['m', 'м'], ['n', 'н'], ['o', 'о'], ['p', 'п'], ['q', 'к'], ['r', 'р'], ['s', 'с'], ['t', 'т'], ['u', 'у'],
  ['v', 'в'], ['w', 'в'], ['x', 'кс'], ['y', 'ы'], ['z', 'з'], ["'", 'ь'],
];
const LAT_LAC = [
  ['ch', 'х'], ['dz', 'дз'], ['dž', 'дж'], ['ju', 'ю'], ['ja', 'я'], ['je', 'е'], ['jo', 'е'],
  ['ž', 'ж'], ['č', 'ч'], ['š', 'ш'], ['ć', 'ць'], ['ń', 'нь'], ['ś', 'сь'], ['ź', 'зь'], ['ł', 'л'], ['ŭ', 'ў'], ['ó', 'о'],
  ['a', 'а'], ['b', 'б'], ['c', 'ц'], ['d', 'д'], ['e', 'э'], ['f', 'ф'], ['g', 'г'], ['h', 'г'], [I, I], ['j', 'й'], ['k', 'к'],
  ['l', 'л'], ['m', 'м'], ['n', 'н'], ['o', 'о'], ['p', 'п'], ['r', 'р'], ['s', 'с'], ['t', 'т'], ['u', 'у'],
  ['v', 'в'], ['w', 'в'], ['x', 'кс'], ['y', 'ы'], ['z', 'з'], ["'", 'ь'],
];

const mapCyr = (s, table) => [...s].map((c) => (c in table ? table[c] : c)).join('');

function mapLat(s, table) {
  let out = '';
  for (let i = 0; i < s.length;) {
    const pair = table.find(([k]) => s.startsWith(k, i));
    if (pair) { out += pair[1]; i += pair[0].length; } else { out += s[i]; i++; }
  }
  return out;
}

const LATIN = /[a-zžčšćńśźłŭó]/;
const CYRILLIC = /[а-яёўґ]/; // без «і», бо яна агульная для абодвух пісьмаў
const WORD = /^[\p{L}'ʼ-]+$/u;

/** Унікальныя варыянты токена; першы — сам токен. */
export function variants(token) {
  const out = new Set([token]);
  const swapI = (s) => { if (s.includes(I)) out.add(s.replaceAll(I, 'и')); if (s.includes('и')) out.add(s.replaceAll('и', I)); };
  swapI(token);
  if (WORD.test(token) && token.length >= 3) {
    const lat = LATIN.test(token), cyr = CYRILLIC.test(token);
    const extra = [];
    if (cyr && !lat) extra.push(mapCyr(token, CYR_RU), mapCyr(token, CYR_LAC));
    else if (lat && !cyr) extra.push(mapLat(token, LAT_RU), mapLat(token, LAT_LAC));
    for (const v of extra) if (v.length >= 3) { out.add(v); swapI(v); }
  }
  return [...out];
}
