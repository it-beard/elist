import { describe, it, expect, vi, beforeAll } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { LangContext } from '../src/hooks/useLang.jsx';
import { LINKS, STRINGS } from '../src/lib/i18n.js';
import { UNDATED } from '../src/lib/wanted.js';

// Поўныя запісы (фрагменты) па нумары ў індэксе — без сеткі: запіс вышуку з крос-спасылкай на асобу, выключаны
// з прыблізнай датай, асоба з крос-спасылкай на вышук
const RECORDS = {
  0: { id: 'w1', list: 'w', name: 'АБАДОВСКАЯ ЮЛИЯ ЛЕОНИДОВНА', aliases: ['АБАДОВСКАЯ-ТЭСТ ЮЛИЯ'], year: 1993, nationality: 'БЕЛАРУСКА', region: 'Минская область', agency: 'МВД', date: '2024-07-16', before: '', first: '<2020', category: 'Полк Калиновского', rf: 'terr', also: ['p1'] },
  1: { id: 'w2', list: 'w', name: 'АБЕЛЕВ НИКОЛАЙ НИКОЛАЕВИЧ', year: 1975, nationality: '', region: '', agency: '', date: '', before: '2026-05', first: '', category: '', rf: '' },
  2: { id: 'p1', list: 'p', num: 1, name: 'Абадовская Юлия Леонидовна', translit: 'ABADOUSKAYA YULIYA', citizenship: 'Республика Беларусь', birth: '01.02.1993', basis: 'Вступивший в законную силу приговор суда', articles: ['342'], included: '23.03.2022', date: '2022-03-23', address: '', info: 'Отбывает наказание', also: ['w1'] },
};
vi.mock('../src/hooks/useRecord.js', () => ({ useRecord: (i) => RECORDS[i] ?? null }));

const ITEMS = [
  { i: 0, id: 'w1', list: 'w', n: null, date: '2024-07-16', added: '', removed: '', editOf: '', replacedBy: '', art: 'wmvd', h: 'абадовская юлия леонидовна' },
  { i: 1, id: 'w2', list: 'w', n: null, date: '', added: '', removed: UNDATED, editOf: '', replacedBy: '', art: 'wother', h: 'абелев николай николаевич' },
  { i: 2, id: 'p1', list: 'p', n: 1, date: '2022-03-23', added: '', removed: '', editOf: '', replacedBy: '', art: 'protest', h: 'абадовская юлия леонидовна' },
];
const META = {
  updated: '2026-09-03', checked: '2026-09-03', checkedAt: '2026-09-03T08:54:44.489Z', sourceError: null, fallback: false, total: 6031,
  persons: { updated: '2026-09-05', checked: '2026-09-05', checkedAt: '2026-09-05T14:04:18.967Z', sourceError: null, total: 6874 },
  wanted: { updated: '2026-09-07', checked: '2026-09-07', checkedAt: '2026-09-07T09:41:30.689Z', sourceError: 'HTTP 404', sourceDate: '2026-08-31', total: 6680 },
};

let ResultItem, RecordPage, Facets, Header, listStamps, Consequences, StatsPage, WhatsNew;
beforeAll(async () => {
  globalThis.location = { href: 'https://elist.test/#/r/w1', hash: '#/r/w1', origin: 'https://elist.test', pathname: '/' };
  globalThis.history = { state: null, replaceState() { } };
  ({ default: ResultItem } = await import('../src/components/ResultItem.jsx'));
  ({ default: RecordPage } = await import('../src/components/RecordPage.jsx'));
  ({ default: Facets } = await import('../src/components/Facets.jsx'));
  ({ default: Header, listStamps } = await import('../src/components/Header.jsx'));
  ({ default: Consequences } = await import('../src/components/Consequences.jsx'));
  ({ default: StatsPage } = await import('../src/components/StatsPage.jsx'));
  ({ default: WhatsNew } = await import('../src/components/WhatsNew.jsx'));
});

const render = (lang, el) => renderToStaticMarkup(<LangContext.Provider value={{ lang, t: STRINGS[lang], setLang: () => { } }}>{el}</LangContext.Provider>);
const watch = { has: () => false, add() { }, remove() { } };

