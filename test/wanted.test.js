import { describe, it, expect } from 'vitest';
import zlib from 'node:zlib';
import { findDataUrl, findWidgetBundle, isWantedEdit, mergeWanted, parseWanted, wantedId } from '../scripts/parse-wanted.mjs';
import { decodeBody } from '../scripts/update-wanted.mjs';
import { CHUNK, chunkRecord, dict, feed, indexRow, linkLists } from '../scripts/index-rows.mjs';
import { buildDigest, digestHeader, entry, icon, title } from '../scripts/digest.mjs';
import { sourceMessages } from '../scripts/alert-logic.mjs';
import { AGENCY_KEY, UNDATED, WANTED_SERIES, isIsoDate, mediazonaRecordUrl, parseWantedDate, personName, wantedSeries, wantedTypeLabel } from '../src/lib/wanted.js';
import { parseIndex } from '../src/lib/api.js';
import { countByList, search } from '../src/lib/search.js';
import { SERIES_BY_LIST, dailyCounts } from '../src/lib/stats.js';
import { isRecent } from '../src/lib/format.js';
import { splitNew } from '../src/lib/whatsnew.js';
import { normalizeCompact } from '../src/lib/normalize.js';

// узор JSON Медыязоны: жывы запіс, выключаны (s = 2) з прыблізнай датай, свежы (s = 1) з іншым напісаннем і паўторным
// абвяшчэннем, запіс з рэдакцыйнай катэгорыяй і ініцыятарам КДК
const SRC = [
  { n: 'АБАДОВСКАЯ ЮЛИЯ ЛЕОНИДОВНА', d: 1993, v: 'БЕЛАРУСКА', r: 'Минская область', dp: 'МВД', w: '2024-07-16' },
  { n: 'АБЕЛЕВ НИКОЛАЙ НИКОЛАЕВИЧ', d: 1975, v: 'БЕЛАРУС', s: 2, w: '<2026-05' },
  { n: 'АРЕФЬЕВ СЕРГЕЙ ГЕОРГИЕВИЧ', d: 1977, v: 'БЕЛАРУС', a: ['ШАХЛОВИЧ СЕРГЕЙ ГЕОРГИЕВИЧ'], r: 'Россия', w: '2025-02-12', w0: '2024-12-28', s: 1 },
  { n: 'АЛЕКСАШЕНКО СЕРГЕЙ ВЛАДИМИРОВИЧ', d: 1959, v: 'РУССКИЙ', c: 'экономист', t: 5, r: 'Минск', dp: 'КГК', rf: 'terr', w: '2025-05-30', w0: '<2020' },
];
const clone = (x) => JSON.parse(JSON.stringify(x));

