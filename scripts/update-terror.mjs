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
 *   3) файл, перасланы адмінам боту (Bot API getUpdates; TELEGRAM_BOT_TOKEN + TELEGRAM_ADMIN_CHAT_ID): адмін перасылае
 *      пост канала ў асабісты чат з ботам, і пры наступным запуску скрыпт забірае дакумент .xlsx адтуль (толькі з
 *      адмін-чата), дата версіі — з подпісу пераслапага паста; убачаныя абнаўленні пацвярджаюцца (offset);
 *   4) прамы адрас файла TERROR_SOURCE (люстэрка, калі з’явіцца, ці аднаразова — укладанне ў GitHub issue, перададзенае
 *      параметрам ручнога запуску воркфлоў); дата версіі для гэтага шляху — TERROR_DATE (неабавязкова).
 * Калі файла ніадкуль няма, скрыпт глядзіць публічнае вэб-прэв’ю канала (PREVIEW_URL — яно з-за мяжы чытаецца): калі
 * там версія навейшая за тую, што ў базе (sourceDate), і пра яе яшчэ не паведамлялі (announcedPost у меце), адмін
 * атрымлівае ў чат допіс са спасылкай на пост — так не трэба падпісвацца на канал; дата праверкі ў меце абнаўляецца.
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
import { CACHE_DIR, DATA_DIR, FORCE, FormatError, UA, downloadBuffer, readJson, runMain, writeSourceError } from './common.mjs';
import { readXlsxSheets, unescapeXml, xlsxModified } from './xlsx.mjs';
import { mergeTerror, parseTerror } from './parse-terror.mjs';

const DB_FILE = path.join(DATA_DIR, 'terror.json');
const META_FILE = path.join(DATA_DIR, 'terror-meta.json');
const SOURCE_PAGE = 'https://www.kgb.by/ru/perechen-inf-ru/';
const CHANNEL = process.env.TERROR_CHANNEL || 'KGB_BY_channel';
const PREVIEW_URL = `https://t.me/s/${CHANNEL}`;
const SOURCE_URL = process.env.TERROR_SOURCE || '';
const ENV_DATE = process.env.TERROR_DATE || '';
const TG = { apiId: process.env.TELEGRAM_API_ID, apiHash: process.env.TELEGRAM_API_HASH, session: process.env.TELEGRAM_SESSION };
const BOT = { token: process.env.TELEGRAM_BOT_TOKEN, admin: process.env.TELEGRAM_ADMIN_CHAT_ID };
const PAGE_TIMEOUT = 60_000, FILE_TIMEOUT = 120_000, TG_LIMIT = 30;
const MIN_TOTAL = 300;   // нацыянальных запісаў у пераліку — сотні; менш — узяты не той ліст ці змяніўся фармат
const MAX_ADDED = Number(process.env.MAX_ADDED) || 100; // за адно абнаўленне КДБ дадае адзінкі-дзясяткі
const MAX_BOT_FILE = 5e6;  // файл пераліку ~0,5 МБ; большае боту не пераслалі б

const now = new Date().toISOString();
const today = now.slice(0, 10);
const [localFile, localDate] = process.argv.slice(2);

const TITLE_RE = /перечень\s+организаций\s+и\s+физических\s+лиц,?\s+причастных\s+к\s+террористической\s+деятельности/i;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const dateShort = (iso) => (iso ? iso.split('-').reverse().join('.') : '');

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

/**
 * Пасты з публічнага вэб-прэв’ю канала (t.me/s/…): { id, text, fileName, size, date } — найноўшыя спачатку. Спасылак на
 * самі файлы прэв’ю не дае, толькі назву і памер. Чыстая функцыя; HTML — чужы, бяруцца толькі патрэбныя фрагменты.
 */
