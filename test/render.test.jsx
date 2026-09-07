import { describe, it, expect, vi, beforeAll } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { LangContext } from '../src/hooks/useLang.jsx';
import { STRINGS } from '../src/lib/i18n.js';

// Поўны запіс (фрагмент) па нумары ў індэксе — без сеткі
const RECORDS = {
  0: { id: 'm1', type: 'Информационная продукция', name: 'Telegram-канал "Свабода"', court: 'Решение суда Ленинского района г. Минска от 20 августа 2026 года. Подлежит немедленному исполнению в соответствии со статьей 302 Кодекса гражданского судопроизводства', order: 0 },
  1: { id: 'f1', list: 'f', kind: 'formation', name: 'Экстремистское формирование «dze.chat»', alias: '«dze.chat»', links: 'https://dze.chat', address: 'Интернет-сайт', basis: 'Решение МВД от 18.10.2021 № 1ЭК', decidedBy: 'mvd', date: '2021-10-18', included: '2021-10-18', info: 'Группа граждан', logo: 'Логотип' },
  2: { id: 'p1', list: 'p', num: 1, name: 'Ковалевский Николай Николаевич', translit: 'KAVALEUSKI MIKALAI', citizenship: 'Республика Беларусь', birth: '14.10.1983', basis: 'Вступивший в законную силу приговор суда Быховского района Могилевской области в связи с совершением преступления, предусмотренного статьей 369 Уголовного кодекса Республики Беларусь', articles: ['369'], included: '23.03.2022, 04.04.2025', date: '2022-03-23', address: 'Республика Беларусь, г. Минск', info: 'Отбывает наказание' },
  3: { id: 'p2', list: 'p', num: null, name: 'Байбак Юрий Юрьевич', translit: 'BAIBAK YURY', citizenship: '', birth: '05.08.1969', basis: 'Вступивший в законную силу приговор суда Барановичского района', articles: [], included: '04.09.2026', date: '2026-09-04', address: '', info: 'Судимость не погашена' },
  4: { stale: true }, // фрагмент не супаў з індэксам (сайт абнавіўся падчас сесіі)
};
vi.mock('../src/hooks/useRecord.js', () => ({ useRecord: (i) => RECORDS[i] ?? null }));

const ITEMS = [
  { i: 0, id: 'm1', list: 'm', n: 1, date: '2026-08-20', added: '', removed: '', editOf: '', replacedBy: '', art: 'kgs', h: 'telegram-канал "свабода"' },
  { i: 1, id: 'f1', list: 'f', n: 1, date: '2021-10-18', added: '', removed: '', editOf: '', replacedBy: '', art: 'mvd', h: 'экстремистское формирование «dze.chat»' },
  { i: 2, id: 'p1', list: 'p', n: 1, date: '2022-03-23', added: '', removed: '', editOf: '', replacedBy: '', art: 'speech', h: 'ковалевский николай николаевич kavaleuski mikalai 14.10.1983' },
  { i: 3, id: 'p2', list: 'p', n: null, date: '2026-09-04', added: '', removed: '', editOf: '', replacedBy: '', art: 'other', h: 'байбак юрий юрьевич baibak yury 05.08.1969' },
  { i: 4, id: 'p3', list: 'p', n: 2, date: '2026-09-04', added: '', removed: '', editOf: '', replacedBy: '', art: 'other', h: 'нехта нехтавіч' },
];
const META = {
  updated: '2026-09-03', checked: '2026-09-03', checkedAt: '2026-09-03T08:54:44.489Z', sourceError: null, fallback: false, total: 6031,
  formations: { updated: '2026-09-03', checked: '2026-09-03', checkedAt: '2026-09-03T10:14:53.217Z', sourceError: null, total: 377 },
  persons: { updated: '2026-09-05', checked: '2026-09-05', checkedAt: '2026-09-05T14:04:18.967Z', sourceError: 'HTTP 503', total: 6874 },
};

