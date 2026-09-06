import { useState, useMemo } from 'react';
import { useLang } from '../hooks/useLang.jsx';
import { fmtDate, NEW_DAYS } from '../lib/format.js';
import { fmtNum } from '../lib/faq.js';
import { splitNew, groupByDate, inList, newCounts } from '../lib/whatsnew.js';
import ResultList from './ResultList.jsx';
import Facets from './Facets.jsx';

/**
 * Старонка «Новае»: запісы, што з’явіліся ў спісе за апошнія NEW_DAYS дзён, па даце з’яўлення;
 * зніклыя за той жа час — па асобным пераключальніку «Выдаленыя». Укладкі-спісы (як у пошуку)
 * абмяжоўваюць і тое, і другое адным спісам. Логіка — у lib/whatsnew.js; ResultList сам паказвае старонкамі.
 */
export default function WhatsNew({ items, chunkSize, lists = {} }) {
  const { t } = useLang();
  const [list, setList] = useState('');
  const [showRemoved, setShowRemoved] = useState(false);
  const hasLists = Boolean(lists.f || lists.p);

  const split = useMemo(() => splitNew(items || []), [items]);
  const counts = useMemo(() => newCounts(split), [split]);
  const groups = useMemo(() => groupByDate(split.added, list), [split, list]);
  const removed = useMemo(() => inList(split.removed, list), [split, list]);
  const fallback = useMemo(() => (split.fallback ? inList(split.fallback, list) : null), [split, list]);
  const empty = [];

  return (
    <>
      <h2 className="page-title">{t.newTitle}</h2>
      <p className="hint">{t.newIntro(NEW_DAYS)}</p>

      <div className="new-toolbar">
        {hasLists && <Facets counts={showRemoved ? counts.removed : counts.added} value={list} onChange={setList} lists={lists} />}
        {hasLists && <div className="filter-divider" aria-hidden="true" />}
        <div className="new-actions">
          <button
            type="button"
            className={`facet removed-facet${showRemoved ? ' on' : ''}${!counts.removed.all && !showRemoved ? ' zero' : ''}`}
            aria-pressed={showRemoved}
            title={t.showRemovedTitle(NEW_DAYS)}
            onClick={() => setShowRemoved((v) => !v)}
          >
            <i className="dot removed-dot" aria-hidden="true" />
            {t.showRemoved}
            <span className="cnt">{fmtNum(showRemoved && list ? counts.removed[list] : counts.removed.all)}</span>
          </button>
        </div>
      </div>

      {showRemoved ? (
        <section className="group">
          <h3 className="group-title">{t.newRemovedGroup(removed.length)}</h3>
          {removed.length > 0 ? (
            <ResultList results={removed} tokens={empty} chunkSize={chunkSize} />
          ) : (
            <p className="summary">{t.newRemovedNone(NEW_DAYS)}</p>
          )}
        </section>
      ) : fallback ? (
        <>
          <p className="summary">{t.newFallback}</p>
          {fallback.length > 0 ? (
            <ResultList results={fallback} tokens={empty} chunkSize={chunkSize} />
          ) : (
            <p className="summary">{t.newFilterEmpty(NEW_DAYS)}</p>
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
        <p className="summary">{list ? t.newFilterEmpty(NEW_DAYS) : t.newNone(NEW_DAYS)}</p>
      )}
    </>
  );
}
