import { useRecord } from '../hooks/useRecord.js';
import { fmtDate, isRecent } from '../lib/format.js';
import { extractArticle } from '../lib/court.js';
import { useLang } from '../hooks/useLang.jsx';
import { href } from '../hooks/useHashRoute.js';
import Highlight from './Highlight.jsx';

export default function ResultItem({ item, tokens, chunkSize }) {
  const { t } = useLang();
  const rec = useRecord(item.i, chunkSize);
  // лэйбл: артыкул з рашэння суда; калі яго ў тэксце няма — тып матэрыялу
  const art = rec?.court ? extractArticle(rec.court) : null;
  return (
    <li className={`item${item.removed ? ' removed' : ''}`}>
      <div className="meta">
        {art ? (
          <span className="type" title={t.articleTitle(art.num, art.code)}>{t.article(art.num, art.code)}</span>
        ) : rec?.type ? (
          <span className="type"><Highlight text={rec.type} tokens={tokens} /></span>
        ) : null}
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
