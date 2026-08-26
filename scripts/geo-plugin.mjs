/**
 * Vite-плагін: дадае ў index.html тое, чаго не хапае SPA для GEO/SEO —
 *  · meta description і og/twitter з рэальнымі лічбамі (яны мяняюцца штодня);
 *  · canonical і hreflang;
 *  · Schema.org (WebSite + SearchAction, Dataset, WebApplication);
 *  · кантэнт для тых, хто не выконвае JS: краўлеры ChatGPT, Claude і Perplexity
 *    інакш бачаць пусты <div id="root">.
 *
 * Змрочны бок SPA: React ачышчае #root пры мантаваньні, таму фолбэк унутры
 * яго — карэктны прагрэсіўны прыём, а не клоўкінг: тэкст той самы, што
 * паказвае сам дадатак.
 */
import fs from 'node:fs';
import path from 'node:path';
import { SUMMARY, siteFacts } from '../src/lib/faq.js';
import { siteJsonLd } from './geo.mjs';

const esc = (s) => String(s).replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));

function readMeta(root) {
  for (const p of ['public/data/meta.json', 'data/meta.json']) {
    try { return JSON.parse(fs.readFileSync(path.join(root, p), 'utf8')); } catch { /* далей */ }
  }
  return {};
}

/** Тое, што бачаць краўлер і карыстальнік без JS: загаловак, факты, спасылкі. */
function fallback(base, f) {
  return `
      <header class="top wrap">
        <div class="top-row"><h1>Сьпіс экстрэмісцкіх матэрыялаў Беларусі</h1></div>
        <p class="sub">${f.total ? `${esc(f.totalStr)} запісаў · абноўлена ${esc(f.updatedStr)}` : 'Пошук па афіцыйным сьпісе'}</p>
      </header>
      <main class="wrap">
        <p class="summary">Загрузка індэкса…</p>
        <noscript>
          <h2>Пошук па Рэспубліканскім сьпісе экстрэмісцкіх матэрыялаў Беларусі</h2>
          <p>${esc(SUMMARY.be(f))}</p>
          <p>Сам пошук патрабуе JavaScript, бо ўся база працуе ў браўзэры і запыты нікуды не адпраўляюцца. Без JavaScript даступныя тэкставыя старонкі:</p>
          <ul>
            <li><a href="${base}faq.html">Пытаньні і адказы: што такое сьпіс, што пагражае за рэпост, як праверыць канал</a></li>
            <li><a href="${base}faq-en.html">FAQ in English</a></li>
            <li><a href="${base}feed.xml">RSS-стужка новых запісаў</a></li>
            <li><a href="https://t.me/elist_by">Telegram-канал @elist_by</a></li>
            <li><a href="https://github.com/it-beard/extremist-by">Адкрыты код на GitHub</a></li>
          </ul>
        </noscript>
      </main>`;
}

export function geo({ site = process.env.SITE_URL || 'https://elist.itbeard.com/', base = process.env.BASE_PATH || '/' } = {}) {
  const siteUrl = site.replace(/\/?$/, '/');
  return {
    name: 'geo',
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        const root = ctx?.server?.config?.root || process.cwd();
        const f = siteFacts(readMeta(root));
        const desc = SUMMARY.be(f);
        const jsonLd = JSON.stringify(siteJsonLd({ site: siteUrl, facts: f, lang: 'be' }));
        const head = `<link rel="canonical" href="${esc(siteUrl)}">
<meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large">
<link rel="search" type="application/opensearchdescription+xml" title="Сьпіс экстрэмісцкіх матэрыялаў" href="${base}opensearch.xml">
<meta property="og:url" content="${esc(siteUrl)}">
<meta property="og:site_name" content="Сьпіс экстрэмісцкіх матэрыялаў Беларусі">
<meta property="og:locale" content="be_BY">
<meta name="twitter:title" content="Пошук па сьпісе экстрэмісцкіх матэрыялаў Беларусі">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${esc(new URL('icon-512.png', siteUrl).href)}">
<script type="application/ld+json">${jsonLd}</script>
</head>`;
        return html
          // апісаньне з жывымі лічбамі — самы моцны GEO-сігнал паводле дасьледаваньня
          .replace(/(<meta name="description" content=")[^"]*(">)/, `$1${esc(desc)}$2`)
          .replace('</head>', head)
          .replace('<div id="root"></div>', `<div id="root">${fallback(base, f)}\n    </div>`);
      },
    },
  };
}

export default geo;