describe('рэндэр чацвёртага спіса — вышук РФ (SSR, абедзве мовы)', () => {
  for (const lang of ['be', 'en']) {
    const t = STRINGS[lang];
    it(`${lang}: картка вышуку — янтарная плашка, імя ў звычайным рэгістры, факты без «undefined», крос-спасылка на асобу`, () => {
      const html = render(lang, <ResultItem item={ITEMS[0]} tokens={[['абадовская']]} chunkSize={200} />);
      expect(html).not.toMatch(/undefined|\[object Object\]|NaN/);
      expect(html).toContain('class="item wanted"');
      expect(html).toContain('class="type wanted"');
      expect(html).toContain(t.wantedLabel('wmvd'));
      expect(html).toContain(`title="${t.wantedTitle('wmvd')}"`);
      expect(html).toContain('<mark>Абадовская</mark> Юлия Леонидовна'); // падсветка працуе на пераўтвораным рэгістры
      expect(html).not.toContain('АБАДОВСКАЯ ЮЛИЯ');
      expect(html).toContain('<mark>Абадовская</mark>-Тэст Юлия'); // і ў іншым напісанні
      expect(html).toContain(`1993 ${t.bornYear} · Беларуска · Минская область · ${t.requestedBy} МВД`);
      expect(html).toContain(`<a class="num date" href="#/r/w1" title="${t.wantedDateTitle}">16.07.2024</a>`); // дата — спасылка на запіс
      expect(html).toContain('<svg class="ico"'); // значок справа — кнопка «скапіяваць спасылку»
      expect(html).toContain(`aria-label="${t.permalinkW}"`);
      expect(html).not.toContain('№');
      expect(html).toContain(`href="#/r/p1">↔ ${t.alsoInPersons}</a>`);
      expect(html).toContain('class="also"');
    });
    it(`${lang}: выключаны з базы без даты — словы без «?», прыблізная дата «да …»; картка асобы са спасылкай на вышук`, () => {
      const gone = render(lang, <ResultItem item={ITEMS[1]} tokens={[]} chunkSize={200} />);
      expect(gone).toContain('item wanted removed');
      expect(gone).toContain(`<span class="gone">${t.wantedOut}</span>`);
      expect(gone).not.toContain('?</span>');
      expect(gone).toContain(`href="#/r/w2" title="${t.wantedDateTitle}">${t.before} 05.2026</a>`); // прыблізная дата — таксама спасылка
      expect(gone).toContain(`1975 ${t.bornYear}`);
      expect(gone).not.toContain('also');
      expect(gone).toContain(t.wantedLabel('wother'));
      const person = render(lang, <ResultItem item={ITEMS[2]} tokens={[]} chunkSize={200} />);
      expect(person).toContain('class="item person"');
      expect(person).toContain(`href="#/r/w1">↔ ${t.alsoInWanted}</a>`);
    });
    it(`${lang}: старонка запісу вышуку — усе палі, ведамства словамі, стан, падказка, наступствы`, () => {
      const a = render(lang, <RecordPage id="w1" items={ITEMS} chunkSize={200} watch={watch} />);
      expect(a).not.toMatch(/undefined|\[object Object\]/);
      expect(a).toContain(t.recTitleW);
      for (const k of ['recYear', 'recNationality', 'recRegion', 'recAgency', 'recWantedDate', 'recFirstWanted', 'recAliases', 'recCategoryW', 'recStatusW']) expect(a).toContain(t[k]);
      expect(a).toContain(t.agencyName['МВД']);
      expect(a).toContain(`${t.before} 2020`);
      expect(a).toContain(`Полк Калиновского · ${t.rfLabel.terr}`);
      expect(a).toContain(t.wantedLive);
      // «корак» у канцы карткі палёў: заўвага пра крыніцу, у ёй спасылка на гэты запіс у віджэце Медыязоны (імя ў ніжнім
      // рэгістры ў ?q=, знешняя — новая ўкладка, без рэферэра); асобнага поля «Крыніца» няма
      expect(a).toContain(`</dl><p class="rec-stub">${t.positionW1}<a href="${LINKS.mediazona}?q=${encodeURIComponent('абадовская юлия леонидовна')}" target="_blank" rel="noopener noreferrer nofollow">${t.positionWLink} ↗</a>${t.positionW2}</p></div>`);
      expect(a).not.toContain('class="hint"');
      expect(a).toContain('crime wanted');
      expect(a).toContain(t.wantedNote.slice(0, 40));
      expect(a).toContain(`☆ ${t.watchAdd}`);
      const b = render(lang, <RecordPage id="w2" items={ITEMS} chunkSize={200} watch={watch} />);
      expect(b).toContain(t.agencyUnknown);
      expect(b).toContain(t.wantedOutFull);
      expect(b).not.toContain(t.recAliases);
      expect(b).not.toContain(t.recFirstWanted);
    });
    it(`${lang}: укладкі, шапка з датай файла Медыязоны і папярэджаннем, статыстыка, «Новае», наступствы`, () => {
      const facets = render(lang, <Facets counts={{ all: 10, m: 1, f: 1, p: 1, w: 7 }} value="w" onChange={() => { }} lists={{ f: true, p: true, w: true }} />);
      expect(facets.match(/<button/g)).toHaveLength(5);
      expect(facets).toContain('facet w on');
      expect(facets).toContain(t.facet.w);
      expect(facets).toContain(`title="${t.facetTitle.w}"`);
      expect(render(lang, <Facets counts={{ all: 3, m: 1, f: 1, p: 1, w: 0 }} value="" onChange={() => { }} lists={{ f: true, p: true }} />)).not.toContain(t.facet.w);
      const head = render(lang, <Header meta={META} online onHelp={() => { }} />);
      expect(head).toContain(t.wantedDown('07.09.2026'));
      expect(head).not.toMatch(/undefined/);
      const { lists, latest } = listStamps(META, t, lang);
      expect(lists.map((x) => x.key)).toEqual(['m', 'p', 'w']);
      expect(latest.key).toBe('w');
      // дата файла Медыязоны — асобным радком толькі ў папове (sub), у бачны радок шапкі (value/latest) не трапляе
      expect(lists[2].sub).toBe(t.wantedSource('31.08.2026'));
      expect(lists[2].value).not.toContain('31.08.2026');
      expect(latest.value).not.toContain('31.08.2026');
      expect(head).not.toContain(t.wantedSource('31.08.2026'));
      expect(lists[1].sub).toBe('');
      expect(listStamps({ wanted: { checkedAt: '2026-09-07T09:41:30.689Z' } }, t, lang).lists[0]).toMatchObject({ sub: '' });
      const stats = render(lang, <StatsPage items={ITEMS} initialList="w" />);
      expect(stats).not.toMatch(/undefined|NaN/);
      expect(stats).toContain(t.statsWanted);
      expect(stats).toContain(t.statsIntroW);
      expect(stats).toContain('key s-wmvd');
      expect(stats).toContain('key s-wother');
      expect(stats).toContain(t.series.wkgk);
      expect(stats).not.toContain(t.statsApproxW('1')); // адзіны запіс без даты — выключаны, у статыстыку не ідзе
      const statsApprox = render(lang, <StatsPage items={[...ITEMS, { ...ITEMS[1], i: 3, id: 'w3', removed: '' }]} initialList="w" />);
      expect(statsApprox).toContain(t.statsApproxW('1'));
      expect(render(lang, <StatsPage items={ITEMS.slice(2)} initialList="w" />)).not.toContain(t.statsWanted); // без вышуку ў базе — і без укладкі
      const cons = render(lang, <Consequences open wanted />);
      expect(cons).toContain('crime wanted');
      expect(cons).not.toContain('crime person');
      const wn = render(lang, <WhatsNew items={ITEMS} chunkSize={200} lists={{ w: true }} />);
      expect(wn).toContain(t.facet.w);
      expect(wn).not.toContain(t.facet.p);
    });
  }
});
