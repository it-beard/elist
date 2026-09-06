import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useIndex } from './hooks/useIndex.js';
import { useQuery } from './hooks/useQuery.js';
import { useLocalStorage } from './hooks/useLocalStorage.js';
import { useLang } from './hooks/useLang.jsx';
import { useHashRoute } from './hooks/useHashRoute.js';
import { useWatchlist } from './hooks/useWatchlist.js';
import { useOnline } from './hooks/useOnline.js';
import { parseQuery } from './lib/normalize.js';
import { deriveResults, summarize } from './lib/results.js';
import { isRecent } from './lib/format.js';
import { queryLink } from './lib/entry.js';
import { showNotification } from './lib/notifications.js';
import { wipeBrowserData } from './lib/wipe.js';
import Header from './components/Header.jsx';
import Nav from './components/Nav.jsx';
import SearchBar from './components/SearchBar.jsx';
import Options from './components/Options.jsx';
import Facets from './components/Facets.jsx';
import ResultList from './components/ResultList.jsx';
import WatchPanel from './components/WatchPanel.jsx';
import WhatsNew from './components/WhatsNew.jsx';
import RecordPage from './components/RecordPage.jsx';
import StatsPage from './components/StatsPage.jsx';
import Consequences from './components/Consequences.jsx';
import HelpDialog from './components/HelpDialog.jsx';
import { LINKS } from './lib/i18n.js';

const SORTS = ['newest', 'oldest', 'source'];

