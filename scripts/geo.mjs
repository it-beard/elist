/**
 * GEO (Generative Engine Optimization): робіць сайт бачным для генэратыўных
 * рухавікоў — ChatGPT, Claude, Perplexity, Google AI Overviews.
 *
 * Генэруе (у public/, адкуль Vite капіюе ў dist/):
 *   robots.txt      — яўны дазвол ИИ-краўлерам + спасылка на sitemap
 *   llms.txt         — карта сайта ў prompt-friendly выглядзе
 *   llms-full.txt    — поўны тэкст (усе пытаньні і адказы) адным файлам
 *   sitemap.xml      — старонкі з датай абнаўленьня
 *   faq.html         — статычная старонка «Пытаньні і адказы» (бе)
 *   faq-en.html      — тое самае па-ангельску
 *   opensearch.xml   — сайт як пошукавік у адрасным радку браўзэра
 *   404.html         — старонка памылкі са спасылкамі (GitHub Pages аддае яе сам)
 *   .well-known/security.txt — куды паведамляць пра ўразьлівасьці (RFC 9116)
 *
 * Статычныя старонкі патрэбныя таму, што сам сайт — SPA: без JS краўлер
 * бачыць пусты <div id="root">, і цытаваць яму няма чаго.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { FAQ, KEY_FACTS, SUMMARY, dataStats, siteFacts } from '../src/lib/faq.js';

const esc = (s) => String(s).replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
const abs = (site, p) => new URL(p, site).href;

/** Краўлеры генэратыўных рухавікоў — дазваляем яўна, каб сайт трапляў у адказы. */
export const AI_BOTS = [
  'GPTBot', 'OAI-SearchBot', 'ChatGPT-User',
  'ClaudeBot', 'Claude-User', 'Claude-SearchBot', 'anthropic-ai',
  'PerplexityBot', 'Perplexity-User',
  'Google-Extended', 'Applebot-Extended', 'Bingbot', 'CCBot', 'meta-externalagent', 'Amazonbot', 'YandexBot',
];

export function robotsTxt({ site }) {
  const allow = AI_BOTS.map((ua) => `User-agent: ${ua}\nAllow: /`).join('\n\n');
  return `# Сайт адкрыты і для звычайных пошукавікаў, і для генэратыўных рухавікоў.
# Даныя публічныя, аналітыкі няма — прычын закрываць краўлераў таксама няма.

User-agent: *
Allow: /

${allow}

Sitemap: ${abs(site, 'sitemap.xml')}
`;
}

