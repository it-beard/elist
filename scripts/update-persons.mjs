#!/usr/bin/env node
/**
 * Трэці спіс: «Перечень граждан Республики Беларусь, иностранных граждан или лиц без гражданства, причастных
 * к экстремистской деятельности» (МУС). Публікуецца некалькімі .doc-файламі («Часть 1…N») у той жа навіне,
 * што і пералік фарміраванняў (SOURCE_PAGE, пререндэр ?_escaped_fragment_=). Старыя часткі не мяняюцца,
 * апошняя дапаўняецца амаль штотыдня — таму правяраем усе часткі пры кожным запуску.
 *
 * Спампоўвае ўсе часткі (з паўторамі: сервер МУС часам абрывае вялікія файлы; на ўсё — агульны ліміт часу
 * BUDGET, каб крок ніколі не паваліў увесь джоб) → разбірае (scripts/parse-persons.mjs) → зліццё з
 * data/persons.json (mergePersons) з нумарам часткі ў кожным запісе (assignParts) — з яго старонка запісу дае
 * спасылку на файл, у якім чалавек ёсць; самі адрасы частак ідуць у мету (sourceFiles).
 * Усё ці нічога: любы збой — недаступная крыніца, змена фармату, падазроныя лічбы — пакідае базу як была,
 * а ў data/persons-meta.json пішацца sourceError: сайт папярэдзіць, адмін атрымае алерт (scripts/alert.mjs
 * source). Сеткавы збой — exit 0 (не наш клопат), збой засцярог ці фармату — exit 1.
 * Першы імпарт: added = null для ўсіх — нічога не «новае», дайджэст маўчыць.
 *
 * Лакальна: node scripts/update-persons.mjs частка1.doc частка2.doc … (у парадку частак).
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import WordExtractor from 'word-extractor';
import {
  CACHE_DIR, DATA_DIR, FORCE, FormatError, downloadBuffer, expectedLength, fetchPrerendered, findLinks, readJson, runMain, writeSourceError,
} from './common.mjs';
import { mergePersons, parsePersons } from './parse-persons.mjs';

const DB_FILE = path.join(DATA_DIR, 'persons.json');
const META_FILE = path.join(DATA_DIR, 'persons-meta.json');
const SOURCE_PAGE = process.env.PERSONS_SOURCE || 'https://www.mvd.gov.by/ru/news/8642';
const PAGE_TIMEOUT = 60_000, FILE_TIMEOUT = 180_000, RETRIES = 3;
const BUDGET = Number(process.env.PERSONS_BUDGET_MS) || 18 * 60_000; // на ўсе спампоўкі разам — менш за таймаўт джоба
const MIN_TOTAL = 1000;     // менш — узятыя не тыя файлы ці змяніўся фармат
const MIN_PART = 50;        // для ўсіх частак, акрамя апошняй: новая «Часть N» першыя тыдні законна маленькая
const MIN_BYTES = 15_000;   // .doc з табліцай меншым не бывае
const SHRINK = 0.02;        // частка «паменшылася» больш чым на 2 % (і больш за 5 запісаў) — падазрона
const MAX_ADDED = Number(process.env.MAX_ADDED) || 300; // пералік расце на дзясяткі за тыдзень

const started = Date.now();
const now = new Date().toISOString();
const today = now.slice(0, 10);
const localFiles = process.argv.slice(2); // неабавязкова: лакальныя .doc для тэсту (у парадку частак)
const remaining = () => BUDGET - (Date.now() - started);

/**
 * Нумар .doc-часткі ў запісы, якія цяпер ёсць у крыніцы (сайт дае з яго спасылку на файл). Пішацца пасля зліцця,
 * а не полем запісу: перанумараваная частка — не праўка тэксту, і сотні «выпраўленых» запісаў з-за яе не з'явяцца.
 * Запіс, які знік з крыніцы, пакідае апошні вядомы нумар — на сайце спасылкі для яго ўсё роўна няма.
 */
export function assignParts(out, parts) {
  const partOf = new Map();
  parts.forEach((p, i) => { for (const it of p.items) partOf.set(it.id, i + 1); });
  for (const rec of out) { const n = partOf.get(rec.id); if (n) rec.part = n; }
  return out;
}

/** Пазначыць збой у меце (сайт папярэдзіць, адмін атрымае алерт), базу не чапаць. */
const failMeta = (message) => writeSourceError(META_FILE, message, now);

