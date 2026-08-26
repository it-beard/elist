import { describe, expect, it } from 'vitest';
import { FAQ, KEY_FACTS, SUMMARY, dataStats, fmtNum, siteFacts } from '../src/lib/faq.js';
import {
  AI_BOTS, faqPage, llmsFullTxt, llmsTxt, notFoundPage, openSearchXml, robotsTxt, securityTxt, siteJsonLd, sitemapXml,
} from '../scripts/geo.mjs';

const SITE = 'https://elist.itbeard.com/';
const META = { total: 5989, updated: '2026-08-26' };
const DB = [
  { type: 'Информационная продукция', date: '2026-08-21' },
  { type: 'Информационная продукция', date: '2025-01-10' },
  { type: 'Книжное издание', date: '2024-05-05' },
  { type: 'Символика и атрибутика', date: '' },
];
const facts = { ...siteFacts(META), ...dataStats(DB) };

describe('факты', () => {
  it('фарматуе лічбы і даты', () => {
    expect(fmtNum(5989)).toBe('5 989');
    expect(siteFacts(META).updatedStr).toBe('26.08.2026');
  });
  it('лічыць гады і долю інфармацыйнай прадукцыі', () => {
    const s = dataStats(DB);
    expect(s.byYear).toEqual([['2026', 1], ['2025', 1], ['2024', 1]]);
    expect(s.infoShare).toBe(50);
  });
  it('перажывае пусты meta.json', () => {
    const f = siteFacts({});
    expect(f.total).toBe(0);
    expect(() => SUMMARY.be(f)).not.toThrow();
  });
});

