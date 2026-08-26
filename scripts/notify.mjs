#!/usr/bin/env node
/**
 * Дайджэст новых запісаў у Telegram-канал (запускаецца ў CI пасля абнаўлення).
 * Патрабуе TELEGRAM_BOT_TOKEN і TELEGRAM_CHAT_ID; без іх проста выходзіць.
 * TELEGRAM_TEST=1 — дасылае пробнае паведамленне з апошнімі запісамі, нават калі новых няма.
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
const token = process.env.TELEGRAM_BOT_TOKEN, chat = process.env.TELEGRAM_CHAT_ID;
const SITE = (process.env.SITE_URL || 'https://elist.itbeard.com/').replace(/\/?$/, '/');
const test = ['1', 'true'].includes(process.env.TELEGRAM_TEST);
const LIMIT = 3900;      // запас да 4096
const NAME_MAX = 220;    // даўжыня назвы ў дайджэсце

if (!token || !chat) { console.log('Telegram не наладжаны — прапускаю.'); process.exit(0); }

const meta = JSON.parse(await fs.readFile(path.join(ROOT, 'data', 'meta.json'), 'utf8'));
const db = JSON.parse(await fs.readFile(path.join(ROOT, 'data', 'materials.json'), 'utf8'));
const today = new Date().toISOString().slice(0, 10);

let fresh = db.filter((x) => x.added === today);
if (test && !fresh.length) fresh = [...db].sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 4);
if (!test && (meta.lastAdded !== today || !fresh.length)) { console.log('Новых запісаў няма — паведамленне не патрэбнае.'); process.exit(0); }

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
const header = test
  ? `🧪 <b>Пробнае паведамленне</b> — так будуць выглядаць дайджэсты\n<i>${dateBe(today)} · ${num(meta.total)} ${plural(meta.total, 'запіс', 'запісы', 'запісаў')} у спісе</i>`
  : `🔴 <b>Спіс экстрэмісцкіх матэрыялаў: +${n} ${plural(n, 'новы запіс', 'новыя запісы', 'новых запісаў')}</b>\n<i>${dateBe(today)} · усяго ў спісе ${num(meta.total)}</i>`;
const footer =
  `🔎 <a href="${SITE}">Праверыць сябе і свой спіс назірання</a>\n` +
  `📰 <a href="${SITE}#/new">Усе новыя запісы</a> · <a href="${SITE}feed.xml">RSS</a>`;

// ---------- разбіццё на паведамленні (≤ 4096) ----------
const blocks = fresh.map((x, i) => entry(x, i + 1));
const messages = [];
let cur = header, count = 0;
for (const b of blocks) {
  const next = `${cur}\n\n${b}`;
  if (next.length > LIMIT && count > 0) { messages.push(cur); cur = `<i>Працяг дайджэсту</i>\n\n${b}`; count = 1; }
  else { cur = next; count++; }
}
messages.push(`${cur}\n\n${footer}`);
if (messages.length > 1) messages.forEach((m, i) => { messages[i] = m.replace(/^(<i>Працяг дайджэсту<\/i>)/, `<i>Працяг дайджэсту (${i + 1}/${messages.length})</i>`); });

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
  if (!r.ok) { console.error(`Telegram: HTTP ${r.status} ${await r.text()}`); process.exit(1); }
}
console.log(`Адпраўлена ў Telegram${test ? ' (тэст)' : ''}: ${n} ${plural(n, 'запіс', 'запісы', 'запісаў')}, ${messages.length} ${plural(messages.length, 'паведамленне', 'паведамленні', 'паведамленняў')}.`);
