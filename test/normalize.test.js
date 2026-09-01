import { describe, it, expect } from 'vitest';
import { normalize, normalizeCompact, parseQuery, matchRanges } from '../src/lib/normalize.js';
import { courtName, extractDate, dateWords, extractArticle } from '../src/lib/court.js';
import { search } from '../src/lib/search.js';

describe('normalize', () => {
  it('захоўвае даўжыню і зводзіць ё/i/лапкі', () => {
    const s = 'Радыё «Свабода» i Ў\tX';
    expect(normalize(s)).toHaveLength(s.length);
    expect(normalize(s)).toBe('радые "свабода" і ў x');
  });
  it('compact сціскае прабелы', () => {
    expect(normalizeCompact('  A   B\n\nC ')).toBe('a b c');
  });
});

describe('parseQuery', () => {
  it('фраза ў лапках — адзін токен', () => {
    expect(parseQuery('Радыё "Свабода з" t.me/X')).toEqual(['радые', 'свабода з', 't.me/x']);
  });
  it('пусты запыт', () => expect(parseQuery('   ')).toEqual([]));
});

describe('matchRanges', () => {
  it('знаходзіць і злівае перакрыцці', () => {
    expect(matchRanges('Свабода свабоды', ['свабод', 'абода'])).toEqual([[0, 7], [8, 14]]);
  });
});

describe('court', () => {
  const c = 'Решение суда Ленинского района г.Гродно \nот 20 августа 2026 года.\nПодлежит немедленному исполнению';
  it('назва суда', () => expect(courtName(c)).toBe('суда Ленинского района г.Гродно'));
  it('дата', () => expect(extractDate(c)).toBe('2026-08-20'));
  it('дата словамі і лічбамі', () => expect(dateWords('2026-08-20')).toBe('20 августа 2026 20.08.2026'));
  it('няма даты', () => expect(extractDate('без даты')).toBeNull());
  it('артыкул 314 ГПК', () => expect(extractArticle('Решение суда …\nПодлежит немедленному исполнению в соответствии с 314 статьей Гражданского процессуального кодекса Республики Беларусь')).toEqual({ num: '314', code: 'gpk' }));
  it('артыкул 302 КГС', () => expect(extractArticle('Решение суда …\nПодлежит немедленному исполнению в соответствии со статьей 302 Кодекса гражданского судопроизводства Республики Беларусь')).toEqual({ num: '302', code: 'kgs' }));
  it('няма артыкула', () => expect(extractArticle(c)).toBeNull());
});

describe('search', () => {
  const items = [
    { i: 0, date: '2020-01-01', added: '', removed: '', h: 'кніга пра свабоду' },
    { i: 1, date: '2024-05-05', added: '', removed: '', h: 'канал пра гродна' },
  ];
  it('усе словы', () => expect(search(items, ['пра', 'свабоду']).map((x) => x.i)).toEqual([0]));
  it('любое са слоў', () => expect(search(items, ['свабоду', 'гродна'], { any: true })).toHaveLength(2));
  it('сартаванне', () => expect(search(items, [], { sort: 'newest' }).map((x) => x.i)).toEqual([1, 0]));
});
