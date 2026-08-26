import { useMemo } from 'react';
import { useLang } from '../hooks/useLang.jsx';
import { fmtDate } from '../lib/format.js';
import { search } from '../lib/search.js';
import ResultList from './ResultList.jsx';

const GROUPS = 8, FALLBACK = 60;

/** Старонка «Што новага»: запісы па даце зьяўленьня ў сьпісе; выдаленыя — асобна. */
export default function WhatsNew({ items, chunkSize }) {
  const { t } = useLang();
  const { groups, removed, fallback } = useMemo(() => {
    const byDate = new Map();
    for (const it of items) if (it.added) (byDate.get(it.added) || byDate.set(it.added, []).get(it.added)).push(it);
    const groups = [...byDate.entries()].sort((a, b) => b[0].localeCompare(a[0])).slice(0, GROUPS)
      .map(([d, list]) => [d, list.sort((a, b) => b.i - a.i)]);
    const removed = items.filter((it) => it.removed).sort((a, b) => b.removed.localeCompare(a.removed)).slice(0, FALLBACK);
    const fallback = groups.length ? null : search(items, [], { sort: 'newest' }).slice(0, FALLBACK);
    return { groups, removed, fallback };
  }, [items]);
  const empty = [];
  return (
    <>
      <h2 className="page-title">{t.newTitle}</h2>
      <p className="hint">{t.newIntro} <a href={`${import.meta.env.BASE_URL}feed.xml`}>{t.newRss}</a> — {t.newRssHint}.</p>
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
      {!fallback && !groups.length && <p className="summary">{t.newNone}</p>}
      {removed.length > 0 && (
        <section className="group">
          <h3 className="group-title">{t.newRemovedGroup(removed.length)}</h3>
          <ResultList results={removed} tokens={empty} chunkSize={chunkSize} />
        </section>
      )}
    </>
  );
}
