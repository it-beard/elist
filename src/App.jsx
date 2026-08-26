import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useIndex } from './hooks/useIndex.js';
import { useUrlParam } from './hooks/useUrlParam.js';
import { useLocalStorage } from './hooks/useLocalStorage.js';
import { useLang } from './hooks/useLang.jsx';
import { useHashRoute } from './hooks/useHashRoute.js';
import { useWatchlist } from './hooks/useWatchlist.js';
import { useOnline } from './hooks/useOnline.js';
import { search } from './lib/search.js';
import { parseQuery } from './lib/normalize.js';
import { variants } from './lib/translit.js';
import { corpusWords, similarWords } from './lib/fuzzy.js';
import { NEW_DAYS, isRecent } from './lib/format.js';
import Header from './components/Header.jsx';
import Nav from './components/Nav.jsx';
import SearchBar from './components/SearchBar.jsx';
import Options from './components/Options.jsx';
import ResultList from './components/ResultList.jsx';
import WatchPanel from './components/WatchPanel.jsx';
import WhatsNew from './components/WhatsNew.jsx';
import RecordPage from './components/RecordPage.jsx';
import Consequences from './components/Consequences.jsx';

/** Дакладны пошук; калі пуста — трансьлітарацыя + прыблізныя словы. */
function runSearch(items, tokens, opts) {
  const vTokens = tokens.map(variants);
  const exact = search(items, vTokens, opts);
  if (exact.length || !tokens.length) return { results: exact, mode: 'exact', hl: vTokens };
  const words = corpusWords(items);
  const fz = tokens.map((t, i) => [...vTokens[i], ...similarWords(words, t)]);
  if (fz.every((v, i) => v.length === vTokens[i].length)) return { results: [], mode: 'exact', hl: vTokens };
  const results = search(items, fz, opts);
  return { results, mode: results.length ? 'fuzzy' : 'exact', hl: fz };
}

export default function App() {
  const { t } = useLang();
  const { status, error, meta, items, chunkSize, reload, refreshing, refreshError, checkedAt } = useIndex();
  const route = useHashRoute();
  const online = useOnline();
  const watch = useWatchlist(items);
  const [query, setQuery] = useUrlParam('q');
  const [sort, setSort] = useLocalStorage('sort', 'newest');
  const [flags, setFlags] = useState({ any: false, onlyNew: false });
  const opts = useMemo(() => ({ ...flags, sort }), [flags, sort]);
  const setOpts = ({ sort: s, ...rest }) => { if (s !== sort) setSort(s); setFlags(rest); };
  const deferredQuery = useDeferredValue(query);

  const tokens = useMemo(() => parseQuery(deferredQuery), [deferredQuery]);
  const { results, mode, hl } = useMemo(
    () => (items ? runSearch(items, tokens, opts) : { results: [], mode: 'exact', hl: [] }),
    [items, tokens, opts],
  );

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
        e.preventDefault();
        document.getElementById('q')?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // Апавяшчэньне пра новыя супадзеньні — раз на загрузку, толькі калі карыстальнік уключыў.
  const notified = useRef(false);
  const freshTotal = watch.checks.reduce((n, c) => n + c.fresh.length, 0);
  useEffect(() => {
    if (!watch.notify || notified.current || !freshTotal || typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    notified.current = true;
    try { new Notification(t.notifyTitle(freshTotal), { body: watch.checks.filter((c) => c.fresh.length).map((c) => c.entry.q).join(', ') }); } catch { /* iOS без PWA */ }
  }, [freshTotal, watch.notify, watch.checks, t]);

  const openWatch = (entry, matches) => {
    watch.markSeen(entry.q, matches.map((m) => m.id));
    setFlags({ any: false, onlyNew: false });
    setQuery(entry.q);
    route.go('');
  };
  const clearAll = () => {
    if (!confirm(t.clearAllConfirm)) return;
    watch.clear();
    setQuery('');
    try { localStorage.clear(); } catch { /* ignore */ }
  };
  const watchChip = query.trim() && status === 'ready' ? {
    on: watch.has(query),
    toggle: () => (watch.has(query) ? watch.remove(query) : watch.add(query, results.map((r) => r.id))),
  } : null;

  const active = tokens.length > 0 || opts.onlyNew;
  const newCount = items ? items.filter((it) => isRecent(it.added)).length : 0;

  return (
    <>
      <Header meta={meta} items={items} online={online} />
      <Nav route={route.name === 'new' ? 'new' : route.name === 'r' ? 'r' : ''} newCount={newCount} />
      <main className="wrap">
        {status === 'loading' && <p className="summary">{t.loading}</p>}
        {status === 'error' && <p className="summary error">{t.loadError(error)}</p>}
        {status === 'ready' && route.name === 'new' && <WhatsNew items={items} chunkSize={chunkSize} />}
        {status === 'ready' && route.name === 'r' && <RecordPage id={route.arg} items={items} chunkSize={chunkSize} meta={meta} watch={watch} />}
        {route.name !== 'new' && route.name !== 'r' && (
          <>
            <div className="search">
              <SearchBar value={query} onChange={setQuery} />
              <Options value={opts} onChange={setOpts} watch={watchChip} />
            </div>
            {status === 'ready' && (
              <>
                {!active && (
                  <WatchPanel
                    watch={watch} meta={meta} refreshing={refreshing} refreshError={refreshError} checkedAt={checkedAt}
                    onReload={reload} onOpen={openWatch} onClearAll={clearAll}
                  />
                )}
                <p className="summary" aria-live="polite">
                  {!active ? t.total(results.length) : mode === 'fuzzy' ? t.fuzzy(results.length) : results.length ? t.found(results.length) : t.nothing}
                </p>
                {active && results.length > 0 && <Consequences />}
                <ResultList results={results} tokens={hl} chunkSize={chunkSize} />
              </>
            )}
          </>
        )}
      </main>
      <footer className="wrap foot">
        <p>
          {t.footSource}
          {meta && <> — <a href={meta.sourcePage} target="_blank" rel="noopener">{t.source}</a></>}. {t.footUpdate}
        </p>
        <p>{t.footNew1(NEW_DAYS)}<em>{t.footNew2}</em>{t.footNew3}</p>
        <p>{t.privacy} <button type="button" className="linklike" onClick={clearAll}>{t.clearAll}</button>.</p>
        <p>{t.mirror}</p>
        <p>
          <a href="https://github.com/it-beard/extremist-by" target="_blank" rel="noopener">{t.code}</a>
          {' · '}<a href={`${import.meta.env.BASE_URL}feed.xml`}>RSS</a>
          {' · '}{t.tip1}<code>{t.tipPhrase}</code>{t.tip2}<code>/</code>{t.tip3}
        </p>
      </footer>
    </>
  );
}