export function parseChannelPreview(html) {
  const text = (s) => unescapeXml(String(s || '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ')).replace(/\s+/g, ' ').trim();
  const posts = [];
  for (const chunk of String(html || '').split(/(?=<div class="tgme_widget_message_wrap)/)) {
    const id = Number((chunk.match(/\bdata-post="[^"/]+\/(\d+)"/) || [])[1]);
    if (!id) continue;
    posts.push({
      id,
      text: text((chunk.match(/class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/) || [])[1]),
      fileName: text((chunk.match(/tgme_widget_message_document_title[^>]*>([^<]*)</) || [])[1]),
      size: text((chunk.match(/tgme_widget_message_document_extra[^>]*>([^<]*)</) || [])[1]),
      date: (chunk.match(/<time\b[^>]*\bdatetime="([^"]+)"/) || [])[1] || '',
    });
  }
  return posts.sort((a, b) => b.id - a.id);
}

/** Дата версіі пераліку з паста: з тэксту «… от 11.09.2026», інакш — дзень публікацыі паста. */
export const postDate = (post) => (post ? parseListDate(post.text) || (post.date || '').slice(0, 10) || null : null);

/**
 * Ці трэба паведаміць адміну пра пост: версія ў ім навейшая за тую, што ў базе (meta.sourceDate), і пра гэты пост яшчэ
 * не паведамлялі (meta.announcedPost). Чыстая функцыя.
 */
export const isFreshPost = (post, meta = {}) => Boolean(post) && postDate(post) > (meta.sourceDate || '') && post.id > (meta.announcedPost || 0);

// ---------- Bot API: паведамленні адміну і файл, перасланы боту ----------

async function botCall(method, body) {
  const r = await fetch(`https://api.telegram.org/bot${BOT.token}/${method}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(30_000),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok || !data.ok) throw new Error(`Telegram ${method}: HTTP ${r.status} ${data.description || ''}`.trim());
  return data.result;
}

/** Допіс адміну ў асабісты чат (HTML); без наладжанага чата — false. */
async function sendAdmin(html, { preview = false } = {}) {
  if (!BOT.token || !BOT.admin) return false;
  await botCall('sendMessage', { chat_id: BOT.admin, text: html, parse_mode: 'HTML', link_preview_options: { is_disabled: !preview } });
  return true;
}

/** Файлы .xlsx з паведамленняў update у адмін-чаце (перасланыя пасты канала); чыстая функцыя. */
export function botInboxFiles(updates, adminChat) {
  return (updates || [])
    .map((u) => u.message)
    .filter((m) => m && String(m.chat?.id) === String(adminChat) && /\.xlsx$/i.test(m.document?.file_name || '') && (m.document.file_size || 0) <= MAX_BOT_FILE)
    .map((m) => ({
      fileId: m.document.file_id,
      fileName: m.document.file_name,
      listDate: parseListDate(m.caption || m.text || ''),
      sourceUrl: m.forward_origin?.type === 'channel' && m.forward_origin.chat?.username
        ? `https://t.me/${m.forward_origin.chat.username}/${m.forward_origin.message_id}`
        : `telegram-bot:${m.document.file_name}`,
    }));
}

/**
 * Файлы, перасланыя адмінам боту: getUpdates → дакументы .xlsx з адмін-чата → getFile → спампоўка. Усе ўбачаныя
 * абнаўленні пацвярджаюцца адразу (offset), каб сапсаваны файл не імпартаваўся зноў пры кожным запуску: у адміна ёсць
 * алерт пра збой, і пост можна пераслаць яшчэ раз. Вяртае [{ buf, listDate, sourceUrl }] у парадку атрымання.
 */
async function fetchFromBotInbox() {
  const updates = await botCall('getUpdates', { allowed_updates: ['message'], timeout: 0 });
  const files = botInboxFiles(updates, BOT.admin);
  const out = [];
  for (const f of files) {
    const file = await botCall('getFile', { file_id: f.fileId });
    const r = await fetch(`https://api.telegram.org/file/bot${BOT.token}/${file.file_path}`, { signal: AbortSignal.timeout(FILE_TIMEOUT) });
    if (!r.ok) throw new Error(`Telegram file: HTTP ${r.status}`);
    const buf = Buffer.from(await r.arrayBuffer());
    console.log(`Файл, перасланы боту: ${f.fileName} (${(buf.length / 1e3).toFixed(0)} KB${f.listDate ? `, версія ад ${f.listDate}` : ''})`);
    out.push({ buf, listDate: f.listDate, sourceUrl: f.sourceUrl });
  }
  if (updates.length) await botCall('getUpdates', { offset: Math.max(...updates.map((u) => u.update_id)) + 1, timeout: 0 });
  return out;
}

// ---------- MTProto (gramjs) ----------

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

// ---------- прэв’ю канала: ці ёсць новая версія ----------

/** Апошні пост з файлам пераліку ў публічным прэв’ю канала (null — паста няма). Сетка: кідае памылку. */
async function latestChannelPost() {
  const res = await fetch(PREVIEW_URL, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(PAGE_TIMEOUT) });
  if (!res.ok) throw new Error(`HTTP ${res.status} (${PREVIEW_URL})`);
  return pickPost(parseChannelPreview(await res.text()));
}

/**
 * Файла ніадкуль няма: глянуць прэв’ю канала. Дата праверкі ў меце абнаўляецца (крыніцу праверылі); калі версія ў канале
 * навейшая за базу і пра гэты пост яшчэ не паведамлялі — допіс адміну са спасылкай на пост (announcedPost — каб адзін раз).
 */
async function checkChannel() {
  const meta = await readJson(META_FILE, {});
  let post;
  try { post = await latestChannelPost(); } catch (e) { console.warn(`Прэв’ю канала @${CHANNEL} недаступнае: ${e.message}`); return; }
  const fresh = isFreshPost(post, meta);
  let announced = false;
  if (fresh) {
    const listDate = postDate(post);
    const text = `🆕 <b>Пералік КДБ: новая версія ад ${dateShort(listDate)}</b>\n` +
      `<a href="https://t.me/${CHANNEL}/${post.id}">Пост у канале</a> · ${esc(post.fileName)}${post.size ? `, ${esc(post.size)}` : ''}\n` +
      `У базе — версія ад ${meta.sourceDate ? dateShort(meta.sourceDate) : '?'}. Перашліце пост боту (файл імпартуецца пры наступным абнаўленні) ` +
      `або пакладзіце файл у inbox/terror/ як ${listDate}.xlsx.`;
    try { announced = await sendAdmin(text, { preview: true }); } catch (e) { console.warn(`Не ўдалося папярэдзіць адміна: ${e.message}`); }
  }
  await fs.writeFile(META_FILE, JSON.stringify({ ...meta, checked: today, checkedAt: now, ...(announced ? { announcedPost: post.id } : {}) }, null, 2));
  if (!post) console.log('У прэв’ю канала паста з файлам пераліку няма.');
  else if (!fresh) console.log(`Новай версіі ў канале няма (апошняя ${postDate(post)}, у базе ${meta.sourceDate || '—'}).`);
  else console.log(announced ? `Адмін папярэджаны пра новую версію ${postDate(post)} (пост ${post.id}).` : `Новая версія ${postDate(post)} (пост ${post.id}), але адмін-чат не наладжаны — паведамленне не даслана.`);
}

// ---------- імпарт ----------

/** Крыніца недаступная: база застаецца, сайт пакажа папярэджанне, адмін атрымае алерт пры змене стану. */
async function unavailable(e) {
  await writeSourceError(META_FILE, e.message, now);
  console.warn(`Крыніца пераліку КДБ недаступная: ${e.message}. sourceError запісаны, база не зменена.`);
}

/** Разабраць буфер .xlsx, зліць з базай, запісаць базу і мету. Вяртае вынік зліцця з датай версіі. */
async function importFile(buf, { sourceUrl, listDate = null }) {
  let sheets;
  try { sheets = readXlsxSheets(buf); } catch (e) { throw new FormatError(`файл не разбіраецца як .xlsx: ${e.message}`); }
  const date = listDate || xlsxModified(buf) || today;
  const stats = {};
  const parsed = parseTerror(sheets, stats);
  console.log(`Разабрана: радкоў ${stats.total}, нацыянальных запісаў ${parsed.length}, з пералікаў ААН прапушчана ${stats.un}, без імя ці падставы ${stats.skipped}, без даты нараджэння ${stats.noBirth}; версія пераліку ад ${date}`);
  if (parsed.length < MIN_TOTAL) throw new Error(`Занадта мала запісаў (${parsed.length}) — магчыма, змяніўся фармат файла ці ўзяты не той ліст`);
  const dupIds = parsed.length - new Set(parsed.map((x) => x.id)).size;
  if (dupIds) console.warn(`Увага: ${dupIds} запісаў з аднолькавым id (імя + дата нараджэння) — застаецца апошні`);
  await fs.mkdir(CACHE_DIR, { recursive: true });
  await fs.writeFile(path.join(CACHE_DIR, 'terror.xlsx'), buf);

  await fs.mkdir(DATA_DIR, { recursive: true });
  const db = await readJson(DB_FILE, []);
  const res = mergeTerror(db, parsed, { today, force: FORCE, maxAdded: MAX_ADDED, listDate: date });
  const { out, added, removed, edited, edits, initial } = res;
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
    sourceDate: date,                // дата версіі пераліку (з паста ў канале ці з docProps файла) — паказваецца ў шапцы
    ...(meta.announcedPost ? { announcedPost: meta.announcedPost } : {}),
    parse: stats,
    total: out.filter((x) => !x.removed).length,
    lastAdded: added && !initial ? today : meta.lastAdded || null,
    lastAddedCount: initial ? 0 : added || meta.lastAddedCount || 0,
  }, null, 2));
  console.log(`Пералік КДБ: дададзена ${added}, выпраўлена ${edited + edits.length}, знікла ${removed}, усяго ў базе ${out.length}${initial ? ' (першы імпарт — без пазнакі «новае»)' : ''}`);
  return { ...res, date };
}