describe('wanted.js — агульная логіка', () => {
  it('даты: дакладная, прыблізная «да …», чужы фармат', () => {
    expect(parseWantedDate('2026-08-28')).toEqual({ date: '2026-08-28', before: '' });
    expect(parseWantedDate('<2026-05')).toEqual({ date: '', before: '2026-05' });
    expect(parseWantedDate('<2020')).toEqual({ date: '', before: '2020' });
    expect(parseWantedDate('<2025-08-06')).toEqual({ date: '', before: '2025-08-06' });
    expect(parseWantedDate('')).toEqual({ date: '', before: '' });
    expect(parseWantedDate('2026-8-1')).toEqual({ date: '', before: '' });
    expect(parseWantedDate(null)).toEqual({ date: '', before: '' });
    expect(isIsoDate('2026-08-28')).toBe(true);
    expect(isIsoDate(UNDATED)).toBe(false);
  });
  it('імя вялікімі → звычайны рэгістр, даўжыня не мяняецца (для падсветкі)', () => {
    expect(personName('АБАЗОВИК-ДАЛИДОВИЧ ПАВЕЛ АЛЕКСАНДРОВИЧ')).toBe('Абазовик-Далидович Павел Александрович');
    expect(personName('АБДУРАШИДОВ АБДУРАУФ ШУХРАТ ОГЛЫ')).toBe('Абдурашидов Абдурауф Шухрат Оглы');
    expect(personName("О'НИЛ ДЖОН")).toBe("О'Нил Джон");
    expect(personName('БЕЛАРУСКА')).toBe('Беларуска');
    expect(personName('')).toBe('');
    for (const s of ['ЁЛКИН ПЁТР', 'X Y', 'ІВАНОЎ ІВАН']) expect(personName(s)).toHaveLength(s.length);
  });
  it('серыі па ведамстве і подпіс тыпу для індэкса', () => {
    expect(WANTED_SERIES).toEqual(['wmvd', 'wkgk', 'wkgb', 'wother']);
    expect(SERIES_BY_LIST.w).toBe(WANTED_SERIES);
    expect(['МВД', 'КГК', 'КГБ', 'ДИН', 'ГПК', ''].map(wantedSeries)).toEqual(['wmvd', 'wkgk', 'wkgb', 'wother', 'wother', 'wother']);
    expect(Object.keys(AGENCY_KEY)).toEqual(['МВД', 'КГК', 'КГБ']);
    expect(wantedTypeLabel('МВД')).toBe('Розыск РФ по запросу МВД');
    expect(wantedTypeLabel('')).toBe('Розыск РФ');
  });
  it('removed без даты — не «нядаўна выдалены»: у «Новае» не трапляе', () => {
    expect(isRecent(UNDATED)).toBe(false);
    const s = splitNew([{ i: 0, id: 'w1', list: 'w', added: null, removed: UNDATED }, { i: 1, id: 'w2', list: 'w', added: new Date().toISOString().slice(0, 10) }]);
    expect(s.removed).toEqual([]);
    expect(s.added.map((x) => x.id)).toEqual(['w2']);
  });
});

describe('parseWanted', () => {
  const stats = {};
  const items = parseWanted(SRC, stats);
  it('раскладвае палі: імя, год, нацыянальнасць, рэгіён, ведамства, даты, псеўданімы, катэгорыя, статус', () => {
    expect(items).toHaveLength(4);
    expect(items[0]).toMatchObject({ name: 'АБАДОВСКАЯ ЮЛИЯ ЛЕОНИДОВНА', year: 1993, nationality: 'БЕЛАРУСКА', region: 'Минская область', agency: 'МВД', date: '2024-07-16', before: '', first: '', category: '', rf: '', out: false });
    expect(items[0]).not.toHaveProperty('aliases');
    expect(items[1]).toMatchObject({ year: 1975, region: '', agency: '', date: '', before: '2026-05', out: true });
    expect(items[2]).toMatchObject({ aliases: ['ШАХЛОВИЧ СЕРГЕЙ ГЕОРГИЕВИЧ'], region: 'Россия', date: '2025-02-12', first: '2024-12-28', out: false });
    expect(items[3]).toMatchObject({ agency: 'КГК', category: 'экономист', rf: 'terr', first: '<2020' });
    expect(stats).toEqual({ skipped: 0, approx: 1, out: 1, fresh: 1 });
  });
  it('id — ад імя і года праз замарожаную нармалізацыю: рэгістр, прабелы і «ё» не мяняюць, год — мяняе', () => {
    expect(items[0].id).toBe(wantedId('абадовская  юлия леонидовна', 1993));
    expect(wantedId('ЁЛКИН ПЁТР', 1990)).toBe(wantedId('Елкин Петр', 1990));
    expect(wantedId('ЁЛКИН ПЁТР', 1990)).not.toBe(wantedId('ЁЛКИН ПЁТР', 1991));
    expect(items[0].id).toMatch(/^[0-9a-f]{12}$/);
  });
  it('чужыя ці сапсаваныя запісы прапускаюцца і лічацца, палі абразаюцца; не масіў — памылка', () => {
    const st = {};
    const out = parseWanted([null, 'x', { n: '', d: 1990 }, { n: 'IVAN LATIN', d: 1990 }, { n: 'ИВАНОВ ИВАН', d: '1990' }, { n: 'ИВАНОВ ИВАН', d: 1800 }, { n: 'ИВАНОВ ИВАН', d: 1990.5 },
      { n: `ДОЎГІ ${'А'.repeat(300)}`, d: 1990, a: Array.from({ length: 15 }, (_, i) => `ПСЕЎДАНІМ ${i}`), r: 'Р'.repeat(200), rf: 'xxx', c: 5, w: 'учора' }], st);
    expect(st.skipped).toBe(6);
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ name: 'ИВАНОВ ИВАН', year: 1990 }); // год радком — прымаецца як лік
    expect(out[1].name).toHaveLength(120);
    expect(out[1].aliases).toHaveLength(10);
    expect(out[1].region).toHaveLength(60);
    expect(out[1]).toMatchObject({ rf: '', category: '', date: '', before: '' });
    expect(() => parseWanted({ items: [] })).toThrow(/не масіў/);
  });
});