export default function App() {
  const { t, lang } = useLang();
  const { status, error, meta, items, chunkSize, counts, reload, refreshing, refreshError, checkedAt } = useIndex();
  const route = useHashRoute();
  const online = useOnline();
  const watch = useWatchlist(items);
  // Запыт — у стане і history.state укладкі, не ў адрасным радку (гл. lib/entry.js).
  const [query, setQuery] = useQuery();
  const [storedSort, setSort] = useLocalStorage('sort', 'newest');
  const sort = SORTS.includes(storedSort) ? storedSort : 'newest'; // сапсаванае значэнне ў localStorage — як па змаўчанні
  const [flags, setFlags] = useState({ any: false, list: '' }); // list: '' | 'm' | 'f' | 'p' — усе / матэрыялы / фарміраванні / асобы
  const [help, setHelp] = useState(false);
  const [copied, setCopied] = useState(false);
  const opts = useMemo(() => ({ ...flags, sort }), [flags, sort]);
  const setOpts = ({ sort: s, ...rest }) => { if (s !== sort) setSort(s); setFlags(rest); };
  const deferredQuery = useDeferredValue(query);

  const tokens = useMemo(() => parseQuery(deferredQuery), [deferredQuery]);
  // выдача, лічбы на ўкладках-спісах і зводка — адна чыстая функцыя (гл. lib/results.js)
  const derived = useMemo(() => deriveResults(items, tokens, opts), [items, tokens, opts]);
  const { results, hl, list, searching, facetCounts, shown } = derived;
  const sum = summarize(derived);
  const summaryText = sum.kind === 'nothing' ? t.nothing : t[sum.kind](sum.n);

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

  // Апавяшчэнне пра новыя супадзенні — раз на загрузку, толькі калі карыстальнік уключыў.
  // Без назваў запытаў у тэксце: апавяшчэнне бачна і на заблакаваным экране.
  const notified = useRef(false);
  const freshTotal = watch.checks.reduce((n, c) => n + c.fresh.length, 0);
  useEffect(() => {
    if (!watch.notify || notified.current || !freshTotal || typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    notified.current = true;
    showNotification(t.notifyTitle(freshTotal), t.notifyBody).catch(() => {});
  }, [freshTotal, watch.notify, t]);

  // Калі карыстальнік сам шукае запыт са спісу назірання — ён бачыць вынікі, пазначаем іх бачанымі.
  const watchedNow = watch.checks.find((c) => c.entry.q === deferredQuery.trim());
  useEffect(() => {
    if (watchedNow && route.name === '') watch.markSeen(watchedNow.entry.q, watchedNow.matches.map((m) => m.id));
  }, [watchedNow, route.name, watch.markSeen]);

  const openWatch = (entry, matches) => {
    watch.markSeen(entry.q, matches.map((m) => m.id));
    setFlags({ any: false, list: '' });
    setQuery(entry.q);
    route.go('');
  };
  const clearAll = async () => {
    if (!confirm(t.clearAllConfirm)) return;
    watch.clear();
    setQuery('');
    await wipeBrowserData();
  };
  // Спасылка на запыт — толькі па просьбе (кнопка «Спасылка»): у адрасны радок запыт не пішацца.
  const copyQueryLink = async () => {
    const link = queryLink(query.trim(), import.meta.env.BASE_URL);
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      if (navigator.share) navigator.share({ title: t.title, url: link }).catch(() => {});
    }
  };
  const watchChip = query.trim() && status === 'ready' ? {
    on: watch.has(query),
    toggle: () => (watch.has(query) ? watch.remove(query) : watch.add(query)),
  } : null;
  const shareChip = query.trim() && status === 'ready' ? { copy: copyQueryLink, copied } : null;

  const newCount = items ? items.filter((it) => !it.replacedBy && isRecent(it.added)).length : 0;
  // дадатковыя спісы (фарміраванні МУС/КДБ, фізічныя асобы МУС): укладкі-спісы і асобны падлік — толькі калі яны ёсць у базе
  const lists = useMemo(() => ({ f: Boolean(counts?.f), p: Boolean(counts?.p) }), [counts]);
  const hasLists = lists.f || lists.p;

  return (
    <>
      <Header meta={meta} online={online} onHelp={() => setHelp(true)} />
      <HelpDialog open={help} onClose={() => setHelp(false)} />
      <Nav route={['new', 'r', 'stats'].includes(route.name) ? route.name : ''} newCount={newCount} />
      <main className="wrap">
        {status === 'ready' && route.name === 'new' && <WhatsNew items={items} chunkSize={chunkSize} lists={lists} />}
        {status === 'ready' && route.name === 'r' && <RecordPage id={route.arg} items={items} chunkSize={chunkSize} watch={watch} />}
        {route.name === 'stats' && (status === 'ready' ? <StatsPage items={items} initialList={['f', 'p'].includes(route.arg) ? route.arg : 'm'} /> : <p className="summary">{status === 'error' ? t.loadError(error) : t.loading}</p>)}
        {!['new', 'r', 'stats'].includes(route.name) && (
          <>
            <WatchPanel
              watch={watch} meta={meta} refreshing={refreshing} refreshError={refreshError} checkedAt={checkedAt}
              onReload={reload} onOpen={openWatch} onClearAll={clearAll} visible={status === 'ready'}
              renderControls={(watchPanel) => (
                <div className="search">
                  <SearchBar value={query} onChange={setQuery} />
                  <Options value={opts} onChange={setOpts} watch={watchChip} share={shareChip} watchPanel={watchPanel} multiWord={tokens.length > 1} />
                </div>
              )}
            />
            {status === 'loading' && <p className="summary">{t.loading}</p>}
            {status === 'error' && <p className="summary error">{t.loadError(error)}</p>}
            {status === 'ready' && (
              <>
                <p className={searching || !hasLists ? 'summary' : 'vh'} aria-live="polite">{summaryText}</p>
                {hasLists && <Facets counts={facetCounts} value={list} onChange={(l) => setFlags((f) => ({ ...f, list: l }))} lists={lists} />}
                {searching && list && !results.length && derived.all.results.length > 0 && <p className="hint">{t.facetEmpty}</p>}
                {searching && results.length > 0 && <Consequences formations={Boolean(shown.f)} persons={Boolean(shown.p)} />}
                <ResultList results={results} tokens={hl} chunkSize={chunkSize} />
              </>
            )}
          </>
        )}
      </main>
      <footer className="wrap foot">
        <p>
          {t.footSrc1}<a href={LINKS.mininform} target="_blank" rel="noopener noreferrer">{t.footSrcM}</a>{t.footSrc2}<a href={LINKS.mvd} target="_blank" rel="noopener noreferrer">{t.footSrcF}</a>{t.footSrc3}<a href={LINKS.mvd} target="_blank" rel="noopener noreferrer">{t.footSrcP}</a>{t.footSrc4}
        </p>
        <p className="travel-warn">⚠️ {t.footSrcWarn}</p>
        <p>{t.footPrivacy} <button type="button" className="linklike" onClick={clearAll}>{t.clearAll}</button>.</p>
        <p>{t.footCode1}<a href="https://github.com/it-beard/elist/issues" target="_blank" rel="noopener">{t.footCode2}</a>{t.footCode3}</p>
        <p>
          <a href={`${import.meta.env.BASE_URL}${lang === 'en' ? 'faq-en.html' : 'faq.html'}`}>{t.faq}</a>
          {' · '}<a href="https://github.com/it-beard/elist" target="_blank" rel="noopener">{t.code}</a>
          {' · '}<a href={LINKS.telegram} target="_blank" rel="noopener">Telegram</a>
          {' · '}<a href={`${import.meta.env.BASE_URL}feed.xml`}>RSS</a>
        </p>
      </footer>
    </>
  );
}
