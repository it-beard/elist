#!/usr/bin/env node
/**
 * Спампоўвае актуальны файл спісу з старонкі-крыніцы (PAGE_URL), разбірае табліцу
 * і даўносіць новыя запісы ў data/materials.json (тэкставая база).
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import WordExtractor from 'word-extractor';
import { recordKey } from '../src/lib/identity.js';
import { extractDate } from '../src/lib/court.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA_DIR = path.join(ROOT, 'data');
const DB_FILE = path.join(DATA_DIR, 'materials.json');
const META_FILE = path.join(DATA_DIR, 'meta.json');
const CACHE_DIR = path.join(ROOT, '.cache');
const PAGE_URL = 'https://zviazda.by/respublikanski-spis-ekstremistskikh-materyyala/';
const UA = 'Mozilla/5.0 (compatible; extremist-materials-search; +https://github.com)';

const today = new Date().toISOString().slice(0, 10);
const localFile = process.argv[2]; // неабавязкова: лакальны .doc для тэсту

// ---------- крок 1: знайсці спасылку на .doc ----------
async function findDocUrls() {
  const res = await fetch(PAGE_URL, { headers: { 'user-agent': UA } });
  if (!res.ok) throw new Error(`Не ўдалося атрымаць старонку: HTTP ${res.status}`);
  const html = await res.text();
  const links = [...html.matchAll(/href="([^"]+\.(?:docx?|rtf))"/gi)].map((m) => m[1]);
  const uniq = [...new Set(links)].map((href) => {
    const url = new URL(href.replace(/&amp;/g, '&'), PAGE_URL).href;
    const num = Number((decodeURIComponent(href).match(/(\d{4,})/) || [])[1] || 0);
    return { url, num };
  });
  // самы новы = з найбольшым нумарам у назве файла; далей — па парадку на старонцы
  uniq.sort((a, b) => b.num - a.num);
  if (!uniq.length) throw new Error('На старонцы не знойдзена спасылак на .doc');
  return uniq.map((u) => u.url);
}

async function download(urls) {
  let lastErr;
  for (const url of urls) {
    try {
      const res = await fetch(url, { headers: { 'user-agent': UA } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 10_000) throw new Error('файл падазрона малы');
      console.log(`Спампавана: ${url} (${(buf.length / 1e6).toFixed(1)} MB)`);
      return { url, buf };
    } catch (e) {
      lastErr = e;
      console.warn(`Не ўдалося спампаваць ${url}: ${e.message}`);
    }
  }
  throw lastErr;
}

// ---------- крок 2: разбор тэксту ----------
const clean = (s) =>
  s
    .replace(/\r/g, '')
    .replace(/ /g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .split('\n')
    .map((l) => l.trim())
    .join('\n')
    .trim();

function parseRows(body) {
  const rows = body.split('\t\n');
  const items = [];
  for (const raw of rows) {
    const cells = raw.split('\t').map(clean);
    while (cells.length && !cells[cells.length - 1]) cells.pop();
    if (cells.length < 2) continue;
    let [type, ...rest] = cells;
    if (/вид экстремистских материалов/i.test(type)) continue; // загаловак табліцы
    // калі ячэйка «тып» адсутнічае і ў першай ячэйцы апісанне — пераносім у назву
    if (rest.length < 2 && type.length > 80) { rest.unshift(type); type = ''; }
    if (/^республиканский список/i.test(type) && rest.length < 2) continue;
    let name, court;
    if (rest.length >= 2) {
      court = rest.pop();
      name = rest.join('\n');
    } else {
      name = rest[0];
      court = '';
    }
    if (!name) continue;
    // id = sha1 ад замарожанай нармалізацыі (src/lib/identity.js) — стабільны між зборкамі
    const id = crypto.createHash('sha1').update(recordKey(type, name, court)).digest('hex').slice(0, 12);
    items.push({ id, type, name, court, date: extractDate(court) });
  }
  return items;
}

// ---------- крок 3: зліццё з базай ----------
async function readJson(file, fallback) {
  try { return JSON.parse(await fs.readFile(file, 'utf8')); } catch { return fallback; }
}

async function main() {
  let sourceUrl = localFile ? `file://${localFile}` : null;
  let buf;
  if (localFile) {
    buf = await fs.readFile(localFile);
  } else {
    try {
      const urls = await findDocUrls();
      ({ url: sourceUrl, buf } = await download(urls));
    } catch (e) {
      // Крыніца недаступная — база застаецца, а сайт пакажа папярэджанне «магла састарэць».
      const meta = await readJson(META_FILE, {});
      await fs.writeFile(META_FILE, JSON.stringify({ ...meta, checked: today, sourceError: e.message }, null, 2));
      console.warn(`Крыніца недаступная: ${e.message}. meta.sourceError запісаны, база не зменена.`);
      return;
    }
  }
  await fs.mkdir(CACHE_DIR, { recursive: true });
  await fs.writeFile(path.join(CACHE_DIR, 'latest.doc'), buf);

  const doc = await new WordExtractor().extract(buf);
  const parsed = parseRows(doc.getBody());
  console.log(`Разабрана запісаў у крыніцы: ${parsed.length}`);
  if (parsed.length < 100) throw new Error('Занадта мала запісаў — магчыма, змяніўся фармат файла');

  await fs.mkdir(DATA_DIR, { recursive: true });
  const db = await readJson(DB_FILE, []);
  const byId = new Map(db.map((x) => [x.id, x]));
  const initial = db.length === 0; // першы імпарт: не пазначаем усё як «новае»
  let added = 0;
  const seen = new Set();
  parsed.forEach((it, i) => {
    seen.add(it.id);
    const ex = byId.get(it.id);
    if (ex) {
      ex.order = i; // свежы парадак з крыніцы
    } else {
      byId.set(it.id, { ...it, order: i, added: initial ? null : today });
      added++;
    }
  });
  // запісы, якіх ужо няма ў крыніцы, пакідаем, але пазначаем
  let removed = 0;
  for (const it of byId.values()) {
    if (!seen.has(it.id) && !it.removed) { it.removed = today; removed++; }
  }
  // Засцярога: спіс амаль ніколі не скарачаецца. Калі «знікла» болей за 5%
  // базы — хутчэй за ўсё змянілася формула id або фармат файла. Не псуем базу.
  if (!initial && removed > Math.max(50, db.length * 0.05)) {
    throw new Error(`Падазрона: ${removed} запісаў знікла з крыніцы, ${added} дададзена. Абнаўленне спынена — праверце формулу id / фармат файла.`);
  }
  const out = [...byId.values()].sort((a, b) => a.order - b.order);
  await fs.writeFile(DB_FILE, JSON.stringify(out));

  const meta = await readJson(META_FILE, {});
  const newMeta = {
    updated: today,
    checked: today,
    sourceError: null,
    sourcePage: PAGE_URL,
    sourceFile: sourceUrl,
    total: out.filter((x) => !x.removed).length,
    lastAdded: added && !initial ? today : meta.lastAdded || null,
    lastAddedCount: initial ? 0 : added || meta.lastAddedCount || 0,
  };
  await fs.writeFile(META_FILE, JSON.stringify(newMeta, null, 2));
  console.log(`Дададзена новых: ${added}, знікла з крыніцы: ${removed}, усяго ў базе: ${out.length}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
