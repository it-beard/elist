#!/usr/bin/env node
/**
 * data/materials.json → public/data/{index.json, chunks/N.json, meta.json}
 * Індэкс: кампактныя нармалізаваныя радкі для пошуку; фрагменты: поўныя запісы,
 * якія браўзер падцягвае ляніва толькі для паказу.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeCompact } from '../src/lib/normalize.js';
import { courtName, dateWords, extractArticle } from '../src/lib/court.js';
import { writeGeo } from './geo.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'public', 'data');
const CHUNK = 200;
// адрас сайта для RSS і пастаянных спасылак (у CI — GitHub Pages)
const SITE = (process.env.SITE_URL || 'https://elist.itbeard.com/').replace(/\/?$/, '/');
// шлях, з якога аддаецца сайт (GitHub Pages праекта — падтэчка)
const BASE = (process.env.BASE_PATH || '/').replace(/\/?$/, '/');

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

// [тып, суд, дата, дададзена, выдалена, назва, id, артыкул, праўка чаго (editOf), заменены чым (replacedBy)]
const ART = { gpk: 1, kgs: 2 };
const items = db.map((x) => [
  types.id(normalizeCompact(x.type)),
  courts.id(normalizeCompact(courtName(x.court))),
  x.date || '',
  x.added || '',
  x.removed || '',
  normalizeCompact(x.name),
  x.id,
  ART[extractArticle(x.court)?.code] || 0,
  x.editOf || '',
  x.replacedBy || '',
]);
const dates = Object.fromEntries([...new Set(items.map((i) => i[2]))].filter(Boolean).map((d) => [d, dateWords(d)]));

await fs.rm(OUT, { recursive: true, force: true });
await fs.mkdir(path.join(OUT, 'chunks'), { recursive: true });
await fs.writeFile(path.join(OUT, 'index.json'), JSON.stringify({ chunk: CHUNK, types: types.list(), courts: courts.list(), dates, items }));
for (let c = 0; c * CHUNK < db.length; c++) {
  const slice = db.slice(c * CHUNK, (c + 1) * CHUNK).map(({ id, type, name, court, order }) => ({ id, type, name, court, order }));
  await fs.writeFile(path.join(OUT, 'chunks', `${c}.json`), JSON.stringify(slice));
}
// адрас крыніцы ў публічны meta.json не трапляе
const { sourcePage, sourceFile, ...publicMeta } = meta;
await fs.writeFile(path.join(OUT, 'meta.json'), JSON.stringify(publicMeta, null, 2));
await fs.writeFile(path.join(ROOT, 'public', 'feed.xml'), feed(db, meta));
// GEO: robots.txt, llms.txt, sitemap.xml і статычныя FAQ-старонкі
const geoFiles = await writeGeo({ root: ROOT, site: SITE, base: BASE, db, meta });
const size = (await fs.stat(path.join(OUT, 'index.json'))).size;
console.log(`Індэкс: ${db.length} запісаў, ${(size / 1e6).toFixed(2)} MB, фрагментаў: ${Math.ceil(db.length / CHUNK)}`);
console.log(`GEO: ${geoFiles.join(', ')}`);

// ---------- RSS: апошнія даданыя запісы (або па даце рашэння, пакуль няма гісторыі абнаўленняў) ----------
function esc(s) { return String(s).replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c])); }
function feed(rows, meta) {
  // выпраўлены запіс захоўвае guid сваёй першай версіі — чытач стужак не паказвае яго як новы
  const editOf = new Map(rows.filter((x) => x.editOf).map((x) => [x.id, x.editOf]));
  const root = (id) => { let cur = id; for (let i = 0; i < 8 && editOf.has(cur); i++) cur = editOf.get(cur); return cur; };
  const withAdded = rows.filter((x) => x.added && !x.removed);
  const pick = (withAdded.length ? withAdded.sort((a, b) => b.added.localeCompare(a.added)) : [...rows].sort((a, b) => (b.date || '').localeCompare(a.date || ''))).slice(0, 100);
  const items = pick.map((x) => {
    const when = new Date(x.added || x.date || meta.updated).toUTCString();
    const title = x.name.replace(/\s+/g, ' ').slice(0, 140);
    return `<item><title>${esc(title)}</title><link>${SITE}#/r/${x.id}</link><guid isPermaLink="false">${root(x.id)}</guid><pubDate>${when}</pubDate><category>${esc(x.type)}</category><description>${esc(`${x.name}\n\n${x.court}`)}</description></item>`;
  }).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel><title>Спіс экстрэмісцкіх матэрыялаў Беларусі — новыя запісы</title><link>${SITE}</link><description>Неафіцыйная стужка новых запісаў у Рэспубліканскім спісе экстрэмісцкіх матэрыялаў. Абнаўляецца двойчы на дзень.</description><language>be</language><image><url>${SITE}icon-192.png</url><title>Спіс экстрэмісцкіх матэрыялаў Беларусі</title><link>${SITE}</link></image><lastBuildDate>${new Date(meta.updated).toUTCString()}</lastBuildDate>
${items}
</channel></rss>`;
}
