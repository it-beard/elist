import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { LangContext } from '../src/hooks/useLang.jsx';
import { STRINGS } from '../src/lib/i18n.js';
import { useLocalStorage } from '../src/hooks/useLocalStorage.js';
import ThemeToggle from '../src/components/ThemeToggle.jsx';

// Захаванае значэнне падаецца напрамую (як яго вярнуў бы useLocalStorage пасля JSON.parse), а set — запісваецца.
let stored;
let written;
vi.mock('../src/hooks/useLocalStorage.js', () => ({
  useLocalStorage: vi.fn((key, initial) => [stored === undefined ? initial : stored, (v) => { written = typeof v === 'function' ? v(stored) : v; }]),
}));

const ICON = { light: 'r="4"', dark: 'M20 14.5', system: 'M12 3a9 9' };
const provider = (lang, el) => <LangContext.Provider value={{ lang, t: STRINGS[lang], setLang: () => {} }}>{el}</LangContext.Provider>;
const render = (lang = 'be') => renderToStaticMarkup(provider(lang, <ThemeToggle />));
/** Сам элемент кнопкі (кампанент выкліканы як функцыя ўнутры рэндэру) — каб націснуць onClick. */
function button(lang = 'be') {
  let el;
  function Probe() { el = ThemeToggle(); return el; }
  renderToStaticMarkup(provider(lang, <Probe />));
  return el;
}

beforeEach(() => { stored = undefined; written = undefined; });

describe('ThemeToggle', () => {
  it('чытае useLocalStorage("theme", "light"); па змаўчанні — светлая', () => {
    const h = render();
    expect(useLocalStorage).toHaveBeenCalledWith('theme', 'light');
    expect(h).toContain('class="theme"');
    expect(h).toContain(`aria-label="${STRINGS.be.theme.light}"`);
    expect(h).toContain(`title="${STRINGS.be.theme.light} — ${STRINGS.be.themeHint}"`);
    expect(h).toContain(ICON.light);
  });

  it.each(['light', 'dark', 'system'])('захаванае «%s» — свая іконка і подпіс на абедзвюх мовах', (mode) => {
    stored = mode;
    for (const lang of ['be', 'en']) {
      const h = render(lang);
      expect(h).toContain(`aria-label="${STRINGS[lang].theme[mode]}"`);
      expect(h).toContain(ICON[mode]);
      for (const other of Object.keys(ICON).filter((m) => m !== mode)) expect(h).not.toContain(ICON[other]);
      expect(h).not.toMatch(/undefined/);
    }
  });

  it.each(['bogus', 'DARK', '', null, 42, {}, []])('невядомае ці сапсаванае значэнне (%j) — як светлая, без «undefined» у подпісе', (bad) => {
    stored = bad;
    const h = render();
    expect(h).toContain(`aria-label="${STRINGS.be.theme.light}"`);
    expect(h).toContain(ICON.light);
    expect(h).not.toMatch(/undefined/);
  });

  it('клік ідзе па коле light → dark → system → light', () => {
    stored = 'light'; button().props.onClick(); expect(written).toBe('dark');
    stored = 'dark'; button().props.onClick(); expect(written).toBe('system');
    stored = 'system'; button().props.onClick(); expect(written).toBe('light');
  });

  it('з невядомага значэння клік вядзе на цёмную (як са светлай), а не на «undefined»', () => {
    stored = 'bogus';
    button().props.onClick();
    expect(written).toBe('dark');
  });
});
