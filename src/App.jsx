import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useIndex } from './hooks/useIndex.js';
import { useQuery } from './hooks/useQuery.js';
import { useLocalStorage } from './hooks/useLocalStorage.js';
import { useLang } from './hooks/useLang.jsx';
import { useHashRoute } from './hooks/useHashRoute.js';
import { useWatchlist } from './hooks/useWatchlist.js';
import { useOnline } from './hooks/useOnline.js';
import { search } from './lib/search.js';
import { parseQuery } from './lib/normalize.js';
import { variants } from './lib/translit.js';
import { corpusWords, similarWords } from './lib/fuzzy.js';
import { isRecent } from './lib/format.js';
import { queryLink } from './lib/entry.js';
import { showNotification } from './lib/notifications.js';
import { wipeBrowserData } from './lib/wipe.js';
import Header from './components/Header.jsx';
import Nav from './components/Nav.jsx';
import SearchBar from './components/SearchBar.jsx';
import Options from './components/Options.jsx';
import ResultList from './components/ResultList.jsx';
import WatchPanel from './components/WatchPanel.jsx';
import WhatsNew from './components/WhatsNew.jsx';
import RecordPage from './components/RecordPage.jsx';
import StatsPage from './components/StatsPage.jsx';
import Consequences from './components/Consequences.jsx';
import HelpDialog from './components/HelpDialog.jsx';
import { LINKS } from './lib/i18n.js';

/** Дакладны пошук; калі пуста — транслітарацыя + прыблізныя словы. */
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
  const { t, lang } = useLang();
  const { status, error, meta, items, chunkSize, counts, reload, refreshing, refreshError, checkedAt } = useIndex();
  const route = useHashRoute();
  const online = useOnline();
  const watch = useWatchlist(items);
  // Запыт — у стане і history.state укладкі, не ў адрасным радку (гл. lib/entry.js).
  const [query, setQuery] = useQuery();
  const [sort, setSort] = useLocalStorage('sort', 'newest');
  const [flags, setFlags] = useState({ any: false, onlyNew: false, list: '' }); // list: '' | 'm' | 'f' — абодва / матэрыялы / фарміраванні
  const [help, setHelp] = useState(false);
  const [copied, setCopied] = useState(false);
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
    setFlags({ any: false, onlyNew: false, list: '' });
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

  const active = tokens.length > 0 || opts.onlyNew || Boolean(opts.list);
  const newCount = items ? items.filter((it) => !it.replacedBy && isRecent(it.added)).length : 0;
  // другі спіс (экстрэмісцкія фарміраванні): пераключальнік і асобны падлік — толькі калі ён ёсць у базе
  const hasLists = Boolean(counts?.f);
  const fInResults = useMemo(() => results.reduce((n, r) => n + (r.list === 'f' ? 1 : 0), 0), [results]);
  // «Усяго запісаў» — адно правіла ўсюды (шапка, статыстыка, FAQ): запісы, якія цяпер ёсць у спісе — без выдаленых і старых версій
  const live = useMemo(() => results.reduce((c, r) => { if (!r.removed) c[r.list === 'f' ? 'f' : 'm']++; return c; }, { m: 0, f: 0 }), [results]);

  return (
    <>
      <Header meta={meta} online={online} onHelp={() => setHelp(true)} />
      <HelpDialog open={help} onClose={() => setHelp(false)} />
      <Nav route={['new', 'r', 'stats'].includes(route.name) ? route.name : ''} newCount={newCount} />
      <main className="wrap">
        {status === 'ready' && route.name === 'new' && <WhatsNew items={items} chunkSize={chunkSize} />}
        {status === 'ready' && route.name === 'r' && <RecordPage id={route.arg} items={items} chunkSize={chunkSize} watch={watch} />}
        {route.name === 'stats' && (status === 'ready' ? <StatsPage items={items} initialList={route.arg === 'f' ? 'f' : 'm'} /> : <p className="summary">{status === 'error' ? t.loadError(error) : t.loading}</p>)}
        {!['new', 'r', 'stats'].includes(route.name) && (
          <>
            <div className="search">
              <SearchBar value={query} onChange={setQuery} />
              <Options value={opts} onChange={setOpts} watch={watchChip} share={shareChip} lists={hasLists} />
            </div>
            {status === 'loading' && <p className="summary">{t.loading}</p>}
            {status === 'error' && <p className="summary error">{t.loadError(error)}</p>}
            {status === 'ready' && (
              <>
                {!active && (
                  <WatchPanel
                    watch={watch} meta={meta} refreshing={refreshing} refreshError={refreshError} checkedAt={checkedAt}
                    onReload={reload} onOpen={openWatch} onClearAll={clearAll}
                  />
                )}
                <p className="summary" aria-live="polite">
                  {!active ? (hasLists ? t.totalBoth(live.m, live.f) : t.total(live.m + live.f)) : mode === 'fuzzy' ? t.fuzzy(results.length) : results.length ? t.found(results.length) : t.nothing}
                </p>
                {active && results.length > 0 && <Consequences formations={fInResults > 0} />}
                <ResultList results={results} tokens={hl} chunkSize={chunkSize} />
              </>
            )}
          </>
        )}
      </main>
      <footer className="wrap foot">
        <p>
          {t.footSrc1}<a href={LINKS.mininform} target="_blank" rel="noopener noreferrer">{t.footSrcM}</a>{t.footSrc2}<a href={LINKS.mvd} target="_blank" rel="noopener noreferrer">{t.footSrcF}</a>{t.footSrc3}
          <strong className="travel-warn">{t.footSrcWarn}</strong>
        </p>
        <p>{t.privacy} <button type="button" className="linklike" onClick={clearAll}>{t.clearAll}</button>.</p>
        <p>{t.mirror}</p>
        <p>{t.issues1}<a href="https://github.com/it-beard/elist/issues" target="_blank" rel="noopener">{t.issues2}</a>{t.issues3}</p>
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
