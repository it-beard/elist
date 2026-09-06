import { describe, it, expect } from 'vitest';
import { parsePersons, personId, oneLine, isPersonEdit, pairPersonEdits } from '../scripts/parse-persons.mjs';
import { findPersonDocs } from '../scripts/update-persons.mjs';
import { personCourt, extractArticles, personSeries, articlesLabel, firstDateIso, allDates, PERSON_SERIES } from '../src/lib/person.js';
import { search } from '../src/lib/search.js';
import { dailyCounts } from '../src/lib/stats.js';

// Фрагмент цела .doc як яго аддае word-extractor: ячэйкі праз «\t», межы радкоў — «\t\n» ці «\t\t».
const HEADER = 'ПЕРЕЧЕНЬ\nграждан Республики Беларусь, иностранных граждан или лиц без гражданства,\nпричастных к экстремистской деятельности\n\n№\nп/п\tФамилия, собственное имя, отчество\n(если таковое имеется) гражданина\tГражданство\tДата\nрождения\tОснование\nдля\nвключения\nв перечень\tДата\nвключения\nв перечень\tМестонахождение\tСправочная\nинформация\t\n\tрусскоязычное\nнаписание\tлатинская либо\nнациональная\nтранслитерация\t\t\t\t\t\t\t\n';
const BASIS_369 = 'Вступивший в законную силу приговор суда Быховского района Могилевской области в связи с совершением преступления, предусмотренного статьей 369 Уголовного кодекса Республики Беларусь';
const BASIS_342 = 'Вступивший в законную силу приговор суда \nЦентрального района \nг. Минска в связи с совершением преступлений, предусмотренных частью 1 статьи 342, статьей 364 и частью 1 статьи 368 \nУголовного кодекса \nРеспублики Беларусь';
const BASIS_361 = 'Вступивший в законную силу приговор Гомельского областного суда в связи\nс совершением преступлений, предусмотренных частями 1, 2 статьи 361-4 Уголовного кодекса Республики Беларусь';
const ROW1 = `1\tКовалевский\nНиколай \nНиколаевич\tKAVALEUSKI\nMIKALAI\tРеспублика Беларусь\t14.10.1983\t${BASIS_369}\t23.03.2022\tРеспублика Беларусь,\nМогилевская область, Быховский район, д. Лудчицы\tОтбывает\nнаказание\t\n`;
// радок выключанай асобы (нумар з прочыркамі) і радок з пустымі ячэйкамі на разрыве старонкі
const EXCLUDED = '2\t-\t-\t-\t-\t-\t-\t-\t-\t\t';
const PAGE_BREAK = '\t\t\t\t\t\t\t';
const ROW3 = `3\tМихальцов\nКонстантин \nЮрьевич\tMIKHALTSOU\nKANSTANTSIN\tРеспублика Беларусь\t24.02.1998\t${BASIS_342}\t23.03.2022\n\n04.04.2025\tРеспублика Беларусь,\nг. Речица\tСудимость\nне погашена\t\t`;
// пустое грамадзянства
const ROW4 = `4\tЧулицкая\nТатьяна Владимировна\tCHULITSKAYA TATSIANA\t\t18.01.1980\t${BASIS_361}\t25.10.2024\tРеспублика Беларусь,\nг. Минск\tОтбывает наказание\t\t`;
// лішняя пустая ячэйка пасля імя (свежая частка) і сапсаваная падстава без «Вступивший»
const ROW5 = `5\tТетерев Андрей Дмитриевич\t\tTSETSERAU ANDREI\tРеспублика Беларусь\t12.09.1969\tсилу приговор суда Заводского района\nг. Минска в связи с совершением преступления, предусмотренного частью 1 статьи 342 Уголовного кодекса\t21.11.2025\tРеспублика Беларусь,\nг. Брест\tСудимость не погашена\t\t`;
// новы запіс без нумара і лацінская транслітарацыя малымі літарамі
const ROW6 = `\tМихайлов Дмитрий\tMihailovs\nDmitrijs\tЛатвийская Республика\t02.02.1990\t${BASIS_369}\t04.09.2026\tРеспублика Беларусь, г. Гомель\tОтбывает наказание\t\t`;
const BODY = HEADER + ROW1 + EXCLUDED + PAGE_BREAK + ROW3 + ROW4 + ROW5 + ROW6 + '\n\n';