describe('FAQ', () => {
  it('аднолькавы набор пытанняў у абедзвюх мовах', () => {
    expect(FAQ.be).toHaveLength(FAQ.en.length);
    expect(FAQ.be.length).toBeGreaterThanOrEqual(10);
  });
  it('пытанне — сапраўднае пытанне, адказ самадастатковы', () => {
    for (const lang of ['be', 'en']) {
      for (const { q, a } of FAQ[lang]) {
        expect(q.endsWith('?')).toBe(true);
        const text = a(facts);
        expect(text.length).toBeGreaterThan(120);
        expect(text).not.toMatch(/\$\{|undefined|NaN/);
      }
    }
  });
  it('падстаўляе жывыя лічбы', () => {
    expect(FAQ.be[0].a(facts)).toContain('5 989');
    expect(FAQ.be[0].a(facts)).toContain('26.08.2026');
  });
  it('ключавыя факты — пары «назва — значэнне»', () => {
    for (const lang of ['be', 'en']) {
      for (const row of KEY_FACTS[lang](facts)) {
        expect(row).toHaveLength(2);
        expect(row[1]).toBeTruthy();
      }
    }
  });
});

describe('GEO-файлы', () => {
  it('robots.txt дазваляе ИИ-краўлераў і паказвае sitemap', () => {
    const r = robotsTxt({ site: SITE });
    for (const bot of ['GPTBot', 'ClaudeBot', 'PerplexityBot']) expect(r).toContain(`User-agent: ${bot}`);
    expect(r).toContain(`Sitemap: ${SITE}sitemap.xml`);
    expect(r).not.toMatch(/^Disallow: \/$/m);
    expect(AI_BOTS.length).toBeGreaterThan(5);
  });
  it('sitemap.xml валідны і змяшчае абедзве FAQ-старонкі', () => {
    const s = sitemapXml({ site: SITE, updated: META.updated });
    expect(s).toContain('http://www.sitemaps.org/schemas/sitemap/0.9');
    expect(s).toContain(`<loc>${SITE}faq.html</loc>`);
    expect(s).toContain(`<loc>${SITE}faq-en.html</loc>`);
    expect(s.match(/<url>/g)).toHaveLength(3);
    expect(s).toContain(`<lastmod>${META.updated}</lastmod>`);
  });
  it('llms.txt — загаловак, кароткі змест і спасылкі', () => {
    const l = llmsTxt({ site: SITE, facts: siteFacts(META), stats: dataStats(DB) });
    expect(l.startsWith('# ')).toBe(true);
    expect(l).toContain('\n> ');
    expect(l).toContain('5 989');
    expect(l).toContain(`${SITE}faq.html`);
    expect(l).not.toMatch(/undefined|NaN/);
  });
});

describe('Schema.org', () => {
  it('галоўная: WebSite з SearchAction, Dataset і WebApplication', () => {
    const g = siteJsonLd({ site: SITE, facts, lang: 'be' });
    const types = g['@graph'].map((n) => n['@type']);
    expect(types).toEqual(['WebSite', 'Dataset', 'WebApplication']);
    const site = g['@graph'][0];
    expect(site.potentialAction.target.urlTemplate).toBe(`${SITE}?q={search_term_string}`);
    expect(g['@graph'][1].dateModified).toBe(META.updated);
    expect(() => JSON.parse(JSON.stringify(g))).not.toThrow();
  });
  it('FAQ-старонка нясе FAQPage з усімі пытаннямі', () => {
    for (const [lang, file] of [['be', 'faq.html'], ['en', 'faq-en.html']]) {
      const html = faqPage({ site: SITE, facts: siteFacts(META), stats: dataStats(DB), lang, base: '/' });
      const ld = JSON.parse(html.match(/<script type="application\/ld\+json">(.+?)<\/script>/s)[1]);
      const faq = ld['@graph'].find((n) => n['@type'] === 'FAQPage');
      expect(faq.mainEntity).toHaveLength(FAQ[lang].length);
      expect(faq.mainEntity[0].acceptedAnswer.text.length).toBeGreaterThan(120);
      expect(html).toContain(`<html lang="${lang}">`);
      expect(html).toContain(`<link rel="canonical" href="${SITE}${file}">`);
      expect(html).toContain('hreflang="en"');
      // тэкст мусіць быць у HTML, а не толькі ў JSON-LD — інакш цытаваць няма чаго
      expect(html.match(/<h2>/g).length).toBeGreaterThanOrEqual(FAQ[lang].length);
      expect(html).not.toMatch(/undefined|NaN|\[object Object\]/);
    }
  });
});

describe('дадатковыя файлы', () => {
  it('llms-full.txt нясе ўсе пытанні абедзвюх моў', () => {
    const l = llmsFullTxt({ site: SITE, facts: siteFacts(META), stats: dataStats(DB) });
    for (const lang of ['be', 'en']) for (const { q } of FAQ[lang]) expect(l).toContain(q);
    expect(l).toContain(`${SITE}data/index.json`);
    expect(l).not.toMatch(/undefined|NaN|\[object Object\]/);
    // поўны тэкст мусіць быць істотна большы за карту сайта
    expect(l.length).toBeGreaterThan(llmsTxt({ site: SITE, facts: siteFacts(META), stats: dataStats(DB) }).length);
  });
  it('opensearch.xml апісвае пошук праз ?q=', () => {
    const x = openSearchXml({ site: SITE });
    expect(x).toContain('http://a9.com/-/spec/opensearch/1.1/');
    expect(x).toContain(`template="${SITE}?q={searchTerms}"`);
    // ShortName паводле спецыфікацыі — не даўжэй за 16 сімвалаў
    expect(x.match(/<ShortName>(.*?)<\/ShortName>/)[1].length).toBeLessThanOrEqual(16);
  });
  it('security.txt адпавядае RFC 9116', () => {
    const t = securityTxt({ site: SITE, now: new Date('2026-08-26T00:00:00Z') });
    expect(t).toMatch(/^Contact: https:\/\//m);
    expect(t).toMatch(/^Expires: 2027-08-26T00:00:00Z$/m);
    expect(t).toContain(`Canonical: ${SITE}.well-known/security.txt`);
    expect(new Date(t.match(/^Expires: (.+)$/m)[1]).getTime()).toBeGreaterThan(Date.parse('2026-08-26'));
  });
  it('404.html не індэксуецца, але вядзе далей', () => {
    const h = notFoundPage({ site: SITE, base: '/' });
    expect(h).toContain('<meta name="robots" content="noindex, follow">');
    expect(h).toContain('href="/faq.html"');
    expect(h).toContain('href="/"');
  });
});
