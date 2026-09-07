import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { STRINGS, LANGS, DEFAULT_LANG, LINKS } from '../src/lib/i18n.js';
import { NEW_DAYS } from '../src/lib/format.js';
import { FAQ, siteFacts } from '../src/lib/faq.js';

const ROOT = path.resolve(import.meta.dirname, '..');
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));
const SRC = walk(path.join(ROOT, 'src')).filter((f) => /\.(jsx?|mjs)$/.test(f) && !f.endsWith('i18n.js')).map((f) => fs.readFileSync(f, 'utf8')).join('\n');

const shape = (v) => (typeof v === 'function' ? `fn/${v.length}` : Array.isArray(v) ? `arr/${v.length}` : v && typeof v === 'object' ? `obj:${Object.keys(v).sort().join(',')}` : typeof v);

describe('i18n: парытэт моў і жывыя ключы', () => {
  it('мовы: be па змаўчанні, ёсць be і en', () => {
    expect(LANGS).toEqual(['be', 'en']);
    expect(DEFAULT_LANG).toBe('be');
  });
  it('усе ключы ёсць у абедзвюх мовах, з той жа формай (функцыя/масіў/аб’ект/радок) і арнасцю', () => {
    const [be, en] = [STRINGS.be, STRINGS.en];
    expect(Object.keys(en).filter((k) => !(k in be))).toEqual([]);
    expect(Object.keys(be).filter((k) => !(k in en))).toEqual([]);
    const diff = Object.keys(be).filter((k) => shape(be[k]) !== shape(en[k])).map((k) => `${k}: ${shape(be[k])} vs ${shape(en[k])}`);
    expect(diff).toEqual([]);
    for (const k of Object.keys(be)) {
      if (Array.isArray(be[k])) be[k].forEach((v, i) => expect(shape(v), `${k}[${i}]`).toBe(shape(en[k][i])));
    }
  });
  it('кожны ключ недзе ўжываецца (t.key, t[rel] для today/yesterday) — мёртвых радкоў няма', () => {
    const dynamic = new Set(['today', 'yesterday', 'total', 'found', 'fuzzy']); // t[rel] у Header, t[sum.kind] у App
    const dead = Object.keys(STRINGS.be).filter((k) => !dynamic.has(k) && !new RegExp(`\\bt\\.${k}\\b|\\bt\\[['"]${k}['"]\\]`).test(SRC));
    expect(dead).toEqual([]);
  });
  it('кожны t.key у кодзе існуе ў слоўніку (нічога не выдалена лішняга)', () => {
    const used = new Set([...SRC.matchAll(/\bt\.([a-zA-Z0-9_]+)\b/g)].map((m) => m[1]));
    const notKeys = new Set(['me', 'length', 'some', 'every', 'map', 'filter', 'includes', 'split', 'trim', 'slice', 'replace', 'test', 'match']); // t.me/… у тэкстах і метады зменных з імем t
    const missing = [...used].filter((k) => !notKeys.has(k) && !(k in STRINGS.be));
    expect(missing).toEqual([]);
  });
  it('спасылкі — толькі https', () => {
    for (const [k, v] of Object.entries(LINKS)) expect(v, k).toMatch(/^https:\/\//);
  });
  it('тэксты не супярэчаць UI: укладкі і плашкі ўсіх чатырох спісаў — тымі ж словамі, без «валанцёраў», без «30 дзён» літаральна', () => {
    const facts = siteFacts({ total: 1, updated: '2026-09-07', formations: { total: 1 }, persons: { total: 1 }, wanted: { total: 1 } });
    for (const lang of LANGS) {
      const t = STRINGS[lang];
      const [open, close] = lang === 'en' ? ['“', '”'] : ['«', '»'];
      // радок укладак — як у Facets.jsx (ORDER), і ў даведцы, і ў FAQ пра адрозненне спісаў
      const tabs = `${open}${['all', 'm', 'f', 'p', 'w'].map((k) => t.facet[k]).join(' · ')}${close}`;
      const joined = [...t.helpHow, t.helpAbout1, t.helpAbout2].join('\n');
      const faq = FAQ[lang].map((x) => x.a(facts)).join('\n');
      expect(joined).toContain(tabs);
      expect(faq).toContain(tabs);
      // плашкі на картках — «Матэрыял», «Фарміраванне», «Асоба», «Вышук РФ» — у даведцы і FAQ названыя так, як на картках
      const chips = [t.article(302, 'kgs').split(' · ')[0], t.formationLabel(), t.personLabel(), t.wantedLabel()];
      for (const c of chips) {
        expect(joined, c).toContain(`${open}${c}${close}`);
        expect(faq, c).toContain(`${open}${c}${close}`);
      }
      // скароты дат нараджэння на картках («д.н.» — асоба, «г.н.» — вышук РФ) — растлумачаныя ў даведцы
      expect(joined).toContain(`${open}${t.born}${close}`);
      expect(joined).toContain(`${open}${t.bornYear(1993).replace('1993', '').trim()}${close}`);
      expect(joined).not.toMatch(/валанцёр|volunteer/);
      expect(t.showRemovedTitle(7)).toContain('7');
      expect(t.newFilterEmpty(7)).toContain('7');
      expect(t.helpHow.some((s) => s.includes(`${NEW_DAYS} `))).toBe(true); // акно «Новага» — з канстанты
    }
  });
});