async function main() {
  if (localFile) {
    let listDate = null;
    if (localDate) { listDate = parseListDate(localDate); if (!listDate) throw new Error(`Незразумелая дата версіі пераліку: ${localDate} (чакаецца «11.09.2026»)`); }
    await importFile(await fs.readFile(localFile), { sourceUrl: `file://${path.resolve(localFile)}`, listDate });
    return;
  }
  if (TG.apiId && TG.apiHash && TG.session) {
    let got;
    try { got = await fetchFromTelegram(); } catch (e) { await unavailable(e); return; }
    await importFile(got.buf, got);
    return;
  }
  // файлы, перасланыя адмінам боту (кожны — асобная версія, па парадку атрымання)
  let imported = 0;
  if (BOT.token && BOT.admin) {
    let files = [];
    try { files = await fetchFromBotInbox(); } catch (e) { console.warn(`Не ўдалося праверыць файлы, перасланыя боту: ${e.message}`); }
    for (const f of files) {
      const r = await importFile(f.buf, f);
      imported++;
      try { await sendAdmin(`✅ Пералік КДБ ад ${dateShort(r.date)} імпартаваны: дададзена ${r.added}, выпраўлена ${r.edited + r.edits.length}, знікла ${r.removed}.`); } catch (e) { console.warn(`Не ўдалося пацвердзіць адміну: ${e.message}`); }
    }
  }
  if (imported) return;
  if (SOURCE_URL) {
    let listDate = null;
    if (ENV_DATE) { listDate = parseListDate(ENV_DATE); if (!listDate) throw new Error(`Незразумелая дата версіі пераліку TERROR_DATE: ${ENV_DATE} (чакаецца «11.09.2026»)`); }
    let buf;
    try { ({ buf } = await downloadBuffer(SOURCE_URL, { timeout: FILE_TIMEOUT })); } catch (e) { await unavailable(e); return; }
    await importFile(buf, { sourceUrl: SOURCE_URL, listDate });
    return;
  }
  console.log('Файла пераліку КДБ няма (лакальны файл, MTProto, перасланы боту, TERROR_SOURCE) — правяраю прэв’ю канала.');
  await checkChannel();
}

// пры імпарце з тэстаў (parseListDate, pickPost, parseChannelPreview, isFreshPost, botInboxFiles) нічога не запускаем;
// засцярога ці фармат — sourceError у меце і exit 1
runMain(import.meta.url, main, { metaFile: META_FILE });
