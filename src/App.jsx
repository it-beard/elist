import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useIndex } from './hooks/useIndex.js';
import { useUrlParam } from './hooks/useUrlParam.js';
import { useLocalStorage } from './hooks/useLocalStorage.js';
import { useLang } from './hooks/useLang.jsx';
import { search } from './lib/search.js';
import { parseQuery } from './lib/normalize.js';
import { NEW_DAYS } from './lib/format.js';
import Header from './components/Header.jsx';
import SearchBar from './components/SearchBar.jsx';
import Options from './components/Options.jsx';
import ResultList from './components/ResultList.jsx';

export default function App() {
  const { t } = useLang();
  const { status, error, meta, items, chunkSize } = useIndex();
  const [query, setQuery] = useUrlParam('q');
  const [sort, setSort] = useLocalStorage('sort', 'newest');
  const [flags, setFlags] = useState({ any: false, onlyNew: false });
  const opts = useMemo(() => ({ ...flags, sort }), [flags, sort]);
  const setOpts = ({ sort: s, ...rest }) => { if (s !== sort) setSort(s); setFlags(rest); };
  const deferredQuery = useDeferredValue(query);

  const tokens = useMemo(() => parseQuery(deferredQuery), [deferredQuery]);
  const results = useMemo(() => (items ? search(items, tokens, opts) : []), [items, tokens, opts]);

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

  const active = tokens.length > 0 || opts.onlyNew;
  return (
    <>
      <Header meta={meta} items={items} />
      <main className="wrap">
        <div className="search">
          <SearchBar value={query} onChange={setQuery} />
          <Options value={opts} onChange={setOpts} />
        </div>
        {status === 'loading' && <p className="summary">{t.loading}</p>}
        {status === 'error' && <p className="summary error">{t.loadError(error)}</p>}
        {status === 'ready' && (
          <>
            <p className="summary" aria-live="polite">
              {!active ? t.total(results.length) : results.length ? t.found(results.length) : t.nothing}
            </p>
            <ResultList results={results} tokens={tokens} chunkSize={chunkSize} />
          </>
        )}
      </main>
      <footer className="wrap foot">
        <p>
          {t.footSource}
          {meta && <> — <a href={meta.sourcePage} target="_blank" rel="noopener">{t.source}</a></>}. {t.footUpdate}
        </p>
        <p>{t.footNew1(NEW_DAYS)}<em>{t.footNew2}</em>{t.footNew3}</p>
        <p>{t.privacy}</p>
        <p>
          <a href="https://github.com/it-beard/extremist-by" target="_blank" rel="noopener">{t.code}</a>
          {' · '}{t.tip1}<code>{t.tipPhrase}</code>{t.tip2}<code>/</code>{t.tip3}
        </p>
      </footer>
    </>
  );
}
