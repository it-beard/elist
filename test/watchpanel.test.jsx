import { describe, it, expect, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { LangContext } from '../src/hooks/useLang.jsx';
import { STRINGS } from '../src/lib/i18n.js';
import WatchPanel from '../src/components/WatchPanel.jsx';

describe('WatchPanel: закрытасць па змаўчанні і захаванне ў localStorage', () => {
  const mockStorage = new Map();
  beforeEach(() => {
    mockStorage.clear();
    globalThis.localStorage = {
      getItem: (k) => mockStorage.get(k) ?? null,
      setItem: (k, v) => mockStorage.set(k, String(v)),
      removeItem: (k) => mockStorage.delete(k),
      clear: () => mockStorage.clear(),
    };
  });

  const baseWatch = {
    entries: [{ q: 'тэст' }],
    checks: [{ entry: { q: 'тэст' }, matches: [], fresh: [] }],
    remove: () => {},
    notify: false,
    setNotify: () => {},
  };

  const render = (el) => renderToStaticMarkup(
    <LangContext.Provider value={{ lang: 'be', t: STRINGS.be, setLang: () => {} }}>
      {el}
    </LangContext.Provider>
  );

  it('па змаўчанні (пры чыстым localStorage) спіс схаваны', () => {
    const html = render(<WatchPanel watch={baseWatch} visible={true} />);
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('hidden=""');
  });

  it('пры націску на кнопку стэйт адкрытасці захоўваецца ў localStorage як true', () => {
    let toggleBtn;
    render(<WatchPanel watch={baseWatch} visible={true} renderControls={(toggle) => { toggleBtn = toggle; return toggle; }} />);
    expect(toggleBtn).toBeDefined();

    // Клік для адкрыцця
    toggleBtn.props.onClick();
    expect(globalThis.localStorage.getItem('watchOpen')).toBe('true');
  });

  it('пры наступнай загрузцы (перазагрузцы) са захаваным true спіс адкрыты', () => {
    globalThis.localStorage.setItem('watchOpen', 'true');
    const html = render(<WatchPanel watch={baseWatch} visible={true} />);
    expect(html).toContain('aria-expanded="true"');
    expect(html).not.toMatch(/<section[^>]*hidden=""/);
  });

  it('пры паўторным кліку стэйт закрываецца і захоўваецца як false', () => {
    globalThis.localStorage.setItem('watchOpen', 'true');
    let toggleBtn;
    render(<WatchPanel watch={baseWatch} visible={true} renderControls={(toggle) => { toggleBtn = toggle; return toggle; }} />);
    toggleBtn.props.onClick();
    expect(globalThis.localStorage.getItem('watchOpen')).toBe('false');

    // Пры перазагрузцы са захаваным false спіс зноў схаваны
    const html = render(<WatchPanel watch={baseWatch} visible={true} />);
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('hidden=""');
  });

  it('бэйдж адлюстроўвае запыты/супадзенні (напрыклад "2/3") калі супадзенняў больш за 0, і проста колькасць калі 0', () => {
    const watchWithHits = {
      entries: [{ q: 'тэст1' }, { q: 'тэст2' }],
      checks: [
        { entry: { q: 'тэст1' }, matches: [{ id: 1 }, { id: 2 }], fresh: [] },
        { entry: { q: 'тэст2' }, matches: [{ id: 3 }], fresh: [] },
      ],
      remove: () => {},
      notify: false,
      setNotify: () => {},
    };
    const htmlHits = render(<WatchPanel watch={watchWithHits} visible={true} />);
    expect(htmlHits).toContain('class="watch-count">2/3</span>');

    const htmlNoHits = render(<WatchPanel watch={baseWatch} visible={true} />);
    expect(htmlNoHits).toContain('class="watch-count">1</span>');
  });

  it('кнопка адлюстроўвае скарочаную назву "Назіранне" і не змяшчае старога "Спіс назірання"', () => {
    const html = render(<WatchPanel watch={baseWatch} visible={true} />);
    expect(html).toContain('class="watch-label">Назіранне</span>');
    expect(html).toContain('class="watch-label-short">Назіранне</span>');
    expect(html).not.toContain('>Спіс назірання<');
  });

  it('у адкрытай панэлі назірання няма падказкі са спасылкай на Telegram-канал', () => {
    globalThis.localStorage.setItem('watchOpen', 'true');
    const html = render(<WatchPanel watch={baseWatch} visible={true} />);
    expect(html).not.toContain('t.me/elist_by');
    expect(html).not.toContain('@elist_by');
    expect(html).not.toContain('Каб даведвацца пра новыя запісы першым');
  });
});
