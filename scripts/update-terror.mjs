#!/usr/bin/env node
/**
 * Пералік КДБ «организаций и физических лиц, причастных к террористической деятельности» (фізічныя асобы).
 * Афіцыйная старонка (SOURCE_PAGE) не адказвае з-за мяжы — у тым ліку з раннераў GitHub; абнаўленні КДБ публікуе
 * файлам «Перечень.xlsx» у сваім Telegram-канале (CHANNEL), але вэб-прэв’ю канала спасылак на файлы не дае, а бот
 * не можа перасылаць пасты з чужога канала. Таму крыніцы па парадку:
 *   1) лакальны файл: node scripts/update-terror.mjs Перечень.xlsx [дата версіі] — дата «11.09.2026» ці ISO з паста
 *      ў канале; без яе бярэцца дата захавання файла з docProps (адстае ад паста на дзень-два);
 *   2) Telegram праз карыстальніцкі акаўнт (MTProto, пакет `telegram` — gramjs, ставіцца асобна): TELEGRAM_API_ID,
 *      TELEGRAM_API_HASH, TELEGRAM_SESSION (StringSession, гл. scripts/telegram-session.mjs); бярэцца апошні пост канала
 *      з файлам .xlsx і назвай пераліку, дата версіі — з тэксту паста «… от 11.09.2026»;
 *   3) прамы адрас файла TERROR_SOURCE (люстэрка, калі з’явіцца, ці аднаразова — укладанне ў GitHub issue, перададзенае
 *      параметрам ручнога запуску воркфлоў); дата версіі для гэтага шляху — TERROR_DATE (неабавязкова).
 * Нічога не наладжана — ціхі выхад без змены меты: база і дата апошняй праверкі застаюцца ад лакальнага запуску.
 * Яшчэ адзін шлях без гэтага скрыпта наўпрост — тэчка inbox/terror/ у рэпазіторыі (джоб inbox у воркфлоў CI).
 *
 * Разбор — scripts/parse-terror.mjs (толькі фізічныя асобы з нацыянальнай падставай, без санкцыйных пералікаў ААН),
 * зліццё — mergeTerror у data/terror.json. Усё ці нічога: недаступная крыніца, змена фармату ці засцярога пакідаюць
 * базу як была, а ў data/terror-meta.json пішацца sourceError (сайт папярэдзіць, адмін атрымае алерт). Сеткавы збой —
 * exit 0, збой фармату ці засцярог — exit 1. Першы імпарт: added = null для ўсіх — нічога не «новае».
 * На сайце гэтыя запісы ўліваюцца ў спіс фізічных асоб (foldTerror у scripts/index-rows.mjs).
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { CACHE_DIR, DATA_DIR, FORCE, FormatError, downloadBuffer, readJson, runMain, writeSourceError } from './common.mjs';
import { readXlsxSheets, xlsxModified } from './xlsx.mjs';
import { mergeTerror, parseTerror } from './parse-terror.mjs';

const DB_FILE = path.join(DATA_DIR, 'terror.json');
const META_FILE = path.join(DATA_DIR, 'terror-meta.json');
const SOURCE_PAGE = 'https://www.kgb.by/ru/perechen-inf-ru/';
const CHANNEL = process.env.TERROR_CHANNEL || 'KGB_BY_channel';
const SOURCE_URL = process.env.TERROR_SOURCE || '';
const ENV_DATE = process.env.TERROR_DATE || '';
const TG = { apiId: process.env.TELEGRAM_API_ID, apiHash: process.env.TELEGRAM_API_HASH, session: process.env.TELEGRAM_SESSION };
const FILE_TIMEOUT = 120_000, TG_LIMIT = 30;
const MIN_TOTAL = 300;   // нацыянальных запісаў у пераліку — сотні; менш — узяты не той ліст ці змяніўся фармат
const MAX_ADDED = Number(process.env.MAX_ADDED) || 100; // за адно абнаўленне КДБ дадае адзінкі-дзясяткі

const now = new Date().toISOString();
const today = now.slice(0, 10);
const [localFile, localDate] = process.argv.slice(2);

const TITLE_RE = /перечень\s+организаций\s+и\s+физических\s+лиц,?\s+причастных\s+к\s+террористической\s+деятельности/i;

/** «… от 11.09.2026» ці «2026-09-11» → ISO-дата; іншае — null. */
export function parseListDate(s) {
  const m = String(s || '').match(/(\d{1,2})\.(\d{2})\.(\d{4})/);
  if (m) return `${m[3]}-${m[2]}-${m[1].padStart(2, '0')}`;
  return /^\d{4}-\d{2}-\d{2}$/.test(s || '') ? s : null;
}

