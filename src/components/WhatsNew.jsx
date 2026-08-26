import { useMemo } from 'react';
import { useLang } from '../hooks/useLang.jsx';
import { fmtDate } from '../lib/format.js';
import { search } from '../lib/search.js';
import { LINKS } from '../lib/i18n.js';
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
      <p className="hint">{t.newIntro}</p>
      <p className="subscribe">
        <a className="chip tg-chip" href={LINKS.telegram} target="_blank" rel="noopener"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21.5 4.5 3.2 11.6c-1 .4-1 1 0 1.3l4.5 1.4 1.7 5.3c.2.6.6.7 1.1.3l2.5-2.1 4.7 3.5c.7.4 1.2.2 1.4-.7l3-14.5c.3-1.1-.4-1.6-1.6-1.1Z" fill="currentColor"/></svg> {t.newTg}</a>
        <a className="chip" href={`${import.meta.env.BASE_URL}feed.xml`}>{t.newRss}</a>
        <span className="hint">{t.newRssHint}</span>
      </p>
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
