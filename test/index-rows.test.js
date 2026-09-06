import { describe, it, expect } from 'vitest';
import { CHUNK, chunkRecord, dict, esc, feed, indexRow, publicMeta } from '../scripts/index-rows.mjs';
import { normalizeCompact } from '../src/lib/normalize.js';
import { parseIndex } from '../src/lib/api.js';

const person = { id: 'p1', list: 'p', num: 7, name: 'Ковалевский Николай Николаевич', translit: 'KAVALEUSKI MIKALAI', citizenship: 'Республика Беларусь', birth: '14.10.1983', basis: 'Вступивший в законную силу приговор суда Быховского района Могилевской области в связи с совершением преступления, предусмотренного статьей 342', court: 'суда Быховского района Могилевской области', articles: ['342', '368'], included: '23.03.2022', date: '2022-03-23', address: 'Могилевская область, д. Лудчицы', info: 'Отбывает наказание', added: '2026-09-05', order: 3 };
const formation = { id: 'f1', list: 'f', kind: 'formation', name: 'Экстремистское формирование «dze.chat»', alias: '«dze.chat»', links: 'https://dze.chat', address: '', basis: 'Решение МВД от 18.10.2021 № 1ЭК', decidedBy: 'mvd', date: '2021-10-18', included: '2021-10-18', info: 'Группа граждан', logo: 'Логотип', added: null, order: 0 };
const material = { id: 'm1', list: 'm', type: 'Информационная продукция', name: 'Telegram-канал "Свабода" & <co>', court: 'Решение суда Ленинского района г. Минска от 1 мая 2026 года.\nПодлежит немедленному исполнению в соответствии со статьей 302 Кодекса гражданского судопроизводства', date: '2026-05-01', added: '2026-09-05', order: 12 };
const edited = { ...material, id: 'm1b', editOf: 'm1', added: '2026-09-05' };

describe('indexRow', () => {
  const dicts = { types: dict(), courts: dict() };
  const rows = [material, formation, person, edited].map((x) => indexRow(x, dicts));
  it('фізічная асоба: імя, транслітарацыя і дата нараджэння ў радку — без адраса, статусу і грамадзянства; спіс 2, № з крыніцы', () => {
    const r = rows[2];
    expect(r[5]).toBe(normalizeCompact('Ковалевский Николай Николаевич\nKAVALEUSKI MIKALAI\n14.10.1983'));
    expect(r[5]).toMatch(/ковалевский/);
    expect(r[5]).toContain(normalizeCompact('KAVALEUSKI')); // лацінская i → і, як і ў пошукавым запыце
    expect(r[5]).toContain('14.10.1983');
    expect(r[5]).not.toMatch(/лудчицы|отбывает|беларусь/);
    expect(dicts.types.list()[r[0]]).toBe(normalizeCompact('ст. 342, 368 УК'));
    expect(dicts.courts.list()[r[1]]).toBe(normalizeCompact('суда Быховского района Могилевской области'));
    expect(r.slice(2, 5)).toEqual(['2022-03-23', '2026-09-05', '']);
    expect(r.slice(6)).toEqual(['p1', 1, '', '', 2, 7]);
    expect(indexRow({ ...person, num: null, articles: [] }, dicts).slice(7)).toEqual([0, '', '', 2, 0]);
  });
  it('фарміраванне: тып/суд — падпісы для пошуку, артыкул — хто прыняў рашэнне, спіс 1', () => {
    const r = rows[1];
    expect(dicts.types.list()[r[0]]).toBe(normalizeCompact('Экстремистское формирование'));
    expect(dicts.courts.list()[r[1]]).toBe(normalizeCompact('Решение МВД'));
    expect(r[5]).toContain('dze.chat');
    expect(r.slice(2, 5)).toEqual(['2021-10-18', '', '']);
    expect(r.slice(6)).toEqual(['f1', 1, '', '', 1]);
  });
  it('матэрыял: артыкул КГС, спіс 0, editOf', () => {
    expect(rows[0].slice(6)).toEqual(['m1', 2, '', '', 0]);
    expect(rows[3].slice(6)).toEqual(['m1b', 2, 'm1', '', 0]);
    expect(dicts.courts.list()[rows[0][1]]).toBe(normalizeCompact('суда Ленинского района г. Минска'));
    // тры тыпы з чатырох радкоў (праўка дзеліць тып з арыгіналам) + пусты тып запісу без артыкулаў з тэсту вышэй
    expect(dicts.types.list()).toEqual([normalizeCompact('Информационная продукция'), normalizeCompact('Экстремистское формирование'), normalizeCompact('ст. 342, 368 УК'), '']);
  });
  it('слоты list і num праходзяць праз parseIndex (src/lib/api.js)', () => {
    const idx = parseIndex({ chunk: CHUNK, types: dicts.types.list(), courts: dicts.courts.list(), dates: {}, items: rows });
    expect(idx.chunkSize).toBe(200);
    expect(idx.items.map((x) => x.list)).toEqual(['m', 'f', 'p', 'm']);
    expect(idx.items.map((x) => x.n)).toEqual([1, 1, 7, 2]);
    expect(idx.items.map((x) => x.art)).toEqual(['kgs', 'mvd', 'protest', 'kgs']);
    expect(idx.items[3].editOf).toBe('m1');
    expect(idx.items[2].h).toContain(normalizeCompact('ст. 342, 368 УК'));
    expect(idx.counts).toEqual({ m: 2, f: 1, p: 1 });
    const idx2 = parseIndex({ chunk: CHUNK, types: dicts.types.list(), courts: dicts.courts.list(), dates: {}, items: [indexRow({ ...person, num: null }, dicts)] });
    expect(idx2.items[0].n).toBe(null);
  });
});

