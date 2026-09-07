#!/usr/bin/env node
/**
 * Службовыя паведамленні адміну ў асабісты Telegram-чат (TELEGRAM_ADMIN_CHAT_ID; без яго — ціхі выхад).
 *   node scripts/alert.mjs failed   — джоб упаў (ALERT_JOB, ALERT_RUN_URL)
 *   node scripts/alert.mjs source   — стан крыніцы ў data/meta.json змяніўся адносна HEAD:
 *                                     крыніца перастала/пачала адказваць, уключылася/выключылася запасная;
 *                                     тое ж для пералікаў МУС (data/formations-meta.json, data/persons-meta.json) і базы
 *                                     вышуку РФ (data/wanted-meta.json), а таксама крок, што не завяршыўся
 *                                     (FORMATIONS_STEP / PERSONS_STEP / WANTED_STEP — steps.<id>.outcome з воркфлоў).
 *                                     Логіка — scripts/alert-logic.mjs.
 */
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { DATA_DIR, ROOT, readJson } from './common.mjs';
import { esc, sourceMessages } from './alert-logic.mjs';

const token = process.env.TELEGRAM_BOT_TOKEN, chat = process.env.TELEGRAM_ADMIN_CHAT_ID;
const mode = process.argv[2];

if (!token || !chat) { console.log('Адмін-чат Telegram не наладжаны — прапускаю.'); process.exit(0); }

async function send(text) {
  const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: chat, text, parse_mode: 'HTML', link_preview_options: { is_disabled: true } }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!r.ok) { console.error(`Telegram: HTTP ${r.status} ${await r.text()}`); process.exit(1); }
}

/** Мета з HEAD (стан да гэтага запуску); няма — першы запуск ці файла яшчэ не было. */
function headJson(file) {
  try { return JSON.parse(execFileSync('git', ['show', `HEAD:data/${file}`], { cwd: ROOT, encoding: 'utf8' })); } catch { return {}; }
}

if (mode === 'failed') {
  const job = process.env.ALERT_JOB || '?', url = process.env.ALERT_RUN_URL || '';
  await send(`🛑 <b>elist: збой джоба «${esc(job)}»</b>${url ? `\n<a href="${esc(url)}">Лог запуску</a>` : ''}`);
} else if (mode === 'source') {
  const msgs = sourceMessages({
    cur: await readJson(path.join(DATA_DIR, 'meta.json'), {}), prev: headJson('meta.json'),
    curF: await readJson(path.join(DATA_DIR, 'formations-meta.json'), {}), prevF: headJson('formations-meta.json'),
    curP: await readJson(path.join(DATA_DIR, 'persons-meta.json'), {}), prevP: headJson('persons-meta.json'),
    curW: await readJson(path.join(DATA_DIR, 'wanted-meta.json'), {}), prevW: headJson('wanted-meta.json'),
    steps: { formations: process.env.FORMATIONS_STEP, persons: process.env.PERSONS_STEP, wanted: process.env.WANTED_STEP },
  });
  if (!msgs.length) { console.log('Стан крыніцы не змяніўся.'); process.exit(0); }
  await send(`<b>elist: стан крыніцы</b>\n${msgs.join('\n')}`);
} else {
  console.error('Рэжым: failed | source');
  process.exit(2);
}
console.log('Адмін папярэджаны.');
