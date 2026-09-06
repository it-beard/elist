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
};
vi.mock('../src/hooks/useRecord.js', () => ({ useRecord: (i) => RECORDS[i] ?? null }));

const ITEMS = [
  { i: 0, id: 'm1', list: 'm', n: 1, date: '2026-08-20', added: '', removed: '', editOf: '', replacedBy: '', art: 'kgs', h: 'telegram-канал "свабода"' },
  { i: 1, id: 'f1', list: 'f', n: 1, date: '2021-10-18', added: '', removed: '', editOf: '', replacedBy: '', art: 'mvd', h: 'экстремистское формирование «dze.chat»' },
  { i: 2, id: 'p1', list: 'p', n: 1, date: '2022-03-23', added: '', removed: '', editOf: '', replacedBy: '', art: 'speech', h: 'ковалевский николай николаевич kavaleuski mikalai 14.10.1983' },
  { i: 3, id: 'p2', list: 'p', n: 2, date: '2026-09-04', added: '', removed: '', editOf: '', replacedBy: '', art: 'other', h: 'байбак юрий юрьевич baibak yury 05.08.1969' },
];
const META = {
  updated: '2026-09-03', checked: '2026-09-03', checkedAt: '2026-09-03T08:54:44.489Z', sourceError: null, fallback: false, total: 6031,
  formations: { updated: '2026-09-03', checked: '2026-09-03', checkedAt: '2026-09-03T10:14:53.330Z', sourceError: null, total: 377 },
  persons: { updated: '2026-09-05', checked: '2026-09-05', checkedAt: '2026-09-05T14:04:18.967Z', sourceError: 'HTTP 503', total: 6874 },
};

let ResultItem, RecordPage, Options, Header, Consequences, StatsPage;
beforeAll(async () => {
  // SSR-рэндэр без браўзера: кампанентам патрэбныя location/history толькі для спасылак
  globalThis.location = { href: 'https://elist.test/#/r/p1', hash: '#/r/p1', origin: 'https://elist.test', pathname: '/' };
  globalThis.history = { state: null, replaceState() {} };
  ({ default: ResultItem } = await import('../src/components/ResultItem.jsx'));
  ({ default: RecordPage } = await import('../src/components/RecordPage.jsx'));
  ({ default: Options } = await import('../src/components/Options.jsx'));
  ({ default: Header } = await import('../src/components/Header.jsx'));
  ({ default: Consequences } = await import('../src/components/Consequences.jsx'));
  ({ default: StatsPage } = await import('../src/components/StatsPage.jsx'));
});

const render = (lang, el) => renderToStaticMarkup(<LangContext.Provider value={{ lang, t: STRINGS[lang], setLang: () => {} }}>{el}</LangContext.Provider>);
const watch = { has: () => false, add() {}, remove() {} };

describe('рэндэр кампанентаў для трох спісаў (SSR, абедзве мовы)', () => {
  for (const lang of ['be', 'en']) {
    it(`${lang}: карткі матэрыялу, фарміравання і асобы — без «undefined» і з патрэбнымі плашкамі`, () => {
      const html = ITEMS.map((it) => render(lang, <ResultItem item={it} tokens={[['свабода']]} chunkSize={200} />)).join('\n');
      expect(html).not.toMatch(/undefined|\[object Object\]|NaN/);
      expect(html).toContain('class="item person"');
      expect(html).toContain('class="item formation"');
      expect(html).toContain('class="type person"');
      expect(html).toContain(STRINGS[lang].personLabel);
      expect(html).toContain('KAVALEUSKI MIKALAI');
      expect(html).toContain(`${STRINGS[lang].born} 14.10.1983`);
      expect(html).toContain('Отбывает наказание');
      expect(html).toContain('<mark>Свабода</mark>'); // падсветка ў матэрыяле не зламалася
    });
    it(`${lang}: старонка запісу асобы з нумарам і без нумара`, () => {
      const a = render(lang, <RecordPage id="p1" items={ITEMS} chunkSize={200} watch={watch} />);
      expect(a).not.toMatch(/undefined|\[object Object\]/);
      expect(a).toContain(STRINGS[lang].recTitleP);
      expect(a).toContain(STRINGS[lang].positionP(1));
      expect(a).toContain('23.03.2022, 04.04.2025');
      expect(a).toContain('ст. 369 УК');
      expect(a).toContain('Республика Беларусь, г. Минск');
      expect(a).toContain(STRINGS[lang].personNote.slice(0, 40));
      const b = render(lang, <RecordPage id="p2" items={ITEMS} chunkSize={200} watch={watch} />);
      expect(b).toContain(STRINGS[lang].positionPNew);
      expect(b).not.toContain(STRINGS[lang].recNum); // без афіцыйнага нумара радок не паказваем
      // фарміраванне і матэрыял — як раней
      expect(render(lang, <RecordPage id="f1" items={ITEMS} chunkSize={200} watch={watch} />)).toContain(STRINGS[lang].recTitleF);
      expect(render(lang, <RecordPage id="m1" items={ITEMS} chunkSize={200} watch={watch} />)).toContain(STRINGS[lang].position(1));
      expect(render(lang, <RecordPage id="zzz" items={ITEMS} chunkSize={200} watch={watch} />)).toContain(STRINGS[lang].recNotFound);
    });
    it(`${lang}: чыпы спісаў, шапка з трыма датамі і папярэджаннем, наступствы, статыстыка`, () => {
      const opts = render(lang, <Options value={{ any: false, onlyNew: false, list: 'p', sort: 'newest' }} onChange={() => {}} lists={{ f: true, p: true }} />);
      expect(opts).toContain(STRINGS[lang].listPersons);
      expect(opts).toContain('chip on person');
      expect(render(lang, <Options value={{ any: false, onlyNew: false, list: '', sort: 'newest' }} onChange={() => {}} lists={{ f: true }} />)).not.toContain(STRINGS[lang].listPersons);
      expect(render(lang, <Options value={{ any: false, onlyNew: false, list: '', sort: 'newest' }} onChange={() => {}} />)).not.toContain(STRINGS[lang].listMaterials);
      const head = render(lang, <Header meta={META} online onHelp={() => {}} />);
      expect(head).toContain(STRINGS[lang].personsChecked);
      expect(head).toContain(STRINGS[lang].personsDown('05.09.2026'));
      expect(head).not.toMatch(/undefined/);
      const cons = render(lang, <Consequences open formations persons />);
      expect(cons).toContain('crime person');
      expect(cons).toContain(STRINGS[lang].crimeNote.slice(0, 30));
      for (const list of ['m', 'f', 'p']) {
        const stats = render(lang, <StatsPage items={ITEMS} initialList={list} />);
        expect(stats).not.toMatch(/undefined|NaN/);
        expect(stats).toContain(STRINGS[lang].statsPersons);
        if (list === 'p') { expect(stats).toContain(STRINGS[lang].statsIntroP); expect(stats).toContain('key s-ext'); }
      }
    });
  }
});