describe('chunkRecord', () => {
  it('фізічная асоба — палі карткі (без added/order); фарміраванне; матэрыял з order', () => {
    expect(chunkRecord(person)).toEqual({
      id: 'p1', list: 'p', num: 7, name: person.name, translit: person.translit, citizenship: person.citizenship, birth: person.birth,
      basis: person.basis, articles: person.articles, included: person.included, date: person.date, address: person.address, info: person.info,
    });
    expect(chunkRecord(formation)).toEqual({
      id: 'f1', list: 'f', kind: 'formation', name: formation.name, alias: formation.alias, links: formation.links, address: '', basis: formation.basis,
      decidedBy: 'mvd', date: '2021-10-18', included: '2021-10-18', info: formation.info, logo: formation.logo,
    });
    expect(chunkRecord(material)).toEqual({ id: 'm1', type: material.type, name: material.name, court: material.court, order: 12 });
  });
});

describe('publicMeta', () => {
  it('без адрасоў крыніц; другі і трэці спісы — укладзеныя ці null', () => {
    const pub = publicMeta(
      { updated: '2026-09-06', total: 1, sourcePage: 'x', sourceFile: 'y' },
      { total: 2, sourcePage: 'a', sourceFile: 'b' },
      { total: 3, parts: 4, sourcePage: 'c', sourceFiles: ['d'] },
    );
    expect(pub).toEqual({ updated: '2026-09-06', total: 1, formations: { total: 2 }, persons: { total: 3, parts: 4 } });
    expect(JSON.stringify(pub)).not.toMatch(/sourcePage|sourceFile|sourceFiles/);
    expect(publicMeta({ total: 1 }, {}, {})).toEqual({ total: 1, formations: null, persons: null });
    expect(publicMeta({ total: 1 }, { sourcePage: 'a' }, { sourceFiles: [] })).toEqual({ total: 1, formations: null, persons: null });
    expect(publicMeta({ total: 1 })).toEqual({ total: 1, formations: null, persons: null });
  });
});

describe('feed (RSS)', () => {
  const SITE = 'https://elist.itbeard.com/';
  const xml = feed([material, formation, person, edited], { updated: '2026-09-06' }, SITE);
  it('асоба: без даты нараджэння і адраса; guid праўкі — каранёвы id; экранаванне', () => {
    expect(xml).not.toContain('14.10.1983');
    expect(xml).not.toContain('Лудчицы');
    expect(xml).toContain('<category>Фізічная асоба (пералік МУС)</category>');
    expect(xml).toContain('KAVALEUSKI MIKALAI');
    expect(xml).toContain('Уключаны ў пералік: 23.03.2022');
    expect(xml).toContain(`<link>${SITE}#/r/p1</link>`);
    expect(xml.match(/<guid isPermaLink="false">m1<\/guid>/g)).toHaveLength(2);
    expect(xml).not.toContain('<guid isPermaLink="false">m1b</guid>');
    expect(xml).toContain('<title>Telegram-канал &quot;Свабода&quot; &amp; &lt;co&gt;</title>');
    expect(xml).not.toContain('f1'); // без added — не ў стужцы
    expect(xml).toContain('<lastBuildDate>Sun, 06 Sep 2026 00:00:00 GMT</lastBuildDate>');
    expect(esc('a & <b> "c"')).toBe('a &amp; &lt;b&gt; &quot;c&quot;');
  });
  it('без added — апошнія матэрыялы па даце рашэння', () => {
    const x = feed([{ ...material, added: null }, { ...person, added: null }], { updated: '2026-09-06' }, SITE);
    expect(x).toContain('#/r/m1</link>');
    expect(x).not.toContain('#/r/p1');
  });
});