let ResultItem, RecordPage, Options, Facets, Header, listStamps, Consequences, StatsPage, WhatsNew, HelpDialog;
beforeAll(async () => {
  // SSR-рэндэр без браўзера: кампанентам патрэбныя location/history толькі для спасылак
  globalThis.location = { href: 'https://elist.test/#/r/p1', hash: '#/r/p1', origin: 'https://elist.test', pathname: '/' };
  globalThis.history = { state: null, replaceState() { } };
  ({ default: ResultItem } = await import('../src/components/ResultItem.jsx'));
  ({ default: RecordPage } = await import('../src/components/RecordPage.jsx'));
  ({ default: Options } = await import('../src/components/Options.jsx'));
  ({ default: Facets } = await import('../src/components/Facets.jsx'));
  ({ default: Header, listStamps } = await import('../src/components/Header.jsx'));
  ({ default: Consequences } = await import('../src/components/Consequences.jsx'));
  ({ default: StatsPage } = await import('../src/components/StatsPage.jsx'));
  ({ default: WhatsNew } = await import('../src/components/WhatsNew.jsx'));
  ({ default: HelpDialog } = await import('../src/components/HelpDialog.jsx'));
});

const render = (lang, el) => renderToStaticMarkup(<LangContext.Provider value={{ lang, t: STRINGS[lang], setLang: () => { } }}>{el}</LangContext.Provider>);
const watch = { has: () => false, add() { }, remove() { } };
const OPTS = { any: false, list: '', sort: 'newest' };

