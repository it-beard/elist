import { useRecord } from '../hooks/useRecord.js';
import { fmtDate, isRecent } from '../lib/format.js';
import { useLang } from '../hooks/useLang.jsx';
import { href } from '../hooks/useHashRoute.js';
import Highlight from './Highlight.jsx';

export default function ResultItem({ item, tokens, chunkSize }) {
  const { t } = useLang();
  const rec = useRecord(item.i, chunkSize);
  return (
    <li className={`item${item.removed ? ' removed' : ''}`}>
      <div className="meta">
        {rec?.type && <span className="type"><Highlight text={rec.type} tokens={tokens} /></span>}
        {item.date && <span className="num">{fmtDate(item.date)}</span>}
        {isRecent(item.added) && <span className="badge-new" title={t.addedTitle}>{t.isNew} · {fmtDate(item.added)}</span>}
        {item.removed && <span className="gone">{t.removed} {fmtDate(item.removed)}</span>}
        <a className="num idx" href={href(`r/${item.id}`)} title={t.permalink}>№{item.i + 1}</a>
      </div>
      {rec?.error ? (
        <p className="name error">{t.recError(rec.error)}</p>
      ) : rec ? (
        <>
          <p className="name"><Highlight text={rec.name} tokens={tokens} /></p>
          {rec.court && <p className="court"><Highlight text={rec.court} tokens={tokens} /></p>}
        </>
      ) : (
        <p className="name skeleton" aria-busy="true">&nbsp;</p>
      )}
    </li>
  );
}
