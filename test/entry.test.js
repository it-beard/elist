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

// --- спасылка «падзяліцца» і history.state: глабальныя location/history падменныя (дапісана ў канец, каб не чапаць існуючае) ---
import { vi, afterEach } from 'vitest';
import { queryLink, takeEntryQuery, rememberQuery } from '../src/lib/entry.js';

describe('queryLink / takeEntryQuery / rememberQuery', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('queryLink: хэш, а не ?q= — і #, &, + і прабел закадаваныя; чытаецца назад без страт', () => {
    vi.stubGlobal('location', { origin: 'https://x.test' });
    expect(queryLink('#a &b+c')).toBe('https://x.test/#q=%23a%20%26b%2Bc');
    expect(queryLink('свабода', '/elist/')).toBe('https://x.test/elist/#q=%D1%81%D0%B2%D0%B0%D0%B1%D0%BE%D0%B4%D0%B0');
    expect(parseEntryUrl(queryLink('#a &b+c', '/elist/'))).toEqual({ q: '#a &b+c', url: 'https://x.test/elist/' });
  });

  it('takeEntryQuery: забірае ?q= у history.state (захоўваючы астатні state) і чысціць адрас', () => {
    const replaceState = vi.fn();
    vi.stubGlobal('location', { href: 'https://x.test/?q=%40nick&x=1' });
    vi.stubGlobal('history', { state: { foo: 1 }, replaceState });
    expect(takeEntryQuery()).toBe('@nick');
    expect(replaceState).toHaveBeenCalledWith({ foo: 1, q: '@nick' }, '', 'https://x.test/?x=1');
  });

  it('takeEntryQuery: #q= — тое самае, хэш ачышчаецца', () => {
    const replaceState = vi.fn();
    vi.stubGlobal('location', { href: 'https://x.test/elist/#q=a+b' });
    vi.stubGlobal('history', { state: null, replaceState });
    expect(takeEntryQuery()).toBe('a b');
    expect(replaceState).toHaveBeenCalledWith({ q: 'a b' }, '', 'https://x.test/elist/');
  });

  it('takeEntryQuery: без запыту ў адрасе — з history.state (ці пусты), адрас не чапае', () => {
    const replaceState = vi.fn();
    vi.stubGlobal('location', { href: 'https://x.test/#/new' });
    vi.stubGlobal('history', { state: { q: 'з укладкі' }, replaceState });
    expect(takeEntryQuery()).toBe('з укладкі');
    vi.stubGlobal('history', { state: null, replaceState });
    expect(takeEntryQuery()).toBe('');
    expect(replaceState).not.toHaveBeenCalled();
  });

  it('rememberQuery: толькі ў history.state, адрас той самы; памылка replaceState глытаецца', () => {
    const replaceState = vi.fn();
    vi.stubGlobal('location', { href: 'https://x.test/#/new' });
    vi.stubGlobal('history', { state: { a: 1 }, replaceState });
    rememberQuery('свабода');
    expect(replaceState).toHaveBeenCalledWith({ a: 1, q: 'свабода' }, '', 'https://x.test/#/new');
    vi.stubGlobal('history', { state: null, replaceState: () => { throw new Error('SecurityError'); } });
    expect(() => rememberQuery('x')).not.toThrow();
  });
});
