import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { LangContext } from '../src/hooks/useLang.jsx';
import { STRINGS } from '../src/lib/i18n.js';
import Highlight from '../src/components/Highlight.jsx';

const t = STRINGS.be;
const ctx = { lang: 'be', t, setLang: () => {} };
const html = (text, tokens = []) => renderToStaticMarkup(<LangContext.Provider value={ctx}><Highlight text={text} tokens={tokens} /></LangContext.Provider>);
const anchors = (s) => [...s.matchAll(/<a [^>]*>/g)].map((m) => m[0]);
const hrefs = (s) => anchors(s).map((a) => a.match(/href="([^"]*)"/)[1]);

describe('Highlight: спасылкі', () => {
  it('https://…, http://…, t.me/… і www.… становяцца спасылкамі; голы site.com, пошта і site.www.by — не', () => {
    const h = html('гл. https://example.by/a, http://old.by t.me/svaboda і www.example.by');
    expect(hrefs(h)).toEqual(['https://example.by/a', 'http://old.by', 'https://t.me/svaboda', 'https://www.example.by']);
    expect(h).toContain('>t.me/svaboda</a>'); // тэкст спасылкі — як у запісе, без дапісанага https://
    expect(html('сайт example.by, пошта info@t.me/x і site.www.by')).not.toContain('<a ');
  });

  it('знакі прыпынку ў канцы (.,;:) і дужка не трапляюць у спасылку', () => {
    const h = html('(https://example.by/x), t.me/x. www.example.by/y;: канец');
    expect(hrefs(h)).toEqual(['https://example.by/x', 'https://t.me/x', 'https://www.example.by/y']);
    expect(h).toContain('</a>), <a');
    expect(h).toContain('</a>. <a');
    expect(h).toContain('</a>;: канец');
  });

  it('у кожнай спасылкі target=_blank і rel=noopener noreferrer nofollow', () => {
    const as = anchors(html('https://a.by t.me/b www.c.by'));
    expect(as).toHaveLength(3);
    for (const a of as) {
      expect(a).toContain('target="_blank"');
      expect(a).toContain('rel="noopener noreferrer nofollow"');
    }
  });

  it('href толькі http(s): javascript:, data:, vbscript: спасылкамі не становяцца', () => {
    expect(html('javascript:alert(1) data:text/html,x vbscript:msgbox')).not.toContain('<a ');
  });
});

describe('Highlight: падсветка і экранаванне', () => {
  it('<mark> па токенах (рэгістр і ё нармалізаваныя), у тым ліку ўнутры спасылкі', () => {
    const h = html('Радыё Свабода https://t.me/svaboda', [['свабод'], ['svaboda']]);
    expect(h).toContain('Радыё <mark>Свабод</mark>а ');
    expect(h).toMatch(/<a [^>]*>https:\/\/t\.me\/<mark>svaboda<\/mark><\/a>/);
    expect(html('без токенаў')).toBe('без токенаў');
    expect(html('без супадзенняў', [['zzz']])).not.toContain('<mark>');
  });

  it('тэкст запісу экранаваны: <script> не трапляе ў HTML, & і " у спасылцы — таксама', () => {
    const h = html('<script>alert(1)</script> https://x.by/?a=1&b="2');
    expect(h).not.toContain('<script>');
    expect(h).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(hrefs(h)).toEqual(['https://x.by/?a=1&amp;b=']); // «"» спыняе спасылку і застаецца тэкстам
    expect(h).toContain('</a>&quot;2');
  });
});

describe('Highlight: папярэджанне перад першым пераходам за сесію', () => {
  // Свежы модуль на кожны тэст — сцяг «ужо пацвердзіў» жыве ў замыканні модуля.
  async function anchorsOf(text) {
    vi.resetModules();
    // ExtLink імпартуецца пасля resetModules разам з Highlight — той жа свежы асобнік, дзе жыве сцяг
    const [{ default: Fresh }, { default: FreshExt }, { LangContext: Ctx }] = await Promise.all([import('../src/components/Highlight.jsx'), import('../src/components/ExtLink.jsx'), import('../src/hooks/useLang.jsx')]);
    let out;
    // Кампаненты выкліканыя як функцыі ўнутры рэндэру: useContext працуе, а вернутыя элементы <a> з onClick — у руках.
    function Probe() { out = Fresh({ text, tokens: [] }).filter((el) => el && el.type === FreshExt).map((el) => FreshExt(el.props)); return out; }
    renderToStaticMarkup(<Ctx.Provider value={ctx}><Probe /></Ctx.Provider>);
    return out.filter((el) => el && el.type === 'a');
  }
  const click = (a) => { const e = { preventDefault: vi.fn(), currentTarget: { href: a.props.href } }; a.props.onClick(e); return e; };
  const memStorage = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; };

  afterEach(() => vi.unstubAllGlobals());

  it('адмова — пераход спынены, нічога не адкрываецца, сцяга няма; згода — адкрывае і ставіць elist-links-ok; далей без пытанняў', async () => {
    const ss = memStorage();
    const confirm = vi.fn(() => false), open = vi.fn();
    vi.stubGlobal('sessionStorage', ss);
    vi.stubGlobal('confirm', confirm);
    vi.stubGlobal('open', open);
    const [a] = await anchorsOf('глядзі https://example.by/x');
    let e = click(a);
    expect(e.preventDefault).toHaveBeenCalledOnce();
    expect(confirm).toHaveBeenCalledWith(t.linkWarn);
    expect(open).not.toHaveBeenCalled();
    expect(ss.getItem('elist-links-ok')).toBeNull();

    confirm.mockReturnValue(true);
    e = click(a);
    expect(e.preventDefault).toHaveBeenCalledOnce();
    expect(open).toHaveBeenCalledWith('https://example.by/x', '_blank', 'noopener,noreferrer');
    expect(ss.getItem('elist-links-ok')).toBe('1');

    e = click(a);
    expect(e.preventDefault).not.toHaveBeenCalled(); // звычайны пераход па href
    expect(confirm).toHaveBeenCalledTimes(2);
    expect(open).toHaveBeenCalledOnce();
  });

  it('сцяг ужо ў sessionStorage (перазагрузка старонкі ў той жа сесіі) — пытанне не паўтараецца', async () => {
    const ss = memStorage();
    ss.setItem('elist-links-ok', '1');
    const confirm = vi.fn(() => true);
    vi.stubGlobal('sessionStorage', ss);
    vi.stubGlobal('confirm', confirm);
    vi.stubGlobal('open', vi.fn());
    const [a] = await anchorsOf('t.me/x');
    expect(click(a).preventDefault).not.toHaveBeenCalled();
    expect(confirm).not.toHaveBeenCalled();
  });

  it('sessionStorage недаступны (кідае) — пытанне задаецца адзін раз, сайт не падае', async () => {
    const broken = { getItem: () => { throw new Error('SecurityError'); }, setItem: () => { throw new Error('SecurityError'); } };
    const confirm = vi.fn(() => true), open = vi.fn();
    vi.stubGlobal('sessionStorage', broken);
    vi.stubGlobal('confirm', confirm);
    vi.stubGlobal('open', open);
    const [a] = await anchorsOf('www.example.by');
    expect(() => click(a)).not.toThrow();
    expect(open).toHaveBeenCalledWith('https://www.example.by', '_blank', 'noopener,noreferrer');
    expect(click(a).preventDefault).not.toHaveBeenCalled(); // памяць модуля
    expect(confirm).toHaveBeenCalledOnce();
  });
});
