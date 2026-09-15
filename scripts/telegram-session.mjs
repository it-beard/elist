#!/usr/bin/env node
/**
 * Аднаразовы памочнік: увайсці ў Telegram карыстальніцкім акаўнтам і надрукаваць StringSession для сакрэту
 * TELEGRAM_SESSION (яго чытае scripts/update-terror.mjs, каб браць файл пераліку КДБ з канала). Патрэбныя api_id і
 * api_hash з https://my.telegram.org (TELEGRAM_API_ID, TELEGRAM_API_HASH) і пакет `telegram` (gramjs): npm i telegram.
 * Заводзьце асобны акаўнт: радок сесіі дае поўны доступ да акаўнта, а ў CI ён ляжыць у сакрэтах рэпазіторыя.
 *
 *   TELEGRAM_API_ID=… TELEGRAM_API_HASH=… node scripts/telegram-session.mjs
 */
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

const apiId = Number(process.env.TELEGRAM_API_ID), apiHash = process.env.TELEGRAM_API_HASH;
if (!apiId || !apiHash) { console.error('Задайце TELEGRAM_API_ID і TELEGRAM_API_HASH (https://my.telegram.org).'); process.exit(2); }

let TelegramClient, StringSession;
try {
  ({ TelegramClient } = await import('telegram'));
  ({ StringSession } = await import('telegram/sessions/index.js'));
} catch (e) {
  console.error(`Пакет telegram (gramjs) не ўсталяваны — npm i telegram (${e.message})`);
  process.exit(2);
}

const rl = readline.createInterface({ input, output });
const client = new TelegramClient(new StringSession(''), apiId, apiHash, { connectionRetries: 3 });
await client.start({
  phoneNumber: () => rl.question('Нумар тэлефона (+375…): '),
  password: () => rl.question('Пароль двухэтапнай праверкі (калі ёсць): '),
  phoneCode: () => rl.question('Код з Telegram: '),
  onError: (e) => console.error(e),
});
console.log('\nTELEGRAM_SESSION (захавайце ў сакрэты CI; нікому не паказвайце):\n');
console.log(client.session.save());
rl.close();
await client.disconnect();
process.exit(0);