describe('mergeWanted — зліццё з базай', () => {
  const today = '2026-09-07';
  const parsed = () => parseWanted(clone(SRC));
  it('першы імпарт: жывыя без пазнакі «новае», выключаныя — removed без даты; парадак як у крыніцы; паўтор — без змен', () => {
    const r1 = mergeWanted([], parsed(), { today });
    expect(r1).toMatchObject({ added: 3, removed: 0, edited: 0, outAdded: 1, initial: true });
    expect(r1.out.map((x) => x.name.split(' ')[0])).toEqual(['АБАДОВСКАЯ', 'АБЕЛЕВ', 'АРЕФЬЕВ', 'АЛЕКСАШЕНКО']);
    expect(r1.out.map((x) => x.order)).toEqual([0, 1, 2, 3]);
    expect(r1.out.every((x) => x.added === null && !('out' in x))).toBe(true);
    expect(r1.out[1]).toMatchObject({ removed: UNDATED, before: '2026-05' });
    expect(r1.out.filter((x) => x.removed)).toHaveLength(1);
    const r2 = mergeWanted(clone(r1.out), parsed(), { today: '2026-09-08' });
    expect(r2).toMatchObject({ added: 0, removed: 0, edited: 0, outAdded: 0, initial: false });
    expect(r2.out[1].removed).toBe(UNDATED); // выключаны застаецца выключаным без даты, а не «вярнуўся» і не «выдалены сёння»
    expect(r2.out.every((x) => !x.edited)).toBe(true);
  });
  it('далей: новы жывы — added сёння; жывы стаў выключаным — removed сёння; выключаны вярнуўся — жывы; новы адразу выключаны — без даты і не «новы»', () => {
    const db = clone(mergeWanted([], parsed(), { today }).out);
    const next = clone(SRC);
    next[0].s = 2;                                   // Абадоўская выключаная
    delete next[1].s;                                // Абелеў вярнуўся ў вышук
    next.push({ n: 'НОВЫ ЧАЛАВЕК ЖЫВЫ', d: 2000, w: '2026-09-07', dp: 'МВД' });
    next.push({ n: 'НОВЫ ЧАЛАВЕК ВЫКЛЮЧАНЫ', d: 2001, w: '<2026-09', s: 2 });
    const r = mergeWanted(db, parseWanted(next), { today: '2026-09-08' });
    expect(r).toMatchObject({ added: 1, removed: 1, outAdded: 1 });
    const by = (n) => r.out.find((x) => x.name.startsWith(n));
    expect(by('АБАДОВСКАЯ')).toMatchObject({ removed: '2026-09-08', added: null });
    expect(by('АБЕЛЕВ')).not.toHaveProperty('removed');
    expect(by('АБЕЛЕВ').added).toBe(null);
    expect(by('НОВЫ ЧАЛАВЕК ЖЫВЫ')).toMatchObject({ added: '2026-09-08' });
    expect(by('НОВЫ ЧАЛАВЕК ВЫКЛЮЧАНЫ')).toMatchObject({ added: null, removed: UNDATED });
    expect(r.out.map((x) => x.order)).toEqual([0, 1, 2, 3, 4, 5]);
    // палі выключанага абнаўляюцца моўчкі, без edited
    const again = clone(next); again[0].r = 'Гомельская область';
    const r3 = mergeWanted(clone(r.out), parseWanted(again), { today: '2026-09-09' });
    expect(r3).toMatchObject({ added: 0, removed: 0, edited: 0, outAdded: 0 });
    expect(r3.out.find((x) => x.name.startsWith('АБАДОВСКАЯ'))).toMatchObject({ region: 'Гомельская область', removed: '2026-09-08' });
  });
  it('змена поля жывога запісу — праўка моўчкі; выпраўленае напісанне ці год — праўка, а не новы чалавек', () => {
    const db = clone(mergeWanted([], parsed(), { today }).out);
    const next = clone(SRC); next[2].r = 'Минск';
    const r = mergeWanted(db, parseWanted(next), { today: '2026-09-08' });
    expect(r).toMatchObject({ added: 0, removed: 0, edited: 1 });
    expect(r.out[2]).toMatchObject({ region: 'Минск', edited: '2026-09-08', added: null });
    const fixed = clone(SRC); fixed[3].n = 'АЛЕКСАШЕНКО СЕРГЕЙ ВЛАДИМИРОВИЧЬ';
    const e = mergeWanted(clone(db), parseWanted(fixed), { today: '2026-09-08' });
    expect(e).toMatchObject({ added: 0, removed: 0 });
    expect(e.edits).toHaveLength(1);
    const [[old, rec]] = e.edits;
    expect(rec).toMatchObject({ added: null, editOf: old.id, edited: '2026-09-08' });
    expect(old).toMatchObject({ removed: '2026-09-08', replacedBy: rec.id });
    expect(isWantedEdit({ name: 'ИВАНОВ ИВАН', year: 1990 }, { name: 'ИВАНОВ ИВАН', year: 1991 })).toBe(true);
    expect(isWantedEdit({ name: 'ИВАНОВ ИВАН ИВАНОВИЧ', year: 1990 }, { name: 'ИВАНОВА ИВАН ИВАНОВИЧ', year: 1990 })).toBe(true);
    expect(isWantedEdit({ name: 'ИВАНОВ ИВАН', year: 1990 }, { name: 'ПЕТРОВ ПЕТР', year: 1990 })).toBe(false);
    expect(isWantedEdit({ name: 'ИВАНОВ ИВАН', year: 1990 }, { name: 'ИВАНОВА ИВАН', year: 1991 })).toBe(false);
  });
  it('засцярогі: зашмат новых — памылка без force; масавае знікненне — памылка заўсёды; дублі id — застаецца апошні', () => {
    const many = (n) => Array.from({ length: n }, (_, i) => ({ n: `ЧАЛАВЕК ${i} ТЭСТАВІЧ`, d: 1990, w: '2026-01-01' }));
    const db = clone(mergeWanted([], parseWanted(many(100)), { today }).out);
    expect(() => mergeWanted(clone(db), parseWanted(many(104)), { today, maxAdded: 3 })).toThrow(/4 новых запісаў/);
    expect(mergeWanted(clone(db), parseWanted(many(104)), { today, maxAdded: 3, force: true })).toMatchObject({ added: 4 });
    expect(() => mergeWanted(clone(db), parseWanted(many(70)), { today })).toThrow(/30 запісаў знікла/);
    const flipped = many(100).map((x, i) => (i < 30 ? { ...x, s: 2 } : x)); // 30 жывых сталі выключанымі за раз — таксама «знікла»
    expect(() => mergeWanted(clone(db), parseWanted(flipped), { today })).toThrow(/30 запісаў знікла/);
    const dup = mergeWanted([], parseWanted([...many(2), { n: 'ЧАЛАВЕК 1 ТЭСТАВІЧ', d: 1990, w: '2026-02-02', r: 'Россия' }]), { today });
    expect(dup.out).toHaveLength(2);
    expect(dup.out.find((x) => x.name === 'ЧАЛАВЕК 1 ТЭСТАВІЧ')).toMatchObject({ region: 'Россия', date: '2026-02-02' });
  });
});