/**
 * Спасылкі на .doc пераліку фізічных асоб: сярод усіх .doc на старонцы — тыя, чый подпіс згадвае «граждан»
 * (пералік арганізацый ляжыць побач як .xlsx). Парадак — па нумары «Часть N» у подпісе, без нумара — як на старонцы.
 */
export function findPersonDocs(html, pageUrl) {
  const links = findLinks(html, pageUrl, /\.docx?$/i).filter((l) => /граждан|физическ/i.test(l.label));
  const uniq = [...new Map(links.map((l) => [l.url, l])).values()];
  if (!uniq.length) throw new Error('На старонцы не знойдзена спасылак на .doc пераліку фізічных асоб');
  const part = (l) => { const m = l.label.match(/часть\s*(\d+)/i); return m ? Number(m[1]) : Number.MAX_SAFE_INTEGER; };
  return uniq.sort((a, b) => part(a) - part(b) || a.i - b.i).map(({ url, label }) => ({ url, label }));
}

/**
 * Засцярогі па частках: усе, акрамя апошняй, не карацейшыя за MIN_PART; разам не менш за MIN_TOTAL; частак не менш,
 * чым было (зніклая частка — гэта тысячы «зніклых» запісаў); раней бачаная частка (той жа парадкавы нумар)
 * не паменшылася больш чым на SHRINK. Дзве апошнія засцярогі здымае force. Вяртае паведамленне ці null.
 */
export function partsProblem(counts, prevCounts = [], { minPart = MIN_PART, minTotal = MIN_TOTAL, shrink = SHRINK, force = false } = {}) {
  const total = counts.reduce((a, b) => a + b, 0);
  const small = counts.slice(0, -1).findIndex((n) => n < minPart);
  if (small >= 0) return `Занадта мала запісаў у частцы ${small + 1} (${counts[small]}) — магчыма, змяніўся фармат файла`;
  if (total < minTotal) return `Занадта мала запісаў (${total}) — магчыма, змяніўся фармат файла ці ўзятыя не тыя файлы`;
  if (!force) {
    if (counts.length < prevCounts.length) return `Падазрона: на старонцы ${counts.length} частак замест ${prevCounts.length}. Абнаўленне спынена; каб прыняць, задайце UPDATE_FORCE=1.`;
    for (let i = 0; i < counts.length; i++) {
      const prev = prevCounts[i];
      if (prev && counts[i] < prev - Math.max(5, prev * shrink)) return `Падазрона: частка ${i + 1} паменшылася з ${prev} да ${counts[i]} запісаў. Абнаўленне спынена; каб прыняць, задайце UPDATE_FORCE=1.`;
    }
  }
  return null;
}

/**
 * Спампаваць з паўторамі ў межах агульнага ліміту часу: абарваны файл не разбіраецца — бяром зноў. Калі ж файл
 * спампаваны цалкам (content-length сышоўся), а разбор усё роўна падае — гэта фармат, а не сетка: FormatError
 * без паўтораў (main прапускае яе далей — sourceError у меце і exit 1).
 */
async function download(url) {
  let lastErr;
  for (let attempt = 1; attempt <= RETRIES; attempt++) {
    const left = remaining();
    if (left < 20_000) throw new Error(`вычарпаны ліміт часу на спампоўку (${Math.round(BUDGET / 60_000)} хв)`);
    try {
      const { buf, res } = await downloadBuffer(url, { timeout: Math.min(FILE_TIMEOUT, left), minBytes: MIN_BYTES });
      let doc;
      try { doc = await parseDoc(buf); } catch (e) {
        if (expectedLength(res.headers) !== null) throw new FormatError(`файл спампаваны цалкам, але не разбіраецца (${url}): ${e.message}`);
        throw e;
      }
      console.log(`Разабрана запісаў: ${doc.items.length} (${url})`);
      return { buf, ...doc };
    } catch (e) {
      if (e instanceof FormatError) throw e;
      lastErr = e;
      console.warn(`Спроба ${attempt}/${RETRIES} не ўдалася (${url}): ${e.message}`);
      if (attempt < RETRIES) await new Promise((r) => setTimeout(r, 5000 * attempt));
    }
  }
  throw lastErr;
}

