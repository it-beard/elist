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
// адрас сайта для RSS і пастаянных спасылак (у CI — GitHub Pages)
const SITE = (process.env.SITE_URL || 'https://it-beard.github.io/extremist-by/').replace(/\/?$/, '/');

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

// [тып, суд, дата, дададзена, выдалена, назва, id]
const items = db.map((x) => [
  types.id(normalizeCompact(x.type)),
  courts.id(normalizeCompact(courtName(x.court))),
  x.date || '',
  x.added || '',
  x.removed || '',
  normalizeCompact(x.name),
  x.id,
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
await fs.writeFile(path.join(ROOT, 'public', 'feed.xml'), feed(db, meta));
const size = (await fs.stat(path.join(OUT, 'index.json'))).size;
console.log(`Індэкс: ${db.length} запісаў, ${(size / 1e6).toFixed(2)} MB, фрагментаў: ${Math.ceil(db.length / CHUNK)}`);

// ---------- RSS: апошнія даданыя запісы (або па даце рашэньня, пакуль няма гісторыі абнаўленьняў) ----------
function esc(s) { return String(s).replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c])); }
function feed(rows, meta) {
  const withAdded = rows.filter((x) => x.added && !x.removed);
  const pick = (withAdded.length ? withAdded.sort((a, b) => b.added.localeCompare(a.added)) : [...rows].sort((a, b) => (b.date || '').localeCompare(a.date || ''))).slice(0, 100);
  const items = pick.map((x) => {
    const when = new Date(x.added || x.date || meta.updated).toUTCString();
    const title = x.name.replace(/\s+/g, ' ').slice(0, 140);
    return `<item><title>${esc(title)}</title><link>${SITE}#/r/${x.id}</link><guid isPermaLink="false">${x.id}</guid><pubDate>${when}</pubDate><category>${esc(x.type)}</category><description>${esc(`${x.name}\n\n${x.court}`)}</description></item>`;
  }).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel><title>Спіс экстрэмісцкіх матэрыялаў Беларусі — новыя запісы</title><link>${SITE}</link><description>Неафіцыйная стужка новых запісаў у Рэспубліканскім спісе экстрэмісцкіх матэрыялаў. Абнаўляецца штодня.</description><language>be</language><lastBuildDate>${new Date(meta.updated).toUTCString()}</lastBuildDate>
${items}
</channel></rss>`;
}