describe('пошук адраса файла і распакоўка', () => {
  it('бандл віджэта са старонкі (экранаваныя атрыбуты), імя файла даных з бандла', () => {
    const html = 'data-html="&lt;script&gt;window.mz_lang = \'ru\'; window.is_bel = true;&lt;/script&gt;&lt;script src=&quot;https://s3.zona.media/infographics/wanted/index-BNftlPk6.js.br&quot;&gt;&lt;/script&gt;';
    expect(findWidgetBundle(html)).toBe('https://s3.zona.media/infographics/wanted/index-BNftlPk6.js.br');
    expect(findWidgetBundle('<script src="https://s3.zona.media/infographics/wanted/index-Bt2v7PRc.js.gz?t=3">')).toBe('https://s3.zona.media/infographics/wanted/index-Bt2v7PRc.js.gz');
    expect(() => findWidgetBundle('<html></html>')).toThrow(/не знойдзены бандл/);
    const bundle = 'const _=!!window.is_bel,z=_?"data_bel":"data";N=await fetch(`https://s3.zona.media/infographics/wanted/${z}.json.br`)';
    expect(findDataUrl(bundle)).toBe('https://s3.zona.media/infographics/wanted/data_bel.json.br');
    expect(findDataUrl('const E="data_bel";fetch(`https://s3.zona.media/infographics/wanted/${E}.json.gz?cb=2`)')).toBe('https://s3.zona.media/infographics/wanted/data_bel.json.gz');
    expect(() => findDataUrl('fetch(`https://s3.zona.media/infographics/wanted/${z}.json.br`)')).toThrow(/data_bel/);
    expect(() => findDataUrl('nothing')).toThrow(/data_bel/);
  });
  it('decodeBody: звычайны JSON, gzip, brotli', () => {
    const json = JSON.stringify(SRC);
    expect(decodeBody(Buffer.from(json))).toBe(json);
    expect(decodeBody(Buffer.from(`  ${json}`))).toBe(`  ${json}`);
    expect(decodeBody(zlib.gzipSync(Buffer.from(json)))).toBe(json);
    expect(decodeBody(zlib.brotliCompressSync(Buffer.from(json)))).toBe(json);
  });
});

