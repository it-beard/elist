#!/usr/bin/env node
/**
 * Другі спіс: «Перечень организаций, формирований, ИП, причастных к экстремистской деятельности»
 * (рашэнні МУС і КДБ). МУС публікуе яго .xlsx-файлам у навіне (SOURCE_PAGE); старонка — Angular-SPA,
 * але пререндэраны HTML аддаецца з параметрам ?_escaped_fragment_=.
 *
 * Спампоўвае xlsx → разбірае (scripts/parse-formations.mjs) → даўносіць новыя запісы ў data/formations.json.
 * Структура і засцярогі — як у scripts/update.mjs для матэрыялаў (агульнае зліццё — mergeList у scripts/merge.mjs);
 * базу матэрыялаў і data/meta.json не кранае. Першы імпарт: added = null для ўсіх — нічога не лічыцца «новым»
 * і не ідзе ў дайджэст. Крыніца недаступная — sourceError у data/formations-meta.json, exit 0, база застаецца.
 *
 * Спісы фізічных асоб (.doc на той жа старонцы) наўмысна не бяруцца — гл. scripts/update-persons.mjs.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { CACHE_DIR, DATA_DIR, FORCE, downloadBuffer, fetchPrerendered, findLinks, readJson, runMain, writeSourceError } from './common.mjs';
import { mergeList } from './merge.mjs';
import { readXlsx } from './xlsx.mjs';
import { parseFormations } from './parse-formations.mjs';

const DB_FILE = path.join(DATA_DIR, 'formations.json');
const META_FILE = path.join(DATA_DIR, 'formations-meta.json');
const SOURCE_PAGE = process.env.FORMATIONS_SOURCE || 'https://www.mvd.gov.by/ru/news/8642';
const PAGE_TIMEOUT = 60_000, FILE_TIMEOUT = 120_000;
const MIN_ITEMS = 100;      // менш — змяніўся фармат файла ці ўзяты не той файл
const MAX_ADDED = Number(process.env.MAX_ADDED) || 100; // спіс расце на адзінкі за раз
// той жа запіс (назва + першае рашэнне): змена гэтых палёў — праўка моўчкі (edited), а не новы запіс
const FIELDS = ['kind', 'name', 'alias', 'links', 'address', 'basis', 'decidedBy', 'date', 'included', 'info', 'logo'];

const now = new Date().toISOString();
const today = now.slice(0, 10);
const localFile = process.argv[2]; // неабавязкова: лакальны .xlsx для тэсту

/** Спасылка на xlsx з пераліку арганізацый: сярод усіх .xlsx на старонцы — той, чый подпіс згадвае «организаций». */
export function findXlsxUrl(html, pageUrl) {
  const links = findLinks(html, pageUrl, /\.xlsx$/i);
  if (!links.length) throw new Error('На старонцы не знойдзена спасылак на .xlsx');
  return (links.find((l) => /организаци/i.test(l.label)) || links[0]).url;
}

async function main() {
  let sourceUrl = localFile ? `file://${localFile}` : null;
  let buf;
  if (localFile) {
    buf = await fs.readFile(localFile);
  } else {
    try {
      sourceUrl = findXlsxUrl(await fetchPrerendered(SOURCE_PAGE, { timeout: PAGE_TIMEOUT }), SOURCE_PAGE);
      ({ buf } = await downloadBuffer(sourceUrl, { timeout: FILE_TIMEOUT }));
    } catch (e) {
      await writeSourceError(META_FILE, e.message, now);
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
  const { out, added, removed, edited, initial } = mergeList(db, parsed, { today, force: FORCE, maxAdded: MAX_ADDED, fields: FIELDS });
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

// пры імпарце з тэстаў (findXlsxUrl) нічога не запускаем. Засцярога спрацавала ці зламаўся разбор: sourceError у меце
// (сайт папярэдзіць, адмін атрымае алерт пры змене стану), база не кранаецца, exit 1 — крок у CI ідзе
// з continue-on-error, таму без гэтага збой быў бы нямы.
runMain(import.meta.url, main, { metaFile: META_FILE });
