import { useState, useMemo } from 'react';
import { useLang } from '../hooks/useLang.jsx';
import { fmtDate, isRecent, NEW_DAYS } from '../lib/format.js';
import { fmtNum } from '../lib/faq.js';
import { search } from '../lib/search.js';
import ResultList from './ResultList.jsx';
import Facets from './Facets.jsx';

const FALLBACK = 60;

/**
 * Старонка «Новае»: запісы, што з’явіліся ў спісе за апошнія NEW_DAYS дзён (тое ж акно, што і лічыльнік на ўкладцы),
 * па даце з’яўлення; зніклыя за той жа час — па асобным фільтры «Выдаленыя».
 * Падтрымлівае фільтрацыю па спісах (матэрыялы, фарміраванні, асобы) па аналогіі з пошукам.
 */
export default function WhatsNew({ items, chunkSize, lists }) {
  const { t } = useLang();
  const [list, setList] = useState('');
  const [showRemoved, setShowRemoved] = useState(false);

  const availableLists = useMemo(() => ({
    f: Boolean(lists?.f ?? items?.some((it) => it.list === 'f')),
    p: Boolean(lists?.p ?? items?.some((it) => it.list === 'p')),
  }), [lists, items]);
  const hasLists = availableLists.f || availableLists.p;

  const { addedItems, removedItems, fallback } = useMemo(() => {
    const added = [];
    const removed = [];
    if (items) {
      for (const it of items) {
        if (it.replacedBy) continue;
        if (isRecent(it.added)) added.push(it);
        if (isRecent(it.removed)) removed.push(it);
      }
    }
    removed.sort((a, b) => (b.removed || '').localeCompare(a.removed || ''));
    const hasHistory = Boolean(items?.some((it) => it.added));
    const fallback = hasHistory || !items ? null : search(items, [], { sort: 'newest' }).slice(0, FALLBACK);
    return { addedItems: added, removedItems: removed, fallback };
  }, [items]);

  const addedCounts = useMemo(() => {
    const res = { all: addedItems.length, m: 0, f: 0, p: 0 };
    for (const it of addedItems) {
      const k = it.list || 'm';
      if (k in res) res[k]++;
    }
    return res;
  }, [addedItems]);

  const removedCounts = useMemo(() => {
    const res = { all: removedItems.length, m: 0, f: 0, p: 0 };
    for (const it of removedItems) {
      const k = it.list || 'm';
      if (k in res) res[k]++;
    }
    return res;
  }, [removedItems]);

  const groups = useMemo(() => {
    const byDate = new Map();
    for (const it of addedItems) {
      if (list && (it.list || 'm') !== list) continue;
      (byDate.get(it.added) || byDate.set(it.added, []).get(it.added)).push(it);
    }
    return [...byDate.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([d, l]) => [d, l.sort((a, b) => b.i - a.i)]);
  }, [addedItems, list]);

  const filteredRemoved = useMemo(() => {
    const arr = list ? removedItems.filter((it) => (it.list || 'm') === list) : removedItems;
    return arr.slice(0, FALLBACK);
  }, [removedItems, list]);

  const fallbackList = useMemo(() => {
    if (!fallback) return null;
    return list ? fallback.filter((it) => (it.list || 'm') === list) : fallback;
  }, [fallback, list]);

  const facetCounts = showRemoved ? removedCounts : addedCounts;
  const empty = [];

  return (
    <>
      <h2 className="page-title">{t.newTitle}</h2>
      <p className="hint">{t.newIntro(NEW_DAYS)}</p>

      <div className="new-toolbar">
        {hasLists && (
          <Facets counts={facetCounts} value={list} onChange={setList} lists={availableLists} />
        )}
        {hasLists && <div className="filter-divider" aria-hidden="true" />}
        <div className="new-actions">
          <button
            type="button"
            className={`facet removed-facet${showRemoved ? ' on' : ''}${!removedCounts.all && !showRemoved ? ' zero' : ''}`}
            aria-pressed={showRemoved}
            title={t.showRemovedTitle}
            onClick={() => setShowRemoved((v) => !v)}
          >
            <i className="dot removed-dot" aria-hidden="true" />
            {t.showRemoved}
            <span className="cnt">{fmtNum(showRemoved && list ? removedCounts[list] || 0 : removedCounts.all)}</span>
          </button>
        </div>
      </div>

      {showRemoved ? (
        <section className="group">
          <h3 className="group-title">{t.newRemovedGroup(filteredRemoved.length)}</h3>
          {filteredRemoved.length > 0 ? (
            <ResultList results={filteredRemoved} tokens={empty} chunkSize={chunkSize} />
          ) : (
            <p className="summary">{t.newRemovedNone(NEW_DAYS)}</p>
          )}
        </section>
      ) : fallbackList ? (
        <>
          <p className="summary">{t.newFallback}</p>
          {fallbackList.length > 0 ? (
            <ResultList results={fallbackList} tokens={empty} chunkSize={chunkSize} />
          ) : (
            <p className="summary">{t.newFilterEmpty}</p>
          )}
        </>
      ) : groups.length > 0 ? (
        groups.map(([d, listItems]) => (
          <section key={d} className="group">
            <h3 className="group-title">{t.newUpdate(fmtDate(d), listItems.length)}</h3>
            <ResultList results={listItems} tokens={empty} chunkSize={chunkSize} />
          </section>
        ))
      ) : (
        <p className="summary">{list ? t.newFilterEmpty : t.newNone(NEW_DAYS)}</p>
      )}
    </>
  );
}
