#!/usr/bin/env node
/**
 * Службовыя паведамленні адміну ў асабісты Telegram-чат (TELEGRAM_ADMIN_CHAT_ID; без яго — ціхі выхад).
 *   node scripts/alert.mjs failed   — джоб упаў (ALERT_JOB, ALERT_RUN_URL)
 *   node scripts/alert.mjs source   — стан крыніцы ў data/meta.json змяніўся адносна HEAD:
 *                                     крыніца перастала/пачала адказваць, уключылася/выключылася запасная
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const META = path.join(ROOT, 'data', 'meta.json');
const token = process.env.TELEGRAM_BOT_TOKEN, chat = process.env.TELEGRAM_ADMIN_CHAT_ID;
const mode = process.argv[2];

if (!token || !chat) { console.log('Адмін-чат Telegram не наладжаны — прапускаю.'); process.exit(0); }

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const readJson = async (file, fallback) => { try { return JSON.parse(await fs.readFile(file, 'utf8')); } catch { return fallback; } };

async function send(text) {
  const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: chat, text, parse_mode: 'HTML', link_preview_options: { is_disabled: true } }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!r.ok) { console.error(`Telegram: HTTP ${r.status} ${await r.text()}`); process.exit(1); }
}

if (mode === 'failed') {
  const job = process.env.ALERT_JOB || '?', url = process.env.ALERT_RUN_URL || '';
  await send(`🛑 <b>elist: збой джоба «${esc(job)}»</b>${url ? `\n<a href="${esc(url)}">Лог запуску</a>` : ''}`);
} else if (mode === 'source') {
  const cur = await readJson(META, {});
  let prev = {};
  try { prev = JSON.parse(execFileSync('git', ['show', 'HEAD:data/meta.json'], { cwd: ROOT, encoding: 'utf8' })); } catch { /* першы запуск */ }
  const msgs = [];
  if (Boolean(cur.sourceError) !== Boolean(prev.sourceError)) {
    msgs.push(cur.sourceError ? `⚠️ Крыніца не адказвае: ${esc(cur.sourceError)}` : '✅ Крыніца зноў адказвае.');
  }
  if (Boolean(cur.fallback) !== Boolean(prev.fallback)) {
    msgs.push(cur.fallback ? `⚠️ Афіцыйная крыніца недаступная, узятая запасная: ${esc(cur.sourcePage || '')}` : '✅ Зноў афіцыйная крыніца.');
  }
  if (!msgs.length) { console.log('Стан крыніцы не змяніўся.'); process.exit(0); }
  await send(`<b>elist: стан крыніцы</b>\n${msgs.join('\n')}`);
} else {
  console.error('Рэжым: failed | source');
  process.exit(2);
}
console.log('Адмін папярэджаны.');
