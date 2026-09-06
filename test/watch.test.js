import { describe, it, expect } from 'vitest';
import { checkWatchlist, watchTokens } from '../src/lib/watch.js';

// Ланцужок правак c0 → c1 → … → c(n-1): кожны наступны — editOf папярэдняга; старыя версіі replacedBy → не ў выдачы.
const chain = (n) => Array.from({ length: n }, (_, k) => ({
  i: k, id: `c${k}`, date: '2026-01-01', h: 'канал "свабода"', editOf: k ? `c${k - 1}` : '', replacedBy: k < n - 1 ? `c${k + 1}` : '',
}));

describe('checkWatchlist: ланцужок правак (editOf)', () => {
  const items = chain(10);
  const fresh = (seen) => checkWatchlist(items, [{ q: 'свабода', seen }])[0].fresh.map((m) => m.id);

  it('у выдачы толькі апошняя версія', () => {
    expect(checkWatchlist(items, [{ q: 'свабода', seen: [] }])[0].matches.map((m) => m.id)).toEqual(['c9']);
    expect(fresh([])).toEqual(['c9']);
  });
  it('бачаная любая з 7 папярэдніх версій (8 крокаў разам з самім запісам) — не трывожыць', () => {
    expect(fresh(['c9'])).toEqual([]);
    expect(fresh(['c5'])).toEqual([]);
    expect(fresh(['c2'])).toEqual([]); // 8-ы крок: c9, c8, …, c2
  });
  it('глыбей за 8 крокаў — лічыцца новым (абарона ад бясконцага ланцужка)', () => {
    expect(fresh(['c1'])).toEqual(['c9']);
    expect(fresh(['c0'])).toEqual(['c9']);
  });
  it('цыкл editOf не вешае праверку', () => {
    const loop = [
      { i: 0, id: 'a', date: '2026-01-01', h: 'канал "свабода"', editOf: 'b' },
      { i: 1, id: 'b', date: '2026-01-01', h: 'канал "свабода"', editOf: 'a', replacedBy: 'a' },
    ];
    expect(checkWatchlist(loop, [{ q: 'свабода', seen: [] }])[0].fresh.map((m) => m.id)).toEqual(['a']);
    expect(checkWatchlist(loop, [{ q: 'свабода', seen: ['b'] }])[0].fresh).toEqual([]);
    expect(checkWatchlist([{ i: 0, id: 'a', date: '', h: 'свабода', editOf: 'a' }], [{ q: 'свабода', seen: [] }])[0].fresh).toHaveLength(1);
  });
  it('watchTokens: дакладныя токены + транслітарацыя, без прыблізнага пошуку; пусты запыт і запіс без seen — не падаюць', () => {
    const [tok] = watchTokens('Свабода');
    expect(tok[0]).toBe('свабода');
    expect(tok).toContain('svaboda');
    expect(watchTokens('   ')).toEqual([]);
    const [r] = checkWatchlist(items, [{ q: '   ' }]);
    expect(r.matches).toEqual([]);
    expect(r.fresh).toEqual([]);
    expect(checkWatchlist(items, [{ q: 'свабода' }])[0].fresh.map((m) => m.id)).toEqual(['c9']);
  });
});
