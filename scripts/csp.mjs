/**
 * Content Security Policy для статычнага сайта на GitHub Pages (загалоўкаў там няма — толькі <meta>).
 * Інлайн-скрыпты і стылі дазваляюцца па sha256-хэшах, якія лічацца з гатовага HTML пры зборцы,
 * таму любая змена інлайн-кода не зламае палітыку моўчкі.
 */
import crypto from 'node:crypto';

export const sha256 = (s) => `'sha256-${crypto.createHash('sha256').update(s).digest('base64')}'`;

export function csp({ scripts = [], styles = [] } = {}) {
  const src = (list) => ["'self'", ...list.map(sha256)].join(' ');
  return [
    "default-src 'self'",
    `script-src ${src(scripts)}`,
    `style-src ${src(styles)}`,
    "img-src 'self' data:",
    "connect-src 'self'",
    "font-src 'self'",
    "manifest-src 'self'",
    "worker-src 'self'",
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
}

const attr = (attrs, name) => (attrs.match(new RegExp(`\\b${name}\\s*=\\s*["']?([^"'\\s>]+)`, 'i')) || [])[1];

/** Змесціва інлайн-скрыптоў, якія браўзер выконвае (без src; тып — JS ці module). JSON-LD не лічыцца. */
export function inlineScripts(html) {
  const out = [];
  for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    if (/\bsrc\s*=/i.test(m[1])) continue;
    const type = attr(m[1], 'type');
    if (type && !/^(module|text\/javascript|application\/javascript)$/i.test(type)) continue;
    out.push(m[2]);
  }
  return out;
}

/** Змесціва інлайн-блокаў <style>. */
export const inlineStyles = (html) => [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]);
