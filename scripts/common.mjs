/**
 * Агульнае для скрыптоў абнаўлення (update*.mjs) і зборкі: шляхі, сеціва з таймаўтамі і праверкай паўнаты
 * спампаванага файла, чытанне JSON, запіс sourceError у мету і запуск main() толькі пры прамым выкліку.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const DATA_DIR = path.join(ROOT, 'data');
export const CACHE_DIR = path.join(ROOT, '.cache');
export const UA = 'Mozilla/5.0 (compatible; extremist-materials-search; +https://github.com/it-beard/elist)';
export const FORCE = ['1', 'true'].includes(process.env.UPDATE_FORCE);

/** Збой фармату: файл спампаваны цалкам, але не разбіраецца — паўтараць спампоўку няма сэнсу, гэта не сетка. */
export class FormatError extends Error {
  constructor(message) { super(message); this.name = 'FormatError'; }
}

export async function readJson(file, fallback) {
  try { return JSON.parse(await fs.readFile(file, 'utf8')); } catch { return fallback; }
}

const header = (headers, name) => (typeof headers?.get === 'function' ? headers.get(name) : headers?.[name]) ?? '';

/**
 * Колькі байт мусіць быць у целе адказу, калі гэта можна праверыць: content-length без сціску (fetch аддае
 * распакаванае цела, а пры gzip загаловак — пра сціснутае). null — праверыць нельга (сціск ці няма загалоўка).
 */
export function expectedLength(headers) {
  const enc = String(header(headers, 'content-encoding')).trim().toLowerCase();
  if (enc && enc !== 'identity') return null;
  const n = Number(header(headers, 'content-length'));
  return n > 0 ? n : null;
}

/** Ці поўны адказ: памер цела супадае з content-length, калі яго можна праверыць (гл. expectedLength). */
export function isComplete(headers, length) {
  const expected = expectedLength(headers);
  return expected === null || expected === length;
}

/** Пререндэраны HTML старонкі МУС (Angular-SPA): параметр ?_escaped_fragment_=. */
export async function fetchPrerendered(page, { timeout = 60_000 } = {}) {
  const url = `${page}${page.includes('?') ? '&' : '?'}_escaped_fragment_=`;
  const res = await fetch(url, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(timeout) });
  if (!res.ok) throw new Error(`Не ўдалося атрымаць старонку: HTTP ${res.status}`);
  return res.text();
}

/**
 * Спасылкі <a href="…">подпіс</a> са старонкі, чый href праходзіць extRe (напрыклад /\.docx?$/i):
 * абсалютны url (з папраўкай &amp;), подпіс без тэгаў у адзін радок, i — парадак на старонцы.
 */
export function findLinks(html, pageUrl, extRe) {
  const out = [];
  for (const m of html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const href = m[1].replace(/&amp;/g, '&');
    if (href.search(extRe) === -1) continue;
    out.push({ url: new URL(href, pageUrl).href, label: m[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(), i: out.length });
  }
  return out;
}

/** Спампаваць файл: HTTP-статус, паўната (isComplete), мінімальны памер; у лог — «Спампавана: …». Вяртае { buf, res }. */
export async function downloadBuffer(url, { timeout = 180_000, minBytes = 10_000 } = {}) {
  const res = await fetch(url, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(timeout) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (!isComplete(res.headers, buf.length)) throw new Error(`абарваны файл (${buf.length} з ${expectedLength(res.headers)} байт)`);
  if (buf.length < minBytes) throw new Error('файл падазрона малы');
  const size = buf.length >= 1e6 ? `${(buf.length / 1e6).toFixed(1)} MB` : `${(buf.length / 1e3).toFixed(0)} KB`;
  console.log(`Спампавана: ${url} (${size}, Last-Modified: ${res.headers.get('last-modified') || '?'})`);
  return { buf, res };
}

/** Пазначыць збой у меце (сайт папярэдзіць, адмін атрымае алерт пры змене стану), базу не чапаць. */
export async function writeSourceError(metaFile, message, now = new Date().toISOString()) {
  const meta = await readJson(metaFile, {});
  await fs.writeFile(metaFile, JSON.stringify({ ...meta, checked: now.slice(0, 10), checkedAt: now, sourceError: message }, null, 2));
}

/**
 * Запусціць main() толькі пры прамым выкліку скрыпта (пры імпарце з тэстаў — не). Збой (засцярога, фармат):
 * у лог, sourceError у мету (калі зададзены metaFile — сайт папярэдзіць, адмін атрымае алерт) і exit 1.
 */
export function runMain(importMetaUrl, main, { metaFile = null } = {}) {
  if (!process.argv[1] || path.resolve(process.argv[1]) !== fileURLToPath(importMetaUrl)) return;
  main().catch(async (e) => {
    console.error(e);
    if (metaFile) { try { await writeSourceError(metaFile, e.message); } catch (e2) { console.error(e2); } }
    process.exit(1);
  });
}
