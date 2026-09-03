const BASE = `${import.meta.env.BASE_URL}data/`;

async function getJson(name, init) {
  const r = await fetch(BASE + name, init);
  if (!r.ok) throw new Error(`${name}: HTTP ${r.status}`);
  return r.json();
}

/** fresh=true — абысці кэш (кнопка «праверыць зноў»). */
const opts = (fresh) => (fresh ? { cache: 'reload' } : undefined);

export const fetchMeta = (fresh) => getJson('meta.json', opts(fresh));

/** Код у слоце «артыкул» → назва серыі статыстыкі (гл. stats.js): матэрыялы — артыкул, фарміраванні — хто прыняў рашэнне. */
const ART = { 1: 'gpk', 2: 'kgs' }, DEC = { 1: 'mvd', 2: 'kgb', 3: 'court' };

/**
 * Індэкс → масіў зручных для пошуку аб’ектаў. list: 'm' — матэрыял, 'f' — экстрэмісцкае фарміраванне
 * (у старым кэшы поля няма — усё матэрыялы); n — нумар у сваім спісе (пазіцыя ў афіцыйнай публікацыі).
 */
export async function fetchIndex(fresh) {
  const idx = await getJson('index.json', opts(fresh));
  const counters = { m: 0, f: 0 };
  const items = idx.items.map(([t, c, date, added, removed, name, id, art, editOf, replacedBy, list], i) => {
    const l = list === 1 ? 'f' : 'm';
    return {
      i, id, date, added, removed, editOf: editOf || '', replacedBy: replacedBy || '', art: l === 'f' ? DEC[art] || 'court' : ART[art] || 'none',
      list: l, n: ++counters[l],
      h: `${name}\n${idx.types[t]}\n${idx.courts[c]}\n${idx.dates[date] || ''}`,
    };
  });
  return { chunkSize: idx.chunk, items, counts: counters };
}

const chunkCache = new Map();
export function fetchChunk(n) {
  if (!chunkCache.has(n)) {
    const p = getJson(`chunks/${n}.json`).catch((e) => { chunkCache.delete(n); throw e; });
    chunkCache.set(n, p);
  }
  return chunkCache.get(n);
}
