import { describe, it, expect, vi, beforeAll } from 'vitest';
import fs from 'node:fs';
import zlib from 'node:zlib';
import { renderToStaticMarkup } from 'react-dom/server';
import { readXlsxSheets, xlsxModified, excelDate } from '../scripts/xlsx.mjs';
import { birthText, isTerrorEdit, mergeTerror, parseTerror, splitTranslit, terrorId } from '../scripts/parse-terror.mjs';
import { botInboxFiles, isFreshPost, parseChannelPreview, parseListDate, pickPost, postDate } from '../scripts/update-terror.mjs';
import { CHUNK, chunkRecord, dict, feed, foldTerror, indexRow, linkLists, publicMeta } from '../scripts/index-rows.mjs';
import { ICON, NAME, RANK, buildDigest, digestHeader, entry, selectFresh, subheader } from '../scripts/digest.mjs';
import { sourceMessages } from '../scripts/alert-logic.mjs';
import { TERROR_MARK, UN_BASIS, similarBirth, terrorStatus, terrorTypeLabel } from '../src/lib/terror.js';
import { PERSON_SERIES, extractArticles } from '../src/lib/person.js';
import { parseIndex } from '../src/lib/api.js';
import { countByList, search } from '../src/lib/search.js';
import { deriveResults } from '../src/lib/results.js';
import { checkWatchlist } from '../src/lib/watch.js';
import { splitNew } from '../src/lib/whatsnew.js';
import { SERIES_BY_LIST, dailyCounts } from '../src/lib/stats.js';
import { normalizeCompact } from '../src/lib/normalize.js';
import { LangContext } from '../src/hooks/useLang.jsx';
import { STRINGS } from '../src/lib/i18n.js';

// ---------- узор .xlsx КДБ без залежнасцяў: ZIP без сціску (метад 0) ----------
const u16 = (b, o, v) => b.writeUInt16LE(v, o), u32 = (b, o, v) => b.writeUInt32LE(v >>> 0, o);
function zipStore(entries) {
  const locals = [], centrals = [];
  let offset = 0;
  for (const { name, data } of entries) {
    const n = Buffer.from(name), crc = zlib.crc32(data);
    const lh = Buffer.alloc(30); u32(lh, 0, 0x04034b50); u16(lh, 4, 20); u32(lh, 14, crc); u32(lh, 18, data.length); u32(lh, 22, data.length); u16(lh, 26, n.length);
    const ch = Buffer.alloc(46); u32(ch, 0, 0x02014b50); u16(ch, 4, 20); u16(ch, 6, 20); u32(ch, 16, crc); u32(ch, 20, data.length); u32(ch, 24, data.length); u16(ch, 28, n.length); u32(ch, 42, offset);
    locals.push(lh, n, data); centrals.push(ch, n); offset += 30 + n.length + data.length;
  }
  const cd = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22); u32(eocd, 0, 0x06054b50); u16(eocd, 8, entries.length); u16(eocd, 10, entries.length); u32(eocd, 12, cd.length); u32(eocd, 16, offset);
  return Buffer.concat([...locals, cd, eocd]);
}
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const serial = (iso) => Math.round((Date.parse(iso) - Date.UTC(1899, 11, 30)) / 864e5);
/** Ліст: радкі — масівы ячэек па калонках A…; лік → <v>, радок → inlineStr, null — пустая ячэйка. */
const sheetXml = (rows) => `<?xml version="1.0"?><worksheet><sheetData>${rows.map((r, i) => `<row r="${i + 1}">${r.map((v, k) => {
  if (v == null || v === '') return '';
  const ref = `${String.fromCharCode(65 + k)}${i + 1}`;
  return typeof v === 'number' ? `<c r="${ref}"><v>${v}</v></c>` : `<c r="${ref}" t="inlineStr"><is><t>${esc(v)}</t></is></c>`;
}).join('')}</row>`).join('')}</sheetData></worksheet>`;
const VERDICT = (a) => `Вступил в законную силу приговор суда о признании виновным в совершении преступлений, предусмотренных ${a} Уголовного кодекса Республики Беларусь`;
const HEAD = ['№ п/п', 'Фамилия, имя, отчество (русскоязычное написание)', 'Фамилия, имя, отчество (латинская либо национальная транслитерация)', 'Гражданство', 'Дата рождения', 'Адрес', 'Основание включения в перечень', 'Справочная информация'];
const PERSONS = [
  HEAD,
  ['1', 'Ли Вон Хо ', ' Ri Won Ho \r\nМожет быть также известен как: \r\n д/о', 'Корейская Народно-Демократическая Республика', 23575, 'д/о', 'Санкционный перечень Комитета Совета Безопасности ООН, учрежденный резолюцией 1718 (2006), номер по перечню ООН KPi.033', 'д/о'],
  ['725', 'Путило Степан Александрович', 'Putsila Stsiapan', 'Республика Беларусь', '27.07.1998', 'г. Варшава, Республика Польша', VERDICT('ст. 130, ст. 290-5, ст. 293, ст. 361'), 'Основатель каналов «NEXTA»'],
  ['729', 'Попок Артур Викторович', 'POPOK ARTHUR', 'Республика Беларусь', '05.05.1969', 'Гродненская обл.', 'Обвиняется по ст. 289 Уголовного кодекса Республики Беларусь', ''],
  ['988', 'Коновалов Олег Анатольевич', 'KANAVALAU ALEH\r\nНа основании достоверных источников также известен как: Шутов Олег Анатольевич, Shutau Aleh', 'Республика Беларусь', serial('1995-07-08'), 'Гомельская область', VERDICT('ст. 130'), ''],
  ['1666', 'Корсакова Татьяна Сигизмундовна', 'KORSAKAVA TATSIANA', 'Республика Беларусь', serial('1968-09-20'), 'д/о', VERDICT('ч. 4 ст. 295'), ''],
  ['1700', 'Демидович Василий Иванович', 'DZEMIDOVICH VASIL', 'Республика Беларусь', serial('1952-04-15'), 'г. Минск', VERDICT('ст.ст 130, 361'), ''],
  ['', 'радок без нумара — не запіс', '', '', '', '', '', ''],
];
const ORGS = [['№ п/п', 'Наименование'], ['1', 'ДЕПАРТАМЕНТ ПРОПАГАНДЫ И АГИТАЦИИ']];
function makeXlsx({ persons = PERSONS, modified = '2026-09-11T09:18:01Z' } = {}) {
  const x = (s) => Buffer.from(s, 'utf8');
  return zipStore([
    { name: '[Content_Types].xml', data: x('<?xml version="1.0"?><Types/>') },
    { name: 'docProps/core.xml', data: x(`<?xml version="1.0"?><cp:coreProperties xmlns:cp="x" xmlns:dcterms="y" xmlns:xsi="z"><dcterms:modified xsi:type="dcterms:W3CDTF">${modified}</dcterms:modified></cp:coreProperties>`) },
    // ліст асоб наўмысна другі: бярэцца па назве, а не па парадку
    { name: 'xl/workbook.xml', data: x('<?xml version="1.0"?><workbook xmlns:r="r"><sheets><sheet name="Перечень организаций" sheetId="2" r:id="rId2"/><sheet name="Перечень физических лиц" sheetId="1" r:id="rId1"/></sheets></workbook>') },
    { name: 'xl/_rels/workbook.xml.rels', data: x('<?xml version="1.0"?><Relationships><Relationship Id="rId2" Type="t" Target="worksheets/sheet2.xml"/><Relationship Id="rId1" Type="t" Target="worksheets/sheet1.xml"/></Relationships>') },
    { name: 'xl/worksheets/sheet1.xml', data: x(sheetXml(persons)) },
    { name: 'xl/worksheets/sheet2.xml', data: x(sheetXml(ORGS)) },
  ]);
}
const clone = (x) => JSON.parse(JSON.stringify(x));

