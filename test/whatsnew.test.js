import { describe, it, expect } from 'vitest';
import { splitNew, groupByDate, inList, newCounts, FALLBACK } from '../src/lib/whatsnew.js';
import { NEW_DAYS } from '../src/lib/format.js';

const day = (n) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
const ITEMS = [
  { i: 0, id: 'm1', list: 'm', date: '2026-09-04', added: day(1), h: 'матэрыял 1' },
  { i: 1, id: 'f1', list: 'f', date: '2026-09-04', added: day(1), h: 'фарміраванне 1' },
  { i: 2, id: 'p1', list: 'p', date: '2026-09-03', added: day(2), h: 'асоба 1' },
  { i: 3, id: 'p2', list: 'p', date: '2026-08-25', added: '', removed: day(3), h: 'асоба выдаленая' },
  { i: 4, id: 'm2', list: 'm', date: '2026-01-01', added: day(NEW_DAYS + 5), h: 'даўно' },
  { i: 5, id: 'old', list: 'm', date: '2026-01-01', added: day(1), replacedBy: 'm1', h: 'старая версія' },
  { i: 6, id: 'm3', list: 'm', date: '2026-02-01', added: day(1), removed: day(1), h: 'дадаўся і знік' },
];

describe('splitNew / groupByDate / newCounts', () => {
  const split = splitNew(ITEMS);
  it('дададзеныя і зніклыя за акно, без старых версій выпраўленых; зніклыя — найноўшыя спачатку', () => {
    expect(split.added.map((x) => x.id)).toEqual(['m1', 'f1', 'p1', 'm3']);
    expect(split.removed.map((x) => x.id)).toEqual(['m3', 'p2']);
    expect(split.fallback).toBe(null);
  });
  it('групы па даце з’яўлення, найноўшыя спачатку, у групе — па індэксе ўніз; фільтр па спісе', () => {
    const g = groupByDate(split.added);
    expect(g.map(([d, l]) => [d, l.map((x) => x.id)])).toEqual([[day(1), ['m3', 'f1', 'm1']], [day(2), ['p1']]]);
    expect(groupByDate(split.added, 'p').map(([d, l]) => [d, l.map((x) => x.id)])).toEqual([[day(2), ['p1']]]);
    expect(groupByDate(split.added, 'f')).toHaveLength(1);
    expect(inList(split.removed, 'p').map((x) => x.id)).toEqual(['p2']);
    expect(inList(split.removed, '')).toBe(split.removed);
  });
  it('лічбы на ўкладках для дададзеных і зніклых', () => {
    expect(newCounts(split)).toEqual({ added: { m: 2, f: 1, p: 1, w: 0, all: 4 }, removed: { m: 1, f: 0, p: 1, w: 0, all: 2 } });
  });
  it('без гісторыі з’яўлення — fallback: апошнія па даце рашэння, не болей за FALLBACK', () => {
    const noHistory = Array.from({ length: 100 }, (_, i) => ({ i, id: `x${i}`, list: 'm', date: `2026-01-${String((i % 28) + 1).padStart(2, '0')}`, added: '', h: '' }));
    const s = splitNew(noHistory);
    expect(s.added).toEqual([]);
    expect(s.fallback).toHaveLength(FALLBACK);
    expect(s.fallback[0].date >= s.fallback[1].date).toBe(true);
    expect(splitNew([])).toEqual({ added: [], removed: [], fallback: [] });
  });
});
