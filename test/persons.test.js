import { describe, it, expect } from 'vitest';
import { parsePersons, personId, oneLine, isPersonEdit, pairPersonEdits, mergePersons } from '../scripts/parse-persons.mjs';
import { findPersonDocs, partsProblem } from '../scripts/update-persons.mjs';
import { personCourt, extractArticles, personSeries, articlesLabel, firstDateIso, allDates, PERSON_SERIES } from '../src/lib/person.js';
import { search } from '../src/lib/search.js';
import { dailyCounts } from '../src/lib/stats.js';

// Фрагмент цела .doc як яго аддае word-extractor: ячэйкі праз «\t», межы радкоў — «\t\n» ці «\t\t».
const HEADER = 'ПЕРЕЧЕНЬ\nграждан Республики Беларусь, иностранных граждан или лиц без гражданства,\nпричастных к экстремистской деятельности\n\n№\nп/п\tФамилия, собственное имя, отчество\n(если таковое имеется) гражданина\tГражданство\tДата\nрождения\tОснование\nдля\nвключения\nв перечень\tДата\nвключения\nв перечень\tМестонахождение\tСправочная\nинформация\t\n\tрусскоязычное\nнаписание\tлатинская либо\nнациональная\nтранслитерация\t\t\t\t\t\t\t\n';
const BASIS_369 = 'Вступивший в законную силу приговор суда Быховского района Могилевской области в связи с совершением преступления, предусмотренного статьей 369 Уголовного кодекса Республики Беларусь';
const BASIS_342 = 'Вступивший в законную силу приговор суда \nЦентрального района \nг. Минска в связи с совершением преступлений, предусмотренных частью 1 статьи 342, статьей 364 и частью 1 статьи 368 \nУголовного кодекса \nРеспублики Беларусь';
const BASIS_361 = 'Вступивший в законную силу приговор Гомельского областного суда в связи\nс совершением преступлений, предусмотренных частями 1, 2 статьи 361-4 Уголовного кодекса Республики Беларусь';
const BASIS_PL = 'Вступившие в законную силу приговора суда \nПружанского района Брестской области в связи с совершением преступлений, предусмотренных частью 2 статьи 367, статьей 369-1 Уголовного кодекса Республики Беларусь';
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
  const stats = { dropped: [] };
  const items = parsePersons(BODY, stats);
  it('бярэ ўсе радкі з падставай, прапускае загаловак і выключаных; нічога не адкідае', () => {
    expect(items.map((x) => x.num)).toEqual([1, 3, 4, 5, null]);
    expect(stats).toMatchObject({ excluded: 1, skipped: 0, unanchored: 0, leftover: 0, noIncluded: 0, dropped: [] });
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
  it('oneLine — лінейна, без квадратычных рэгулярных выразаў', () => {
    expect(oneLine('Республика Беларусь,\nг. Минск ')).toBe('Республика Беларусь, г. Минск');
    expect(oneLine('Отбывает \nнаказание')).toBe('Отбывает наказание');
    const t = Date.now();
    oneLine(`a${' '.repeat(300_000)}b`);
    parsePersons(`1\tИванов Иван Иванович\tIVANOU\tРеспублика Беларусь\t01.01.1990\tВступивший в законную силу приговор суда ${' '.repeat(300_000)}статьи 342\t01.01.2022\tг. Минск\tОтбывает наказание\t\t`);
    expect(Date.now() - t).toBeLessThan(1000);
  });
  it('падстава ў родным склоне («приговора») і пастанова суда — таксама якар; «определенного места жительства» — не', () => {
    const body = `${HEADER}500\tГнаук Елена Петровна\tHNAUK ALENA\tРеспублика Беларусь\t16.03.1957\t${BASIS_PL}\t23.09.2022\tРеспублика Беларусь, д. Ткачи\tОтбывает наказание\t\t`
      + `310\tГубчик Иван Александрович\tHUBCHYK IVAN\tРеспублика Беларусь\t01.01.1970\t${BASIS_369}\t03.06.2022\tБез определенного места жительства\tОсвобожден от уголовной ответственности в соответствии со статьями 1,2 Закона Республики Беларусь от 19.07.2019 «Об амнистии»\t\t`
      + `311\tЛюдских Евгений Леонидович\tLIUDSKIKH YAUHEN\tРеспублика Беларусь\t02.02.1980\tВступившее в законную силу постановление суда Оршанского района о прекращении производства по уголовному делу по части 1 статьи 368 Уголовного кодекса\t03.06.2022\tг. Орша\tОсвобожден от уголовной ответственности\t\t`;
    const s = { dropped: [] };
    const out = parsePersons(body, s);
    expect(out.map((x) => [x.num, x.name])).toEqual([[500, 'Гнаук Елена Петровна'], [310, 'Губчик Иван Александрович'], [311, 'Людских Евгений Леонидович']]);
    expect(out[1].address).toBe('Без определенного места жительства');
    expect(out[2].court).toBe('суда Оршанского района');
    expect(s).toMatchObject({ unanchored: 0, leftover: 0, skipped: 0, dropped: [] });
  });
  it('радок без даты ўключэння не «з’ядае» суседа і сам не губляецца (нават сярод ненумараваных)', () => {
    const lost = `\tДенисов Дмитрий Васильевич\tDZIANISAU DZMITRY\tРеспублика Беларусь\t06.01.1985\t${BASIS_361}\t\tРеспублика Беларусь, г. Минск\tОтбывает наказание\t\t`;
    const next = `\tОсипов Иван Дмитриевич\tOSIPAU IVAN\tРеспублика Беларусь\t07.07.1990\t${BASIS_369}\t17.04.2026\tРеспублика Беларусь, г. Гомель\tСудимость не погашена\t\t`;
    const s = {};
    const out = parsePersons(`${HEADER}${ROW1}${lost}${next}`, s);
    expect(out.map((x) => x.name)).toEqual(['Ковалевский Николай Николаевич', 'Денисов Дмитрий Васильевич', 'Осипов Иван Дмитриевич']);
    expect(out[1]).toMatchObject({ num: null, included: '', date: null, birth: '06.01.1985', address: 'Республика Беларусь, г. Минск', info: 'Отбывает наказание' });
    expect(out[2]).toMatchObject({ num: null, birth: '07.07.1990', included: '17.04.2026', translit: 'OSIPAU IVAN', citizenship: 'Республика Беларусь' });
    expect(s.noIncluded).toBe(1);
  });
  it('радок, які зусім не распазнаўся, не аддае сваё імя суседу — ні нумараванаму, ні ненумараванаму', () => {
    // «решение» замест «приговор» — не якар: ячэйкі радка адкідаюцца як рэшткі, сусед застаецца сабой
    const broken = (num) => `${num}\tЛишний Человек Тестович\tLISHNI CHALAVEK\tРеспублика Беларусь\t01.01.1990\tВступившее в законную силу решение суда Минского района по статье 130 Уголовного кодекса Республики Беларусь\t05.05.2025\tРеспублика Беларусь, г. Минск\tОтбывает наказание\t\t`;
    const numbered = `${HEADER}${ROW1}${broken(2)}3\tПравильный Иван Иванович\tPRAVILNY IVAN\tРеспублика Беларусь\t03.03.1993\t${BASIS_369}\t06.06.2025\tг. Гродно\tСудимость не погашена\t\t`;
    const s1 = { dropped: [] };
    const o1 = parsePersons(numbered, s1);
    expect(o1.map((x) => [x.num, x.name, x.birth])).toEqual([[1, 'Ковалевский Николай Николаевич', '14.10.1983'], [3, 'Правильный Иван Иванович', '03.03.1993']]);
    expect(s1.leftover).toBeGreaterThan(0);
    expect(s1.dropped.some((c) => /Лишний/.test(c))).toBe(true);
    // тое ж без нумароў і з пустым грамадзянствам у суседа
    const unnumbered = `${HEADER}${ROW1}${broken('')}\tПравильный Иван Иванович\tPRAVILNY IVAN\t\t03.03.1993\t${BASIS_369}\t06.06.2025\tг. Гродно\tСудимость не погашена\t\t`;
    const o2 = parsePersons(unnumbered, {});
    expect(o2.map((x) => [x.num, x.name, x.citizenship, x.translit])).toEqual([[1, 'Ковалевский Николай Николаевич', 'Республика Беларусь', 'KAVALEUSKI MIKALAI'], [null, 'Правильный Иван Иванович', '', 'PRAVILNY IVAN']]);
  });
  it('выключаны радок перад ненумараваным не аддае яму свой нумар; прочырк замест транслітарацыі; пустая дата нараджэння', () => {
    const body = `${HEADER}${ROW1}6480\t-\t-\t-\t-\t-\t-\t-\t-\t\t\tМарецкий Виталий Витальевич\tMARETSKI VITALI\tРеспублика Беларусь\t10.10.1980\t${BASIS_342}\t10.04.2026\tг. Минск\tОтбывает наказание\t\t`
      + `7\tЧерницкий Павел Павлович\t-\tРеспублика Беларусь\t\t${BASIS_369}\t01.01.2023\tг. Брест\tСудимость не погашена\t\t`;
    const s = {};
    const out = parsePersons(body, s);
    expect(out.map((x) => [x.num, x.name])).toEqual([[1, 'Ковалевский Николай Николаевич'], [null, 'Марецкий Виталий Витальевич'], [7, 'Черницкий Павел Павлович']]);
    expect(out[2]).toMatchObject({ translit: '', birth: '', citizenship: 'Республика Беларусь', included: '01.01.2023' });
    expect(s.excluded).toBe(1);
  });
});