describe('xlsx.mjs — некалькі лістоў, дата файла, раннія даты', () => {
  it('readXlsxSheets: лісты ў парадку кнігі з назвамі; xlsxModified — дата захавання; excelDate з малым парогам', () => {
    const buf = makeXlsx();
    const sheets = readXlsxSheets(buf);
    expect(sheets.map((s) => s.name)).toEqual(['Перечень организаций', 'Перечень физических лиц']);
    expect(sheets[1].rows).toHaveLength(PERSONS.length);
    expect(sheets[1].rows[2].cells).toMatchObject({ A: '725', B: 'Путило Степан Александрович', G: expect.stringContaining('ст. 290-5') });
    expect(sheets[1].rows[4].cells.E).toBe(String(serial('1995-07-08')));
    expect(xlsxModified(buf)).toBe('2026-09-11');
    expect(xlsxModified(makeXlsx({ modified: '' }))).toBe(null);
    expect(excelDate(19099)).toBe(null); // даты рашэнняў: да 1954 года — не дата
    expect(excelDate(19099, 1)).toBe('1952-04-15');
    expect(excelDate(serial('1995-07-08'), 1)).toBe('1995-07-08');
    expect(excelDate('27.07.1998', 1)).toBe(null);
  });
});

describe('terror.js — агульная логіка', () => {
  it('падстава ААН, стан справы, падобная дата нараджэння, подпісы для індэкса', () => {
    expect(UN_BASIS.test('Санкционный перечень Комитета Совета Безопасности ООН')).toBe(true);
    expect(UN_BASIS.test('Обвиняется по ст. 289 УК')).toBe(false);
    expect(terrorStatus('Обвиняется по ст. 289 УК')).toBe('charged');
    expect(terrorStatus(VERDICT('ст. 130'))).toBe('verdict');
    expect(terrorStatus('')).toBe('other');
    expect(similarBirth('11.07.1986', '11.06.1986')).toBe(true);   // памылка ў месяцы
    expect(similarBirth('29.09.1989', '29.09.2025')).toBe(true);   // памылка ў годзе
    expect(similarBirth('24.06.2006', '24.09.2006')).toBe(true);
    expect(similarBirth('01.01.1990', '02.02.1990')).toBe(false);  // супадае толькі год
    expect(similarBirth('01.01.1990', '01.01.1990')).toBe(true);
    expect(similarBirth('', '01.01.1990')).toBe(false);
    expect(similarBirth('1984', '1984')).toBe(true);
    expect(terrorTypeLabel(['289'])).toBe('Террорист (перечень КГБ) тэрарыст terrorist · ст. 289 УК');
    expect(terrorTypeLabel([])).toBe('Террорист (перечень КГБ) тэрарыст terrorist');
    expect(TERROR_MARK).toMatch(/тэрарыст/);
    expect(PERSON_SERIES).toContain('terror');
    expect(SERIES_BY_LIST.p).toBe(PERSON_SERIES);
  });
  it('радок статыстыкі па пераліку КДБ: злітыя, асобныя, без даты — у абедзвюх мовах', () => {
    const be = STRINGS.be.statsKgbP, en = STRINGS.en.statsKgbP;
    expect(be(738, 700, 38)).toBe('У пераліку КДБ «прычастных да тэрарыстычнай дзейнасці» 738 чалавек. 700 з іх ёсць і ў пераліку МУС і на графіку лічацца як запісы МУС — па даце ўключэння і групе артыкулаў. Астатнія 38 ёсць толькі ў пераліку КДБ — гэта малінавая серыя. Дат уключэння пералік не публікуе, таму на графік яны пакуль не трапляюць: дату атрымліваюць толькі тыя, хто з’явіцца ў наступных версіях пераліку.');
    expect(be(1042, 1000, 40)).toContain('У пераліку КДБ «прычастных да тэрарыстычнай дзейнасці» 1 042 чалавекі.');
    expect(be(1042, 1000, 40)).toContain('таму 40 з іх на графік не трапляюць');
    expect(be(42, 40, 0)).not.toContain('не трапляюць');
    expect(be(3, 0, 3)).toContain('Усе яны ёсць толькі ў пераліку КДБ');
    expect(be(3, 0, 3)).not.toContain('ёсць і ў пераліку МУС');
    expect(be(5, 5, 0)).toBe('У пераліку КДБ «прычастных да тэрарыстычнай дзейнасці» 5 чалавек. 5 з іх ёсць і ў пераліку МУС і на графіку лічацца як запісы МУС — па даце ўключэння і групе артыкулаў.');
    expect(en(738, 700, 38)).toBe('The KGB list of those “involved in terrorist activity” holds 738 people. 700 of them are also on the Interior Ministry list and are counted on the chart as Interior Ministry entries, by inclusion date and article group. The remaining 38 are only on the KGB list — that is the crimson series. The list publishes no inclusion dates, so they are not on the chart yet: a date is only known for people who appear in later versions of the list.');
    expect(en(1, 0, 1)).toContain('holds 1 person.');
    expect(en(50, 40, 4)).toContain('so 4 of them are not on the chart');
  });
  it('артыкулы КК у скарочаным запісе пераліку КДБ', () => {
    expect(extractArticles('Обвиняется по ст. 289, ч. 4 ст. 309 УК')).toEqual(['289', '309']);
    expect(extractArticles('предусмотренныхст. 289-1, ст. 290-1 Уголовного')).toEqual(['289-1', '290-1']);
    expect(extractArticles('ст. 130, 290-4, 359, 361')).toEqual(['130', '290-4', '359', '361']);
    expect(extractArticles('ст.289, ст.359')).toEqual(['289', '359']);
    expect(extractArticles('ст.ст 130, 361,203,342')).toEqual(['130', '361', '203', '342']);
    expect(extractArticles('частью 1 статьи 342, статьей 364')).toEqual(['342', '364']); // пералік МУС — як раней
  });
});

