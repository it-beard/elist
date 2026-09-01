import { describe, it, expect } from 'vitest';
import { floorTo, nextOf, dailyCounts, buckets, trend, pickGrain, niceTicks, clampRange, summary, DAY } from '../src/lib/stats.js';

const T = (s) => Date.parse(s);

describe('stats', () => {
  it('floorTo: тыдзень з панядзелка, квартал, год', () => {
    expect(floorTo(T('2026-08-30'), 'week')).toBe(T('2026-08-24')); // нядзеля → панядзелак
    expect(floorTo(T('2026-08-24'), 'week')).toBe(T('2026-08-24'));
    expect(floorTo(T('2026-08-30'), 'quarter')).toBe(T('2026-07-01'));
    expect(floorTo(T('2026-08-30'), 'year')).toBe(T('2026-01-01'));
    expect(nextOf(T('2026-12-01'), 'month')).toBe(T('2027-01-01'));
  });
  const items = [
    { date: '2026-08-26', art: 'kgs' }, { date: '2026-08-26', art: 'kgs' },
    { date: '2026-08-20', art: 'gpk' }, { date: '2026-07-03', art: 'none' }, { date: '', art: 'gpk' },
  ];
  const daily = dailyCounts(items);
  it('dailyCounts: адсартаваныя дні, без даты — прапускаецца', () => {
    expect(daily).toEqual([[T('2026-07-03'), [0, 0, 1]], [T('2026-08-20'), [1, 0, 0]], [T('2026-08-26'), [0, 2, 0]]]);
  });
  it('buckets: суцэльны шэраг месяцаў да «сёння»', () => {
    const b = buckets(daily, 'month', T('2026-10-05'));
    expect(b.map((x) => x.total)).toEqual([1, 3, 0, 0]);
    expect(b[1].counts).toEqual([1, 2, 0]);
    expect(b[3].start).toBe(T('2026-10-01'));
  });
  it('trend: цэнтраванае сярэдняе са схаванымі серыямі', () => {
    const b = buckets(daily, 'month', T('2026-10-05'));
    expect(trend(b, 3)).toEqual([2, 4 / 3, 1, 0]);
    expect(trend(b, 3, new Set(['kgs']))).toEqual([1, 2 / 3, 1 / 3, 0]);
  });
  it('pickGrain: чым вузейшы экран — тым буйнейшая карзіна', () => {
    expect(pickGrain(3 * 365 * DAY, 700)).toBe('month');
    expect(pickGrain(18 * 365 * DAY, 340)).toBe('year');
    expect(pickGrain(20 * DAY, 340)).toBe('day');
  });
  it('niceTicks', () => {
    expect(niceTicks(148)).toEqual([0, 50, 100, 150]);
    expect(niceTicks(0)).toEqual([0, 1]);
    expect(niceTicks(7)).toEqual([0, 2, 4, 6, 8]);
    expect(niceTicks(9)).toEqual([0, 5, 10]);
    expect(niceTicks(3)).toEqual([0, 1, 2, 3]);
    expect(niceTicks(1200)).toEqual([0, 500, 1000, 1500]);
  });
  it('clampRange', () => {
    expect(clampRange([5, 8], 0, 100, 10)).toEqual([5, 15]);
    expect(clampRange([95, 105], 0, 100, 10)).toEqual([90, 100]);
    expect(clampRange([-50, 500], 0, 100, 10)).toEqual([0, 100]);
  });
  it('summary', () => {
    const s = summary(daily, T('2026-09-01'));
    expect(s.total).toBe(4);
    expect(s.last30).toBe(3);
    expect(s.peak.start).toBe(T('2026-08-01'));
  });
});