describe('person.js', () => {
  it('суд з падставы, у тым ліку зліплыя словы і прапушчаны «в»', () => {
    expect(personCourt(BASIS_369)).toBe('суда Быховского района Могилевской области');
    expect(personCourt('Вступивший в законную силу приговор судебной коллегии по уголовным делам Брестского областного суда в связи с совершением')).toBe('судебной коллегии по уголовным делам Брестского областного суда');
    expect(personCourt('Вступивший в законную силу приговор суда Ленинского района г. Могилевав связи с совершением')).toBe('суда Ленинского района г. Могилева');
    expect(personCourt('Вступивший в законную силу приговор Минского городского суда   связи с совершением')).toBe('Минского городского суда');
    expect(personCourt('')).toBe('');
    const t = Date.now();
    personCourt('приговор x '.repeat(20_000));
    expect(Date.now() - t).toBeLessThan(500);
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

describe('partsProblem — засцярогі па частках', () => {
  it('звычайны набор частак праходзіць; новая маленькая апошняя частка — таксама', () => {
    expect(partsProblem([1466, 1415, 1583, 2410], [])).toBe(null);
    expect(partsProblem([1466, 1415, 1583, 2410, 13], [1466, 1415, 1583, 2410])).toBe(null);
  });
  it('маленькая не апошняя частка, малы агульны лік, паменшаная частка — памылка (акрамя force)', () => {
    expect(partsProblem([30, 1466], [])).toMatch(/частцы 1/);
    expect(partsProblem([600, 300], [])).toMatch(/Занадта мала запісаў \(900\)/);
    expect(partsProblem([1466, 1100], [1466, 1415])).toMatch(/частка 2 паменшылася з 1415 да 1100/);
    expect(partsProblem([1466, 1100], [1466, 1415], { force: true })).toBe(null);
    expect(partsProblem([1466, 1412], [1466, 1415])).toBe(null); // некалькі выключаных — не падазрона
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

describe('mergePersons — зліццё з базай і засцярогі', () => {
  const rec = (n, extra = {}) => ({ id: `id${n}`, num: n, name: `Чалавек ${n} Тэставіч`, translit: `CHALAVEK ${n}`, citizenship: 'Республика Беларусь', birth: '01.01.1990', basis: BASIS_369, court: 'суда', articles: ['369'], included: '01.01.2023', date: '2023-01-01', address: 'г. Минск', info: 'Отбывает наказание', ...extra });
  const parsed = (n, extra) => Array.from({ length: n }, (_, i) => rec(i + 1, extra));
  const clone = (x) => JSON.parse(JSON.stringify(x));
  it('першы імпарт: усё без пазнакі «новае»; паўтор — без змен', () => {
    const r1 = mergePersons([], parsed(5), { today: '2026-09-06' });
    expect(r1).toMatchObject({ added: 5, removed: 0, edited: 0, initial: true });
    expect(r1.out.every((x) => x.added === null)).toBe(true);
    expect(r1.out.map((x) => x.order)).toEqual([0, 1, 2, 3, 4]);
    const r2 = mergePersons(clone(r1.out), parsed(5), { today: '2026-09-07' });
    expect(r2).toMatchObject({ added: 0, removed: 0, edited: 0, initial: false });
    expect(r2.out.every((x) => x.added === null && !x.edited)).toBe(true);
  });
  it('новы запіс — added сёння; змена статусу ці нумара — праўка моўчкі; зніклы — removed, вярнуўся — зноў жывы', () => {
    const db = clone(mergePersons([], parsed(5), { today: '2026-09-06' }).out);
    const next = [...parsed(5), rec(6)];
    next[0] = { ...next[0], info: 'Судимость погашена' };
    const r = mergePersons(db, next, { today: '2026-09-07' });
    expect(r).toMatchObject({ added: 1, removed: 0, edited: 1 });
    expect(r.out.find((x) => x.id === 'id6')).toMatchObject({ added: '2026-09-07', order: 5 });
    expect(r.out.find((x) => x.id === 'id1')).toMatchObject({ info: 'Судимость погашена', edited: '2026-09-07', added: null });
    const gone = mergePersons(clone(r.out), next.slice(1), { today: '2026-09-08' });
    expect(gone).toMatchObject({ added: 0, removed: 1 });
    expect(gone.out.find((x) => x.id === 'id1').removed).toBe('2026-09-08');
    const back = mergePersons(clone(gone.out), next, { today: '2026-09-09' });
    expect(back).toMatchObject({ added: 0, removed: 0 });
    expect(back.out.find((x) => x.id === 'id1')).not.toHaveProperty('removed');
    expect(back.out.find((x) => x.id === 'id1').added).toBe(null); // вярнуўся — не «новы»
  });
  it('выпраўленая памылка друку ў імені — праўка, а не новы чалавек: наследуе added, стары вядзе на новы', () => {
    const db = clone(mergePersons([], parsed(3), { today: '2026-09-06' }).out);
    const fixed = { ...rec(2), id: 'id2fix', name: 'Чалавек 2 Тэстовіч' };
    const r = mergePersons(db, [rec(1), fixed, rec(3)], { today: '2026-09-07' });
    expect(r).toMatchObject({ added: 0, removed: 0 });
    expect(r.edits).toHaveLength(1);
    expect(r.out.find((x) => x.id === 'id2fix')).toMatchObject({ added: null, editOf: 'id2', edited: '2026-09-07' });
    expect(r.out.find((x) => x.id === 'id2')).toMatchObject({ removed: '2026-09-07', replacedBy: 'id2fix' });
  });
  it('засцярогі: масавае знікненне і зашмат новых — памылка, база не кранаецца; force прымае новых', () => {
    const db = clone(mergePersons([], parsed(100), { today: '2026-09-06' }).out);
    expect(() => mergePersons(clone(db), parsed(70), { today: '2026-09-07' })).toThrow(/30 запісаў знікла/);
    expect(() => mergePersons(clone(db), parsed(104), { today: '2026-09-07', maxAdded: 3 })).toThrow(/4 новых запісаў/);
    expect(mergePersons(clone(db), parsed(104), { today: '2026-09-07', maxAdded: 3, force: true })).toMatchObject({ added: 4 });
    expect(mergePersons(clone(db), parsed(103), { today: '2026-09-07', maxAdded: 3 })).toMatchObject({ added: 3 });
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

describe('partsProblem — зніклая частка', () => {
  it('менш частак, чым было, — памылка (акрамя force); больш — норма', () => {
    expect(partsProblem([1466, 1415, 1583], [1466, 1415, 1583, 2410])).toMatch(/на старонцы 3 частак замест 4/);
    expect(partsProblem([1466, 1415, 1583], [1466, 1415, 1583, 2410], { force: true })).toBe(null);
    expect(partsProblem([1466, 1415, 1583, 2410], [1466, 1415, 1583, 2410, 13])).toMatch(/4 частак замест 5.*UPDATE_FORCE=1/);
    expect(partsProblem([1466, 1415, 1583, 2410, 13], [1466, 1415, 1583, 2410])).toBe(null);
  });
});

describe('mergePersons — дублі id у крыніцы', () => {
  const rec = (id, info) => ({ id, num: 1, name: 'Чалавек Тэставіч', translit: 'CHALAVEK', citizenship: 'Республика Беларусь', birth: '01.01.1990', basis: BASIS_369, court: 'суда', articles: ['369'], included: '01.01.2023', date: '2023-01-01', address: 'г. Минск', info });
  const clone = (x) => JSON.parse(JSON.stringify(x));
  it('застаецца апошні варыянт на сваім месцы; пры паўторах праўка не пазначаецца', () => {
    const src = [rec('dup', 'A'), rec('dup', 'B')];
    const r1 = mergePersons([], src, { today: '2026-09-06' });
    expect(r1.out).toHaveLength(1);
    expect(r1.out[0]).toMatchObject({ id: 'dup', info: 'B', order: 1, added: null });
    expect(r1.out[0]).not.toHaveProperty('edited');
    const r2 = mergePersons(clone(r1.out), src, { today: '2026-09-07' });
    expect(r2).toMatchObject({ added: 0, removed: 0, edited: 0 });
    const r3 = mergePersons(clone(r2.out), src, { today: '2026-09-08' });
    expect(r3).toMatchObject({ added: 0, removed: 0, edited: 0 });
    expect(r3.out[0]).toMatchObject({ info: 'B' });
    expect(r3.out[0]).not.toHaveProperty('edited');
  });
});

describe('isPersonEdit — стары запіс без даты ўключэння', () => {
  const old = { id: 'a', name: 'Ковалевский Николай Николаевич', birth: '14.10.1983', date: null };
  it('тое ж імя і тая ж непустая дата нараджэння — праўка; пустыя даты нараджэння — не; іншае імя ці дата — не', () => {
    const fixed = { id: 'b', name: 'ковалевский  николай николаевич', birth: '14.10.1983', date: '2022-03-23' };
    expect(isPersonEdit(old, fixed)).toBe(true);
    expect(isPersonEdit({ ...old, birth: '' }, { ...fixed, birth: '' })).toBe(false);
    expect(isPersonEdit(old, { ...fixed, name: 'Ковалевский Николай Никалаевич' })).toBe(false);
    expect(isPersonEdit(old, { ...fixed, birth: '14.10.1984' })).toBe(false);
    expect(pairPersonEdits([old], [fixed, { id: 'z', name: 'Іншы Чалавек', birth: '14.10.1983', date: '2022-03-23' }])).toEqual([[old, fixed]]);
  });
});

describe('parsePersons — абрэзка ячэек (MAX_CELL) і імя без ячэйкі, падобнай на імя', () => {
  it('падстава даўжэйшая за 5000 сімвалаў захоўваецца абрэзанай да 5000', () => {
    const body = `${HEADER}1\tКовалевский Николай Николаевич\tKAVALEUSKI MIKALAI\tРеспублика Беларусь\t14.10.1983\t${BASIS_369} ${'х'.repeat(6000)}\t23.03.2022\tг. Минск\tОтбывает наказание\t\t`;
    const [x] = parsePersons(body);
    expect(x.basis).toHaveLength(5000);
    expect(x.basis.startsWith(BASIS_369)).toBe(true);
    expect(x).toMatchObject({ name: 'Ковалевский Николай Николаевич', court: 'суда Быховского района Могилевской области', articles: ['369'], included: '23.03.2022' });
  });
  it('без ячэйкі, падобнай на імя, грамадзянства не становіцца імем — якар прапускаецца, суседзі цэлыя', () => {
    const noName = `7\t-\t-\tРеспублика Беларусь\t01.01.1990\t${BASIS_369}\t01.01.2023\tг. Минск\tОтбывает наказание\t\t`;
    const s = {};
    const out = parsePersons(`${HEADER}${ROW1}${noName}${ROW6}`, s);
    expect(out.map((x) => [x.num, x.name])).toEqual([[1, 'Ковалевский Николай Николаевич'], [null, 'Михайлов Дмитрий']]);
    expect(out.every((x) => x.name !== 'Республика Беларусь')).toBe(true);
    expect(s.skipped).toBe(1);
    expect(out[1]).toMatchObject({ translit: 'Mihailovs Dmitrijs', citizenship: 'Латвийская Республика', birth: '02.02.1990', address: 'Республика Беларусь, г. Гомель' });
  });
  it('імя з аднаго слова (псеўданім) — усё ж імя', () => {
    const out = parsePersons(`${HEADER}8\tМадонна\tMADONNA\tРеспублика Беларусь\t16.08.1958\t${BASIS_369}\t01.01.2023\tг. Минск\tОтбывает наказание\t\t`);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ num: 8, name: 'Мадонна', translit: 'MADONNA', citizenship: 'Республика Беларусь', birth: '16.08.1958', address: 'г. Минск' });
  });
});
