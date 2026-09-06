#!/usr/bin/env node
/**
 * Спампоўвае актуальны файл спісу са старонкі-крыніцы (SOURCES, па парадку прыярытэту),
 * разбірае табліцу (scripts/parse.mjs) і даўносіць новыя запісы ў data/materials.json.
 * Праўкі тэксту ў крыніцы (scripts/merge.mjs) не лічацца новымі запісамі.
 *
 * Засцярогі: спіс амаль ніколі не скарачаецца і расце на адзінкі-дзясяткі запісаў за раз, таму
 * масавае «знікненне» ці занадта шмат «новых» спыняюць абнаўленне (UPDATE_FORCE=1 — прыняць).
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import WordExtractor from 'word-extractor';
import { CACHE_DIR, DATA_DIR, FORCE, UA, downloadBuffer, readJson, runMain, writeSourceError } from './common.mjs';
import { parseRows } from './parse.mjs';
import { isEdit, mergeList } from './merge.mjs';

const DB_FILE = path.join(DATA_DIR, 'materials.json');
const META_FILE = path.join(DATA_DIR, 'meta.json');
// Крыніцы па парадку прыярытэту. Афіцыйная — Мінінфарм; Звязда — люстэрка, якое
// адстае на дні (у жніўні 2026 — на 23 запісы), таму яно толькі запасны варыянт.
const SOURCES = [
  { page: 'https://mininform.gov.by/ru/respublikanskiy-spisok-ekstremistskikh-materialov-ru/', primary: true },
  { page: 'https://zviazda.by/respublikanski-spis-ekstremistskikh-materyyala/', primary: false },
];
const PAGE_TIMEOUT = 60_000, FILE_TIMEOUT = 180_000; // каб джоб не вісеў гадзінамі, калі крыніца «маўчыць»
const MAX_CANDIDATES = 3;  // колькі .doc са старонкі параўноўваем, калі іх некалькі
const MAX_ADDED = Number(process.env.MAX_ADDED) || 400; // больш «новых» за раз — падазрона

const now = new Date().toISOString();
const today = now.slice(0, 10);
const localFile = process.argv[2]; // неабавязкова: лакальны .doc для тэсту

// ---------- крок 1: знайсці спасылкі на .doc ----------
async function findDocUrls(pageUrl) {
  const res = await fetch(pageUrl, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(PAGE_TIMEOUT) });
  if (!res.ok) throw new Error(`Не ўдалося атрымаць старонку: HTTP ${res.status}`);
  const html = await res.text();
  const links = [...html.matchAll(/href=["']([^"']+\.(?:docx?|rtf))["']/gi)].map((m) => m[1]);
  const urls = [...new Set(links.map((href) => new URL(href.replace(/&amp;/g, '&'), pageUrl).href))];
  if (!urls.length) throw new Error('На старонцы не знойдзена спасылак на .doc');
  return urls.slice(0, MAX_CANDIDATES); // у парадку старонкі
}

async function parseDoc(buf) {
  const doc = await new WordExtractor().extract(buf);
  return parseRows(doc.getBody());
}

/** Калі спасылак некалькі — бярэм файл з найбольшай колькасцю запісаў: спіс амаль ніколі не скарачаецца. */
async function fetchBest(urls) {
  let best = null, lastErr;
  for (const url of urls) {
    try {
      const { buf } = await downloadBuffer(url, { timeout: FILE_TIMEOUT });
      const items = await parseDoc(buf);
      console.log(`Разабрана запісаў: ${items.length} (${url})`);
      if (!best || items.length > best.items.length) best = { url, buf, items };
    } catch (e) {
      lastErr = e;
      console.warn(`Не ўдалося ${url}: ${e.message}`);
    }
  }
  if (!best) throw lastErr || new Error('няма файлаў');
  return best;
}

/** Абыходзіць SOURCES па чарзе; вяртае першую крыніцу, з якой удалося ўзяць файл. */
async function fetchFromSources() {
  const errors = [];
  for (const src of SOURCES) {
    try {
      const urls = await findDocUrls(src.page);
      const best = await fetchBest(urls);
      if (!src.primary) console.warn('Увага: выкарыстана запасная крыніца — яна можа адставаць ад афіцыйнай.');
      return { ...src, ...best };
    } catch (e) {
      errors.push(`${new URL(src.page).host}: ${e.message}`);
      console.warn(`Крыніца ${src.page} недаступная: ${e.message}`);
    }
  }
  throw new Error(errors.join('; '));
}

// ---------- крок 2: зліццё з базай ----------
async function main() {
  let sourceUrl = localFile ? `file://${localFile}` : null;
  let sourcePage = localFile ? null : SOURCES[0].page;
  let primary = true; // лакальны файл лічым паўнавартаснай крыніцай
  let buf, parsed;
  if (localFile) {
    buf = await fs.readFile(localFile);
    parsed = await parseDoc(buf);
  } else {
    try {
      ({ page: sourcePage, primary, url: sourceUrl, buf, items: parsed } = await fetchFromSources());
    } catch (e) {
      // Крыніца недаступная — база застаецца, а сайт пакажа папярэджанне «магла састарэць».
      await writeSourceError(META_FILE, e.message, now);
      console.warn(`Крыніца недаступная: ${e.message}. meta.sourceError запісаны, база не зменена.`);
      return;
    }
  }
  await fs.mkdir(CACHE_DIR, { recursive: true });
  await fs.writeFile(path.join(CACHE_DIR, 'latest.doc'), buf);

  console.log(`Разабрана запісаў у крыніцы: ${parsed.length}`);
  if (parsed.length < 100) throw new Error('Занадта мала запісаў — магчыма, змяніўся фармат файла');

  await fs.mkdir(DATA_DIR, { recursive: true });
  const db = await readJson(DB_FILE, []);
  // Зліццё (merge.mjs): новыя — added = today; зніклыя пазначаюцца толькі для асноўнай крыніцы (запасное люстэрка
  // можа быць старэйшым за базу); «зніклы» + «новы» з тым жа судом і амаль той жа назвай — праўка тэксту: новы
  // наследуе дату з’яўлення (не ідзе ў Telegram/RSS/«Новае»), стары вядзе на новы (replacedBy).
  const { out, added, removed, edits, initial } = mergeList(db, parsed, { today, force: FORCE, maxAdded: MAX_ADDED, isEdit, minRemoved: 50, primary });
  for (const [old, rec] of edits) console.log(`Праўка запісу ${old.id} → ${rec.id}: ${rec.name.replace(/\s+/g, ' ').slice(0, 90)}`);
  await fs.writeFile(DB_FILE, JSON.stringify(out));

  const meta = await readJson(META_FILE, {});
  const newMeta = {
    updated: today,
    checked: today,
    checkedAt: now, // поўны час апошняй праверкі крыніцы — паказваецца ў шапцы сайта
    sourceError: null,
    fallback: !primary, // узятая запасная крыніца — сайт папярэджвае, што база можа адставаць
    sourcePage,
    sourceFile: sourceUrl,
    total: out.filter((x) => !x.removed).length,
    lastAdded: added && !initial ? today : meta.lastAdded || null,
    lastAddedCount: initial ? 0 : added || meta.lastAddedCount || 0,
  };
  await fs.writeFile(META_FILE, JSON.stringify(newMeta, null, 2));
  console.log(`Дададзена новых: ${added}, выпраўлена: ${edits.length}, знікла з крыніцы: ${removed}, усяго ў базе: ${out.length}`);
}

// збой засцярог ці разбору — exit 1 (джоб падае, alert.mjs failed скажа адміну); meta.json пры гэтым не кранаем
runMain(import.meta.url, main);
