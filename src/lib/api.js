const BASE = `${import.meta.env.BASE_URL}data/`;

async function getJson(name, init) {
  const r = await fetch(BASE + name, init);
  if (!r.ok) throw new Error(`${name}: HTTP ${r.status}`);
  return r.json();
}

/** fresh=true — абысці кэш (кнопка «праверыць зноў»). */
const opts = (fresh) => (fresh ? { cache: 'reload' } : undefined);

export const fetchMeta = (fresh) => getJson('meta.json', opts(fresh));

/** Індэкс → масіў зручных для пошуку аб’ектаў. */
export async function fetchIndex(fresh) {
  const idx = await getJson('index.json', opts(fresh));
  const items = idx.items.map(([t, c, date, added, removed, name, id], i) => ({
    i, id, date, added, removed,
    h: `${name}\n${idx.types[t]}\n${idx.courts[c]}\n${idx.dates[date] || ''}`,
  }));
  return { chunkSize: idx.chunk, items };
}

const chunkCache = new Map();
export function fetchChunk(n) {
  if (!chunkCache.has(n)) {
    const p = getJson(`chunks/${n}.json`).catch((e) => { chunkCache.delete(n); throw e; });
    chunkCache.set(n, p);
  }
  return chunkCache.get(n);
}