describe('parsePersons', () => {
  const stats = {};
  const items = parsePersons(BODY, stats);
  it('бярэ ўсе радкі з падставай, прапускае загаловак і выключаных', () => {
    expect(items.map((x) => x.num)).toEqual([1, 3, 4, 5, null]);
    expect(stats.excluded).toBe(1);
    expect(stats.skipped).toBe(0);
  });
  it('раскладвае палі ў адзін радок, даты і артыкулы', () => {
    const [a, c, d, e, f] = items;
    expect(a).toMatchObject({
      name: 'Ковалевский Николай Николаевич', translit: 'KAVALEUSKI MIKALAI', citizenship: 'Республика Беларусь', birth: '14.10.1983',
      court: 'суда Быховского района Могилевской области', articles: ['369'], included: '23.03.2022', date: '2022-03-23',
      address: 'Республика Беларусь, Могилевская область, Быховский район, д. Лудчицы', info: 'Отбывает наказание',
    });
    expect(a.basis).toBe(BASIS_369);
    // дзве даты ўключэння (паўторнае рашэнне): захоўваюцца абедзве, date — першая
    expect(c).toMatchObject({ name: 'Михальцов Константин Юрьевич', articles: ['342', '364', '368'], included: '23.03.2022, 04.04.2025', date: '2022-03-23', court: 'суда Центрального района г. Минска' });
    expect(c.basis).not.toMatch(/\n/);
    expect(d).toMatchObject({ name: 'Чулицкая Татьяна Владимировна', citizenship: '', birth: '18.01.1980', articles: ['361-4'] });
    expect(e).toMatchObject({ num: 5, name: 'Тетерев Андрей Дмитриевич', translit: 'TSETSERAU ANDREI', citizenship: 'Республика Беларусь', birth: '12.09.1969', court: 'суда Заводского района г. Минска' });
    expect(f).toMatchObject({ num: null, name: 'Михайлов Дмитрий', translit: 'Mihailovs Dmitrijs', citizenship: 'Латвийская Республика', date: '2026-09-04' });
  });
  it('id стабільны: імя + дата нараджэння + першая дата ўключэння; прабелы, рэгістр і дапісаная дата не мяняюць', () => {
    expect(items[0].id).toMatch(/^[0-9a-f]{12}$/);
    expect(new Set(items.map((x) => x.id)).size).toBe(items.length);
    expect(personId('Ковалевский\nНиколай  Николаевич', '14.10.1983', '23.03.2022')).toBe(personId('ковалевский николай николаевич', '14.10.1983 ', '23.03.2022\n\n04.04.2025'));
    expect(personId('Ковалевский Николай Николаевич', '14.10.1983', '23.03.2022')).not.toBe(personId('Ковалевский Николай Николаевич', '14.10.1984', '23.03.2022'));
    expect(personId('Ковалевский Николай Николаевич', '14.10.1983', '23.03.2022')).not.toBe(personId('Ковалевский Николай Николаевич', '14.10.1983', '30.03.2022'));
  });
  it('oneLine', () => {
    expect(oneLine('Республика Беларусь,\nг. Минск ')).toBe('Республика Беларусь, г. Минск');
    expect(oneLine('Отбывает \nнаказание')).toBe('Отбывает наказание');
  });
  it('запіс з імем без падставы побач не «з’ядае» суседа: падстава без даты ўключэння лічыцца unanchored', () => {
    const s = {};
    const broken = `${HEADER}7\tИванов Иван Иванович\tIVANOU IVAN\tРеспублика Беларусь\t01.01.1990\t${BASIS_369}\t\tг. Минск\tОтбывает наказание\t\t${ROW1}`;
    const out = parsePersons(broken, s);
    expect(out.map((x) => x.num)).toEqual([1]);
    expect(out[0].name).toBe('Ковалевский Николай Николаевич');
    expect(s.unanchored).toBe(1);
  });
});