describe('рэндэр кампанентаў для трох спісаў (SSR, абедзве мовы)', () => {
  for (const lang of ['be', 'en']) {
    const t = STRINGS[lang];
    it(`${lang}: карткі матэрыялу, фарміравання і асобы — без «undefined» і з патрэбнымі плашкамі`, () => {
      const html = ITEMS.slice(0, 4).map((it) => render(lang, <ResultItem item={it} tokens={[['свабода']]} chunkSize={200} />)).join('\n');
      expect(html).not.toMatch(/undefined|\[object Object\]|NaN/);
      expect(html).toContain('class="item material"');
      expect(html).toContain('class="item person"');
      expect(html).toContain('class="item formation"');
      expect(html).toContain('class="type person"');
      expect(html).toContain(t.personLabel('speech'));
      expect(html).toContain('KAVALEUSKI MIKALAI');
      expect(html).toContain(`${t.born} 14.10.1983`);
      if (lang === 'be') {
        expect(t.born).toBe('д.н.');
        expect(html).toContain('д.н. 14.10.1983');
        expect(html).toContain('Матэрыял · 302 КГС');
      } else {
        expect(t.born).toBe('b.');
        expect(html).toContain('b. 14.10.1983');
        expect(html).toContain('Material · 302 CCP');
      }
      expect(html).toContain('Отбывает наказание');
      expect(html).toContain('<mark>Свабода</mark>'); // падсветка ў матэрыяле не зламалася
      // плашкі асоб паводле артыкулаў («экстрэміст», «выказванні», «гр.дз.») і пазнака ў тайтле
      expect(t.personLabel('ext')).toContain(lang === 'be' ? 'экстрэміст' : 'extremist');
      expect(t.personLabel('speech')).toContain(lang === 'be' ? 'выказванні' : 'speech');
      expect(t.personLabel('protest')).toContain(lang === 'be' ? 'гр.дз.' : 'group act.');
      expect(t.personTitle('protest')).toContain(lang === 'be' ? 'групавыя дзеянні' : 'group actions');
      // нумар у картцы не паказваецца (ён сярод палёў старонкі запісу): справа ва ўсіх — кнопка-значок, што капіюе
      // спасылку; дата — спасылка на старонку запісу (з тайтлам пра сэнс даты, дзе ён ёсць)
      const card2 = render(lang, <ResultItem item={ITEMS[3]} tokens={[]} chunkSize={200} />);
      expect(card2).toContain('<svg class="ico"');
      expect(card2).not.toContain('б/н');
      expect(card2).not.toContain('№2');
      expect(card2).toContain(`<button type="button" class="idx" title="${t.permalinkP}" aria-label="${t.permalinkP}">`);
      expect(card2).toContain(`<a class="num date" href="#/r/p2" title="${t.includedTitle}">04.09.2026</a>`);
      const card1 = render(lang, <ResultItem item={ITEMS[2]} tokens={[]} chunkSize={200} />);
      expect(card1).not.toContain('№1');
      expect(card1).toContain('href="#/r/p1"');
      expect(html).toContain(`<a class="num date" href="#/r/m1" title="${t.openRec}">20.08.2026</a>`);
      expect(html).toContain(`title="${t.permalink}"`);
      expect(html).toContain(`title="${t.permalinkF}"`);
      expect(html).not.toMatch(/>№\d+</); // «№ 1ЭК» у падставе фарміравання — тэкст крыніцы, не наш нумар
      expect(html).not.toContain('copy-tip'); // падказка «Скапіявана» — толькі пасля націску
      // без даты ў індэксе (адзінкавыя матэрыялы) — спасылка «Адкрыць запіс», каб старонка заставалася даступнай
      const undated = render(lang, <ResultItem item={{ ...ITEMS[0], date: '' }} tokens={[]} chunkSize={200} />);
      expect(undated).toContain(`<a class="date" href="#/r/m1">${t.openRec}</a>`);
      // фрагмент не супаў з індэксам — чужы запіс не паказваецца, толькі падказка перазагрузіць
      const stale = render(lang, <ResultItem item={ITEMS[4]} tokens={[]} chunkSize={200} />);
      expect(stale).toContain(t.recStale);
      expect(stale).not.toContain('Байбак');
    });
    it(`${lang}: старонка запісу асобы з нумарам і без нумара`, () => {
      const a = render(lang, <RecordPage id="p1" items={ITEMS} chunkSize={200} watch={watch} />);
      expect(a).not.toMatch(/undefined|\[object Object\]/);
      expect(a).toContain(t.recTitleP);
      expect(a).toContain(t.recNum);
      // «Да пошуку» — кнопка-чып; дзеянні — над карткай; падказкі з пазіцыяй больш няма (нумар — сярод палёў)
      expect(a).toContain(`<div class="rec-bar"><a class="chip back" href="#/">← ${t.back}</a><div class="rec-actions">`); // адзін радок: назад злева, дзеянні справа
      expect(a.indexOf('class="rec-actions"')).toBeLessThan(a.indexOf('class="page-title"'));
      expect(a).toContain(`title="${t.watchThisTitle}"`);
      expect(a).toContain(`☆ ${t.watchAdd}<`);
      expect(a).not.toContain('class="hint"');
      expect(a).toContain(`<dt>${t.recNum}</dt><dd>№1</dd>`);
      expect(a).not.toContain('class="num date"'); // на самой старонцы дата — не спасылка на сябе
      expect(a).toContain(`aria-label="${t.permalinkP}"`); // а значок капіявання застаецца
      expect(a).toContain('23.03.2022, 04.04.2025');
      expect(a).toContain('ст. 369 УК');
      expect(a).toContain('Республика Беларусь, г. Минск');
      expect(a).toContain(t.personNote.slice(0, 40));
      const b = render(lang, <RecordPage id="p2" items={ITEMS} chunkSize={200} watch={watch} />);
      expect(b).toContain(`<dt>${t.recNum}</dt><dd>${t.recNumPending}</dd>`); // без афіцыйнага нумара — пазнака замест нумара
      // фрагмент не супаў з індэксам: ні дэталяў, ні чужога імя
      const c = render(lang, <RecordPage id="p3" items={ITEMS} chunkSize={200} watch={watch} />);
      expect(c).toContain(t.recStale);
      expect(c).not.toContain(t.recBirth);
      // фарміраванне і матэрыял — нумар у спісе (пазіцыя ў публікацыі) сярод палёў
      const f = render(lang, <RecordPage id="f1" items={ITEMS} chunkSize={200} watch={watch} />);
      expect(f).toContain(t.recTitleF);
      expect(f).toContain(`<dt>${t.recNum}</dt><dd>№1</dd>`);
      const m = render(lang, <RecordPage id="m1" items={ITEMS} chunkSize={200} watch={watch} />);
      expect(m).toContain(`<dl class="rec-details"><div><dt>${t.recNumM}</dt><dd>№1</dd></div></dl>`);
      expect(m).not.toContain('class="hint"');
      expect(render(lang, <RecordPage id="zzz" items={ITEMS} chunkSize={200} watch={watch} />)).toContain(t.recNotFound);
    });
    it(`${lang}: радок чыпаў — без чыпаў спісаў, «Любое са слоў» толькі для некалькіх слоў, «Спасылка» з іконкай`, () => {
      const base = render(lang, <Options value={OPTS} onChange={() => { }} />);
      expect(base).not.toContain(t.facet.p);
      expect(base).not.toContain(t.any);
      expect(base).toContain(t.sortNewest);
      expect(base).toContain(`title="${t.sortTitle}"`);
      const multi = render(lang, <Options value={{ ...OPTS, any: true }} onChange={() => { }} multiWord share={{ copy() { }, copied: false }} watch={{ on: false, toggle() { } }} />);
      expect(multi).toContain(t.any);
      expect(multi).toContain(`aria-pressed="true" title="${t.anyTitle}"`);
      expect(multi).toContain('chip share');
      expect(multi).toContain(`aria-label="${t.shareQuery}"`);
      expect(multi).toContain(t.watchAdd);
      expect(render(lang, <Options value={OPTS} onChange={() => { }} share={{ copy() { }, copied: true }} />)).toContain(t.copied);
    });
    it(`${lang}: укладкі-спісы з лічбамі: актыўная — колерам спіса, нулявая — прыглушаная, без дадатковых спісаў — схаваная ў App`, () => {
      const counts = { all: 43, m: 3, f: 0, p: 40 };
      const html = render(lang, <Facets counts={counts} value="p" onChange={() => { }} lists={{ f: true, p: true }} />);
      for (const k of ['all', 'm', 'f', 'p']) expect(html).toContain(t.facet[k]);
      expect(html).toContain('facet p on');
      expect(html).toContain('facet f zero');
      expect(html).toContain('>43<');
      expect(html).toContain('>40<');
      expect(html).toContain(`aria-label="${t.facetsLabel}"`);
      expect(html.match(/<button/g)).toHaveLength(4);
      // толькі фарміраванні ў базе — тры ўкладкі; вялікія лічбы з прабелам тысяч
      const two = render(lang, <Facets counts={{ all: 6420, m: 6043, f: 377, p: 0 }} value="" onChange={() => { }} lists={{ f: true }} />);
      expect(two.match(/<button/g)).toHaveLength(3);
      expect(two).toContain('6 043');
      expect(two).not.toContain(t.facet.p);
    });
    it(`${lang}: шапка з трыма датамі і папярэджаннем, наступствы, статыстыка`, () => {
      const head = render(lang, <Header meta={META} online onHelp={() => { }} />);
      expect(head).toContain(t.personsDown('05.09.2026'));
      expect(head).not.toMatch(/undefined/);
      expect(head).toContain(t.updated);
      // у бачным тэксце толькі апошняе абнаўленне (асобы ад 05.09); падрабязнасці па кожным спісе — у папове
      // па націску (у SSR зачынены), без падвойнага title на абзацы і кнопцы
      expect(head).not.toContain('title="' + t.updatedTipHint.slice(0, 20));
      expect(head).toMatch(/<p class="sub">/);
      expect(head).toContain('class="updated-btn"');
      expect(head).toContain('aria-expanded="false"');
      expect(head).not.toContain('aria-describedby');
      expect(head).toContain('dateTime="2026-09-05T14:04:18.967Z"');
      expect(head).not.toContain(` · ${t.formationsChecked} <time`);
      const { lists, latest } = listStamps(META, t, lang);
      expect(lists.map((x) => x.key)).toEqual(['m', 'f', 'p']);
      expect(lists.map((x) => x.label)).toEqual([t.updatedMaterials, t.formationsChecked, t.personsChecked]);
      expect(latest.key).toBe('p');
      expect(latest.iso).toBe('2026-09-05T14:04:18.967Z');
      expect(lists.every((x) => x.value && !/undefined/.test(x.value))).toBe(true);
      // без пазнак — пусты спіс, latest null; толькі матэрыялы — адзін радок
      expect(listStamps({}, t, lang)).toEqual({ lists: [], latest: null });
      expect(listStamps({ updated: '2026-09-01' }, t, lang).latest).toMatchObject({ key: 'm', iso: '2026-09-01' });
      const cons = render(lang, <Consequences open formations persons />);
      expect(cons).toContain('crime person');
      expect(cons).toContain(t.crimeNote.slice(0, 30));
      for (const list of ['m', 'f', 'p']) {
        const stats = render(lang, <StatsPage items={ITEMS} initialList={list} />);
        expect(stats).not.toMatch(/undefined|NaN/);
        expect(stats).toContain(t.statsPersons);
        if (list === 'p') { expect(stats).toContain(t.statsIntroP); expect(stats).toContain('key s-ext'); }
      }
      // старонка «Новае» з фільтрамі па спісах і выдаленых
      const newItems = [
        { i: 0, id: 'm1', list: 'm', n: 1, date: '2026-09-04', added: '2026-09-04', removed: '', editOf: '', replacedBy: '', art: 'kgs', h: 'матэрыял 1' },
        { i: 1, id: 'f1', list: 'f', n: 1, date: '2026-09-04', added: '2026-09-04', removed: '', editOf: '', replacedBy: '', art: 'mvd', h: 'фарміраванне 1' },
        { i: 2, id: 'p1', list: 'p', n: 1, date: '2026-09-03', added: '2026-09-03', removed: '', editOf: '', replacedBy: '', art: 'speech', h: 'асоба 1' },
        { i: 3, id: 'p2', list: 'p', n: 2, date: '2026-08-25', added: '', removed: '2026-08-25', editOf: '', replacedBy: '', art: 'speech', h: 'асоба выдаленая' },
      ];
      const wn = render(lang, <WhatsNew items={newItems} chunkSize={200} lists={{ f: true, p: true }} />);
      expect(wn).toContain(t.newTitle.replace("'", '&#x27;'));
      expect(wn).toContain('class="new-toolbar"');
      expect(wn).toContain(t.facet.all);
      expect(wn).toContain(t.facet.m);
      expect(wn).toContain(t.facet.f);
      expect(wn).toContain(t.facet.p);
      expect(wn).toContain(t.showRemoved);
      expect(wn).toContain('removed-facet');
      expect(wn).toContain(t.newUpdate('04.09.2026', 2));
      expect(wn).toContain(t.newUpdate('03.09.2026', 1));
      expect(wn).not.toContain(t.newRemovedGroup(1));

      // даведка / дапамога
      const help = render(lang, <HelpDialog open onClose={() => { }} />);
      expect(help).toContain('href="https://itbeard.com"');
      expect(help).toContain(t.helpAboutAuthor);
      expect(help).not.toContain('валанцёр');
      expect(help).not.toContain('volunteer');
    });
  }
});
