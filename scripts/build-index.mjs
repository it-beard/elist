#!/usr/bin/env node
/**
 * data/materials.json → public/data/{index.json, meta.json, chunks/N.json}
 * Індэкс: кампактныя нармалізаваныя радкі для пошуку; фрагменты: поўныя запісы,
 * якія браўзэр падцягвае ленiва толькі для паказу.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeCompact } from '../src/lib/normalize.js';
import { courtName, dateWords } from '../src/lib/court.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'public', 'data');
const CHUNK = 200;

const dict = () => {
  const map = new Map();
  return {
    id: (s) => { if (!map.has(s)) map.set(s, map.size); return map.get(s); },
    list: () => [...map.keys()],
  };
};

const db = JSON.parse(await fs.readFile(path.join(ROOT, 'data', 'materials.json'), 'utf8'));
const meta = JSON.parse(await fs.readFile(path.join(ROOT, 'data', 'meta.json'), 'utf8'));
const types = dict(), courts = dict();

// [тып, суд, дата, дададзена, выдалена, назва]
const items = db.map((x) => [
  types.id(normalizeCompact(x.type)),
  courts.id(normalizeCompact(courtName(x.court))),
  x.date || '',
  x.added || '',
  x.removed || '',
  normalizeCompact(x.name),
]);
const dates = Object.fromEntries([...new Set(items.map((i) => i[2]))].filter(Boolean).map((d) => [d, dateWords(d)]));

await fs.rm(OUT, { recursive: true, force: true });
await fs.mkdir(path.join(OUT, 'chunks'), { recursive: true });
await fs.writeFile(path.join(OUT, 'index.json'), JSON.stringify({ chunk: CHUNK, types: types.list(), courts: courts.list(), dates, items }));
for (let c = 0; c * CHUNK < db.length; c++) {
  const slice = db.slice(c * CHUNK, (c + 1) * CHUNK).map(({ id, type, name, court, order }) => ({ id, type, name, court, order }));
  await fs.writeFile(path.join(OUT, 'chunks', `${c}.json`), JSON.stringify(slice));
}
await fs.writeFile(path.join(OUT, 'meta.json'), JSON.stringify(meta, null, 2));
const size = (await fs.stat(path.join(OUT, 'index.json'))).size;
console.log(`Індэкс: ${db.length} запісаў, ${(size / 1e6).toFixed(2)} MB, фрагментаў: ${Math.ceil(db.length / CHUNK)}`);