describe('person.js', () => {
  it('суд з падставы, у тым ліку зліплыя словы і прапушчаны «в»', () => {
    expect(personCourt(BASIS_369)).toBe('суда Быховского района Могилевской области');
    expect(personCourt('Вступивший в законную силу приговор судебной коллегии по уголовным делам Брестского областного суда в связи с совершением')).toBe('судебной коллегии по уголовным делам Брестского областного суда');
    expect(personCourt('Вступивший в законную силу приговор суда Ленинского района г. Могилевав связи с совершением')).toBe('суда Ленинского района г. Могилева');
    expect(personCourt('Вступивший в законную силу приговор Минского городского суда   связи с совершением')).toBe('Минского городского суда');
    expect(personCourt('')).toBe('');
  });
  it('артыкулы КК: пералікі, часткі, «и», без паўтораў', () => {
    expect(extractArticles(BASIS_342)).toEqual(['342', '364', '368']);
    expect(extractArticles('статьями 368, 369 Уголовного кодекса')).toEqual(['368', '369']);
    expect(extractArticles('частями 1, 2 статьи 361-4 и частью 3 статьи 361-1, частью 1 статьи 361-4')).toEqual(['361-4', '361-1']);
    expect(extractArticles('предусмотренного статей 369 Уголовного кодекса')).toEqual(['369']); // памылка друку «статей»
    expect(extractArticles('без артыкула')).toEqual([]);
  });
  it('серыі статыстыкі і подпіс', () => {
    expect(personSeries(['361-4'])).toBe('ext');
    expect(personSeries(['130', '342'])).toBe('protest');
    expect(personSeries(['368', '369'])).toBe('speech');
    expect(personSeries(['328'])).toBe('other');
    expect(personSeries([])).toBe('other');
    expect(PERSON_SERIES).toEqual(['protest', 'speech', 'ext', 'other']);
    expect(articlesLabel(['342', '368'])).toBe('ст. 342, 368 УК');
    expect(articlesLabel([])).toBe('');
  });
  it('даты', () => {
    expect(firstDateIso('23.03.2022, 04.04.2025')).toBe('2022-03-23');
    expect(firstDateIso('07.04.198')).toBe(null);
    expect(allDates('23.03.2022\n\n04.04.2025')).toEqual(['23.03.2022', '04.04.2025']);
  });
});

describe('findPersonDocs', () => {
  const page = 'https://www.mvd.gov.by/ru/news/8642';
  it('бярэ .doc з подпісам пра грамадзян у парадку частак, xlsx і іншыя .doc не чапае', () => {
    const html = `<a href="/uploads/news/8642/bbb.xlsx">Перечень организаций, формирований, индивидуальных предпринимателей_03.09.2026</a>
      <a href="/uploads/news/8642/p2.doc"><span>Перечень граждан Республики Беларусь, иностранных граждан или лиц без гражданства, причастных к экстремистской деятельности. Часть 2</span></a>
      <a href="/uploads/news/8642/p4.doc">Перечень граждан … причастных к экстремистской деятельности_ 04.09.2026. Часть 4</a>
      <a href="/uploads/news/8642/p1.doc">Перечень граждан Республики Беларусь, иностранных граждан или лиц без гражданства, причастных к экстремистской деятельности. Часть 1</a>
      <a href="/uploads/news/8642/other.doc">Нешта іншае</a>`;
    expect(findPersonDocs(html, page).map((d) => d.url)).toEqual([
      'https://www.mvd.gov.by/uploads/news/8642/p1.doc',
      'https://www.mvd.gov.by/uploads/news/8642/p2.doc',
      'https://www.mvd.gov.by/uploads/news/8642/p4.doc',
    ]);
  });
  it('без нумара часткі — як на старонцы; без падыходных .doc — памылка', () => {
    expect(findPersonDocs('<a href="https://x.by/a.doc">Перечень граждан</a><a href="https://x.by/b.doc">Перечень физических лиц</a>', page).map((d) => d.url)).toEqual(['https://x.by/a.doc', 'https://x.by/b.doc']);
    expect(() => findPersonDocs('<a href="/f.xlsx">Перечень граждан</a>', page)).toThrow(/doc/);
  });
});

