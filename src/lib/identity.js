/**
 * ЗАМАРОЖАНАЯ нармалізацыя для вылічэньня id запісу.
 * Ад яе залежаць id ва ўсёй базе, пастаянныя спасылкі і сьпісы назіраньня карыстальнікаў.
 * НЕ МЯНЯЙЦЕ гэты файл (у адрозьненьне ад normalize.js, які можна разьвіваць для пошуку).
 * Любая зьмена тут = усе запісы лічацца новымі, а ў карыстальнікаў усё «новае».
 */
const QUOTES = /[«»“”„‟"‘’‚‛']/;

export function idNormalize(text) {
  let out = '';
  for (const ch of text) {
    let c = ch.toLowerCase();
    if (c.length !== ch.length) c = ch;
    if (c === 'ё') c = 'е';
    else if (c === 'i') c = 'і';
    else if (QUOTES.test(c)) c = '"';
    else if (/\s/.test(c)) c = ' ';
    out += c;
  }
  return out.replace(/ {2,}/g, ' ').trim();
}

export const recordKey = (type, name, court) => [type, name, court].map(idNormalize).join('|');