async function parseDoc(buf) {
  const doc = await new WordExtractor().extract(buf);
  const stats = {};
  const items = parsePersons(doc.getBody(), stats);
  if (stats.skipped || stats.unanchored || stats.leftover || stats.noIncluded) {
    console.warn(`Разбор: якараў без імя ${stats.skipped}, падстаў без даты побач ${stats.unanchored}, адкінутых ячэек ${stats.leftover}, запісаў без даты ўключэння ${stats.noIncluded}`);
  }
  if (stats.excluded) console.log(`Выключаных з пераліку (нумар без даных): ${stats.excluded}`);
  return { items, stats };
}

async function main() {
  let parts; // [{ url, label, items, stats, buf }]
  if (localFiles.length) {
    parts = [];
    for (const f of localFiles) parts.push({ url: `file://${path.resolve(f)}`, ...(await parseDoc(await fs.readFile(f))) });
  } else {
    try {
      const html = await fetchPrerendered(SOURCE_PAGE, { timeout: Math.min(PAGE_TIMEOUT, Math.max(1000, remaining())) });
      const docs = findPersonDocs(html, SOURCE_PAGE);
      console.log(`Частак пераліку на старонцы: ${docs.length}`);
      parts = [];
      for (const d of docs) parts.push({ url: d.url, label: d.label, ...(await download(d.url)) });
    } catch (e) {
      if (e instanceof FormatError) throw e; // не сетка, а фармат файла: sourceError і exit 1 (runMain)
      // Крыніца недаступная — база застаецца, сайт пакажа папярэджанне, адмін атрымае алерт пры змене стану.
      await failMeta(e.message);
      console.warn(`Крыніца пераліку фізічных асоб недаступная: ${e.message}. sourceError запісаны, база не зменена.`);
      return;
    }
  }
  const meta = await readJson(META_FILE, {});
  const counts = parts.map((p) => p.items.length);
  const parsed = parts.flatMap((p) => p.items);
  console.log(`Разабрана запісаў у крыніцы: ${parsed.length} (${counts.join(' + ')})`);
  const problem = partsProblem(counts, meta.partCounts || [], { force: FORCE });
  if (problem) throw new Error(problem);
  const dupIds = parsed.length - new Set(parsed.map((x) => x.id)).size;
  if (dupIds) console.warn(`Увага: ${dupIds} запісаў з аднолькавым id (імя + дата нараджэння + дата ўключэння) — застаецца апошні`);
  await fs.mkdir(CACHE_DIR, { recursive: true });
  await Promise.all(parts.map((p, i) => (p.buf ? fs.writeFile(path.join(CACHE_DIR, `persons-${i + 1}.doc`), p.buf) : null)));

  await fs.mkdir(DATA_DIR, { recursive: true });
  const db = await readJson(DB_FILE, []);
  const { out, added, removed, edited, edits, initial } = mergePersons(db, parsed, { today, force: FORCE, maxAdded: MAX_ADDED });
  for (const [old, rec] of edits) console.log(`Праўка запісу ${old.id} → ${rec.id}: ${rec.name}`);
  await fs.writeFile(DB_FILE, JSON.stringify(assignParts(out, parts)));

  const parse = parts.reduce((a, p) => { for (const k of Object.keys(p.stats || {})) a[k] = (a[k] || 0) + p.stats[k]; return a; }, {});
  await fs.writeFile(META_FILE, JSON.stringify({
    updated: added || removed || edited || edits.length || !meta.updated ? today : meta.updated,
    checked: today,
    checkedAt: now,
    sourceError: null,
    sourcePage: SOURCE_PAGE,
    sourceFiles: parts.map((p) => p.url),
    parts: parts.length,
    partCounts: counts,
    parse,
    total: out.filter((x) => !x.removed).length,
    lastAdded: added && !initial ? today : meta.lastAdded || null,
    lastAddedCount: initial ? 0 : added || meta.lastAddedCount || 0,
  }, null, 2));
  console.log(`Фізічныя асобы: дададзена ${added}, выпраўлена ${edited + edits.length}, знікла ${removed}, усяго ў базе ${out.length}${initial ? ' (першы імпарт — без пазнакі «новае»)' : ''}`);
}

// пры імпарце з тэстаў (findPersonDocs, partsProblem) нічога не запускаем; засцярога ці фармат — sourceError у меце і exit 1
runMain(import.meta.url, main, { metaFile: META_FILE });
