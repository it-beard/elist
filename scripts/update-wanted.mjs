#!/usr/bin/env node
/**
 * Чацвёрты спіс: беларусы (грамадзяне і ўраджэнцы) у базе вышуку МУС РФ — паводле Медыязоны-Беларусь. Сама база
 * МУС РФ аддае толькі пошук па імені з капчай і не адказвае з-за мяжы, таму адзіная практычная крыніца — статычны
 * JSON, які Медыязона збірае штодня для свайго віджэта (SOURCE_URL, ~1 МБ) і адкрыта прапануе спампаваць.
 *
 * Спампоўвае JSON → разбірае (scripts/parse-wanted.mjs) → зліццё з data/wanted.json (mergeWanted). Усё ці нічога:
 * недаступная крыніца, змена фармату ці засцярога пакідаюць базу як была, а ў data/wanted-meta.json пішацца
 * sourceError: сайт папярэдзіць, адмін атрымае алерт (scripts/alert.mjs source). Сеткавы збой — exit 0, збой
 * фармату ці засцярог — exit 1. Калі файл пераехаў (HTTP 403/404), адрас шукаецца зноў праз старонку Медыязоны:
 * бандл віджэта → імя файла даных. Першы імпарт: added = null для ўсіх — нічога не «новае», дайджэст маўчыць;
 * выключаныя ў крыніцы адразу пазначаюцца removed без даты (гл. mergeWanted).
 *
 * Лакальна: node scripts/update-wanted.mjs файл.json (сыры JSON крыніцы).
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import { CACHE_DIR, DATA_DIR, FORCE, FormatError, UA, readJson, runMain, writeSourceError } from './common.mjs';
import { findDataUrl, findWidgetBundle, mergeWanted, parseWanted } from './parse-wanted.mjs';

const DB_FILE = path.join(DATA_DIR, 'wanted.json');
const META_FILE = path.join(DATA_DIR, 'wanted-meta.json');
const SOURCE_URL = process.env.WANTED_SOURCE || 'https://s3.zona.media/infographics/wanted/data_bel.json.br';
const SOURCE_PAGE = process.env.WANTED_PAGE || 'https://mediazonaby.com/article/2026/08/26/wanted_all';
const TIMEOUT = 90_000;
const MIN_TOTAL = 5000;        // менш — узяты не той файл ці змяніўся фармат
const MAX_SKIPPED = 0.01;      // больш за 1 % запісаў не разабралася — змяніўся фармат
const MAX_ADDED = Number(process.env.MAX_ADDED) || 500; // штодня дзясяткі, пасля паўзы ў крыніцы — сотні за раз

const now = new Date().toISOString();
const today = now.slice(0, 10);
const localFile = process.argv[2];

/** Цела адказу → тэкст: сервер аддае brotli/gzip з Content-Encoding (fetch распакоўвае сам), але на ўсякі выпадак — і сырыя. */
export function decodeBody(buf) {
  if (buf.length >= 2 && buf[0] === 0x1f && buf[1] === 0x8b) return zlib.gunzipSync(buf).toString('utf8');
  const head = buf.subarray(0, 64).toString('utf8').trimStart();
  if (head.startsWith('[') || head.startsWith('{') || head.startsWith('(') || /^[\w"'/]/.test(head)) return buf.toString('utf8');
  try { return zlib.brotliDecompressSync(buf).toString('utf8'); } catch { return buf.toString('utf8'); }
}

async function fetchText(url) {
  const res = await fetch(url, { headers: { 'user-agent': UA, accept: 'application/json, text/javascript, text/html' }, signal: AbortSignal.timeout(TIMEOUT) });
  if (!res.ok) { const e = new Error(`HTTP ${res.status} (${url})`); e.status = res.status; throw e; }
  const buf = Buffer.from(await res.arrayBuffer());
  const modified = res.headers.get('last-modified');
  console.log(`Спампавана: ${url} (${(buf.length / 1e6).toFixed(2)} MB, Last-Modified: ${modified || '?'})`);
  return { text: decodeBody(buf), modified };
}

/** Файл пераехаў — шукаем адрас нанова: старонка → бандл віджэта → імя файла даных. */
async function discover() {
  const { text: html } = await fetchText(SOURCE_PAGE);
  const bundleUrl = findWidgetBundle(html);
  const { text: bundle } = await fetchText(bundleUrl);
  return findDataUrl(bundle);
}

async function main() {
  let text, modified = null, sourceUrl = SOURCE_URL;
  if (localFile) {
    text = decodeBody(await fs.readFile(localFile));
    sourceUrl = `file://${path.resolve(localFile)}`;
  } else {
    try {
      try {
        ({ text, modified } = await fetchText(SOURCE_URL));
      } catch (e) {
        if (![403, 404].includes(e.status)) throw e;
        console.warn(`Файл крыніцы не адказвае (${e.message}) — шукаю адрас праз старонку ${SOURCE_PAGE}`);
        sourceUrl = await discover();
        if (sourceUrl === SOURCE_URL) throw e;
        ({ text, modified } = await fetchText(sourceUrl));
      }
    } catch (e) {
      // Крыніца недаступная — база застаецца, сайт пакажа папярэджанне, адмін атрымае алерт пры змене стану.
      await writeSourceError(META_FILE, e.message, now);
      console.warn(`Крыніца базы вышуку РФ недаступная: ${e.message}. sourceError запісаны, база не зменена.`);
      return;
    }
  }
  let data;
  try { data = JSON.parse(text); } catch (e) { throw new FormatError(`файл спампаваны, але гэта не JSON: ${e.message}`); }
  const stats = {};
  const parsed = parseWanted(data, stats);
  console.log(`Разабрана запісаў у крыніцы: ${parsed.length} (жывых ${parsed.length - stats.out}, выключаных ${stats.out}, без дакладнай даты ${stats.approx}, прапушчана ${stats.skipped})`);
  if (parsed.length < MIN_TOTAL) throw new Error(`Занадта мала запісаў (${parsed.length}) — магчыма, змяніўся фармат файла ці ўзяты не той файл`);
  if (stats.skipped > data.length * MAX_SKIPPED) throw new Error(`Не разабралася ${stats.skipped} з ${data.length} запісаў — магчыма, змяніўся фармат файла`);
  await fs.mkdir(CACHE_DIR, { recursive: true });
  await fs.writeFile(path.join(CACHE_DIR, 'wanted.json'), text);

  await fs.mkdir(DATA_DIR, { recursive: true });
  const db = await readJson(DB_FILE, []);
  const { out, added, removed, edited, edits, initial, outAdded } = mergeWanted(db, parsed, { today, force: FORCE, maxAdded: MAX_ADDED });
  for (const [old, rec] of edits) console.log(`Праўка запісу ${old.id} → ${rec.id}: ${rec.name}`);
  await fs.writeFile(DB_FILE, JSON.stringify(out));

  const meta = await readJson(META_FILE, {});
  const sourceDate = modified && !Number.isNaN(Date.parse(modified)) ? new Date(modified).toISOString().slice(0, 10) : meta.sourceDate || null;
  await fs.writeFile(META_FILE, JSON.stringify({
    updated: added || removed || edited || edits.length || outAdded || !meta.updated ? today : meta.updated,
    checked: today,
    checkedAt: now,
    sourceError: null,
    sourcePage: SOURCE_PAGE,
    sourceFile: sourceUrl,
    sourceDate,                    // дата файла Медыязоны (Last-Modified) — паказваецца ў шапцы побач з нашай праверкай
    parse: stats,
    total: out.filter((x) => !x.removed).length,
    removedTotal: out.filter((x) => x.removed).length,
    approx: out.filter((x) => !x.removed && !x.date).length,
    lastAdded: added && !initial ? today : meta.lastAdded || null,
    lastAddedCount: initial ? 0 : added || meta.lastAddedCount || 0,
  }, null, 2));
  console.log(`Вышук РФ: дададзена ${added}, выпраўлена ${edited + edits.length}, выключана/знікла ${removed}, выключаных без даты дададзена ${outAdded}, усяго ў базе ${out.length}${initial ? ' (першы імпарт — без пазнакі «новае»)' : ''}`);
}

// пры імпарце з тэстаў (decodeBody) нічога не запускаем; засцярога ці фармат — sourceError у меце і exit 1
runMain(import.meta.url, main, { metaFile: META_FILE });
