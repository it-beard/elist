import { describe, it, expect } from 'vitest';
import { deriveResults, summarize, runSearch } from '../src/lib/results.js';
import { countByList } from '../src/lib/search.js';
import { parseQuery } from '../src/lib/normalize.js';

// індэкс трох спісаў: h — нармалізаваны радок для пошуку
const ITEMS = [
  { i: 0, id: 'm1', list: 'm', date: '2026-01-01', h: 'telegram-канал "свабода"' },
  { i: 1, id: 'm2', list: 'm', date: '2025-01-01', removed: '2026-08-01', h: 'газета свабода' },
  { i: 2, id: 'f1', list: 'f', date: '2026-02-01', h: 'экстремистское формирование «свабода»' },
  { i: 3, id: 'p1', list: 'p', date: '2026-03-01', h: 'свабоду іван іванавіч\nsvabodu ivan\n01.01.1990\nст. 342 ук' },
  { i: 4, id: 'p2', list: 'p', date: '2026-03-02', h: 'іншы чалавек\nст. 130 ук' },
  { i: 5, id: 'old', list: 'm', date: '2020-01-01', replacedBy: 'm1', h: 'свабода старая версія' },
];
const OPTS = { any: false, sort: 'newest', list: '' };
const q = (s) => parseQuery(s);

describe('countByList', () => {
  it('лічыць па спісах, невядомы спіс — матэрыялы; live — без выдаленых', () => {
    expect(countByList(ITEMS)).toEqual({ m: 3, f: 1, p: 2, w: 0, all: 6 });
    expect(countByList(ITEMS, { live: true })).toEqual({ m: 2, f: 1, p: 2, w: 0, all: 5 });
    expect(countByList([{ h: '' }, { list: 'zzz', h: '' }])).toEqual({ m: 2, f: 0, p: 0, w: 0, all: 2 });
    expect(countByList([])).toEqual({ m: 0, f: 0, p: 0, w: 0, all: 0 });
  });
});

describe('deriveResults — выдача, укладкі-спісы, фільтр', () => {
  it('без запыту: усе жывыя запісы, лічбы на ўкладках — колькі ў базе (без выдаленых і старых версій)', () => {
    const d = deriveResults(ITEMS, [], OPTS);
    expect(d.searching).toBe(false);
    expect(d.results.map((x) => x.id)).toEqual(['p2', 'p1', 'f1', 'm1', 'm2']);
    expect(d.facetCounts).toEqual({ m: 1, f: 1, p: 2, w: 0, all: 4 });
    expect(d.live).toEqual(d.facetCounts);
    expect(summarize(d)).toEqual({ kind: 'total', n: 4 });
  });
  it('з запытам: пошук па ўсіх спісах, лічбы — колькі знойдзена ў кожным (уключна з выдаленымі)', () => {
    const d = deriveResults(ITEMS, q('свабода'), OPTS);
    expect(d.results.map((x) => x.id)).toEqual(['f1', 'm1', 'm2']);
    expect(d.facetCounts).toEqual({ m: 2, f: 1, p: 0, w: 0, all: 3 });
    expect(d.shown).toEqual({ m: true, f: true });
    expect(summarize(d)).toEqual({ kind: 'found', n: 3 });
  });
  it('абраны спіс: паказваем толькі яго, лічбы застаюцца з поўнай выдачы, зводка — агульная', () => {
    const d = deriveResults(ITEMS, q('свабода'), { ...OPTS, list: 'f' });
    expect(d.list).toBe('f');
    expect(d.results.map((x) => x.id)).toEqual(['f1']);
    expect(d.facetCounts.all).toBe(3);
    expect(d.shown).toEqual({ f: true });
    expect(summarize(d)).toEqual({ kind: 'found', n: 3 });
  });
  it('у абраным спісе дакладных няма — прыблізны пошук у межах спіса; зводка кажа пра прыблізныя', () => {
    const d = deriveResults(ITEMS, q('свабода'), { ...OPTS, list: 'p' });
    expect(d.mode).toBe('fuzzy');
    expect(d.results.map((x) => x.id)).toEqual(['p1']); // «свабоду» ~ «свабода» (1 літара)
    expect(d.all.mode).toBe('exact');
    expect(summarize(d)).toEqual({ kind: 'fuzzy', n: 1 });
  });
  it('абраны спіс пусты, а поўная выдача прыблізная — зводка не кажа «знойдзена»', () => {
    const d = deriveResults(ITEMS, q('свабоза'), { ...OPTS, list: 'p' }); // «свабоза» ~ «свабода» (m/f), да «свабоду» — 2 літары
    expect(d.all.mode).toBe('fuzzy');
    expect(d.results).toEqual([]);
    expect(summarize(d)).toEqual({ kind: 'fuzzy', n: d.all.results.length });
    expect(d.all.results.length).toBeGreaterThan(0);
  });
  it('нічога няма ні дакладна, ні прыблізна — «нічога»; без індэкса — пустая выдача', () => {
    const d = deriveResults(ITEMS, q('qwertyuiop'), OPTS);
    expect(d.results).toEqual([]);
    expect(summarize(d)).toEqual({ kind: 'nothing', n: 0 });
    const none = deriveResults(null, q('свабода'), { ...OPTS, list: 'p' });
    expect(none.results).toEqual([]);
    expect(none.facetCounts.all).toBe(0);
  });
  it('без запыту з абраным спісам — толькі гэты спіс, лічбы «колькі ў базе»', () => {
    const d = deriveResults(ITEMS, [], { ...OPTS, list: 'p' });
    expect(d.results.map((x) => x.id)).toEqual(['p2', 'p1']);
    expect(summarize(d)).toEqual({ kind: 'total', n: 4 });
  });
  it('«любое са слоў» і сартаванне даходзяць да пошуку', () => {
    const any = deriveResults(ITEMS, q('газета формирование'), { ...OPTS, any: true });
    expect(any.results.map((x) => x.id)).toEqual(['f1', 'm2']);
    expect(deriveResults(ITEMS, q('газета формирование'), OPTS).results).toEqual([]);
    expect(deriveResults(ITEMS, [], { ...OPTS, sort: 'source' }).results.map((x) => x.id)).toEqual(['m1', 'm2', 'f1', 'p1', 'p2']);
  });
});

describe('runSearch', () => {
  it('дакладна → exact; толькі падобныя → fuzzy з пашыранымі токенамі; нічога → exact і пуста', () => {
    expect(runSearch(ITEMS, ['свабода'], OPTS).mode).toBe('exact');
    const fz = runSearch(ITEMS, ['свабоза'], OPTS);
    expect(fz.mode).toBe('fuzzy');
    expect(fz.hl[0].length).toBeGreaterThan(1);
    expect(runSearch(ITEMS, ['qwertyuiop'], OPTS)).toMatchObject({ mode: 'exact', results: [] });
  });
});
