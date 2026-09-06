#!/usr/bin/env node
/**
 * data/materials.json + data/formations.json + data/persons.json → public/data/{index.json, chunks/N.json, meta.json},
 * public/feed.xml і GEO-файлы. Індэкс: кампактныя нармалізаваныя радкі для пошуку (scripts/index-rows.mjs); фрагменты:
 * поўныя запісы, якія браўзер падцягвае ляніва толькі для паказу. GEO-факты па гадах лічацца толькі па матэрыялах.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { dateWords } from '../src/lib/court.js';
import { DATA_DIR, ROOT, readJson } from './common.mjs';
import { CHUNK, chunkRecord, dict, feed, indexRow, publicMeta } from './index-rows.mjs';
import { writeGeo } from './geo.mjs';

const OUT = path.join(ROOT, 'public', 'data');
// адрас сайта для RSS і пастаянных спасылак (у CI — GitHub Pages)
const SITE = (process.env.SITE_URL || 'https://elist.itbeard.com/').replace(/\/?$/, '/');
// шлях, з якога аддаецца сайт (GitHub Pages праекта — падтэчка)
const BASE = (process.env.BASE_PATH || '/').replace(/\/?$/, '/');

const materials = JSON.parse(await fs.readFile(path.join(DATA_DIR, 'materials.json'), 'utf8'));
const meta = JSON.parse(await fs.readFile(path.join(DATA_DIR, 'meta.json'), 'utf8'));
// другі і трэці спісы неабавязковыя: без файлаў (свежы клон да першага абнаўлення) сайт працуе як раней
const formations = await readJson(path.join(DATA_DIR, 'formations.json'), []);
const fmeta = await readJson(path.join(DATA_DIR, 'formations-meta.json'), {});
const persons = await readJson(path.join(DATA_DIR, 'persons.json'), []);
const pmeta = await readJson(path.join(DATA_DIR, 'persons-meta.json'), {});
const db = [...materials.map((x) => ({ ...x, list: 'm' })), ...formations.map((x) => ({ ...x, list: 'f' })), ...persons.map((x) => ({ ...x, list: 'p' }))];
const dicts = { types: dict(), courts: dict() };
const items = db.map((x) => indexRow(x, dicts));
const dates = Object.fromEntries([...new Set(items.map((i) => i[2]))].filter(Boolean).map((d) => [d, dateWords(d)]));

await fs.rm(OUT, { recursive: true, force: true });
await fs.mkdir(path.join(OUT, 'chunks'), { recursive: true });
await fs.writeFile(path.join(OUT, 'index.json'), JSON.stringify({ chunk: CHUNK, types: dicts.types.list(), courts: dicts.courts.list(), dates, items }));
for (let c = 0; c * CHUNK < db.length; c++) {
  await fs.writeFile(path.join(OUT, 'chunks', `${c}.json`), JSON.stringify(db.slice(c * CHUNK, (c + 1) * CHUNK).map(chunkRecord)));
}
const pub = publicMeta(meta, fmeta, pmeta);
await fs.writeFile(path.join(OUT, 'meta.json'), JSON.stringify(pub, null, 2));
await fs.writeFile(path.join(ROOT, 'public', 'feed.xml'), feed(db, meta, SITE));
// GEO: robots.txt, llms.txt, sitemap.xml і статычныя FAQ-старонкі (статыстыка па гадах — толькі матэрыялы)
const geoFiles = await writeGeo({ root: ROOT, site: SITE, base: BASE, db: materials, meta: pub });
const size = (await fs.stat(path.join(OUT, 'index.json'))).size;
console.log(`Індэкс: ${materials.length} матэрыялаў + ${formations.length} фарміраванняў + ${persons.length} фізічных асоб, ${(size / 1e6).toFixed(2)} MB, фрагментаў: ${Math.ceil(db.length / CHUNK)}`);
console.log(`GEO: ${geoFiles.join(', ')}`);