export function sitemapXml({ site, updated }) {
  const pages = [
    { loc: abs(site, ''), priority: '1.0', freq: 'daily' },
    { loc: abs(site, 'faq.html'), priority: '0.8', freq: 'weekly' },
    { loc: abs(site, 'faq-en.html'), priority: '0.6', freq: 'weekly' },
  ];
  const urls = pages.map((p) => `  <url>
    <loc>${esc(p.loc)}</loc>
    <lastmod>${updated}</lastmod>
    <changefreq>${p.freq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

/** llms.txt — кароткая карта сайта для моўных мадэляў (markdown, без разьметкі старонак). */
export function llmsTxt({ site, facts, stats }) {
  const f = { ...facts, ...stats };
  const years = (stats.byYear || []).slice(0, 6).map(([y, n]) => `- ${y}: ${n} запісаў`).join('\n');
  const faq = FAQ.be.slice(0, 6).map((x) => `- **${x.q}** ${x.a(f)}`).join('\n');
  return `# Сьпіс экстрэмісцкіх матэрыялаў Беларусі — пошук

> ${SUMMARY.be(f)}

Неафіцыйны сайт з адкрытым кодам. Даныя аўтаматычна бяруцца з афіцыйнай публікацыі Рэспубліканскага сьпісу экстрэмісцкіх матэрыялаў і не рэдагуюцца. Сайт статычны, без сэрвэрнай часткі: уся база спампоўваецца ў браўзэр, запыты нікуды не адпраўляюцца.

## Ключавыя факты

${KEY_FACTS.be(f).map(([k, v]) => `- **${k}:** ${v}`).join('\n')}

## Запісы па годзе судовага рашэньня

${years}

## Старонкі

- [Пошук](${abs(site, '')}): галоўная старонка; запыт можна перадаць у URL — \`?q=запыт\`.
- [Пытаньні і адказы](${abs(site, 'faq.html')}): што такое сьпіс, што пагражае за рэпост, чым ён адрозьніваецца ад сьпісу экстрэмісцкіх фарміраваньняў.
- [FAQ (English)](${abs(site, 'faq-en.html')}): тое самае па-ангельску.
- [Што новага](${abs(site, '#/new')}): запісы, згрупаваныя па даце зьяўленьня ў сьпісе.
- [RSS](${abs(site, 'feed.xml')}): стужка новых запісаў.

## Часта пытаюць

${faq}

## Умовы выкарыстаньня

Кантэнт можна цытаваць і пераказваць са спасылкай на ${abs(site, '')}. Тэксты саміх запісаў — афіцыйныя даныя і падаюцца як у крыніцы. Гэта не юрыдычная кансультацыя.
`;
}

/** Schema.org для галоўнай: WebSite + SearchAction, Dataset, WebApplication. */
export function siteJsonLd({ site, facts, lang = 'be' }) {
  const f = facts;
  const name = lang === 'en' ? 'List of extremist materials of Belarus — search' : 'Сьпіс экстрэмісцкіх матэрыялаў Беларусі — пошук';
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': `${abs(site, '')}#website`,
        url: abs(site, ''),
        name,
        description: SUMMARY[lang](f),
        inLanguage: ['be', 'en'],
        isAccessibleForFree: true,
        potentialAction: {
          '@type': 'SearchAction',
          target: { '@type': 'EntryPoint', urlTemplate: `${abs(site, '')}?q={search_term_string}` },
          'query-input': 'required name=search_term_string',
        },
      },
      {
        '@type': 'Dataset',
        '@id': `${abs(site, '')}#dataset`,
        name: lang === 'en' ? 'Republican list of extremist materials of Belarus' : 'Рэспубліканскі сьпіс экстрэмісцкіх матэрыялаў Беларусі',
        description: SUMMARY[lang](f),
        url: abs(site, ''),
        inLanguage: 'ru',
        isAccessibleForFree: true,
        dateModified: f.updated || undefined,
        creator: { '@type': 'Organization', name: 'elist.itbeard.com' },
        distribution: [
          { '@type': 'DataDownload', encodingFormat: 'application/rss+xml', contentUrl: abs(site, 'feed.xml') },
          { '@type': 'DataDownload', encodingFormat: 'application/json', contentUrl: abs(site, 'data/index.json') },
        ],
        variableMeasured: ['тып матэрыялу', 'апісаньне', 'суд', 'дата рашэньня', 'дата зьяўленьня ў сьпісе'],
      },
      {
        '@type': 'WebApplication',
        '@id': `${abs(site, '')}#app`,
        name,
        url: abs(site, ''),
        applicationCategory: 'ReferenceApplication',
        operatingSystem: 'Any (PWA)',
        browserRequirements: 'JavaScript; працуе афлайн пасьля першага адкрыцьця',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        featureList: lang === 'en'
          ? ['Instant search over the whole list', 'Watchlist with change alerts', 'RSS and Telegram digest', 'Offline PWA', 'No tracking']
          : ['Імгненны пошук па ўсім сьпісе', 'Сьпіс назіраньня з апавяшчэньнямі', 'RSS і дайджэст у Telegram', 'Афлайн-рэжым (PWA)', 'Без сачэньня і аналітыкі'],
      },
    ],
  };
}

function faqJsonLd({ site, facts, lang, page }) {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'FAQPage',
        '@id': `${page}#faq`,
        url: page,
        inLanguage: lang,
        dateModified: facts.updated || undefined,
        mainEntity: FAQ[lang].map((x) => ({
          '@type': 'Question',
          name: x.q,
          acceptedAnswer: { '@type': 'Answer', text: x.a(facts) },
        })),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: lang === 'en' ? 'Search' : 'Пошук', item: abs(site, '') },
          { '@type': 'ListItem', position: 2, name: lang === 'en' ? 'FAQ' : 'Пытаньні і адказы', item: page },
        ],
      },
    ],
  };
}

