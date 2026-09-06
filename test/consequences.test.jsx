import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { LangContext } from '../src/hooks/useLang.jsx';
import { STRINGS } from '../src/lib/i18n.js';

const ITEMS = [
  { i: 0, id: 'm1', list: 'm', n: 1, date: '2026-08-20', added: '', removed: '', editOf: '', replacedBy: '', art: 'kgs', h: 'telegram-канал "свабода"' },
  { i: 1, id: 'f1', list: 'f', n: 1, date: '2021-10-18', added: '', removed: '', editOf: '', replacedBy: '', art: 'mvd', h: 'экстремистское формирование «dze.chat»' },
  { i: 2, id: 'p1', list: 'p', n: 1, date: '2022-03-23', added: '', removed: '', editOf: '', replacedBy: '', art: 'speech', h: 'ковалевский николай николаевич' },
];

const META = {
  updated: '2026-09-03', checked: '2026-09-03', checkedAt: '2026-09-03T08:54:44.489Z', sourceError: null, fallback: false, total: 3,
  formations: { updated: '2026-09-03', checked: '2026-09-03', checkedAt: '2026-09-03T10:14:53.217Z', sourceError: null, total: 1 },
  persons: { updated: '2026-09-05', checked: '2026-09-05', checkedAt: '2026-09-05T14:04:18.967Z', sourceError: null, total: 1 },
};

let currentQuery = '';

vi.mock('../src/hooks/useIndex.js', () => ({
  useIndex: () => ({
    status: 'ready',
    error: null,
    meta: META,
    items: ITEMS,
    chunkSize: 200,
    counts: { m: 1, f: 1, p: 1 },
    reload: () => {},
    refreshing: false,
    refreshError: null,
    checkedAt: null,
  }),
}));

vi.mock('../src/hooks/useQuery.js', () => ({
  useQuery: () => [currentQuery, (q) => { currentQuery = q; }],
}));

// у App праз useLocalStorage жыве толькі сартаванне; фільтр спіса — у useState, таму яго тут не падмяніць
// (логіка фільтраў правяраецца ў test/results.test.js праз чыстую deriveResults)
vi.mock('../src/hooks/useLocalStorage.js', () => ({
  useLocalStorage: (key, initial) => [key === 'sort' ? 'newest' : initial, () => {}],
}));

vi.mock('../src/hooks/useHashRoute.js', () => ({
  useHashRoute: () => ({ name: '', arg: '' }),
  href: (p) => `#/${p}`,
}));

vi.mock('../src/hooks/useOnline.js', () => ({
  useOnline: () => true,
}));

vi.mock('../src/hooks/useWatchlist.js', () => ({
  useWatchlist: () => ({
    has: () => false,
    add: () => {},
    remove: () => {},
    entries: [],
    checks: [],
    notify: false,
    setNotify: () => {},
    reload: () => {},
  }),
}));

vi.mock('../src/hooks/useRecord.js', () => ({
  useRecord: () => null,
}));

let App;
beforeAll(async () => {
  globalThis.location = { href: 'https://elist.test/', hash: '', origin: 'https://elist.test', pathname: '/' };
  globalThis.history = { state: null, replaceState() {} };
  const mockStorage = new Map();
  globalThis.localStorage = {
    getItem: (k) => mockStorage.get(k) ?? null,
    setItem: (k, v) => mockStorage.set(k, String(v)),
    removeItem: (k) => mockStorage.delete(k),
    clear: () => mockStorage.clear(),
  };
  ({ default: App } = await import('../src/App.jsx'));
});

describe('Consequences («Што гэта значыць для мяне»): паказваецца толькі пры наяўнасці супадзенняў у пошуку', () => {
  const renderApp = (lang = 'be') => renderToStaticMarkup(
    <LangContext.Provider value={{ lang, t: STRINGS[lang], setLang: () => {} }}>
      <App />
    </LangContext.Provider>
  );

  beforeEach(() => { currentQuery = ''; });

  it('калі радок пошуку пусты — блок наступстваў схаваны, зводка схаваная візуальна (лічбы на ўкладках), укладкі ёсць', () => {
    const html = renderApp();
    expect(html).not.toContain('class="legal"');
    expect(html).not.toContain(`<summary>${STRINGS.be.legalTitle}</summary>`);
    expect(html).toContain(`<p class="vh" aria-live="polite">${STRINGS.be.total(3)}</p>`);
    expect(html).toContain('class="facets"');
    expect(html).toContain('option value="newest" selected'); // сартаванне з localStorage сапраўды дайшло да select
  });

  it('калі ёсць пошукавы запыт і знойдзены супадзенні — блок наступстваў паказваецца, зводка «знойдзена»', () => {
    currentQuery = 'свабода';
    const html = renderApp();
    expect(html).toContain('class="legal"');
    expect(html).toContain(`<summary>${STRINGS.be.legalTitle}</summary>`);
    expect(html).toContain(STRINGS.be.found(1));
  });

  it('калі пошукавы запыт не даў ніводнага супадзення — блок схаваны, зводка «нічога»', () => {
    currentQuery = 'неіснуючызапыт12345';
    const html = renderApp();
    expect(html).not.toContain('class="legal"');
    expect(html).not.toContain(`<summary>${STRINGS.be.legalTitle}</summary>`);
    expect(html).toContain(STRINGS.be.nothing);
  });
});
