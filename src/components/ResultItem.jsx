import { useRecord } from '../hooks/useRecord.js';
import { fmtDate, isRecent } from '../lib/format.js';
import { extractArticle } from '../lib/court.js';
import { useLang } from '../hooks/useLang.jsx';
import { href } from '../hooks/useHashRoute.js';
import Highlight from './Highlight.jsx';

/**
 * Картка запісу. Матэрыял (суды) — як раней: артыкул/тып, назва, рашэнне суда.
 * Экстрэмісцкае фарміраванне (МУС/КДБ) — фіялетавая палоска і плашка «Фарміраванне · МУС», назва,
 * кароткая назва, спасылкі і падстава; пазнака спіса вядомая з індэкса яшчэ да загрузкі фрагмента.
 */
export default function ResultItem({ item, tokens, chunkSize }) {
  const { t } = useLang();
  const rec = useRecord(item.i, chunkSize);
  const isF = item.list === 'f';
  // лэйбл: артыкул з рашэння суда; калі яго ў тэксце няма — тып матэрыялу
  const art = !isF && rec?.court ? extractArticle(rec.court) : null;
  return (
    <li className={`item${isF ? ' formation' : ''}${item.removed ? ' removed' : ''}`}>
      <div className="meta">
        {isF ? (
          <span className="type form" title={rec?.basis ? rec.basis.replace(/\s+/g, ' ') : t.formationTitle}>{t.formationLabel(rec?.kind, rec?.decidedBy)}</span>
        ) : art ? (
          <span className="type" title={t.articleTitle(art.num, art.code)}>{t.article(art.num, art.code)}</span>
        ) : rec?.type ? (
          <span className="type"><Highlight text={rec.type} tokens={tokens} /></span>
        ) : null}
        {item.date && <span className="num">{fmtDate(item.date)}</span>}
        {isRecent(item.added) && <span className="badge-new" title={t.addedTitle}>{t.isNew} · {fmtDate(item.added)}</span>}
        {item.removed && <span className="gone">{t.removed} {fmtDate(item.removed)}</span>}
        <a className="num idx" href={href(`r/${item.id}`)} title={isF ? t.permalinkF : t.permalink}>№{item.n ?? item.i + 1}</a>
      </div>
      {rec?.error ? (
        <p className="name error">{t.recError(rec.error)}</p>
      ) : rec ? (
        isF ? (
          <>
            <p className="name"><Highlight text={rec.name} tokens={tokens} /></p>
            {rec.alias && rec.alias !== rec.name && <p className="alias"><Highlight text={rec.alias} tokens={tokens} /></p>}
            {rec.links && <p className="links"><Highlight text={rec.links.replace(/\n{2,}/g, '\n')} tokens={tokens} /></p>}
            {rec.basis && <p className="court"><Highlight text={rec.basis} tokens={tokens} /></p>}
          </>
        ) : (
          <>
            <p className="name"><Highlight text={rec.name} tokens={tokens} /></p>
            {rec.court && <p className="court"><Highlight text={rec.court} tokens={tokens} /></p>}
          </>
        )
      ) : (
        <p className="name skeleton" aria-busy="true">&nbsp;</p>
      )}
    </li>
  );
}