const PAGE_CSS = `:root{--bg:#f4f5f7;--card:#fff;--text:#16181d;--muted:#6b7280;--line:#e4e6eb;--accent:#b3261e;--accent-soft:#fbeae8;--radius:14px}
:root[data-theme="dark"]{color-scheme:dark}:root[data-theme="light"]{color-scheme:light}
@media(prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#111317;--card:#1a1d23;--text:#e9ebef;--muted:#9aa1ad;--line:#272b33;--accent:#ff6b5e;--accent-soft:#3a1f1d}}
:root[data-theme="dark"]{--bg:#111317;--card:#1a1d23;--text:#e9ebef;--muted:#9aa1ad;--line:#272b33;--accent:#ff6b5e;--accent-soft:#3a1f1d}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--text);font:16px/1.6 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
.wrap{max-width:760px;margin:0 auto;padding:0 max(16px,env(safe-area-inset-left)) 48px}
a{color:var(--accent);text-underline-offset:2px}
header.top{padding:28px 0 4px}
h1{font-size:1.5rem;line-height:1.25;margin:0 0 8px;letter-spacing:-.01em}
.lead{font-size:1.02rem;margin:0 0 4px}
.sub{color:var(--muted);font-size:.9rem;margin:0}
nav.crumbs{margin:16px 0 0;font-size:.9rem}
table{width:100%;border-collapse:collapse;margin:16px 0;font-size:.92rem;display:block;overflow-x:auto}
th,td{text-align:left;padding:8px 10px;border-bottom:1px solid var(--line);vertical-align:top}
th{width:38%;font-weight:600;color:var(--muted)}
h2{font-size:1.08rem;margin:28px 0 6px;line-height:1.3}
h2+p{margin-top:0}
section p{margin:0 0 10px}
.card{background:var(--card);border:1px solid var(--line);border-radius:var(--radius);padding:14px 16px;margin:18px 0}
.cta{display:inline-block;margin:6px 8px 0 0;padding:9px 16px;border-radius:99px;border:1px solid var(--accent);color:var(--accent);text-decoration:none;font-weight:600;font-size:.9rem}
.cta.solid{background:var(--accent);color:#fff}
ul.links{padding-left:18px}
footer{margin-top:36px;padding-top:20px;border-top:1px solid var(--line);color:var(--muted);font-size:.84rem}
footer p{margin:0 0 8px}
code{font-size:.85em;background:var(--line);padding:1px 5px;border-radius:5px}
@media(max-width:600px){h1{font-size:1.25rem}th{width:auto}}`;

const THEME_BOOT = 'var t="light";try{t=JSON.parse(localStorage.getItem("theme"))||t}catch(e){}if(t!=="system")document.documentElement.setAttribute("data-theme",t==="dark"?"dark":"light")';