describe('parseTerror', () => {
  const stats = {};
  const items = parseTerror(readXlsxSheets(makeXlsx()), stats);
  it('бярэ ліст асоб па назве, прапускае ААН і радкі без нумара; раскладвае палі', () => {
    expect(items.map((x) => x.num)).toEqual([725, 729, 988, 1666, 1700]);
    expect(stats).toEqual({ total: 6, un: 1, skipped: 0, noBirth: 0 });
    expect(items[0]).toMatchObject({ name: 'Путило Степан Александрович', translit: 'Putsila Stsiapan', aka: '', citizenship: 'Республика Беларусь', birth: '27.07.1998', address: 'г. Варшава, Республика Польша', articles: ['130', '290-5', '293', '361'], info: 'Основатель каналов «NEXTA»' });
    expect(items[1]).toMatchObject({ birth: '05.05.1969', address: 'Гродненская обл.', articles: ['289'], info: '' });
    expect(items[2]).toMatchObject({ translit: 'KANAVALAU ALEH', aka: 'Шутов Олег Анатольевич, Shutau Aleh', birth: '08.07.1995' });
    expect(items[3]).toMatchObject({ birth: '20.09.1968', address: '', articles: ['295'] }); // «д/о» — пуста; серыял Excel — дата
    expect(items[4]).toMatchObject({ birth: '15.04.1952', articles: ['130', '361'] });       // серыял ніжэй за 20 000 — таксама дата
    expect(items.every((x) => /^[0-9a-f]{12}$/.test(x.id))).toBe(true);
    expect(() => parseTerror([])).toThrow(/лістоў/);
  });
  it('id — ад імя і даты нараджэння праз замарожаную нармалізацыю; нумар не ўплывае', () => {
    expect(items[3].id).toBe(terrorId('корсакова  татьяна сигизмундовна', '20.09.1968'));
    expect(terrorId('ЁЛКИН ПЁТР', '01.01.1990')).toBe(terrorId('Елкин Петр', '01.01.1990'));
    expect(terrorId('Елкин Петр', '01.01.1990')).not.toBe(terrorId('Елкин Петр', '01.01.1991'));
  });
  it('дапаможныя: дата нараджэння і транслітарацыя з дапіскай', () => {
    expect(birthText('7.4.1985')).toBe('7.4.1985');
    expect(birthText('7.04.1985')).toBe('07.04.1985');
    expect(birthText('Между 1965 и 1969')).toBe('Между 1965 и 1969');
    expect(birthText('д/о')).toBe('');
    expect(splitTranslit('HULEVICH VADZIM, может быть известен как Лукашевич Вадим Геннадьевич')).toEqual({ translit: 'HULEVICH VADZIM', aka: 'Лукашевич Вадим Геннадьевич' });
    expect(splitTranslit('д/о \r\nНа основании достоверных источников также известен как: Хромов Денис Васильевич ')).toEqual({ translit: '', aka: 'Хромов Денис Васильевич' });
    expect(splitTranslit('KORSAKAVA TATSIANA')).toEqual({ translit: 'KORSAKAVA TATSIANA', aka: '' });
    expect(splitTranslit('')).toEqual({ translit: '', aka: '' });
  });
});

describe('mergeTerror — зліццё з базай і версія пераліку', () => {
  const parsed = () => parseTerror(readXlsxSheets(makeXlsx()));
  it('першы імпарт — без «новага» і без since; паўтор — без змен', () => {
    const r1 = mergeTerror([], parsed(), { today: '2026-09-15', listDate: '2026-09-11' });
    expect(r1).toMatchObject({ added: 5, removed: 0, edited: 0, initial: true });
    expect(r1.out.every((x) => x.added === null && !('since' in x))).toBe(true);
    const r2 = mergeTerror(clone(r1.out), parsed(), { today: '2026-09-16', listDate: '2026-09-11' });
    expect(r2).toMatchObject({ added: 0, removed: 0, edited: 0, initial: false });
    expect(r2.out.every((x) => !x.edited && !x.since)).toBe(true);
  });
  it('новы запіс — added сёння і since = дата версіі пераліку; зніклы — removed; праўка нумара — моўчкі', () => {
    const db = clone(mergeTerror([], parsed(), { today: '2026-09-15' }).out);
    const next = clone(PERSONS);
    next.push(['1701', 'Новы Чалавек Іванавіч', 'NOVY CHALAVEK', 'Республика Беларусь', '01.01.2000', 'г. Минск', 'Обвиняется по ст. 289 Уголовного кодекса Республики Беларусь', '']);
    next.splice(3, 1); // Попок знік
    next[2][0] = '726'; // нумар Пуцілы змяніўся
    const r = mergeTerror(db, parseTerror(readXlsxSheets(makeXlsx({ persons: next }))), { today: '2026-09-25', listDate: '2026-09-24' });
    expect(r).toMatchObject({ added: 1, removed: 1, edited: 1 });
    const by = (n) => r.out.find((x) => x.name.startsWith(n));
    expect(by('Новы')).toMatchObject({ added: '2026-09-25', since: '2026-09-24' });
    expect(by('Попок')).toMatchObject({ removed: '2026-09-25' });
    expect(by('Путило')).toMatchObject({ num: 726, edited: '2026-09-25', added: null });
    expect(by('Путило').since).toBeUndefined();
  });
  it('выпраўленае імя пры той жа даце ці выпраўленая дата пры тым жа імені — праўка, а не новы чалавек; наследуе since', () => {
    const db = clone(mergeTerror([], parsed(), { today: '2026-09-15' }).out);
    db.find((x) => x.name.startsWith('Попок')).since = '2026-08-19';
    const fixed = clone(PERSONS); fixed[3][1] = 'Попок Артур Викторовичь'; fixed[5][4] = serial('1968-09-21');
    const r = mergeTerror(db, parseTerror(readXlsxSheets(makeXlsx({ persons: fixed }))), { today: '2026-09-25', listDate: '2026-09-24' });
    expect(r).toMatchObject({ added: 0, removed: 0 });
    expect(r.edits).toHaveLength(2);
    const popok = r.out.find((x) => x.name === 'Попок Артур Викторовичь');
    expect(popok).toMatchObject({ added: null, since: '2026-08-19', edited: '2026-09-25' });
    expect(popok.editOf).toBeTruthy();
    expect(isTerrorEdit({ name: 'Иванов Иван', birth: '01.01.1990' }, { name: 'Иванов Иван', birth: '02.01.1990' })).toBe(true);
    expect(isTerrorEdit({ name: 'Иванов Иван', birth: '01.01.1990' }, { name: 'Петров Петр', birth: '01.01.1990' })).toBe(false);
    expect(isTerrorEdit({ name: 'Иванов Иван', birth: '' }, { name: 'Иванов Иван', birth: '01.01.1990' })).toBe(false);
  });
  it('засцярогі mergeList: масавае знікненне — памылка, зашмат новых — без force', () => {
    // знікла больш за max(20, 5 %) — памылка: база з 30 чалавек, у новай версіі застаўся адзін
    const big = clone(PERSONS);
    for (let i = 0; i < 25; i++) big.push([`3${i}00`, `Чалавек ${i} Пятровіч`, '', 'Республика Беларусь', '02.02.1980', '', 'Обвиняется по ст. 289 УК', '']);
    const bigDb = clone(mergeTerror([], parseTerror(readXlsxSheets(makeXlsx({ persons: big }))), { today: '2026-09-15' }).out);
    expect(bigDb).toHaveLength(30);
    expect(() => mergeTerror(bigDb, parsed().slice(0, 1), { today: '2026-09-16' })).toThrow(/Падазрона: 29 запісаў знікла/);
    const db = clone(mergeTerror([], parsed(), { today: '2026-09-15' }).out);
    const many = clone(PERSONS);
    for (let i = 0; i < 3; i++) many.push([`2${i}00`, `Чалавек ${i} Іванавіч`, '', 'Республика Беларусь', '01.01.2000', '', 'Обвиняется по ст. 289 УК', '']);
    expect(() => mergeTerror(clone(db), parseTerror(readXlsxSheets(makeXlsx({ persons: many }))), { today: '2026-09-16', maxAdded: 2 })).toThrow(/ліміт 2/);
    expect(mergeTerror(clone(db), parseTerror(readXlsxSheets(makeXlsx({ persons: many }))), { today: '2026-09-16', maxAdded: 2, force: true }).added).toBe(3);
  });
});

