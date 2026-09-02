import { describe, it, expect } from 'vitest';
import { parseEntryUrl } from '../src/lib/entry.js';
import { parseHash } from '../src/hooks/useHashRoute.js';

describe('parseEntryUrl', () => {
  it('?q= — запыт і адрас без яго', () => {
    expect(parseEntryUrl('https://x.test/?q=%40nick&x=1')).toEqual({ q: '@nick', url: 'https://x.test/?x=1' });
    expect(parseEntryUrl('https://x.test/?q=a+b')).toEqual({ q: 'a b', url: 'https://x.test/' });
  });
  it('#q= — тое самае, хэш ачышчаецца', () => {
    expect(parseEntryUrl('https://x.test/#q=a+b%20c')).toEqual({ q: 'a b c', url: 'https://x.test/' });
    expect(parseEntryUrl('https://x.test/sub/#q=%D1%81%D0%B2%D0%B0%D0%B1%D0%BE%D0%B4%D0%B0')).toEqual({ q: 'свабода', url: 'https://x.test/sub/' });
  });
  it('без запыту — нічога не чапае', () => {
    expect(parseEntryUrl('https://x.test/#/r/abc')).toEqual({ q: null, url: 'https://x.test/#/r/abc' });
  });
  it('сапсаваная кадоўка не кідае выключэння', () => {
    expect(parseEntryUrl('https://x.test/#q=%E0%A4%A').q).toBe('%E0%A4%A');
  });
});

describe('parseHash', () => {
  it('маршруты', () => {
    expect(parseHash('')).toEqual({ name: '', arg: '' });
    expect(parseHash('#/new')).toEqual({ name: 'new', arg: '' });
    expect(parseHash('#/r/abc%2Fd')).toEqual({ name: 'r', arg: 'abc/d' });
  });
  it('«#q=…» — галоўная, а не асобны маршрут', () => {
    expect(parseHash('#q=foo').name).toBe('');
  });
  it('сапсаваная спасылка не кладзе сайт', () => {
    expect(() => parseHash('#/r/%')).not.toThrow();
    expect(parseHash('#/r/%')).toEqual({ name: 'r', arg: '%' });
  });
});