/** Статычная старонка FAQ: поўны тэкст у HTML, без JS — менавіта яе цытуюць мадэлі. */
export function faqPage({ site, facts, stats, lang, base = '/' }) {
  const f = { ...facts, ...stats };
  const en = lang === 'en';
  const page = abs(site, en ? 'faq-en.html' : 'faq.html');
  const title = en
    ? 'FAQ: the list of extremist materials of Belarus'
    : 'Пытаньні і адказы: сьпіс экстрэмісцкіх матэрыялаў Беларусі';
  const lead = en
    ? `This page answers the most common questions about the Republican list of extremist materials of Belarus and about this search site: what the list is, how to check a channel or handle, what the penalties are, and what data the site stores. As of ${f.updatedStr} the database holds ${f.totalStr} entries and refreshes once a day.`
    : `Гэтая старонка адказвае на самыя частыя пытаньні пра Рэспубліканскі сьпіс экстрэмісцкіх матэрыялаў Беларусі і пра гэты сайт: што такое сьпіс, як праверыць канал ці нік, што пагражае за рэпост і якія даныя сайт захоўвае. На ${f.updatedStr} у базе ${f.totalStr} запісаў, яна абнаўляецца раз на суткі.`;
  const years = (stats.byYear || []).slice(0, 6);
  const yearsTitle = en ? 'Entries by year of the court decision' : 'Запісы па годзе судовага рашэньня';
  const factsTitle = en ? 'Key facts' : 'Ключавыя факты';
  const sourcesTitle = en ? 'Where to get help' : 'Куды зьвяртацца па дапамогу';
  const backLabel = en ? 'Search the list' : 'Шукаць па сьпісе';

  const rows = KEY_FACTS[lang](f).map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join('\n');
  const yearRows = years.map(([y, n]) => `<tr><th>${y}</th><td>${en ? `${n} entries` : `${n} запісаў`}</td></tr>`).join('\n');
  const sections = FAQ[lang].map((x) => `<section>\n<h2>${esc(x.q)}</h2>\n<p>${esc(x.a(f))}</p>\n</section>`).join('\n\n');

  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(en ? `FAQ about the Republican list of extremist materials of Belarus: ${f.totalStr} entries as of ${f.updatedStr}, penalties under Art. 19.11, how to check a channel or handle, what data the site stores.` : `Пытаньні і адказы пра Рэспубліканскі сьпіс экстрэмісцкіх матэрыялаў Беларусі: ${f.totalStr} запісаў на ${f.updatedStr}, адказнасьць паводле арт. 19.11 КаАП, як праверыць канал ці нік, якія даныя захоўвае сайт.`)}">
<link rel="canonical" href="${esc(page)}">
<link rel="alternate" hreflang="be" href="${esc(abs(site, 'faq.html'))}">
<link rel="alternate" hreflang="en" href="${esc(abs(site, 'faq-en.html'))}">
<link rel="icon" href="${base}favicon.ico" sizes="any">
<meta property="og:type" content="article">
<meta property="og:title" content="${esc(title)}">
<meta property="og:url" content="${esc(page)}">
<meta property="og:image" content="${esc(abs(site, 'icon-512.png'))}">
<meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large">
<script type="application/ld+json">${JSON.stringify(faqJsonLd({ site, facts: f, lang, page }))}</script>
<script>${THEME_BOOT}</script>
<style>${PAGE_CSS}</style>
</head>
<body>
<div class="wrap">
<header class="top">
<h1>${esc(title)}</h1>
<p class="sub">${en ? 'Updated' : 'Абноўлена'} <time datetime="${esc(f.updated)}">${esc(f.updatedStr)}</time> · <a href="${base}">${esc(en ? 'to the search' : 'да пошуку')}</a> · <a href="${base}${en ? 'faq.html' : 'faq-en.html'}">${en ? 'Па-беларуску' : 'English'}</a></p>
</header>

<main>
<p class="lead">${esc(lead)}</p>
<p><a class="cta solid" href="${base}">${esc(backLabel)}</a><a class="cta" href="${base}feed.xml">RSS</a><a class="cta" href="https://t.me/elist_by">Telegram</a></p>

<h2>${esc(factsTitle)}</h2>
<table>
<tbody>
${rows}
</tbody>
</table>

${years.length ? `<h2>${esc(yearsTitle)}</h2>\n<table><tbody>\n${yearRows}\n</tbody></table>` : ''}

${sections}

<div class="card">
<h2 style="margin-top:0">${esc(sourcesTitle)}</h2>
<ul class="links">
<li><a href="https://spring96.org/" rel="noopener">${en ? 'Viasna Human Rights Centre' : 'Праваабарончы цэнтр «Вясна»'}</a></li>
<li><a href="https://humanconstanta.org/" rel="noopener">Human Constanta</a></li>
<li><a href="https://www.mvd.gov.by/" rel="noopener">${en ? 'List of extremist formations (Interior Ministry)' : 'Сьпіс экстрэмісцкіх фарміраваньняў (МУС)'}</a></li>
</ul>
<p>${en ? 'This page is not legal advice.' : 'Гэтая старонка — не юрыдычная кансультацыя.'}</p>
</div>
</main>

