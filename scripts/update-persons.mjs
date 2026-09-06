#!/usr/bin/env node
/**
 * Трэці спіс: «Перечень граждан Республики Беларусь, иностранных граждан или лиц без гражданства, причастных
 * к экстремистской деятельности» (МУС). Публікуецца некалькімі .doc-файламі («Часть 1…N») у той жа навіне,
 * што і пералік фарміраванняў (SOURCE_PAGE, пререндэр ?_escaped_fragment_=). Старыя часткі не мяняюцца,
 * апошняя дапаўняецца амаль штотыдня — таму правяраем усе часткі пры кожным запуску.
 *
 * Спампоўвае ўсе часткі (з паўторамі: сервер МУС часам абрывае вялікія файлы) → разбірае
 * (scripts/parse-persons.mjs) → даўносіць запісы ў data/persons.json. Усё ці нічога: калі хоць адна частка
 * не спампавалася, база не кранаецца, а ў data/persons-meta.json пішацца sourceError (сайт папярэдзіць).
 * Структура і засцярогі — як у scripts/update-formations.mjs; праўкі ў крыніцы пазнаюцца (pairPersonEdits)
 * і не лічацца новымі запісамі. Першы імпарт: added = null для ўсіх — нічога не «новае», дайджэст маўчыць.
 *
 * Лакальна: node scripts/update-persons.mjs частка1.doc частка2.doc … (у парадку частак).
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import WordExtractor from 'word-extractor';
import { pairPersonEdits, parsePersons } from './parse-persons.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA_DIR = path.join(ROOT, 'data');
const DB_FILE = path.join(DATA_DIR, 'persons.json');
const META_FILE = path.join(DATA_DIR, 'persons-meta.json');
const CACHE_DIR = path.join(ROOT, '.cache');
const SOURCE_PAGE = process.env.PERSONS_SOURCE || 'https://www.mvd.gov.by/ru/news/8642';
const UA = 'Mozilla/5.0 (compatible; extremist-materials-search; +https://github.com)';
const PAGE_TIMEOUT = 60_000, FILE_TIMEOUT = 240_000, RETRIES = 3;
const MIN_TOTAL = 1000;     // менш — узятыя не тыя файлы ці змяніўся фармат
const MIN_PART = 50;        // кожная частка — сотні запісаў; амаль пустая частка = сапсаваны файл
const MAX_ADDED = Number(process.env.MAX_ADDED) || 300; // пералік расце на дзясяткі за тыдзень
const FORCE = ['1', 'true'].includes(process.env.UPDATE_FORCE);

const now = new Date().toISOString();
const today = now.slice(0, 10);
const localFiles = process.argv.slice(2); // неабавязкова: лакальныя .doc для тэсту (у парадку частак)

async function readJson(file, fallback) {
  try { return JSON.parse(await fs.readFile(file, 'utf8')); } catch { return fallback; }
}

/**
 * Спасылкі на .doc пераліку фізічных асоб: сярод усіх .doc на старонцы — тыя, чый подпіс згадвае «граждан»
 * (пералік арганізацый ляжыць побач як .xlsx). Парадак — па нумары «Часть N» у подпісе, без нумара — як на старонцы.
 */
export function findPersonDocs(html, pageUrl) {
  const links = [...html.matchAll(/<a\b[^>]*href=["']([^"']+\.docx?)["'][^>]*>([\s\S]*?)<\/a>/gi)]
    .map((m, i) => ({ url: new URL(m[1].replace(/&amp;/g, '&'), pageUrl).href, label: m[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(), i }))
    .filter((l) => /граждан|физическ/i.test(l.label));
  const uniq = [...new Map(links.map((l) => [l.url, l])).values()];
  if (!uniq.length) throw new Error('На старонцы не знойдзена спасылак на .doc пераліку фізічных асоб');
  const part = (l) => { const m = l.label.match(/часть\s*(\d+)/i); return m ? Number(m[1]) : Number.MAX_SAFE_INTEGER; };
  return uniq.sort((a, b) => part(a) - part(b) || a.i - b.i).map(({ url, label }) => ({ url, label }));
}

async function fetchPage() {
  const url = `${SOURCE_PAGE}${SOURCE_PAGE.includes('?') ? '&' : '?'}_escaped_fragment_=`;
  const res = await fetch(url, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(PAGE_TIMEOUT) });
  if (!res.ok) throw new Error(`Не ўдалося атрымаць старонку: HTTP ${res.status}`);
  return res.text();
}