describe('індэкс, фрагменты, крос-спасылкі', () => {
  const today = '2026-09-07';
  const wanted = mergeWanted([], parseWanted(clone(SRC)), { today }).out.map((x) => ({ ...x, list: 'w' }));
  const person = { id: 'p1', list: 'p', num: 7, name: 'Абадовская Юлия Леонидовна', translit: 'ABADOUSKAYA YULIYA', citizenship: 'Республика Беларусь', birth: '01.02.1993', basis: 'приговор суда', court: 'суда', articles: ['342'], included: '23.03.2022', date: '2022-03-23', address: '', info: '' };
  const personAlias = { ...person, id: 'p2', name: 'Шахлович Сергей Георгиевич', birth: '05.05.1977' };
  const personRemoved = { ...person, id: 'p3', name: 'Абелев Николай Николаевич', birth: '01.01.1975' };
  it('linkLists: імя + год (і псеўданім) → also у абодва бакі; выключаныя і старыя версіі не звязваюцца', () => {
    const w = clone(wanted), ps = clone([person, personAlias, personRemoved, { ...person, id: 'p4', replacedBy: 'p1' }]);
    const db = [...ps, ...w];
    const pairs = linkLists(db);
    expect(pairs).toBe(2);
    expect(ps[0].also).toEqual([w[0].id]);
    expect(w[0].also).toEqual(['p1']);
    expect(ps[1].also).toEqual([w[2].id]); // праз іншае напісанне імя ў базе вышуку
    expect(w[2].also).toEqual(['p2']);
    expect(ps[2]).not.toHaveProperty('also'); // Абелеў у вышуку выключаны
    expect(w[1]).not.toHaveProperty('also');
    expect(ps[3]).not.toHaveProperty('also');
    // паўторная зборка перазапісвае: запіс выбыў — also знікае і ў яго, і ў пары
    w[0].removed = '2026-09-08';
    expect(linkLists(db)).toBe(1);
    expect(ps[0]).not.toHaveProperty('also');
    expect(w[0]).not.toHaveProperty('also');
    expect(w[2].also).toEqual(['p2']);
  });
  it('indexRow: імя, псеўданім і год у радку — без нацыянальнасці; тып — ведамства, суд — рэгіён; спіс 3, серыя, № 0', () => {
    const dicts = { types: dict(), courts: dict() };
    const rows = wanted.map((x) => indexRow(x, dicts));
    expect(rows[0][5]).toBe(normalizeCompact('АБАДОВСКАЯ ЮЛИЯ ЛЕОНИДОВНА\n1993'));
    expect(rows[0][5]).not.toMatch(/беларуска/);
    expect(rows[2][5]).toContain('шахлович');
    expect(dicts.types.list()[rows[0][0]]).toBe('розыск рф по запросу мвд');
    expect(dicts.types.list()[rows[1][0]]).toBe('розыск рф');
    expect(dicts.courts.list()[rows[0][1]]).toBe('минская область');
    expect(rows[0].slice(2, 5)).toEqual(['2024-07-16', '', '']);
    expect(rows[1].slice(2, 5)).toEqual(['', '', UNDATED]); // прыблізная дата — не ў індэкс; выключаны без даты
    expect(rows[0].slice(6)).toEqual([wanted[0].id, 1, '', '', 3, 0]);
    expect(rows[3][7]).toBe(2); // КДК
    expect(rows[1][7]).toBe(0);
    const idx = parseIndex({ chunk: CHUNK, types: dicts.types.list(), courts: dicts.courts.list(), dates: {}, items: rows });
    expect(idx.items.map((x) => x.list)).toEqual(['w', 'w', 'w', 'w']);
    expect(idx.items.map((x) => x.art)).toEqual(['wmvd', 'wother', 'wother', 'wkgk']);
    expect(idx.items.map((x) => x.n)).toEqual([null, null, null, null]);
    expect(idx.counts).toEqual({ m: 0, f: 0, p: 0, w: 4 });
    expect(idx.items[0].h).toContain('розыск рф по запросу мвд');
    expect(idx.items[0].h).toContain('минская область');
    expect(idx.items[1].removed).toBe(UNDATED);
    // пошук і лічыльнікі
    expect(search(idx.items, ['шахлович']).map((x) => x.id)).toEqual([wanted[2].id]);
    expect(search(idx.items, ['1993'], { list: 'w' })).toHaveLength(1);
    expect(countByList(idx.items)).toEqual({ m: 0, f: 0, p: 0, w: 4, all: 4 });
    expect(countByList(idx.items, { live: true }).w).toBe(3);
    expect(dailyCounts(idx.items.filter((x) => !x.removed), SERIES_BY_LIST.w)).toEqual([[Date.parse('2024-07-16'), [1, 0, 0, 0]], [Date.parse('2025-02-12'), [0, 0, 0, 1]], [Date.parse('2025-05-30'), [0, 1, 0, 0]]]);
  });
  it('chunkRecord: усе палі карткі і also; feed: імя ў звычайным рэгістры, без года нараджэння', () => {
    const c = chunkRecord({ ...wanted[2], also: ['p2'], added: today, order: 2 });
    expect(c).toEqual({ id: wanted[2].id, list: 'w', name: wanted[2].name, aliases: ['ШАХЛОВИЧ СЕРГЕЙ ГЕОРГИЕВИЧ'], year: 1977, nationality: 'БЕЛАРУС', region: 'Россия', agency: '', date: '2025-02-12', before: '', first: '2024-12-28', category: '', rf: '', also: ['p2'] });
    expect(chunkRecord({ ...person, also: ['w1'] }).also).toEqual(['w1']);
    const xml = feed([{ ...wanted[0], added: today }, { ...wanted[1], added: today }], { updated: today }, 'https://elist.test/');
    expect(xml).toContain('<title>Абадовская Юлия Леонидовна</title>');
    expect(xml).toContain('<category>Вышук РФ (база МУС РФ паводле Медыязоны)</category>');
    expect(xml).toContain('Па запыце: МВД, Минская область');
    expect(xml).toContain('Абвешчаны ў вышук: 16.07.2024');
    expect(xml).not.toContain('1993');
    expect(xml).not.toContain('АБЕЛЕВ'); // выключаны — не ў стужцы
  });
});