describe('update-terror.mjs — дата версіі і выбар паста', () => {
  it('parseListDate: з тэксту паста ці ISO; pickPost — найноўшы пост з .xlsx і назвай пераліку', () => {
    expect(parseListDate('Перечень организаций и физических лиц, причастных к террористической деятельности от 11.09.2026')).toBe('2026-09-11');
    expect(parseListDate('2026-09-11')).toBe('2026-09-11');
    expect(parseListDate('учора')).toBe(null);
    const posts = [
      { id: 78, text: 'Перечень организаций и физических лиц, причастных к террористической деятельности от 11.09.2026', fileName: 'Перечень.xlsx' },
      { id: 79, text: 'Навіна без файла', fileName: '' },
      { id: 80, text: 'Перечень организаций и физических лиц, причастных к террористической деятельности от 25.09.2026', fileName: 'Перечень.pdf' },
      { id: 77, text: 'Перечень организаций и физических лиц, причастных к террористической деятельности от 03.09.2026', fileName: 'Перечень.xlsx' },
    ];
    expect(pickPost(posts).id).toBe(78);
    expect(pickPost([])).toBe(null);
    expect(pickPost(undefined)).toBe(null);
  });
  it('parseChannelPreview: пасты з публічнага прэв’ю канала (id, тэкст, файл, памер, дата), найноўшыя спачатку; чужы HTML — пуста', () => {
    const html = fs.readFileSync(new URL('./fixtures/kgb-channel.html', import.meta.url), 'utf8');
    const posts = parseChannelPreview(html);
    expect(posts.map((p) => p.id)).toEqual([78, 77, 59]);
    expect(posts[0]).toEqual({ id: 78, text: 'Перечень организаций и физических лиц, причастных к террористической деятельности от 11.09.2026', fileName: 'Перечень.xlsx', size: '427.9 KB', date: '2026-09-15T14:34:04+00:00' });
    expect(posts[1].text).toContain('от 03.09.2026');
    expect(pickPost(posts).id).toBe(78);
    expect(postDate(posts[0])).toBe('2026-09-11');
    expect(postDate({ id: 1, text: 'без даты', date: '2026-09-15T14:34:04+00:00' })).toBe('2026-09-15');
    expect(postDate(null)).toBe(null);
    expect(parseChannelPreview('<html>нічога</html>')).toEqual([]);
    expect(parseChannelPreview('')).toEqual([]);
    // пост без файла і з экранаваннем у тэксце
    const one = parseChannelPreview('<div class="tgme_widget_message_wrap"><div data-post="X/5"><div class="tgme_widget_message_text js-message_text" dir="auto">Навіна &amp; <b>тэкст</b><br/>другі радок</div><time datetime="2026-09-16T10:00:00+00:00"></time></div></div>');
    expect(one).toEqual([{ id: 5, text: 'Навіна & тэкст другі радок', fileName: '', size: '', date: '2026-09-16T10:00:00+00:00' }]);
    expect(pickPost(one)).toBe(null);
  });
  it('isFreshPost: паведамляць толькі пра версію навейшую за базу і толькі раз', () => {
    const post = { id: 78, text: 'Перечень … от 11.09.2026', fileName: 'Перечень.xlsx', date: '2026-09-15T14:34:04+00:00' };
    expect(isFreshPost(post, { sourceDate: '2026-09-03' })).toBe(true);
    expect(isFreshPost(post, {})).toBe(true);
    expect(isFreshPost(post, { sourceDate: '2026-09-11' })).toBe(false);
    expect(isFreshPost(post, { sourceDate: '2026-09-25' })).toBe(false);
    expect(isFreshPost(post, { sourceDate: '2026-09-03', announcedPost: 78 })).toBe(false);
    expect(isFreshPost(post, { sourceDate: '2026-09-03', announcedPost: 77 })).toBe(true);
    expect(isFreshPost(null, {})).toBe(false);
  });
  it('botInboxFiles: толькі .xlsx з адмін-чата, дата з подпісу, спасылка на зыходны пост', () => {
    const doc = (over = {}) => ({ file_id: 'f1', file_name: 'Перечень.xlsx', file_size: 438_146, ...over });
    const updates = [
      { update_id: 1, message: { chat: { id: 111 }, document: doc(), caption: 'Перечень организаций и физических лиц, причастных к террористической деятельности от 25.09.2026', forward_origin: { type: 'channel', chat: { username: 'KGB_BY_channel' }, message_id: 80 } } },
      { update_id: 2, message: { chat: { id: 222 }, document: doc({ file_id: 'чужы' }), caption: 'от 25.09.2026' } },   // чужы чат
      { update_id: 3, message: { chat: { id: 111 }, document: doc({ file_id: 'pdf', file_name: 'Перечень.pdf' }) } },   // не xlsx
      { update_id: 4, message: { chat: { id: 111 }, document: doc({ file_id: 'big', file_size: 50e6 }) } },            // зашмат
      { update_id: 5, message: { chat: { id: 111 }, text: 'проста тэкст' } },
      { update_id: 6, message: { chat: { id: 111 }, document: doc({ file_id: 'f2', file_name: '2026-10-02.xlsx' }) } }, // без подпісу
      { update_id: 7, edited_message: { chat: { id: 111 }, document: doc({ file_id: 'edited' }) } },
    ];
    expect(botInboxFiles(updates, '111')).toEqual([
      { fileId: 'f1', fileName: 'Перечень.xlsx', listDate: '2026-09-25', sourceUrl: 'https://t.me/KGB_BY_channel/80' },
      { fileId: 'f2', fileName: '2026-10-02.xlsx', listDate: null, sourceUrl: 'telegram-bot:2026-10-02.xlsx' },
    ]);
    expect(botInboxFiles(updates, 222)).toHaveLength(1);
    expect(botInboxFiles([], '111')).toEqual([]);
    expect(botInboxFiles(undefined, '111')).toEqual([]);
  });
});

