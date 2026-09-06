#!/usr/bin/env node
/**
 * Дайджэст новых запісаў у Telegram-канал (запускаецца ў CI пасля абнаўлення). Адбор, фарматаванне і разбіццё
 * на паведамленні — scripts/digest.mjs; тут — файлы, пробны рэжым і адпраўка.
 * Патрабуе TELEGRAM_BOT_TOKEN і TELEGRAM_CHAT_ID; без іх проста выходзіць.
 * TELEGRAM_TEST=1 — пробнае паведамленне з узорам апошніх запісаў: у адмін-чат (TELEGRAM_ADMIN_CHAT_ID),
 * калі ён зададзены, інакш у канал. Рэальныя новыя запісы ў пробным рэжыме не кранаюцца і не пазначаюцца.
 *
 * Абарона ад дублёў: адпраўленыя id захоўваюцца ў data/notified.json (камітуецца ў рэпо).
 * Воркфлоў ходзіць двойчы на суткі, таму «новае за сёння» само па сабе не крытэрый —
 * шлём толькі тое, чаго яшчэ не было ў канале. Незасланае за апошнія WINDOW_DAYS дзён
 * дабіраецца пры наступным запуску, калі адпраўка ўпала. Выпраўлены ў крыніцы запіс (editOf)
 * не абвяшчаецца, калі яго папярэднюю версію ўжо дасылалі.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { DATA_DIR, readJson } from './common.mjs';
import { buildDigest, plural, selectFresh, shiftDays } from './digest.mjs';

const STATE_FILE = path.join(DATA_DIR, 'notified.json');
const token = process.env.TELEGRAM_BOT_TOKEN, chat = process.env.TELEGRAM_CHAT_ID, adminChat = process.env.TELEGRAM_ADMIN_CHAT_ID;
const SITE = (process.env.SITE_URL || 'https://elist.itbeard.com/').replace(/\/?$/, '/');
const test = ['1', 'true'].includes(process.env.TELEGRAM_TEST);
const WINDOW_DAYS = 7;   // як глыбока дабіраем незасланыя запісы
const KEEP_DAYS = 60;    // як доўга трымаем адзнакі ў data/notified.json

if (!token || !chat) { console.log('Telegram не наладжаны — прапускаю.'); process.exit(0); }

const meta = JSON.parse(await fs.readFile(path.join(DATA_DIR, 'meta.json'), 'utf8'));
const materials = JSON.parse(await fs.readFile(path.join(DATA_DIR, 'materials.json'), 'utf8'));
const formations = await readJson(path.join(DATA_DIR, 'formations.json'), []);
const persons = await readJson(path.join(DATA_DIR, 'persons.json'), []);
const db = [...materials.map((x) => ({ ...x, list: 'm' })), ...formations.map((x) => ({ ...x, list: 'f' })), ...persons.map((x) => ({ ...x, list: 'p' }))];
const byId = new Map(db.map((x) => [x.id, x]));
const sent = (await readJson(STATE_FILE, {})).sent || {};
const today = new Date().toISOString().slice(0, 10);
const since = shiftDays(today, -WINDOW_DAYS);

// Пробны рэжым: заўсёды ўзор з апошніх запісаў, а не рэальныя новыя — інакш яны пайшлі б у канал двойчы.
const fresh = test
  ? [
    ...materials.filter((x) => !x.removed).sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 3).map((x) => ({ ...x, list: 'm' })),
    ...formations.filter((x) => !x.removed).slice(-1).map((x) => ({ ...x, list: 'f' })),
    ...persons.filter((x) => !x.removed).slice(-1).map((x) => ({ ...x, list: 'p' })),
  ]
  : selectFresh(db, sent, since);
if (!fresh.length) { console.log('Новых запісаў няма — паведамленне не патрэбнае.'); process.exit(0); }
const target = test && adminChat ? adminChat : chat;
const n = fresh.length;
const { messages, ids } = buildDigest(fresh, { site: SITE, test, today, total: meta.total });

/** Захаваць адзнакі пра адпраўку, адкінуўшы старыя (файл не расце бясконца). */
async function saveState() {
  if (test) return;
  const keepFrom = shiftDays(today, -KEEP_DAYS);
  const kept = Object.fromEntries(Object.entries(sent).filter(([, d]) => d >= keepFrom).sort());
  await fs.writeFile(STATE_FILE, `${JSON.stringify({ sent: kept }, null, 2)}\n`);
}

// ---------- адпраўка ----------
let failed = null;
try {
  for (const [i, text] of messages.entries()) {
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        chat_id: target, text, parse_mode: 'HTML',
        link_preview_options: { is_disabled: true },
        disable_notification: i > 0, // гук — толькі на першую частку
      }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!r.ok) { failed = `HTTP ${r.status} ${await r.text()}`; break; }
    for (const id of ids[i]) {
      sent[id] = today;
      const prev = byId.get(id)?.editOf; // папярэдняя версія выпраўленага запісу — таксама дасланая
      if (prev) sent[prev] = today;
    }
  }
} catch (e) {
  failed = e.message;
} finally {
  await saveState(); // тое, што ўжо сышло, паўторна не пойдзе — і пры HTTP-памылцы, і пры сеткавым збоі
}
if (failed) { console.error(`Telegram: ${failed}`); process.exit(1); }
console.log(`Адпраўлена ў Telegram${test ? ' (тэст)' : ''}: ${n} ${plural(n, 'запіс', 'запісы', 'запісаў')}, ${messages.length} ${plural(messages.length, 'паведамленне', 'паведамленні', 'паведамленняў')}.`);
