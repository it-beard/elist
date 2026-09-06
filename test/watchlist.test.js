import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { useWatchlist, sanitizeEntries, withEntry, withSeen } from '../src/hooks/useWatchlist.js';

// Для тэстаў запісу useLocalStorage падмяняецца простай парай [значэнне, set]: set адразу выклікае апдэйтар
// з сырым захаваным значэннем і піша ў сховішча — як сапраўдны хук, але без залежнасці ад яго ўнутранасцяў.
// Чытанне (direct = false) ідзе праз сапраўдны хук і падменены localStorage.
let direct = false;
const store = new Map();
vi.mock('../src/hooks/useLocalStorage.js', async (importOriginal) => {
  const orig = await importOriginal();
  const fake = (key, initial) => {
    const raw = store.has(key) ? JSON.parse(store.get(key)) : initial;
    return [raw, (v) => store.set(key, JSON.stringify(typeof v === 'function' ? v(raw) : v))];
  };
  return { ...orig, useLocalStorage: (key, initial) => (direct ? fake(key, initial) : orig.useLocalStorage(key, initial)) };
});

const ITEMS = [
  { i: 0, id: 'a', date: '2026-01-01', h: 'канал "свабода" https://t.me/svaboda' },
  { i: 1, id: 'b', date: '2026-02-01', h: 'газета "наша ніва"' },
];
const storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k), clear: () => store.clear() };

/** Рэндэрыць «пустышку», якая выклікае хук, і аддае тое, што ён вярнуў (SSR: без эфектаў). */
function mount(items = ITEMS) {
  let out;
  function Probe() { out = useWatchlist(items); return null; }
  renderToStaticMarkup(createElement(Probe));
  return out;
}

beforeEach(() => { store.clear(); direct = false; vi.stubGlobal('localStorage', storage); });
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('sanitizeEntries', () => {
  it('не масіў → пусты спіс', () => {
    for (const raw of [{}, 'x', null, undefined, 42, true]) expect(sanitizeEntries(raw)).toEqual([]);
  });
  it('запісы без q, з не-радковым q, null, радкі і масівы — прэч; астатнія — тыя ж аб\'екты', () => {
    const ok = { q: 'ніва', seen: ['b'], at: '2026-09-01' };
    const out = sanitizeEntries([{ q: 1 }, { seen: [] }, null, 'x', [], { q: null }, ok]);
    expect(out).toEqual([ok]);
    expect(out[0]).toBe(ok);
  });
  it('міграцыя seen: [null, …] ці адсутнасць → [], валідны seen — без зменаў', () => {
    const out = sanitizeEntries([{ q: 'a', seen: [null, 'x'] }, { q: 'b' }, { q: 'c', seen: [] }, { q: 'd', seen: 'x' }]);
    expect(out).toEqual([{ q: 'a', seen: [] }, { q: 'b', seen: [] }, { q: 'c', seen: [] }, { q: 'd', seen: [] }]);
  });
  it('чысты спіс вяртаецца як ёсць (той самы масіў) — інакш markSeen без зменаў перарэндэрваў бы App', () => {
    const list = [{ q: 'a', seen: ['x'], at: '2026-09-01' }, { q: 'b', seen: [] }];
    expect(sanitizeEntries(list)).toBe(list);
    expect(sanitizeEntries([])).toEqual([]);
  });
});

describe('withEntry / withSeen', () => {
  const list = [{ q: 'свабода', seen: ['a'], at: '2026-09-01' }, { q: 'ніва', seen: [], at: '2026-09-02' }];
  it('withEntry: паўтор запыту — той самы спіс; новы — у канец', () => {
    expect(withEntry(list, { q: 'ніва', seen: [], at: '2026-09-06' })).toBe(list);
    const out = withEntry(list, { q: 'гродна', seen: ['b'], at: '2026-09-06' });
    expect(out.map((e) => e.q)).toEqual(['свабода', 'ніва', 'гродна']);
    expect(out[0]).toBe(list[0]);
    expect(list).toHaveLength(2); // зыходны не мутуецца
  });
  it('withSeen: невядомы запыт ці тыя ж id (у любым парадку) — той самы спіс', () => {
    expect(withSeen(list, 'няма', ['a'])).toBe(list);
    expect(withSeen(list, 'свабода', ['a'])).toBe(list);
    expect(withSeen(list, 'ніва', [])).toBe(list);
    const two = [{ q: 'x', seen: ['a', 'b'] }];
    expect(withSeen(two, 'x', ['b', 'a'])).toBe(two);
  });
  it('withSeen: змена — новы спіс, абноўлены толькі гэты запіс, зыходны не мутуецца', () => {
    const out = withSeen(list, 'ніва', ['b']);
    expect(out).not.toBe(list);
    expect(out[1]).toEqual({ q: 'ніва', seen: ['b'], at: '2026-09-02' });
    expect(out[0]).toBe(list[0]);
    expect(list[1].seen).toEqual([]);
    expect(withSeen(list, 'свабода', [])[0]).toEqual({ q: 'свабода', seen: [], at: '2026-09-01' });
  });
});

