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
  const [opts, setOpts] = useState({ any: false, onlyNew: false, sort: 'newest' });
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
                ? `Усяго запісаў: ${results.length}`
                : results.length
                  ? `Знойдзена: ${results.length}`
                  : 'Нічога не знойдзена. Паспрабуйце карацейшае слова або «Любое са словаў».'}
            </p>
            <ResultList results={results} tokens={tokens} chunkSize={chunkSize} />
          </>
        )}
      </main>
      <footer className="wrap foot">
        <p>
          Неафіцыйны пошук па спісе, які публікуе газета «Звязда» (Мінінфарм)
          {meta && <> — <a href={meta.sourcePage} target="_blank" rel="noopener">крыніца</a></>}. База абнаўляецца аўтаматычна раз на суткі.
        </p>
        <p>
          «Новыя за 30 дзён» — запісы, якія за гэты час <em>з'явіліся ў самім спісе</em> (яны пазначаныя бэйджам «новае»).
          Сартыроўка «спачатку новыя» — па даце судовага рашэння, а яна можа быць на месяцы ранейшай за публікацыю.
        </p>
        <p>
          Сайт нічога не захоўвае: ні запыты, ні cookies, ні статыстыку. Усё працуе ў вашым браўзэры.
        </p>
        <p>
          <a href="https://github.com/it-beard/extremist-by" target="_blank" rel="noopener">Код сайта на GitHub</a>
          {' · '}Падказка: фраза ў лапках <code>"словы запар"</code>, клавіша <code>/</code> — у поле пошуку.
        </p>
      </footer>
    </>
  );
}
