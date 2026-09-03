#!/usr/bin/env node
/**
 * Другі спіс: «Перечень организаций, формирований, ИП, причастных к экстремистской деятельности»
 * (рашэнні МУС і КДБ). МУС публікуе яго .xlsx-файлам у навіне (SOURCE_PAGE); старонка — Angular-SPA,
 * але пререндэраны HTML аддаецца з параметрам ?_escaped_fragment_=.
 *
 * Спампоўвае xlsx → разбірае (scripts/parse-formations.mjs) → даўносіць новыя запісы ў data/formations.json.
 * Структура і засцярогі — як у scripts/update.mjs для матэрыялаў; базу матэрыялаў і data/meta.json не кранае.
 * Першы імпарт: added = null для ўсіх — нічога не лічыцца «новым» і не ідзе ў дайджэст. Крыніца недаступная —
 * sourceError у data/formations-meta.json, exit 0, база застаецца.
 *
 * Спісы фізічных асоб (.doc на той жа старонцы) наўмысна не бяруцца.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readXlsx } from './xlsx.mjs';
import { parseFormations } from './parse-formations.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA_DIR = path.join(ROOT, 'data');
const DB_FILE = path.join(DATA_DIR, 'formations.json');
const META_FILE = path.join(DATA_DIR, 'formations-meta.json');
const CACHE_DIR = path.join(ROOT, '.cache');
const SOURCE_PAGE = process.env.FORMATIONS_SOURCE || 'https://www.mvd.gov.by/ru/news/8642';
const UA = 'Mozilla/5.0 (compatible; extremist-materials-search; +https://github.com)';
const PAGE_TIMEOUT = 60_000, FILE_TIMEOUT = 120_000;
const MIN_ITEMS = 100;      // менш — змяніўся фармат файла ці ўзяты не той файл
const MAX_ADDED = Number(process.env.MAX_ADDED) || 100; // спіс расце на адзінкі за раз
const FORCE = ['1', 'true'].includes(process.env.UPDATE_FORCE);

const now = new Date().toISOString();
const today = now.slice(0, 10);
const localFile = process.argv[2]; // неабавязкова: лакальны .xlsx для тэсту

async function readJson(file, fallback) {
  try { return JSON.parse(await fs.readFile(file, 'utf8')); } catch { return fallback; }
}

/** Спасылка на xlsx з пераліку арганізацый: сярод усіх .xlsx на старонцы — той, чый подпіс згадвае «организаций». */
export function findXlsxUrl(html, pageUrl) {
  const links = [...html.matchAll(/<a\b[^>]*href=["']([^"']+\.xlsx)["'][^>]*>([\s\S]*?)<\/a>/gi)]
    .map((m) => ({ url: new URL(m[1].replace(/&amp;/g, '&'), pageUrl).href, label: m[2].replace(/<[^>]+>/g, ' ') }));
  if (!links.length) throw new Error('На старонцы не знойдзена спасылак на .xlsx');
  return (links.find((l) => /организаци/i.test(l.label)) || links[0]).url;
}

async function fetchPage() {
  const url = `${SOURCE_PAGE}${SOURCE_PAGE.includes('?') ? '&' : '?'}_escaped_fragment_=`;
  const res = await fetch(url, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(PAGE_TIMEOUT) });
  if (!res.ok) throw new Error(`Не ўдалося атрымаць старонку: HTTP ${res.status}`);
  return res.text();
}

async function download(url) {
  const res = await fetch(url, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(FILE_TIMEOUT) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 10_000) throw new Error('файл падазрона малы');
  console.log(`Спампавана: ${url} (${(buf.length / 1e3).toFixed(0)} KB, Last-Modified: ${res.headers.get('last-modified') || '?'})`);
  return buf;
}

async function main() {
  let sourceUrl = localFile ? `file://${localFile}` : null;
  let buf;
  if (localFile) {
    buf = await fs.readFile(localFile);
  } else {
    try {
      sourceUrl = findXlsxUrl(await fetchPage(), SOURCE_PAGE);
      buf = await download(sourceUrl);
    } catch (e) {
      const meta = await readJson(META_FILE, {});
      await fs.writeFile(META_FILE, JSON.stringify({ ...meta, checked: today, checkedAt: now, sourceError: e.message }, null, 2));
      console.warn(`Крыніца пераліку фарміраванняў недаступная: ${e.message}. sourceError запісаны, база не зменена.`);
      return;
    }
  }
  const parsed = parseFormations(readXlsx(buf));
  console.log(`Разабрана запісаў у крыніцы: ${parsed.length}`);
  if (parsed.length < MIN_ITEMS) throw new Error(`Занадта мала запісаў (${parsed.length}) — магчыма, змяніўся фармат файла ці ўзяты не той файл`);
  await fs.mkdir(CACHE_DIR, { recursive: true });
  await fs.writeFile(path.join(CACHE_DIR, 'formations.xlsx'), buf);

  await fs.mkdir(DATA_DIR, { recursive: true });
  const db = await readJson(DB_FILE, []);
  const byId = new Map(db.map((x) => [x.id, x]));
  const initial = db.length === 0; // першы імпарт: нічога не «новае»
  let added = 0, edited = 0, removed = 0;
  const seen = new Set();
  parsed.forEach((it, i) => {
    seen.add(it.id);
    const ex = byId.get(it.id);
    if (ex) {
      // той жа запіс (назва + першае рашэнне): абнаўляем тэкставыя палі моўчкі — гэта праўка, а не новы запіс
      const changed = ['kind', 'name', 'alias', 'links', 'address', 'basis', 'decidedBy', 'date', 'included', 'info', 'logo'].some((k) => (ex[k] ?? null) !== (it[k] ?? null));
      if (changed) { Object.assign(ex, it); ex.edited = today; edited++; }
      ex.order = i;
      if (ex.removed) { delete ex.removed; }
    } else {
      byId.set(it.id, { ...it, order: i, added: initial ? null : today });
      added++;
    }
  });
  for (const it of byId.values()) if (!seen.has(it.id) && !it.removed) { it.removed = today; removed++; }

  if (!initial && removed > Math.max(20, db.length * 0.05)) {
    throw new Error(`Падазрона: ${removed} запісаў знікла з пераліку, ${added} дададзена. Абнаўленне спынена — праверце файл крыніцы.`);
  }
  if (!initial && !FORCE && added > MAX_ADDED) {
    throw new Error(`Падазрона: ${added} новых запісаў за адзін раз (ліміт ${MAX_ADDED}). Абнаўленне спынена; каб прыняць, задайце UPDATE_FORCE=1.`);
  }
  const out = [...byId.values()].sort((a, b) => a.order - b.order);
  await fs.writeFile(DB_FILE, JSON.stringify(out));

  const meta = await readJson(META_FILE, {});
  await fs.writeFile(META_FILE, JSON.stringify({
    updated: added || removed || edited || !meta.updated ? today : meta.updated,
    checked: today,
    checkedAt: now,
    sourceError: null,
    sourcePage: SOURCE_PAGE,
    sourceFile: sourceUrl,
    total: out.filter((x) => !x.removed).length,
    lastAdded: added && !initial ? today : meta.lastAdded || null,
    lastAddedCount: initial ? 0 : added || meta.lastAddedCount || 0,
  }, null, 2));
  console.log(`Фарміраванні: дададзена ${added}, выпраўлена ${edited}, знікла ${removed}, усяго ў базе ${out.length}${initial ? ' (першы імпарт — без пазнакі «новае»)' : ''}`);
}

// пры імпарце з тэстаў (findXlsxUrl) нічога не запускаем
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