// ---------- уліванне ў спіс асоб, індэкс, пошук ----------
const mvd = (id, name, birth, extra = {}) => ({ id, list: 'p', num: 10, name, translit: 'X', citizenship: 'Республика Беларусь', birth, basis: 'Вступивший в законную силу приговор суда Быховского района в связи с совершением преступления, предусмотренного статьей 342', court: 'суда Быховского района', articles: ['342'], included: '23.03.2022', date: '2022-03-23', address: 'д. Лудчицы', added: null, order: 0, ...extra });
const kgb = (id, name, birth, extra = {}) => ({ id, list: 't', num: 700, name, translit: 'Y', aka: '', citizenship: 'Республика Беларусь', birth, address: 'г. Минск', basis: 'Обвиняется по ст. 289 Уголовного кодекса Республики Беларусь', articles: ['289'], info: '', added: null, order: 0, ...extra });
const wantedRec = { id: 'w1', list: 'w', name: 'ПОПОК АРТУР ВИКТОРОВИЧ', year: 1969, nationality: 'БЕЛАРУС', region: 'Гродненская область', agency: 'КГБ', date: '2025-01-10', before: '', first: '', category: '', rf: '', added: null, order: 0 };
const makeDb = () => [
  mvd('p1', 'Спариш Сергей Сергеевич', '11.06.1986'),
  mvd('p2', 'Иванов Иван Иванович', '01.01.1990'),
  mvd('p3', 'Иванов Иван Иванович', '01.01.1990', { removed: '2026-01-01' }),
  { ...wantedRec },
  kgb('t1', 'Спариш Сергей Сергеевич', '11.07.1986', { since: '2026-09-11', added: '2026-09-15' }),   // той жа чалавек, памылка ў месяцы
  kgb('t2', 'Попок Артур Викторович', '05.05.1969'),                                                // яго няма ў пераліку МУС
  kgb('t3', 'Иванов Иван Иванович', '01.01.1990', { removed: '2026-09-15' }),                       // выбыў — не ўліваецца
];

describe('foldTerror + linkLists', () => {
  it('улівае жывы запіс КДБ у жывы запіс МУС пра таго ж чалавека; іншыя застаюцца самастойнымі; крос-спасылкі з вышукам', () => {
    const db = makeDb();
    expect(foldTerror(db)).toBe(1);
    const by = (id) => db.find((x) => x.id === id);
    expect(by('t1').mergedInto).toBe('p1');
    expect(by('p1').kgb).toEqual({ id: 't1', num: 700, basis: by('t1').basis, articles: ['289'], status: 'charged', since: '2026-09-11' });
    expect(by('t2').mergedInto).toBeUndefined();
    expect(by('t3').mergedInto).toBeUndefined();
    expect(by('p2').kgb).toBeUndefined();
    expect(linkLists(db)).toBe(1);
    expect(by('t2').also).toEqual(['w1']);
    expect(by('w1').also).toEqual(['t2']);
    expect(by('t1').also).toBeUndefined();
    // паўторны выклік пасля змены стану — старыя сувязі не застаюцца
    by('t1').removed = '2026-10-01';
    expect(foldTerror(db)).toBe(0);
    expect(by('p1').kgb).toBeUndefined();
    expect(by('t1').mergedInto).toBeUndefined();
  });
});