/** Спампаваць з паўторамі: абарваны файл не разбіраецца (word-extractor кідае памылку) — бяром зноў. */
async function download(url) {
  let lastErr;
  for (let attempt = 1; attempt <= RETRIES; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(FILE_TIMEOUT) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      const expected = Number(res.headers.get('content-length'));
      if (expected && buf.length !== expected) throw new Error(`абарваны файл (${buf.length} з ${expected} байт)`);
      if (buf.length < 100_000) throw new Error('файл падазрона малы');
      const items = await parseDoc(buf);
      console.log(`Спампавана: ${url} (${(buf.length / 1e6).toFixed(1)} MB, Last-Modified: ${res.headers.get('last-modified') || '?'}), запісаў: ${items.length}`);
      return { buf, items };
    } catch (e) {
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
  if (stats.skipped || stats.unanchored) console.warn(`Разбор: прапушчана якараў без імя ${stats.skipped}, падстаў без даты побач ${stats.unanchored}`);
  if (stats.excluded) console.log(`Выключаных з пераліку (нумар без даных): ${stats.excluded}`);
  return items;
}

async function main() {
  let parts; // [{ url, items, buf }]
  if (localFiles.length) {
    parts = [];
    for (const f of localFiles) parts.push({ url: `file://${path.resolve(f)}`, items: await parseDoc(await fs.readFile(f)) });
  } else {
    try {
      const docs = findPersonDocs(await fetchPage(), SOURCE_PAGE);
      console.log(`Частак пераліку на старонцы: ${docs.length}`);
      parts = [];
      for (const d of docs) parts.push({ url: d.url, label: d.label, ...(await download(d.url)) });
    } catch (e) {
      const meta = await readJson(META_FILE, {});
      await fs.writeFile(META_FILE, JSON.stringify({ ...meta, checked: today, checkedAt: now, sourceError: e.message }, null, 2));
      console.warn(`Крыніца пераліку фізічных асоб недаступная: ${e.message}. sourceError запісаны, база не зменена.`);
      return;
    }
  }
  const parsed = parts.flatMap((p) => p.items);
  console.log(`Разабрана запісаў у крыніцы: ${parsed.length} (${parts.map((p) => p.items.length).join(' + ')})`);
  const small = parts.find((p) => p.items.length < MIN_PART);
  if (small) throw new Error(`Занадта мала запісаў у частцы ${small.url} (${small.items.length}) — магчыма, змяніўся фармат файла`);
  if (parsed.length < MIN_TOTAL) throw new Error(`Занадта мала запісаў (${parsed.length}) — магчыма, змяніўся фармат файла ці ўзятыя не тыя файлы`);
  const dupIds = parsed.length - new Set(parsed.map((x) => x.id)).size;
  if (dupIds) console.warn(`Увага: ${dupIds} запісаў з аднолькавым id (імя + дата нараджэння + дата ўключэння) — застаецца апошні`);
  await fs.mkdir(CACHE_DIR, { recursive: true });
  await Promise.all(parts.map((p, i) => (p.buf ? fs.writeFile(path.join(CACHE_DIR, `persons-${i + 1}.doc`), p.buf) : null)));

  await fs.mkdir(DATA_DIR, { recursive: true });
  const db = await readJson(DB_FILE, []);
  const byId = new Map(db.map((x) => [x.id, x]));
  const initial = db.length === 0; // першы імпарт: нічога не «новае»
  const addedRecs = [];
  let edited = 0;
  const seen = new Set();
  const FIELDS = ['num', 'name', 'translit', 'citizenship', 'birth', 'basis', 'court', 'articles', 'included', 'date', 'address', 'info'];
  const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
  parsed.forEach((it, i) => {
    seen.add(it.id);
    const ex = byId.get(it.id);
    if (ex) {
      // той жа чалавек: дапісаная дата ўключэння, нумар, статус ці адрас — праўка, а не новы запіс
      const changed = FIELDS.some((k) => !same(ex[k], it[k]));
      if (changed) { Object.assign(ex, it); ex.edited = today; edited++; }
      ex.order = i;
      if (ex.removed) { delete ex.removed; delete ex.replacedBy; } // запіс вярнуўся ў пералік
    } else {
      const rec = { ...it, order: i, added: initial ? null : today };
      byId.set(it.id, rec);
      addedRecs.push(rec);
    }
  });
  const removedRecs = [];
  for (const it of byId.values()) if (!seen.has(it.id) && !it.removed) removedRecs.push(it);

  // Праўкі: «зніклы» + «новы» з той жа датай уключэння і амаль тым жа імем ці датай нараджэння — адзін чалавек.
  const edits = initial ? [] : pairPersonEdits(removedRecs, addedRecs);
  const paired = new Set();
  for (const [old, rec] of edits) {
    rec.added = old.added; rec.edited = today; rec.editOf = old.id;
    old.removed = today; old.replacedBy = rec.id;
    paired.add(old.id); paired.add(rec.id);
    console.log(`Праўка запісу ${old.id} → ${rec.id}: ${rec.name}`);
  }
  const added = addedRecs.filter((r) => !paired.has(r.id)).length;
  let removed = 0;
  for (const it of removedRecs) if (!paired.has(it.id)) { it.removed = today; removed++; }

  if (!initial && removed > Math.max(20, db.length * 0.05)) {
    throw new Error(`Падазрона: ${removed} запісаў знікла з пераліку, ${added} дададзена. Абнаўленне спынена — праверце файлы крыніцы.`);
  }
  if (!initial && !FORCE && added > MAX_ADDED) {
    throw new Error(`Падазрона: ${added} новых запісаў за адзін раз (ліміт ${MAX_ADDED}). Абнаўленне спынена; каб прыняць, задайце UPDATE_FORCE=1.`);
  }
  const out = [...byId.values()].sort((a, b) => a.order - b.order);
  await fs.writeFile(DB_FILE, JSON.stringify(out));

  const meta = await readJson(META_FILE, {});
  await fs.writeFile(META_FILE, JSON.stringify({
    updated: added || removed || edited || edits.length || !meta.updated ? today : meta.updated,
    checked: today,
    checkedAt: now,
    sourceError: null,
    sourcePage: SOURCE_PAGE,
    sourceFiles: parts.map((p) => p.url),
    parts: parts.length,
    total: out.filter((x) => !x.removed).length,
    lastAdded: added && !initial ? today : meta.lastAdded || null,
    lastAddedCount: initial ? 0 : added || meta.lastAddedCount || 0,
  }, null, 2));
  console.log(`Фізічныя асобы: дададзена ${added}, выпраўлена ${edited + edits.length}, знікла ${removed}, усяго ў базе ${out.length}${initial ? ' (першы імпарт — без пазнакі «новае»)' : ''}`);
}

// пры імпарце з тэстаў (findPersonDocs) нічога не запускаем
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