<footer>
<p>${en ? 'Unofficial search over the Republican list of extremist materials. The database updates automatically once a day; entry text, court name and date are kept exactly as in the official source.' : 'Неафіцыйны пошук па Рэспубліканскім сьпісе экстрэмісцкіх матэрыялаў. База абнаўляецца аўтаматычна раз на суткі; тэкст запісу, назва суда і дата захоўваюцца як у афіцыйнай крыніцы.'}</p>
<p><a href="${base}">${en ? 'Search' : 'Пошук'}</a> · <a href="${base}${en ? 'faq.html' : 'faq-en.html'}">${en ? 'Па-беларуску' : 'English'}</a> · <a href="https://github.com/it-beard/extremist-by" rel="noopener">GitHub</a> · <a href="${base}llms.txt">llms.txt</a></p>
</footer>
</div>
</body>
</html>
`;
}


/** llms-full.txt — увесь тэкст адным файлам, каб мадэлі не давялося хадзіць па старонках. */
export function llmsFullTxt({ site, facts, stats }) {
  const f = { ...facts, ...stats };
  const block = (lang) => FAQ[lang].map((x) => `### ${x.q}\n\n${x.a(f)}`).join('\n\n');
  const years = (stats.byYear || []).map(([y, n]) => `- ${y}: ${n}`).join('\n');
  return `# Сьпіс экстрэмісцкіх матэрыялаў Беларусі — поўны даведнік

> ${SUMMARY.be(f)}

Крыніца: ${abs(site, '')} · абноўлена ${f.updatedStr}

## Ключавыя факты

${KEY_FACTS.be(f).map(([k, v]) => `- **${k}:** ${v}`).join('\n')}

## Запісы па годзе судовага рашэньня

${years}

## Як уладкаваны пошук

- Індэкс (~400 КБ gzip) спампоўваецца ў браўзэр цалкам, таму запыты нікуды не адпраўляюцца.
- Не ўлічваюцца рэгістар, «ё/е», лацінская і кірылічная «i», віды лапак; фраза ў лапках шукаецца цалкам.
- «@nick», «t.me/nick», «https://nick.by/» і «nick» зводзяцца да аднаго выгляду.
- Кірыліца ↔ лацінка ў абодва бакі: расейская трансьлітарацыя і беларуская лацінка без дыякрытыкі.
- Калі дакладных супадзеньняў няма — прыблізны пошук па словах з памылкамі ў 1–2 літары.
- Па рашэньні суда шукаюцца назва суда і дата — словамі («20 августа 2026») і лічбамі («20.08.2026»).
- Запыт трапляе ва URL: \`?q=запыт\` — спасылкай можна дзяліцца.

## Пытаньні і адказы (беларуская)

${block('be')}

## Questions and answers (English)

${block('en')}

## Даныя ў машыначытальным выглядзе

- RSS новых запісаў: ${abs(site, 'feed.xml')}
- Індэкс базы (JSON): ${abs(site, 'data/index.json')}
- Мэтаданыя (дата абнаўленьня, колькасьць): ${abs(site, 'data/meta.json')}

## Умовы

Кантэнт можна цытаваць і пераказваць са спасылкай на ${abs(site, '')}. Тэксты саміх запісаў — афіцыйныя даныя і падаюцца як у крыніцы, без рэдагаваньня. Гэта не юрыдычная кансультацыя.
`;
}

