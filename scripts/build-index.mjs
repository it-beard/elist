#!/usr/bin/env node
/**
 * data/materials.json + data/formations.json → public/data/{index.json, chunks/N.json, meta.json}
 * Індэкс: кампактныя нармалізаваныя радкі для пошуку; фрагменты: поўныя запісы,
 * якія браўзер падцягвае ляніва толькі для паказу.
 *
 * Два спісы ў адным індэксе: спачатку матэрыялы (суды), за імі — экстрэмісцкія фарміраванні (МУС/КДБ),
 * з пазнакай спіса ў кожным радку. Так пошук, спіс назірання, «Новае» і пастаянныя спасылкі
 * працуюць па абодвух без асобнай логікі; статыстыка і GEO-факты па гадах лічацца толькі па матэрыялах.
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
const readJson = async (file, fallback) => { try { return JSON.parse(await fs.readFile(file, 'utf8')); } catch { return fallback; } };

const materials = JSON.parse(await fs.readFile(path.join(ROOT, 'data', 'materials.json'), 'utf8'));
const meta = JSON.parse(await fs.readFile(path.join(ROOT, 'data', 'meta.json'), 'utf8'));
// другі спіс неабавязковы: без файла (свежы клон да першага абнаўлення) сайт працуе як раней
const formations = await readJson(path.join(ROOT, 'data', 'formations.json'), []);
const fmeta = await readJson(path.join(ROOT, 'data', 'formations-meta.json'), {});
const db = [...materials.map((x) => ({ ...x, list: 'm' })), ...formations.map((x) => ({ ...x, list: 'f' }))];
const types = dict(), courts = dict();

// «тып» і «суд» для фарміраванняў — кароткія падпісы, каб шукалася па словах «формирование», «кгб», «мвд»
const KIND = { formation: 'Экстремистское формирование', organization: 'Экстремистская организация' };
const DECIDER = { mvd: 'Решение МВД', kgb: 'Решение КГБ', court: 'Решение суда' };

// [тып, суд, дата, дададзена, выдалена, назва, id, артыкул, праўка чаго (editOf), заменены чым (replacedBy), спіс (0/1)]
const ART = { gpk: 1, kgs: 2 };
const items = db.map((x) => (x.list === 'f'
  ? [
    types.id(normalizeCompact(KIND[x.kind] || KIND.formation)),
    courts.id(normalizeCompact(DECIDER[x.decidedBy] || '')),
    x.date || '',
    x.added || '',
    x.removed || '',
    normalizeCompact([x.name, x.alias, x.links, x.address, x.basis].filter(Boolean).join('\n')),
    x.id,
    0, '', '', 1,
  ]
  : [
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
    0,
  ]));
const dates = Object.fromEntries([...new Set(items.map((i) => i[2]))].filter(Boolean).map((d) => [d, dateWords(d)]));

/** Поўны запіс для фрагмента: матэрыял — як раней; фарміраванне — усе палі для карткі і старонкі запісу. */
const chunkRecord = (x) => (x.list === 'f'
  ? { id: x.id, list: 'f', kind: x.kind, name: x.name, alias: x.alias, links: x.links, address: x.address, basis: x.basis, decidedBy: x.decidedBy, date: x.date, included: x.included, info: x.info, logo: x.logo }
  : { id: x.id, type: x.type, name: x.name, court: x.court, order: x.order });

await fs.rm(OUT, { recursive: true, force: true });
await fs.mkdir(path.join(OUT, 'chunks'), { recursive: true });
await fs.writeFile(path.join(OUT, 'index.json'), JSON.stringify({ chunk: CHUNK, types: types.list(), courts: courts.list(), dates, items }));
for (let c = 0; c * CHUNK < db.length; c++) {
  await fs.writeFile(path.join(OUT, 'chunks', `${c}.json`), JSON.stringify(db.slice(c * CHUNK, (c + 1) * CHUNK).map(chunkRecord)));
}
// адрасы крыніц у публічны meta.json не трапляюць; звесткі пра другі спіс — у meta.formations
const { sourcePage, sourceFile, ...publicMeta } = meta;
const { sourcePage: fPage, sourceFile: fFile, ...publicFmeta } = fmeta;
publicMeta.formations = Object.keys(publicFmeta).length ? publicFmeta : null;
await fs.writeFile(path.join(OUT, 'meta.json'), JSON.stringify(publicMeta, null, 2));
await fs.writeFile(path.join(ROOT, 'public', 'feed.xml'), feed(db, meta));
// GEO: robots.txt, llms.txt, sitemap.xml і статычныя FAQ-старонкі (статыстыка па гадах — толькі матэрыялы)
const geoFiles = await writeGeo({ root: ROOT, site: SITE, base: BASE, db: materials, meta: publicMeta });
const size = (await fs.stat(path.join(OUT, 'index.json'))).size;
console.log(`Індэкс: ${materials.length} матэрыялаў + ${formations.length} фарміраванняў, ${(size / 1e6).toFixed(2)} MB, фрагментаў: ${Math.ceil(db.length / CHUNK)}`);
console.log(`GEO: ${geoFiles.join(', ')}`);

// ---------- RSS: апошнія даданыя запісы (або па даце рашэння, пакуль няма гісторыі абнаўленняў) ----------
function esc(s) { return String(s).replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c])); }
function feed(rows, meta) {
  // выпраўлены запіс захоўвае guid сваёй першай версіі — чытач стужак не паказвае яго як новы
  const editOf = new Map(rows.filter((x) => x.editOf).map((x) => [x.id, x.editOf]));
  const root = (id) => { let cur = id; for (let i = 0; i < 8 && editOf.has(cur); i++) cur = editOf.get(cur); return cur; };
  const withAdded = rows.filter((x) => x.added && !x.removed);
  const pick = (withAdded.length ? withAdded.sort((a, b) => b.added.localeCompare(a.added)) : rows.filter((x) => x.list !== 'f').sort((a, b) => (b.date || '').localeCompare(a.date || ''))).slice(0, 100);
  const items = pick.map((x) => {
    const when = new Date(x.added || x.date || meta.updated).toUTCString();
    const title = x.name.replace(/\s+/g, ' ').slice(0, 140);
    const category = x.list === 'f' ? 'Экстрэмісцкае фарміраванне (МУС/КДБ)' : x.type;
    const body = x.list === 'f' ? [x.alias, x.links, x.basis].filter(Boolean).join('\n\n') : `${x.name}\n\n${x.court}`;
    return `<item><title>${esc(title)}</title><link>${SITE}#/r/${x.id}</link><guid isPermaLink="false">${root(x.id)}</guid><pubDate>${when}</pubDate><category>${esc(category)}</category><description>${esc(body)}</description></item>`;
  }).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel><title>Спіс экстрэмісцкіх матэрыялаў Беларусі — новыя запісы</title><link>${SITE}</link><description>Неафіцыйная стужка новых запісаў у Рэспубліканскім спісе экстрэмісцкіх матэрыялаў і пераліку экстрэмісцкіх фарміраванняў МУС/КДБ. Абнаўляецца двойчы на дзень.</description><language>be</language><image><url>${SITE}icon-192.png</url><title>Спіс экстрэмісцкіх матэрыялаў Беларусі</title><link>${SITE}</link></image><lastBuildDate>${new Date(meta.updated).toUTCString()}</lastBuildDate>
${items}
</channel></rss>`;
}
