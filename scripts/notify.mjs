#!/usr/bin/env node
/**
 * Паведамленьне ў Telegram-канал пра новыя запісы (запускаецца ў CI пасьля абнаўленьня).
 * Патрабуе TELEGRAM_BOT_TOKEN і TELEGRAM_CHAT_ID; без іх проста выходзіць.
 * Ніякіх пэрсанальных дадзеных — толькі публічны дайджэст.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const token = process.env.TELEGRAM_BOT_TOKEN, chat = process.env.TELEGRAM_CHAT_ID;
const SITE = (process.env.SITE_URL || 'https://elist.itbeard.com/').replace(/\/?$/, '/');
if (!token || !chat) { console.log('Telegram не наладжаны — прапускаю.'); process.exit(0); }

const meta = JSON.parse(await fs.readFile(path.join(ROOT, 'data', 'meta.json'), 'utf8'));
const db = JSON.parse(await fs.readFile(path.join(ROOT, 'data', 'materials.json'), 'utf8'));
const today = new Date().toISOString().slice(0, 10);
const fresh = db.filter((x) => x.added === today);
if (meta.lastAdded !== today || !fresh.length) { console.log('Новых запісаў няма — паведамленьне не патрэбнае.'); process.exit(0); }

const esc = (s) => s.replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
const lines = fresh.slice(0, 15).map((x) => `• <a href="${SITE}#/r/${x.id}">${esc(x.name.replace(/\s+/g, ' ').slice(0, 120))}</a>`);
if (fresh.length > 15) lines.push(`… і яшчэ ${fresh.length - 15}`);
const text = `<b>+${fresh.length} у спісе экстрэмісцкіх матэрыялаў</b> (${today})\n\n${lines.join('\n')}\n\n<a href="${SITE}#/new">Усе новыя запісы</a> · праверце свой сьпіс назіраньня`;

const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ chat_id: chat, text, parse_mode: 'HTML', disable_web_page_preview: true }),
});
if (!r.ok) { console.error(`Telegram: HTTP ${r.status} ${await r.text()}`); process.exit(1); }
console.log(`Адпраўлена ў Telegram: ${fresh.length} запісаў.`);
