import { describe, it, expect, vi, beforeAll } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { LangContext } from '../src/hooks/useLang.jsx';
import { STRINGS } from '../src/lib/i18n.js';

// Фрагменты не грузім — карткі застаюцца «шкілетамі»
vi.mock('../src/hooks/useRecord.js', () => ({ useRecord: () => null }));

let ResultList;
beforeAll(async () => {
  // SSR без браўзера: кампанентам патрэбныя location/history толькі для спасылак
  globalThis.location = { href: 'https://elist.test/', hash: '', origin: 'https://elist.test', pathname: '/' };
  globalThis.history = { state: null, replaceState() {} };
  ({ default: ResultList } = await import('../src/components/ResultList.jsx'));
});

const items = (n) => Array.from({ length: n }, (_, i) => ({ i, id: `m${i}`, list: 'm', n: i + 1, date: '2026-01-01', added: '', removed: '', editOf: '', replacedBy: '', art: 'none', h: `запіс ${i}` }));
const render = (el, lang = 'be') => renderToStaticMarkup(<LangContext.Provider value={{ lang, t: STRINGS[lang], setLang: () => {} }}>{el}</LangContext.Provider>);
const cards = (html) => (html.match(/<li /g) || []).length;

describe('ResultList: старонкі па 50', () => {
  it('101 вынік → 50 картак і кнопка «Паказаць яшчэ (засталося 51)»', () => {
    const html = render(<ResultList results={items(101)} tokens={[]} chunkSize={200} />);
    expect(cards(html)).toBe(50);
    expect(html).toContain('<ol class="results">');
    expect(html).toContain('class="more"');
    expect(html).toContain(`>${STRINGS.be.more(51)}</button>`);
    expect(html).toContain('засталося 51');
    expect(html).not.toMatch(/undefined|NaN/);
  });
  it('роўна 50 — усё на адной старонцы, без кнопкі; 51 — кнопка з адным', () => {
    const fifty = render(<ResultList results={items(50)} tokens={[]} chunkSize={200} />);
    expect(cards(fifty)).toBe(50);
    expect(fifty).not.toContain('class="more"');
    const one = render(<ResultList results={items(51)} tokens={[]} chunkSize={200} />, 'en');
    expect(cards(one)).toBe(50);
    expect(one).toContain(`>${STRINGS.en.more(1)}</button>`);
  });
  it('пусты спіс — пусты <ol>, без кнопкі', () => {
    const html = render(<ResultList results={[]} tokens={[]} chunkSize={200} />);
    expect(html).toBe('<ol class="results"></ol>');
  });
});