describe('useWatchlist: чытанне з сапсаванага localStorage (SSR)', () => {
  it.each(['{}', '"x"', 'null', '42', 'true', 'not json'])('watch = %s → пусты спіс, без выключэння', (raw) => {
    store.set('watch', raw);
    const w = mount();
    expect(w.entries).toEqual([]);
    expect(w.checks).toEqual([]);
    expect(w.has('свабода')).toBe(false);
  });
  it('запісы без q адкідаюцца, валідныя — як ёсць (з міграцыяй seen); праверка і has працуюць', () => {
    store.set('watch', JSON.stringify([{ q: 1 }, { seen: [] }, null, 'x', { q: 'свабода', seen: [null] }, { q: 'ніва', seen: ['b'], at: '2026-09-01' }]));
    const w = mount();
    expect(w.entries).toEqual([{ q: 'свабода', seen: [] }, { q: 'ніва', seen: ['b'], at: '2026-09-01' }]);
    expect(w.checks.map((c) => c.fresh.map((m) => m.id))).toEqual([['a'], []]);
    expect(w.has(' ніва ')).toBe(true);
    expect(w.has('гродна')).toBe(false);
    expect(w.notify).toBe(false);
  });
  it('валідныя даныя — без зменаў; без індэкса — праверак няма', () => {
    const list = [{ q: 'a', seen: ['x'], at: '2026-01-01' }, { q: 'b', seen: [], at: '2026-01-02' }];
    store.set('watch', JSON.stringify(list));
    const w = mount(null);
    expect(w.entries).toEqual(list);
    expect(w.checks).toEqual([]);
  });
  it('localStorage недаступны (кідае) — пусты спіс', () => {
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('SecurityError'); } });
    expect(mount().entries).toEqual([]);
  });
});

describe('useWatchlist: запіс (падменены useLocalStorage)', () => {
  beforeEach(() => { direct = true; vi.useFakeTimers({ now: Date.UTC(2026, 8, 6, 12), toFake: ['Date'] }); });
  const saved = () => JSON.parse(store.get('watch'));

  it('add: абразае прабелы, бягучыя супадзенні адразу бачаныя, дата дадання; паўтор і пусты запыт — нічога', () => {
    mount().add('  свабода ');
    expect(saved()).toEqual([{ q: 'свабода', seen: ['a'], at: '2026-09-06' }]);
    mount().add('свабода');
    mount().add('   ');
    expect(saved()).toHaveLength(1);
    mount().add('гродна');
    expect(saved()).toEqual([{ q: 'свабода', seen: ['a'], at: '2026-09-06' }, { q: 'гродна', seen: [], at: '2026-09-06' }]);
  });
  it('без індэкса add захоўвае запыт з пустым seen', () => {
    mount(null).add('ніва');
    expect(saved()).toEqual([{ q: 'ніва', seen: [], at: '2026-09-06' }]);
  });
  it('сапсаванае сховішча лечыцца першым запісам, а не кладзе «дадаць» ці «бачана»', () => {
    store.set('watch', '{}');
    expect(() => mount().add('ніва')).not.toThrow();
    expect(saved()).toEqual([{ q: 'ніва', seen: ['b'], at: '2026-09-06' }]);
    store.set('watch', JSON.stringify([{ q: 1 }, { q: 'ніва', seen: [null] }]));
    mount().markSeen('ніва', ['b']);
    expect(saved()).toEqual([{ q: 'ніва', seen: ['b'] }]);
    store.set('watch', '"x"');
    mount().remove('ніва');
    expect(saved()).toEqual([]);
  });
  it('markSeen без зменаў пакідае спіс як ёсць; remove і clear', () => {
    store.set('watch', JSON.stringify([{ q: 'a', seen: ['x'] }, { q: 'b', seen: [] }]));
    mount().markSeen('a', ['x']);
    expect(saved()).toEqual([{ q: 'a', seen: ['x'] }, { q: 'b', seen: [] }]);
    mount().markSeen('b', ['y', 'z']);
    expect(saved()).toEqual([{ q: 'a', seen: ['x'] }, { q: 'b', seen: ['y', 'z'] }]);
    mount().remove('a');
    expect(saved()).toEqual([{ q: 'b', seen: ['y', 'z'] }]);
    mount().clear();
    expect(saved()).toEqual([]);
  });
});
