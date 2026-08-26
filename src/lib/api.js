const BASE = `${import.meta.env.BASE_URL}data/`;

async function getJson(name) {
  const r = await fetch(BASE + name);
  if (!r.ok) throw new Error(`${name}: HTTP ${r.status}`);
  return r.json();
}

export const fetchMeta = () => getJson('meta.json');

/** Індэкс → масіў зручных для пошуку аб'ектаў. */
export async function fetchIndex() {
  const idx = await getJson('index.json');
  const items = idx.items.map(([t, c, date, added, removed, name], i) => ({
    i, date, added, removed,
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
