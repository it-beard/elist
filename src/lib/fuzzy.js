/** Прыблізны пошук: словы індэкса, што адрозніваюцца ад токена на 1–2 літары. */

/** Абмежаваная адлегласць Левенштэйна (вяртае max+1, калі большая за max). */
export function levenshtein(a, b, max = Infinity) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      cur.push(v);
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}

const cache = new WeakMap();
/** Унікальныя словы (≥3 сімвалаў) з усіх запісаў індэкса; кэшуецца на масіў. */
export function corpusWords(items) {
  if (!cache.has(items)) {
    const set = new Set();
    for (const it of items) for (const w of it.h.split(/[^\p{L}\p{N}]+/u)) if (w.length >= 3) set.add(w);
    cache.set(items, [...set]);
  }
  return cache.get(items);
}

export const maxDistance = (token) => (token.length >= 8 ? 2 : token.length >= 5 ? 1 : 0);

/** Словы корпуса, падобныя да токена (сам токен не ўключаецца). */
export function similarWords(words, token) {
  const k = maxDistance(token);
  if (!k) return [];
  return words.filter((w) => w !== token && Math.abs(w.length - token.length) <= k && levenshtein(w, token, k) <= k);
}