describe('індэкс і фрагменты для запісаў КДБ', () => {
  const db = makeDb();
  foldTerror(db); linkLists(db);
  const dicts = { types: dict(), courts: dict() };
  const rows = db.map((x) => indexRow(x, dicts));
  const idx = parseIndex({ chunk: CHUNK, types: dicts.types.list(), courts: dicts.courts.list(), dates: { '2026-09-11': '11 верасня 2026' }, items: rows });
  const item = (id) => idx.items.find((x) => x.id === id);
  it('радкі: запіс КДБ — спіс 2, серыя 4, нумар КДБ, mergedInto у 13-м слоце; запіс МУС з пазнакай kgb — 1 у 13-м слоце і словы для пошуку', () => {
    const t1 = rows[4], t2 = rows[5], p1 = rows[0], p2 = rows[1];
    expect(t1.slice(6)).toEqual(['t1', 4, '', '', 2, 700, 'p1']);
    expect(t2.slice(6)).toEqual(['t2', 4, '', '', 2, 700, '']);
    expect(t1[2]).toBe('2026-09-11');
    expect(t2[5]).toBe(normalizeCompact('Попок Артур Викторович\nY\n05.05.1969'));
    expect(dicts.types.list()[t2[0]]).toBe(normalizeCompact(terrorTypeLabel(['289'])));
    expect(p1.slice(10)).toEqual([2, 10, 1]);
    expect(p2).toHaveLength(12);
    expect(dicts.types.list()[p1[0]]).toContain('тэрарыст');
    expect(dicts.types.list()[p2[0]]).toBe(normalizeCompact('ст. 342 УК'));
  });
  it('parseIndex: merged, kgb, серыя terror; лічыльнікі спісаў без асобнага спіса КДБ', () => {
    expect(item('t1')).toMatchObject({ list: 'p', art: 'terror', n: 700, merged: 'p1', kgb: true, date: '2026-09-11' });
    expect(item('t2')).toMatchObject({ list: 'p', art: 'terror', merged: '', kgb: true });
    expect(item('p1')).toMatchObject({ list: 'p', art: 'protest', merged: '', kgb: true });
    expect(item('p2')).toMatchObject({ merged: '', kgb: false });
    expect(item('w1')).toMatchObject({ list: 'w', merged: '', kgb: false });
    expect(idx.counts).toEqual({ m: 0, f: 0, p: 6, w: 1 });
    expect(item('t1').h).toContain('11 верасня 2026');
  });
  it('пошук: «тэрарыст» знаходзіць і запіс МУС з пазнакай, і самастойны запіс КДБ; улінуты запіс схаваны, для спісу назірання — не', () => {
    const ids = (r) => r.map((x) => x.id);
    // t3 — выдалены з пераліку КДБ, не ўліты: у выдачы, з пазнакай «выдалена»
    expect(ids(search(idx.items, ['тэрарыст']))).toEqual(['p1', 't3', 't2']);
    expect(ids(search(idx.items, ['террорист']))).toEqual(['p1', 't3', 't2']);
    expect(ids(search(idx.items, [normalizeCompact('terrorist')]))).toEqual(['p1', 't3', 't2']); // запыт нармалізуецца, як у parseQuery: лацінская i → і
    expect(ids(search(idx.items, ['289']))).toEqual(['t3', 't2']);
    expect(ids(search(idx.items, ['спариш']))).toEqual(['p1']);
    expect(ids(search(idx.items, ['спариш'], { merged: true })).sort()).toEqual(['p1', 't1']);
    expect(ids(search(idx.items, [], { list: 'p' }))).toEqual(['p3', 'p2', 'p1', 't3', 't2']); // без улінутага t1; спачатку з датай, потым па месцы ў індэксе
    expect(countByList(search(idx.items, []), { live: true })).toEqual({ m: 0, f: 0, p: 3, w: 1, all: 4 });
    const [{ fresh }] = checkWatchlist(idx.items, [{ q: 'спариш', seen: ['p1'] }]);
    expect(fresh.map((x) => x.id)).toEqual(['t1']); // з’яўленне ў пераліку КДБ — новае супадзенне
    const d = deriveResults(idx.items, ['попок'], { any: false, list: '', sort: 'newest' });
    expect(d.shown).toEqual({ t: true, w: true }); // самастойны запіс КДБ — не «пералік МУС»
    expect(deriveResults(idx.items, ['спариш'], { any: false, list: '', sort: 'newest' }).shown).toEqual({ p: true, t: true });
  });
  it('«Новае» бачыць і ўлінуты запіс; статыстыка спіса асоб лічыць серыю terror', () => {
    const now = new Date().toISOString().slice(0, 10);
    const s = splitNew(idx.items.map((x) => (x.id === 't1' ? { ...x, added: now } : x)));
    expect(s.added.map((x) => x.id)).toEqual(['t1']);
    const live = idx.items.filter((x) => x.list === 'p' && !x.removed && !x.replacedBy && !x.merged);
    expect(live.map((x) => x.id)).toEqual(['p1', 'p2', 't2']);
    expect(dailyCounts([{ date: '2026-09-11', art: 'terror' }, { date: '2026-09-11', art: 'protest' }], PERSON_SERIES)).toEqual([[Date.parse('2026-09-11'), [1, 0, 0, 1, 0]]]);
  });
  it('фрагменты: запіс КДБ як асоба з src, станам справы і mergedInto; запіс МУС — з kgb; публічная мета з terror', () => {
    expect(chunkRecord(db[4])).toEqual({ id: 't1', list: 'p', src: 'kgb', num: 700, name: 'Спариш Сергей Сергеевич', translit: 'Y', aka: '', citizenship: 'Республика Беларусь', birth: '11.07.1986', basis: db[4].basis, articles: ['289'], status: 'charged', address: 'г. Минск', info: '', since: '2026-09-11', mergedInto: 'p1', also: undefined });
    expect(chunkRecord(db[0]).kgb).toEqual(db[0].kgb);
    expect(chunkRecord(db[1])).not.toHaveProperty('kgb', expect.anything());
    expect(JSON.stringify(chunkRecord(db[1]))).not.toContain('kgb');
    expect(publicMeta({ total: 1 }, {}, {}, {}, { total: 738, sourceDate: '2026-09-11', channel: 'https://t.me/KGB_BY_channel', sourcePage: 'x', sourceFile: 'file:///tmp/x.xlsx' }).terror).toEqual({ total: 738, sourceDate: '2026-09-11', channel: 'https://t.me/KGB_BY_channel' });
  });
  it('RSS: запіс КДБ — катэгорыя пераліку КДБ, версія пераліку, спасылка на запіс МУС для ўлінутага', () => {
    const xml = feed(db.map((x) => (x.list === 't' ? { ...x, added: '2026-09-15' } : x)), { updated: '2026-09-15' }, 'https://elist.test/');
    expect(xml).toContain('<category>Фізічная асоба (пералік КДБ — тэрарыстычная дзейнасць)</category>');
    expect(xml).toContain('<link>https://elist.test/#/r/p1</link><guid isPermaLink="false">t1</guid>');
    expect(xml).toContain('<link>https://elist.test/#/r/t2</link>');
    expect(xml).toContain('У пераліку КДБ з версіі ад 11.09.2026');
    expect(xml).toContain('Ёсць і ў пераліку фізічных асоб МУС');
    expect(xml).not.toContain('11.07.1986');
  });
});

