import { describe, it, expect } from 'vitest';
import { parseQuery, cleanToken, matchRanges } from '../src/lib/normalize.js';
import { variants } from '../src/lib/translit.js';
import { levenshtein, corpusWords, similarWords } from '../src/lib/fuzzy.js';
import { search } from '../src/lib/search.js';
import { checkWatchlist } from '../src/lib/watch.js';
import { nextUpdate } from '../src/lib/schedule.js';

const items = [
  { i: 0, id: 'a', date: '2026-01-01', h: 'канал "свабода" https://t.me/svaboda\nинформационная продукция' },
  { i: 1, id: 'b', date: '2026-02-01', h: 'страница в социальной сети "instagram" @mіnsk_lіfe\nсимволика' },
  { i: 2, id: 'c', date: '2026-03-01', h: 'газета "наша ніва" nashanіva.com' },
];

describe('cleanToken / parseQuery', () => {
  it('прыбірае пратакол, www, @ і хвост', () => {
    expect(cleanToken('https://www.t.me/foo/')).toBe('t.me/foo');
    expect(cleanToken('@minsk_life.')).toBe('minsk_life');
    expect(parseQuery('https://t.me/Svaboda/ @Minsk_life')).toEqual(['t.me/svaboda', 'mіnsk_lіfe']);
  });
});

describe('variants', () => {
  it('кірыліца → лацінка ў абодвух стылях', () => {
    const v = variants('свабода');
    expect(v).toContain('svaboda');
    expect(v).toContain('свабода');
  });
  it('лацінка → кірыліца з і/и', () => {
    const v = variants('mіnsk'); // ужо нармалізаваная i → і
    expect(v).toContain('мінск');
    expect(v).toContain('минск');
    expect(variants('zhodіno')).toContain('жодино');
    expect(variants('hrodna')).toContain('гродна');
  });
  it('не чапае спасылкі і лічбы', () => {
    expect(variants('t.me/x')).toEqual(['t.me/x']);
  });
});

describe('fuzzy', () => {
  it('levenshtein з абмежаваньнем', () => {
    expect(levenshtein('свобода', 'свабода')).toBe(1);
    expect(levenshtein('abc', 'xyz', 1)).toBe(2);
  });
  it('знаходзіць падобныя словы корпуса', () => {
    const words = corpusWords(items);
    expect(similarWords(words, 'свобода')).toEqual(['свабода']);
    expect(similarWords(words, 'ніва')).toEqual([]); // закароткае для прыблізнага пошуку
  });
});

describe('search з варыянтамі', () => {
  it('масіў варыянтаў — дастаткова любога', () => {
    expect(search(items, [variants('svaboda')]).map((x) => x.id)).toEqual(['a']);
    expect(search(items, [variants('минск')]).map((x) => x.id)).toEqual(['b']);
    expect(search(items, [['zzz', 'nashanіva']]).map((x) => x.id)).toEqual(['c']);
  });
  it('matchRanges прымае масівы', () => {
    expect(matchRanges('Свабода svaboda', [['свабода', 'svaboda']])).toEqual([[0, 7], [8, 15]]);
  });
});

describe('checkWatchlist', () => {
  it('адрозьнівае новыя супадзеньні ад бачаных', () => {
    const [r] = checkWatchlist(items, [{ q: 'svaboda', seen: [] }]);
    expect(r.matches).toHaveLength(1);
    expect(r.fresh).toHaveLength(1);
    const [s] = checkWatchlist(items, [{ q: 'svaboda', seen: ['a'] }]);
    expect(s.fresh).toHaveLength(0);
  });
});

describe('nextUpdate', () => {
  it('сёньня, калі яшчэ не было; інакш заўтра', () => {
    expect(nextUpdate(new Date('2026-08-26T01:00:00Z')).toISOString()).toBe('2026-08-26T04:30:00.000Z');
    expect(nextUpdate(new Date('2026-08-26T05:00:00Z')).toISOString()).toBe('2026-08-27T04:30:00.000Z');
  });
});