describe('праўкі ў крыніцы (pairPersonEdits)', () => {
  const old = { id: 'a', name: 'Ковалевский Николай Николаевич', birth: '14.10.1983', date: '2022-03-23' };
  it('выпраўленае імя пры той жа даце нараджэння ці выпраўленая дата пры тым жа імені — праўка', () => {
    expect(isPersonEdit(old, { id: 'b', name: 'Ковалевский Николай Никалаевич', birth: '14.10.1983', date: '2022-03-23' })).toBe(true);
    expect(isPersonEdit(old, { id: 'c', name: 'Ковалевский Николай Николаевич', birth: '14.10.1984', date: '2022-03-23' })).toBe(true);
  });
  it('іншы чалавек — не праўка', () => {
    expect(isPersonEdit(old, { id: 'd', name: 'Ковалевская Анна Николаевна', birth: '14.10.1983', date: '2022-03-23' })).toBe(false);
    expect(isPersonEdit(old, { id: 'e', name: 'Ковалевский Николай Николаевич', birth: '14.10.1983', date: '2025-03-23' })).toBe(false);
    expect(isPersonEdit(old, { id: 'f', name: 'Ковалевский Николай Никалаевич', birth: '14.10.1984', date: '2022-03-23' })).toBe(false);
  });
  it('пары аднназначныя, масавае знікненне — не праўкі', () => {
    const fixed = { id: 'b', name: 'Ковалевский Николай Никалаевич', birth: '14.10.1983', date: '2022-03-23' };
    expect(pairPersonEdits([old], [fixed, { id: 'z', name: 'Іншы Чалавек', birth: '01.01.2000', date: '2022-03-23' }])).toEqual([[old, fixed]]);
    expect(pairPersonEdits([old], [fixed, { ...fixed, id: 'b2' }])).toEqual([]);
    expect(pairPersonEdits(Array.from({ length: 70 }, (_, i) => ({ ...old, id: `o${i}` })), [fixed])).toEqual([]);
  });
});

describe('пошук і статыстыка па трох спісах', () => {
  const items = [
    { i: 0, id: 'm1', list: 'm', date: '2026-01-01', h: 'канал "свабода"' },
    { i: 1, id: 'f1', list: 'f', date: '2026-02-01', h: 'экстремистское формирование «свабода»' },
    { i: 2, id: 'p1', list: 'p', date: '2026-03-01', art: 'protest', h: 'свабода іван іванавіч\nsvaboda ivan\n01.01.1990\nст. 342 ук' },
    { i: 3, id: 'p2', list: 'p', date: '2026-03-01', art: 'zzz', h: 'іншы чалавек' },
  ];
  it('без фільтра выдача змяшаная, «толькі асобы» — трэці спіс', () => {
    expect(search(items, ['свабода']).map((x) => x.id)).toEqual(['p1', 'f1', 'm1']);
    expect(search(items, ['свабода'], { list: 'p' }).map((x) => x.id)).toEqual(['p1']);
    expect(search(items, ['342'], { list: 'p' }).map((x) => x.id)).toEqual(['p1']);
    expect(search(items, [], { list: 'p' }).map((x) => x.id)).toEqual(['p2', 'p1']);
  });
  it('серыі трэцяга спісу: невядомая — у апошнюю («іншыя»)', () => {
    const d = dailyCounts(items.filter((x) => x.list === 'p'), PERSON_SERIES);
    expect(d).toEqual([[Date.parse('2026-03-01'), [1, 0, 0, 1]]]);
  });
});
