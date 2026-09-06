import { describe, it, expect, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { useLocalStorage } from '../src/hooks/useLocalStorage.js';

// SSR-збруя: хук чытае localStorage у першым рэндэры, set піша адразу (не ў апдэйтары React),
// таму запіс відаць і пасля рэндэру, а функцыянальныя абнаўленні ланцужком бачаць апошняе значэнне.
const mock = new Map();
beforeEach(() => {
  mock.clear();
  globalThis.localStorage = {
    getItem: (k) => mock.get(k) ?? null,
    setItem: (k, v) => mock.set(k, String(v)),
    removeItem: (k) => mock.delete(k),
    clear: () => mock.clear(),
  };
});
let api;
function Probe({ k, initial }) { const [v, set] = useLocalStorage(k, initial); api = { v, set }; return <i>{typeof v === 'string' ? v : JSON.stringify(v)}</i>; }
const render = (k, initial) => renderToStaticMarkup(<Probe k={k} initial={initial} />);

describe('useLocalStorage', () => {
  it('чытае захаванае значэнне; сапсаваны JSON, адсутнасць ключа і зламаны localStorage — пачатковае', () => {
    mock.set('sort', '"oldest"');
    expect(render('sort', 'newest')).toBe('<i>oldest</i>');
    mock.set('sort', 'not json');
    expect(render('sort', 'newest')).toBe('<i>newest</i>');
    expect(render('missing', [])).toBe('<i>[]</i>');
    globalThis.localStorage = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };
    expect(render('sort', 'newest')).toBe('<i>newest</i>');
    expect(() => api.set('x')).not.toThrow(); // запіс у прыватным рэжыме не валіць
  });
  it('set піша адразу і падтрымлівае функцыянальныя абнаўленні ланцужком', () => {
    render('n', 1);
    api.set(5);
    expect(mock.get('n')).toBe('5');
    api.set((p) => p + 1);
    api.set((p) => p + 1);
    expect(mock.get('n')).toBe('7');
    api.set({ a: [1] });
    expect(mock.get('n')).toBe('{"a":[1]}');
  });
});