describe('дайджэст і алерты для чацвёртага спіса', () => {
  const SITE = 'https://elist.itbeard.com/';
  const w = { id: 'w1', list: 'w', name: 'АБАДОВСКАЯ ЮЛИЯ <ЛЕОНИДОВНА>', year: 1993, nationality: 'БЕЛАРУСКА', region: 'Минская область', agency: 'МВД', date: '2024-07-16', added: '2026-09-07', order: 0 };
  const p = { id: 'p1', list: 'p', name: 'Ковалевский Николай', articles: ['342'], court: 'суда Быховского района', date: '2022-03-23', added: '2026-09-07' };
  it('эмодзі, назва ў звычайным рэгістры, радок мэты без года нараджэння', () => {
    expect(icon(w)).toBe('🔎');
    expect(title(w)).toBe('Абадовская Юлия <Леонидовна>');
    const e = entry(w, 1, SITE);
    expect(e).toContain('🔎 <b>1.</b> Абадовская Юлия &lt;Леонидовна&gt;');
    expect(e).toContain('<i>16.07.2024 · 🔎 па запыце МВД · Минская область</i>');
    expect(e).not.toContain('1993');
    expect(e).not.toContain('БЕЛАРУСКА');
    expect(entry({ ...w, date: '', agency: '', region: '' }, 2, SITE)).toContain('<i>🔎 база вышуку МУС РФ</i>');
  });
  it('шапка: асобная для вышуку, у змяшанай — лічба; падзагаловак у змяшаным дайджэсце', () => {
    expect(digestHeader([w], { total: 1 })).toBe('🔎 <b>База вышуку МУС РФ па беларусах (паводле Медыязоны): +1 новы запіс</b>\n<i>7 верасня 2026</i>');
    expect(digestHeader([p, w], { total: 6038 })).toBe('🔴 <b>Экстрэмісцкія спісы: +2 новыя запісы</b>\n<i>7 верасня 2026 · асоб +1, у вышуку РФ +1</i>');
    const mixed = buildDigest([p, w], { site: SITE, today: '2026-09-07', total: 1 });
    expect(mixed.messages[0]).toContain('\n\n🔎 <b>База вышуку МУС РФ: беларусы (паводле Медыязоны)</b> — ');
    expect(mixed.ids).toEqual([['p1', 'w1']]);
    expect(buildDigest([w], { site: SITE, today: '2026-09-07', total: 1 }).messages[0]).not.toContain('(паводле Медыязоны)</b> — ');
  });
  it('алерты: крыніца ўпала / аднавілася, крок не завяршыўся', () => {
    expect(sourceMessages({ curW: { sourceError: 'HTTP 404' }, prevW: {} })).toEqual(['⚠️ База вышуку РФ (Медыязона) не абнаўляецца: HTTP 404']);
    expect(sourceMessages({ curW: { sourceError: null }, prevW: { sourceError: 'x' } })).toEqual(['✅ База вышуку РФ (Медыязона) зноў абнаўляецца.']);
    expect(sourceMessages({ steps: { wanted: 'failure' } })).toEqual(['⚠️ Крок абнаўлення базы вышуку РФ (Медыязона) не завяршыўся (таймаўт ці збой да запісу меты).']);
    expect(sourceMessages({ steps: { wanted: 'failure' }, curW: { sourceError: 'x' }, prevW: { sourceError: 'x' } })).toEqual([]);
    expect(sourceMessages({ curW: { sourceError: 'a' }, prevW: { sourceError: 'b' } })).toEqual([]);
  });
});

describe('mediazonaRecordUrl: спасылка на запіс у віджэце Медыязоны', () => {
  it('імя ў ніжнім рэгістры (віджэт параўноўвае словы з адраса як ёсць), прабелы сціснутыя, кадаванне URL', () => {
    expect(mediazonaRecordUrl('https://m.test/a', 'АБАДОВСКАЯ  ЮЛИЯ ЛЕОНИДОВНА ')).toBe(`https://m.test/a?q=${encodeURIComponent('абадовская юлия леонидовна')}`);
    expect(mediazonaRecordUrl('https://m.test/a', 'ЁЛКИН-ТЭСТ Ё')).toBe(`https://m.test/a?q=${encodeURIComponent('ёлкин-тэст ё')}`);
    expect(mediazonaRecordUrl('https://m.test/a', '')).toBe('https://m.test/a?q=');
    expect(mediazonaRecordUrl('https://m.test/a', null)).toBe('https://m.test/a?q=');
  });
});