/** OpenSearch — браўзэр можа дадаць сайт як пошукавік (і гэта яшчэ адзін сігнал пра ?q=). */
export function openSearchXml({ site }) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<OpenSearchDescription xmlns="http://a9.com/-/spec/opensearch/1.1/" xmlns:moz="http://www.mozilla.org/2006/browser/search/">
  <ShortName>Сьпіс ЭМ</ShortName>
  <LongName>Пошук па сьпісе экстрэмісцкіх матэрыялаў Беларусі</LongName>
  <Description>Пошук па Рэспубліканскім сьпісе экстрэмісцкіх матэрыялаў Беларусі</Description>
  <InputEncoding>UTF-8</InputEncoding>
  <Language>be</Language>
  <Image width="16" height="16" type="image/x-icon">${esc(abs(site, 'favicon.ico'))}</Image>
  <Image width="96" height="96" type="image/png">${esc(abs(site, 'icon-96.png'))}</Image>
  <Url type="text/html" method="get" template="${esc(abs(site, ''))}?q={searchTerms}"/>
  <moz:SearchForm>${esc(abs(site, ''))}</moz:SearchForm>
</OpenSearchDescription>
`;
}

/** security.txt (RFC 9116): куды пісаць пра ўразьлівасьці. */
export function securityTxt({ site, now = new Date() }) {
  const expires = new Date(now.getTime() + 365 * 864e5).toISOString().replace(/\.\d{3}Z$/, 'Z');
  return `# Паведаміць пра ўразьлівасьць можна праз GitHub Issues.
Contact: https://github.com/it-beard/extremist-by/issues
Expires: ${expires}
Preferred-Languages: be, en, ru
Canonical: ${abs(site, '.well-known/security.txt')}
Policy: https://github.com/it-beard/extremist-by#readme
`;
}

/** 404: статычная старонка са спасылкамі — GitHub Pages аддае яе на невядомых шляхах. */
export function notFoundPage({ site, base = '/' }) {
  return `<!doctype html>
<html lang="be">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Старонка не знойдзеная — Сьпіс экстрэмісцкіх матэрыялаў Беларусі</title>
<meta name="robots" content="noindex, follow">
<link rel="icon" href="${base}favicon.ico" sizes="any">
<script>${THEME_BOOT}</script>
<style>${PAGE_CSS}</style>
</head>
<body>
<div class="wrap">
<header class="top"><h1>Такой старонкі няма</h1>
<p class="sub">Спасылка магла састарэць або быць набранай з памылкай.</p></header>
<main>
<p class="lead">Пошук па сьпісе экстрэмісцкіх матэрыялаў працуе на галоўнай старонцы. Запісы маюць пастаянныя спасылкі выгляду <code>#/r/&lt;id&gt;</code> — калі запіс зьнік са сьпісу, спасылка на яго ўсё роўна застаецца.</p>
<p><a class="cta solid" href="${base}">На галоўную</a><a class="cta" href="${base}faq.html">Пытаньні і адказы</a><a class="cta" href="${base}feed.xml">RSS</a></p>
</main>
<footer><p><a href="${base}">Пошук</a> · <a href="${base}faq.html">Пытаньні і адказы</a> · <a href="${base}faq-en.html">English</a> · <a href="https://github.com/it-beard/extremist-by" rel="noopener">GitHub</a></p></footer>
</div>
</body>
</html>
`;
}

/** Піша ўсе GEO-файлы ў public/. */
export async function writeGeo({ root, site, base = '/', db, meta }) {
  const facts = siteFacts(meta);
  const stats = dataStats(db);
  const pub = path.join(root, 'public');
  const sec = securityTxt({ site });
  const out = {
    'robots.txt': robotsTxt({ site }),
    'sitemap.xml': sitemapXml({ site, updated: facts.updated }),
    'llms.txt': llmsTxt({ site, facts, stats }),
    'llms-full.txt': llmsFullTxt({ site, facts, stats }),
    'faq.html': faqPage({ site, facts, stats, lang: 'be', base }),
    'faq-en.html': faqPage({ site, facts, stats, lang: 'en', base }),
    'opensearch.xml': openSearchXml({ site }),
    '404.html': notFoundPage({ site, base }),
    // RFC 9116 патрабуе .well-known; копія ў корані — для старых сканэраў
    '.well-known/security.txt': sec,
    'security.txt': sec,
  };
  await fs.mkdir(path.join(pub, '.well-known'), { recursive: true });
  for (const [name, body] of Object.entries(out)) await fs.writeFile(path.join(pub, name), body);
  return Object.keys(out);
}
