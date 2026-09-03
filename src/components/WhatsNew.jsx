import { useMemo } from 'react';
import { useLang } from '../hooks/useLang.jsx';
import { fmtDate, isRecent, NEW_DAYS } from '../lib/format.js';
import { search } from '../lib/search.js';
import ResultList from './ResultList.jsx';

const FALLBACK = 60;

/**
 * Старонка «Новае»: запісы, што з’явіліся ў спісе за апошнія NEW_DAYS дзён (тое ж акно, што і лічыльнік на ўкладцы),
 * па даце з’яўлення; зніклыя за той жа час — асобна. Старыя версіі выпраўленых запісаў не паказваем.
 * Спасылак на Telegram і RSS тут няма — яны ў меню зверху.
 */
export default function WhatsNew({ items, chunkSize }) {
  const { t } = useLang();
  const { groups, removed, fallback } = useMemo(() => {
    const byDate = new Map();
    for (const it of items) if (isRecent(it.added) && !it.replacedBy) (byDate.get(it.added) || byDate.set(it.added, []).get(it.added)).push(it);
    const groups = [...byDate.entries()].sort((a, b) => b[0].localeCompare(a[0]))
      .map(([d, list]) => [d, list.sort((a, b) => b.i - a.i)]);
    const removed = items.filter((it) => isRecent(it.removed) && !it.replacedBy).sort((a, b) => b.removed.localeCompare(a.removed)).slice(0, FALLBACK);
    const hasHistory = items.some((it) => it.added);
    const fallback = hasHistory ? null : search(items, [], { sort: 'newest' }).slice(0, FALLBACK);
    return { groups, removed, fallback };
  }, [items]);
  const empty = [];
  return (
    <>
      <h2 className="page-title">{t.newTitle}</h2>
      <p className="hint">{t.newIntro(NEW_DAYS)}</p>
      {fallback ? (
        <>
          <p className="summary">{t.newFallback}</p>
          <ResultList results={fallback} tokens={empty} chunkSize={chunkSize} />
        </>
      ) : groups.map(([d, list]) => (
        <section key={d} className="group">
          <h3 className="group-title">{t.newUpdate(fmtDate(d), list.length)}</h3>
          <ResultList results={list} tokens={empty} chunkSize={chunkSize} />
        </section>
      ))}
      {!fallback && !groups.length && <p className="summary">{t.newNone(NEW_DAYS)}</p>}
      {removed.length > 0 && (
        <section className="group">
          <h3 className="group-title">{t.newRemovedGroup(removed.length)}</h3>
          <ResultList results={removed} tokens={empty} chunkSize={chunkSize} />
        </section>
      )}
    </>
  );
}
