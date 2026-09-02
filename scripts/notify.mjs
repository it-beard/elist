#!/usr/bin/env node
/**
 * Дайджэст новых запісаў у Telegram-канал (запускаецца ў CI пасля абнаўлення).
 * Патрабуе TELEGRAM_BOT_TOKEN і TELEGRAM_CHAT_ID; без іх проста выходзіць.
 * TELEGRAM_TEST=1 — дасылае пробнае паведамленне з апошнімі запісамі, нават калі новых няма.
 *
 * Абарона ад дублёў: адпраўленыя id захоўваюцца ў data/notified.json (камітуецца ў рэпо).
 * Воркфлоў ходзіць двойчы на суткі, таму «новае за сёння» само па сабе не крытэрый —
 * шлём толькі тое, чаго яшчэ не было ў канале. Незасланае за апошнія WINDOW_DAYS дзён
 * дабіраецца пры наступным запуску, калі адпраўка ўпала.
 *
 * Фарматаванне — HTML-рэжым Bot API (дазволеныя толькі b/i/u/s/code/a/blockquote):
 * https://core.telegram.org/bots/api#html-style. Ліміт — 4096 сімвалаў на паведамленне,
 * таму доўгі дайджэст разбіваецца на некалькі частак.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { courtName } from '../src/lib/court.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STATE_FILE = path.join(ROOT, 'data', 'notified.json');
const token = process.env.TELEGRAM_BOT_TOKEN, chat = process.env.TELEGRAM_CHAT_ID;
const SITE = (process.env.SITE_URL || 'https://elist.itbeard.com/').replace(/\/?$/, '/');
const test = ['1', 'true'].includes(process.env.TELEGRAM_TEST);
const LIMIT = 3900;      // запас да 4096
const NAME_MAX = 220;    // даўжыня назвы ў дайджэсце
const WINDOW_DAYS = 7;   // як глыбока дабіраем незасланыя запісы
const KEEP_DAYS = 60;    // як доўга трымаем адзнакі ў data/notified.json

if (!token || !chat) { console.log('Telegram не наладжаны — прапускаю.'); process.exit(0); }

const readJson = async (file, fallback) => {
  try { return JSON.parse(await fs.readFile(file, 'utf8')); } catch { return fallback; }
};

const meta = JSON.parse(await fs.readFile(path.join(ROOT, 'data', 'meta.json'), 'utf8'));
const db = JSON.parse(await fs.readFile(path.join(ROOT, 'data', 'materials.json'), 'utf8'));
const sent = (await readJson(STATE_FILE, {})).sent || {};
const today = new Date().toISOString().slice(0, 10);
const shiftDays = (iso, n) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86400e3).toISOString().slice(0, 10);
const since = shiftDays(today, -WINDOW_DAYS);

let fresh = db
  .filter((x) => x.added && x.added >= since && !sent[x.id])
  .sort((a, b) => a.added.localeCompare(b.added) || (a.order ?? 0) - (b.order ?? 0));
if (test && !fresh.length) fresh = [...db].sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 4);
if (!fresh.length) { console.log('Новых запісаў няма — паведамленне не патрэбнае.'); process.exit(0); }

// ---------- фарматаванне ----------
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const MONTHS = ['студзеня', 'лютага', 'сакавіка', 'красавіка', 'мая', 'чэрвеня', 'ліпеня', 'жніўня', 'верасня', 'кастрычніка', 'лістапада', 'снежня'];
const dateBe = (iso) => { const [y, m, d] = iso.split('-'); return `${+d} ${MONTHS[+m - 1]} ${y}`; };
const dateShort = (iso) => (iso ? iso.split('-').reverse().join('.') : '');
const plural = (n, one, few, many) => { const a = n % 10, b = n % 100; return a === 1 && b !== 11 ? one : a >= 2 && a <= 4 && (b < 10 || b >= 20) ? few : many; };
const num = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '\u2009'); // тонкі прабел між тысячамі

/** Эмодзі паводле тыпу рэсурсу — бяром той, што згадваецца ў назве першым. */
const KINDS = [
  [/telegram|t\.me|телеграм/, '✈️'], [/youtube/, '📺'], [/tiktok/, '🎵'], [/instagram/, '📷'],
  [/facebook|вконтакте|vk\.com|одноклассники|twitter|x\.com/, '👥'], [/книг|брошюр|печатн|журнал|газет/, '📚'],
  [/символик|атрибутик|логотип|флаг|нашивк|стикер/, '🚩'], [/видео|фильм|ролик/, '🎬'], [/песн|аудио|музык|альбом/, '🎧'],
  [/сайт|ресурс|http|www\.|\.by|\.com|\.org/, '🌐'],
];
function icon(x) {
  const s = `${x.name}\n${x.type}`.toLowerCase();
  let best = null;
  for (const [re, emoji] of KINDS) { const i = s.search(re); if (i !== -1 && (best === null || i < best.i)) best = { i, emoji }; }
  return best ? best.emoji : '📄';
}

