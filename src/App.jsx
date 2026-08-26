import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useIndex } from './hooks/useIndex.js';
import { useUrlParam } from './hooks/useUrlParam.js';
import { search } from './lib/search.js';
import { parseQuery } from './lib/normalize.js';
import Header from './components/Header.jsx';
import SearchBar from './components/SearchBar.jsx';
import Options from './components/Options.jsx';
import ResultList from './components/ResultList.jsx';

export default function App() {
  const { status, error, meta, items, chunkSize } = useIndex();
  const [query, setQuery] = useUrlParam('q');
  const [opts, setOpts] = useState({ any: false, onlyNew: false, sort: 'source' });
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
        {status === 'loading' && <p className="summary">Загрузка індэкса…</p>}
        {status === 'error' && <p className="summary error">Не ўдалося загрузіць базу: {error}</p>}
        {status === 'ready' && (
          <>
            <p className="summary" aria-live="polite">
              {!active
                ? `Усяго запісаў: ${results.length}. Увядзіце запыт для пошуку.`
                : results.length
                  ? `Знойдзена: ${results.length}`
                  : 'Нічога не знойдзена — паспрабуйце карацейшае слова або ўключыце «любое са словаў».'}
            </p>
            <ResultList results={results} tokens={tokens} chunkSize={chunkSize} />
          </>
        )}
      </main>
      <footer className="wrap foot">
        Неафіцыйны пошук. Даныя — з афіцыйнага спісу, які публікуе газета «Звязда» (Мінінфарм).
        База абнаўляецца аўтаматычна раз на суткі праз GitHub Actions.
      </footer>
    </>
  );
}