/** Найноўшы пост канала з файлам пераліку: назва файла .xlsx і тэкст пра пералік; posts — [{ id, text, fileName }]. */
export function pickPost(posts) {
  return (posts || [])
    .filter((p) => /\.xlsx$/i.test(p.fileName || '') && TITLE_RE.test(p.text || ''))
    .sort((a, b) => b.id - a.id)[0] || null;
}

/** Файл з апошняга паста канала праз MTProto (gramjs). Пакет `telegram` ставіцца асобна (npm i telegram). */
async function fetchFromTelegram() {
  let TelegramClient, StringSession;
  try {
    ({ TelegramClient } = await import('telegram'));
    ({ StringSession } = await import('telegram/sessions/index.js'));
  } catch (e) {
    throw new Error(`пакет telegram (gramjs) не ўсталяваны — npm i telegram (${e.message})`);
  }
  const client = new TelegramClient(new StringSession(TG.session), Number(TG.apiId), TG.apiHash, { connectionRetries: 3 });
  await client.connect();
  try {
    if (!(await client.isUserAuthorized())) throw new Error('сесія Telegram не аўтарызаваная — згенеруйце TELEGRAM_SESSION нанова (scripts/telegram-session.mjs)');
    const msgs = await client.getMessages(CHANNEL, { limit: TG_LIMIT });
    const posts = msgs.map((m) => ({
      id: m.id, text: m.message || '', date: m.date, raw: m,
      fileName: m.document?.attributes?.find((a) => a.className === 'DocumentAttributeFilename')?.fileName || '',
    }));
    const post = pickPost(posts);
    if (!post) throw new Error(`у апошніх ${TG_LIMIT} пастах @${CHANNEL} няма файла пераліку (.xlsx)`);
    const media = await client.downloadMedia(post.raw, {});
    const buf = Buffer.isBuffer(media) ? media : Buffer.from(media || []);
    if (buf.length < 10_000) throw new Error('файл з Telegram падазрона малы ці пусты');
    console.log(`Спампавана з Telegram: https://t.me/${CHANNEL}/${post.id} (${post.fileName}, ${(buf.length / 1e3).toFixed(0)} KB)`);
    const listDate = parseListDate(post.text) || (post.date ? new Date(post.date * 1000).toISOString().slice(0, 10) : null);
    return { buf, sourceUrl: `https://t.me/${CHANNEL}/${post.id}`, listDate };
  } finally {
    await client.disconnect().catch(() => {});
  }
}

/** Крыніца недаступная: база застаецца, сайт пакажа папярэджанне, адмін атрымае алерт пры змене стану. */
async function unavailable(e) {
  await writeSourceError(META_FILE, e.message, now);
  console.warn(`Крыніца пераліку КДБ недаступная: ${e.message}. sourceError запісаны, база не зменена.`);
}