/** Назва: адзін радок, без службовых хвастоў, абрэзаная. */
function title(x) {
  let s = x.name.replace(/\s+/g, ' ').replace(/[;,.\s]+$/, '').trim();
  if (s.length > NAME_MAX) s = s.slice(0, NAME_MAX - 1).replace(/\s+\S*$/, '') + '…';
  return s;
}

function entry(x, n) {
  const court = x.court ? courtName(x.court).replace(/^суда\s+/i, 'суд ') : '';
  const metaLine = [x.date && dateShort(x.date), court && `⚖️ ${esc(court)}`].filter(Boolean).join(' · ');
  return (
    `<blockquote>${icon(x)} <b>${n}.</b> ${esc(title(x))}` +
    (metaLine ? `\n<i>${metaLine}</i>` : '') +
    `\n<a href="${SITE}#/r/${x.id}">Адкрыць запіс →</a></blockquote>`
  );
}

const n = fresh.length;
// дата дайджэсту — калі запісы трапілі ў базу, а не калі мы дасылаем (важна для дабору за мінулыя дні)
const day = test ? today : fresh[fresh.length - 1].added;
const header = test
  ? `🧪 <b>Пробнае паведамленне</b> — так будуць выглядаць дайджэсты\n<i>${dateBe(day)} · ${num(meta.total)} ${plural(meta.total, 'запіс', 'запісы', 'запісаў')} у спісе</i>`
  : `🔴 <b>Спіс экстрэмісцкіх матэрыялаў: +${n} ${plural(n, 'новы запіс', 'новыя запісы', 'новых запісаў')}</b>\n<i>${dateBe(day)} · усяго ў спісе ${num(meta.total)}</i>`;
const footer =
  `🔎 <a href="${SITE}">Праверыць сябе і свой спіс назірання</a>\n` +
  `📰 <a href="${SITE}#/new">Усе новыя запісы</a> · <a href="${SITE}feed.xml">RSS</a>`;

// ---------- разбіццё на паведамленні (≤ 4096) ----------
// ids[i] — запісы, што трапілі ў messages[i]: пазначаем іх адпраўленымі паштучна,
// каб пасля збою на сярэдзіне дайджэсту паўтарылася толькі недасланая частка.
const blocks = fresh.map((x, i) => ({ id: x.id, html: entry(x, i + 1) }));
const messages = [], ids = [];
let cur = header, curIds = [], count = 0;
for (const b of blocks) {
  const next = `${cur}\n\n${b.html}`;
  if (next.length > LIMIT && count > 0) {
    messages.push(cur); ids.push(curIds);
    cur = `<i>Працяг дайджэсту</i>\n\n${b.html}`; curIds = [b.id]; count = 1;
  } else { cur = next; curIds.push(b.id); count++; }
}
messages.push(`${cur}\n\n${footer}`); ids.push(curIds);
if (messages.length > 1) messages.forEach((m, i) => { messages[i] = m.replace(/^(<i>Працяг дайджэсту<\/i>)/, `<i>Працяг дайджэсту (${i + 1}/${messages.length})</i>`); });

/** Захаваць адзнакі пра адпраўку, адкінуўшы старыя (файл не расце бясконца). */
async function saveState() {
  if (test) return;
  const keepFrom = shiftDays(today, -KEEP_DAYS);
  const kept = Object.fromEntries(Object.entries(sent).filter(([, d]) => d >= keepFrom).sort());
  await fs.writeFile(STATE_FILE, `${JSON.stringify({ sent: kept }, null, 2)}\n`);
}

// ---------- адпраўка ----------
for (const [i, text] of messages.entries()) {
  const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      chat_id: chat, text, parse_mode: 'HTML',
      link_preview_options: { is_disabled: true },
      disable_notification: i > 0, // гук — толькі на першую частку
    }),
  });
  if (!r.ok) {
    console.error(`Telegram: HTTP ${r.status} ${await r.text()}`);
    await saveState(); // тое, што ўжо сышло, паўторна не пойдзе
    process.exit(1);
  }
  for (const id of ids[i]) sent[id] = today;
}
await saveState();
console.log(`Адпраўлена ў Telegram${test ? ' (тэст)' : ''}: ${n} ${plural(n, 'запіс', 'запісы', 'запісаў')}, ${messages.length} ${plural(messages.length, 'паведамленне', 'паведамленні', 'паведамленняў')}.`);