describe('дайджэст і алерты для пераліку КДБ', () => {
  const SITE = 'https://elist.test/';
  const t1 = { ...kgb('t1', 'Спариш Сергей Сергеевич', '11.07.1986'), since: '2026-09-11', added: '2026-09-15', mergedInto: 'p1' };
  const t2 = { ...kgb('t2', 'Попок Артур <Викторович>', '05.05.1969'), added: '2026-09-15', order: 1, basis: 'Вступил в законную силу приговор суда … ч. 4 ст. 295 УК', articles: ['295'] };
  const w = { ...wantedRec, added: '2026-09-15' };
  it('запіс: эмодзі, дата версіі, стан справы, артыкулы; спасылка ўлінутага — на запіс МУС', () => {
    const e = entry(t1, 1, SITE);
    expect(e).toContain('🚫 <b>1.</b> Спариш Сергей Сергеевич');
    expect(e).toContain('<i>11.09.2026 · абвінавачваецца · ст. 289 УК · ёсць у пераліку МУС</i>');
    expect(e).toContain(`<a href="${SITE}#/r/p1">`);
    expect(e).not.toContain('11.07.1986');
    const e2 = entry(t2, 2, SITE);
    expect(e2).toContain('Попок Артур &lt;Викторович&gt;');
    expect(e2).toContain('<i>прысуд · ст. 295 УК</i>');
    expect(e2).toContain(`<a href="${SITE}#/r/t2">`);
    expect(ICON.t).toBe('🚫');
    expect(RANK).toEqual({ m: 0, f: 1, p: 2, t: 3, w: 4 });
  });
  it('шапка: група КДБ, сума па ўсіх спісах без падвойнага ліку (totals.all); парадак — пералік КДБ перад вышукам', () => {
    const totals = { m: 6038, f: 377, p: 6874, t: 738, w: 6680, all: 6038 + 377 + 6874 + 738 + 6680 - 700 };
    expect(digestHeader([t1, t2], { totals })).toBe(`<b>${NAME.t}: +2 новыя запісы</b>\n<i>15 верасня 2026 · у спісе 738, ва ўсіх спісах 20 007</i>`);
    expect(digestHeader([w, t2], { totals })).toBe('<b>Экстрэмісцкія спісы Беларусі: +2 новыя запісы</b>\n<i>15 верасня 2026 · у пераліку КДБ +1, у вышуку РФ +1 · ва ўсіх спісах 20 007</i>');
    expect(digestHeader([t2], { totals: { m: 1, f: 1, p: 1, t: 1, w: 1 } })).toContain('ва ўсіх спісах 5');
    const fresh = selectFresh([w, t2, t1], {}, '2026-09-10');
    expect(fresh.map((x) => x.id)).toEqual(['t1', 't2', 'w1']);
    const { messages } = buildDigest(fresh, { site: SITE, today: '2026-09-15', totals });
    expect(messages[0]).toContain(`\n\n${subheader('t', 2)}\n\n<blockquote>🚫 <b>1.</b>`);
    expect(messages[0]).toContain(`\n\n🔎 <b>${NAME.w}: +1</b>`);
  });
  it('алерты: крыніца ўпала / аднавілася, крок не завяршыўся; парадак — пасля пералікаў МУС, перад вышукам', () => {
    expect(sourceMessages({ curT: { sourceError: 'пакет telegram не ўсталяваны' }, prevT: {} })).toEqual(['⚠️ Пералік КДБ (тэрарыстычная дзейнасць) не абнаўляецца: пакет telegram не ўсталяваны']);
    expect(sourceMessages({ curT: { sourceError: null }, prevT: { sourceError: 'x' } })).toEqual(['✅ Пералік КДБ (тэрарыстычная дзейнасць) зноў абнаўляецца.']);
    expect(sourceMessages({ steps: { terror: 'failure' } })).toEqual(['⚠️ Крок абнаўлення пераліку КДБ (тэрарыстычная дзейнасць) не завяршыўся (таймаўт ці збой да запісу меты).']);
    expect(sourceMessages({ steps: { terror: 'failure' }, curT: { sourceError: 'x' }, prevT: { sourceError: 'x' } })).toEqual([]);
    const msgs = sourceMessages({ curP: { sourceError: 'a' }, curT: { sourceError: 'b' }, curW: { sourceError: 'c' } });
    expect(msgs.map((m) => m.slice(3, 15))).toEqual(['Пералік фізі', 'Пералік КДБ ', 'База вышуку ']);
  });
});

// ---------- рэндэр (SSR, абедзве мовы) ----------
const RECORDS = {
  0: { id: 'p1', list: 'p', num: 10, name: 'Спариш Сергей Сергеевич', translit: 'SPARYSH SIARHEI', citizenship: 'Республика Беларусь', birth: '11.06.1986', basis: 'Вступивший в законную силу приговор суда', articles: ['342'], included: '27.05.2022', date: '2022-05-27', address: 'г. Минск', part: 1, kgb: { id: 't1', num: 700, basis: 'Обвиняется по ст. 289 Уголовного кодекса Республики Беларусь', articles: ['289'], status: 'charged', since: '2026-09-11' } },
  1: { id: 't1', list: 'p', src: 'kgb', num: 700, name: 'Спариш Сергей Сергеевич', translit: 'SPARYSH SIARHEI', aka: '', citizenship: 'Республика Беларусь', birth: '11.07.1986', basis: 'Обвиняется по ст. 289 Уголовного кодекса Республики Беларусь', articles: ['289'], status: 'charged', address: 'г. Минск', info: '', since: '2026-09-11', mergedInto: 'p1' },
  2: { id: 't2', list: 'p', src: 'kgb', num: 729, name: 'Попок Артур Викторович', translit: 'POPOK ARTHUR', aka: 'Попок Артур', citizenship: 'Республика Беларусь', birth: '05.05.1969', basis: 'Обвиняется по ст. 289 Уголовного кодекса Республики Беларусь', articles: ['289'], status: 'charged', address: 'Гродненская обл.', info: 'даведка', also: ['w1'] },
  3: { id: 'p2', list: 'p', num: 11, name: 'Иванов Иван Иванович', translit: 'IVANOU IVAN', citizenship: '', birth: '01.01.1990', basis: 'прысуд', articles: [], included: '', date: '', address: '' },
};
vi.mock('../src/hooks/useRecord.js', () => ({ useRecord: (i) => RECORDS[i] ?? null }));
const ITEMS = [
  { i: 0, id: 'p1', list: 'p', n: 10, date: '2022-05-27', added: '', removed: '', editOf: '', replacedBy: '', art: 'protest', merged: '', kgb: true, h: 'спариш' },
  { i: 1, id: 't1', list: 'p', n: 700, date: '2026-09-11', added: '', removed: '', editOf: '', replacedBy: '', art: 'terror', merged: 'p1', kgb: true, h: 'спариш' },
  { i: 2, id: 't2', list: 'p', n: 729, date: '', added: '', removed: '', editOf: '', replacedBy: '', art: 'terror', merged: '', kgb: true, h: 'попок' },
  { i: 3, id: 'p2', list: 'p', n: 11, date: '', added: '', removed: '', editOf: '', replacedBy: '', art: 'other', merged: '', kgb: false, h: 'иванов' },
];
const META = {
  updated: '2026-09-15', checked: '2026-09-15', checkedAt: '2026-09-15T08:54:44.489Z', sourceError: null, total: 6031,
  persons: { updated: '2026-09-15', checked: '2026-09-15', checkedAt: '2026-09-15T08:56:00.000Z', sourceError: null, total: 6874, files: ['https://mvd.test/part1.doc'] },
  terror: { updated: '2026-09-15', checked: '2026-09-15', checkedAt: '2026-09-15T09:00:00.000Z', sourceError: 'пакет telegram не ўсталяваны', total: 738, sourceDate: '2026-09-11', channel: 'https://t.me/KGB_BY_channel' },
};
let ResultItem, RecordPage, Header, listStamps, Consequences, StatsPage, WhatsNew;
beforeAll(async () => {
  globalThis.location = { href: 'https://elist.test/#/r/t2', hash: '#/r/t2', origin: 'https://elist.test', pathname: '/' };
  globalThis.history = { state: null, replaceState() { } };
  ({ default: ResultItem } = await import('../src/components/ResultItem.jsx'));
  ({ default: RecordPage } = await import('../src/components/RecordPage.jsx'));
  ({ default: Header, listStamps } = await import('../src/components/Header.jsx'));
  ({ default: Consequences } = await import('../src/components/Consequences.jsx'));
  ({ default: StatsPage } = await import('../src/components/StatsPage.jsx'));
  ({ default: WhatsNew } = await import('../src/components/WhatsNew.jsx'));
});
const render = (lang, el) => renderToStaticMarkup(<LangContext.Provider value={{ lang, t: STRINGS[lang], setLang: () => { } }}>{el}</LangContext.Provider>);
const watch = { has: () => false, add() { }, remove() { } };