async function main() {
  let buf, sourceUrl, listDate = null;
  if (localFile) {
    buf = await fs.readFile(localFile);
    sourceUrl = `file://${path.resolve(localFile)}`;
    if (localDate) { listDate = parseListDate(localDate); if (!listDate) throw new Error(`Незразумелая дата версіі пераліку: ${localDate} (чакаецца «11.09.2026»)`); }
  } else if (TG.apiId && TG.apiHash && TG.session) {
    try { ({ buf, sourceUrl, listDate } = await fetchFromTelegram()); } catch (e) { await unavailable(e); return; }
  } else if (SOURCE_URL) {
    if (ENV_DATE) { listDate = parseListDate(ENV_DATE); if (!listDate) throw new Error(`Незразумелая дата версіі пераліку TERROR_DATE: ${ENV_DATE} (чакаецца «11.09.2026»)`); }
    try { ({ buf } = await downloadBuffer(SOURCE_URL, { timeout: FILE_TIMEOUT })); sourceUrl = SOURCE_URL; } catch (e) { await unavailable(e); return; }
  } else {
    console.log('Крыніца пераліку КДБ не наладжана (лакальны файл, TELEGRAM_API_ID/HASH/SESSION ці TERROR_SOURCE) — прапускаю.');
    return;
  }
  let sheets;
  try { sheets = readXlsxSheets(buf); } catch (e) { throw new FormatError(`файл не разбіраецца як .xlsx: ${e.message}`); }
  listDate = listDate || xlsxModified(buf) || today;
  const stats = {};
  const parsed = parseTerror(sheets, stats);
  console.log(`Разабрана: радкоў ${stats.total}, нацыянальных запісаў ${parsed.length}, з пералікаў ААН прапушчана ${stats.un}, без імя ці падставы ${stats.skipped}, без даты нараджэння ${stats.noBirth}; версія пераліку ад ${listDate}`);
  if (parsed.length < MIN_TOTAL) throw new Error(`Занадта мала запісаў (${parsed.length}) — магчыма, змяніўся фармат файла ці ўзяты не той ліст`);
  const dupIds = parsed.length - new Set(parsed.map((x) => x.id)).size;
  if (dupIds) console.warn(`Увага: ${dupIds} запісаў з аднолькавым id (імя + дата нараджэння) — застаецца апошні`);
  await fs.mkdir(CACHE_DIR, { recursive: true });
  await fs.writeFile(path.join(CACHE_DIR, 'terror.xlsx'), buf);

  await fs.mkdir(DATA_DIR, { recursive: true });
  const db = await readJson(DB_FILE, []);
  const { out, added, removed, edited, edits, initial } = mergeTerror(db, parsed, { today, force: FORCE, maxAdded: MAX_ADDED, listDate });
  for (const [old, rec] of edits) console.log(`Праўка запісу ${old.id} → ${rec.id}: ${rec.name}`);
  await fs.writeFile(DB_FILE, JSON.stringify(out));

  const meta = await readJson(META_FILE, {});
  await fs.writeFile(META_FILE, JSON.stringify({
    updated: added || removed || edited || edits.length || !meta.updated ? today : meta.updated,
    checked: today,
    checkedAt: now,
    sourceError: null,
    sourcePage: SOURCE_PAGE,
    sourceFile: sourceUrl,
    channel: `https://t.me/${CHANNEL}`,
    sourceDate: listDate,            // дата версіі пераліку (з паста ў канале ці з docProps файла) — паказваецца ў шапцы
    parse: stats,
    total: out.filter((x) => !x.removed).length,
    lastAdded: added && !initial ? today : meta.lastAdded || null,
    lastAddedCount: initial ? 0 : added || meta.lastAddedCount || 0,
  }, null, 2));
  console.log(`Пералік КДБ: дададзена ${added}, выпраўлена ${edited + edits.length}, знікла ${removed}, усяго ў базе ${out.length}${initial ? ' (першы імпарт — без пазнакі «новае»)' : ''}`);
}

// пры імпарце з тэстаў (parseListDate, pickPost) нічога не запускаем; засцярога ці фармат — sourceError у меце і exit 1
runMain(import.meta.url, main, { metaFile: META_FILE });
