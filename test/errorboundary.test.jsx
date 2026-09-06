import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { LangContext } from '../src/hooks/useLang.jsx';
import { STRINGS } from '../src/lib/i18n.js';
import ErrorBoundary from '../src/components/ErrorBoundary.jsx';

const ctx = (lang) => ({ lang, t: STRINGS[lang], setLang: () => {} });
const render = (el, lang = 'be') => renderToStaticMarkup(<LangContext.Provider value={ctx(lang)}>{el}</LangContext.Provider>);
function Boom() { throw new Error('boom'); }

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('ErrorBoundary', () => {
  it('без памылкі — проста дзеці', () => {
    expect(render(<ErrorBoundary><p className="ok">Пошук</p></ErrorBoundary>)).toBe('<p class="ok">Пошук</p>');
  });

  it('getDerivedStateFromError кладзе памылку ў стан', () => {
    const err = new Error('boom');
    expect(ErrorBoundary.getDerivedStateFromError(err)).toEqual({ error: err });
  });

  it('SSR не перахоплівае памылкі дзяцей (так задумана ў React) — таму стан з памылкай рэндэрым напрамую', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<ErrorBoundary><Boom /></ErrorBoundary>)).toThrow('boom');
  });

  it('з памылкай — загаловак, тэкст памылкі (экранаваны), падказка, «зноў» і спасылка на галоўную; дзеці не рэндэрацца', () => {
    for (const lang of ['be', 'en']) {
      const t = STRINGS[lang];
      const eb = new ErrorBoundary({ children: <p>дзеці</p> });
      eb.context = ctx(lang);
      eb.state = { error: new Error('Сапсаваная <спасылка>') };
      const html = renderToStaticMarkup(eb.render());
      expect(html).toContain('<main class="wrap">');
      expect(html).toContain(t.errTitle);
      expect(html).toContain('Сапсаваная &lt;спасылка&gt;');
      expect(html).not.toContain('<спасылка>');
      expect(html).toContain(t.errHint);
      expect(html).toContain(`>${t.errRetry}</button>`);
      expect(html).toContain(`<a class="chip" href="${import.meta.env.BASE_URL}">${t.errHome}</a>`);
      expect(html).not.toContain('дзеці');
      expect(html).not.toMatch(/undefined/);
    }
  });

  it('кінуты не-Error (радок) — таксама паказваецца', () => {
    const eb = new ErrorBoundary({});
    eb.context = ctx('be');
    eb.state = { error: 'проста радок' };
    expect(renderToStaticMarkup(eb.render())).toContain('проста радок');
  });

  it('«Паспрабаваць зноў» чысціць хэш і стан', () => {
    vi.stubGlobal('location', { hash: '#/r/broken' });
    const eb = new ErrorBoundary({});
    eb.setState = vi.fn();
    eb.reset();
    expect(globalThis.location.hash).toBe('');
    expect(eb.setState).toHaveBeenCalledWith({ error: null });
  });
});