describe('рэндэр пераліку КДБ у спісе асоб (SSR, абедзве мовы)', () => {
  for (const lang of ['be', 'en']) {
    const t = STRINGS[lang];
    it(`${lang}: карткі — запіс МУС з плашкай «тэрарыст · КДБ», самастойны запіс КДБ з малінавай плашкай, улінуты — са спасылкай на запіс МУС`, () => {
      const [p1, t1, t2, p2] = ITEMS.map((it) => render(lang, <ResultItem item={it} tokens={[]} chunkSize={200} />));
      expect(`${p1}${t1}${t2}${p2}`).not.toMatch(/undefined|\[object Object\]|NaN/);
      expect(p1).toContain('class="item person"');
      expect(p1).toContain(`class="type person" title="${t.personTitle('protest')}"`);
      expect(p1).toContain(`class="type terror" title="${t.terrorTagTitle}">${t.terrorTag}<`);
      expect(t2).toContain('class="item person terror"');
      expect(t2).toContain(`class="type terror" title="${t.personTitle('terror')}">${t.personLabel('terror')}<`);
      expect(t2).not.toContain(t.terrorTag + '<'); // самастойны запіс — без другой плашкі
      expect(t2).toContain('POPOK ARTHUR · Попок Артур');
      expect(t2).toContain(`${t.born} 05.05.1969 · Республика Беларусь`);
      expect(t2).toContain('Обвиняется по ст. 289');
      expect(t2).toContain(`href="#/r/w1">↔ ${t.alsoInWanted}`);
      expect(t2).toContain(`href="#/r/t2">${t.openRec}</a>`); // без даты — спасылка «Адкрыць запіс»
      expect(t1).toContain(`class="mvd" href="#/r/p1">↔ ${t.alsoInPersons}</a>`);
      expect(t1).toContain(`title="${t.sinceTitle}">11.09.2026</a>`);
      expect(p2).not.toContain('terror');
    });
    it(`${lang}: старонка запісу — самастойны запіс КДБ з палямі і крыніцай; улінуты — з заўвагай; запіс МУС — з палямі пераліку КДБ`, () => {
      const t2 = render(lang, <RecordPage id="t2" items={ITEMS} chunkSize={200} watch={watch} meta={META} />);
      expect(t2).not.toMatch(/undefined|\[object Object\]|NaN/);
      expect(t2).toContain(t.recTitleT);
      for (const k of [t.recBirth, t.recCitizenship, t.recArticles, t.recStatusT, t.recAddressP, t.recAliases, t.recInfo, t.recNumT, t.recSinceT, t.recSourceT]) expect(t2).toContain(`<dt>${k}</dt>`);
      expect(t2).toContain(`<dd>${t.statusT.charged}</dd>`);
      expect(t2).toContain('<dd>№729</dd>');
      expect(t2).toContain(`<dd>${t.recSinceUnknown}</dd>`);
      expect(t2).toContain('href="https://www.kgb.by/ru/perechen-inf-ru/"');
      expect(t2).toContain('class="crime terror"');
      expect(t2).not.toContain('class="crime person"');
      expect(t2).not.toContain(t.recMerged);
      const t1 = render(lang, <RecordPage id="t1" items={ITEMS} chunkSize={200} watch={watch} meta={META} />);
      expect(t1).toContain(`${t.recMerged} <a href="#/r/p1">${t.recOpenPersons}</a>`);
      expect(t1).toContain('<dd>11.09.2026</dd>');
      const p1 = render(lang, <RecordPage id="p1" items={ITEMS} chunkSize={200} watch={watch} meta={META} />);
      expect(p1).toContain(t.recTitleP);
      expect(p1).toContain(`<dt>${t.recKgb}</dt><dd>№700 · ${t.statusT.charged} · ст. 289 УК</dd>`);
      expect(p1).toContain(`<dt>${t.recKgbBasis}</dt>`);
      expect(p1).toContain(`<dt>${t.recSinceT}</dt><dd>11.09.2026</dd>`);
      expect(p1).toContain('Part 1 (.doc)'.replace('Part 1', lang === 'be' ? 'Частка 1' : 'Part 1'));
      expect(p1).toContain('class="crime person"');
      expect(p1).toContain('class="crime terror"');
    });
    it(`${lang}: шапка — дата пераліку КДБ з версіяй і папярэджанне; наступствы; статыстыка з серыяй terror; «Новае»`, () => {
      const { lists } = listStamps(META, t, lang);
      expect(lists.map((l) => l.key)).toEqual(['m', 'p', 't']);
      expect(lists[2]).toMatchObject({ label: t.terrorChecked, sub: t.terrorSource('11.09.2026') });
      const header = render(lang, <Header meta={META} online onHelp={() => { }} />);
      expect(header).toContain(t.terrorDown('15.09.2026'));
      const cons = render(lang, <Consequences terror />);
      expect(cons).toContain('class="crime terror"');
      expect(cons).toContain(t.terrorNote.slice(0, 40));
      const stats = render(lang, <StatsPage items={ITEMS} initialList="p" />);
      expect(stats).toContain(t.series.terror);
      expect(stats).toContain('s-terror');
      // лічбы па пераліку КДБ: t1 зліты з запісам МУС, t2 асобны без даты
      expect(stats).toContain(`<p class="hint">${t.statsKgbP(2, 1, 1)}</p>`);
      // без запісаў пераліку КДБ радка няма
      expect(render(lang, <StatsPage items={ITEMS.filter((x) => x.art !== 'terror')} initialList="p" />)).not.toContain(t.statsKgbP(2, 1, 1).slice(0, 20));
      const now = new Date().toISOString().slice(0, 10);
      const fresh = render(lang, <WhatsNew items={ITEMS.map((x) => ({ ...x, added: now }))} chunkSize={200} lists={{ p: true }} />);
      expect(fresh).toContain('class="item person terror"');
      expect(fresh).toContain(`↔ ${t.alsoInPersons}`); // улінуты запіс бачны ў «Новым» са спасылкай
    });
  }
});
