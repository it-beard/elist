import { useRecord } from '../hooks/useRecord.js';
import { fmtDate, isRecent } from '../lib/format.js';
import { extractArticle } from '../lib/court.js';
import { personSeries } from '../lib/person.js';
import { useLang } from '../hooks/useLang.jsx';
import { href } from '../hooks/useHashRoute.js';
import Highlight from './Highlight.jsx';

/**
 * Картка запісу. Матэрыял (суды) — як раней: артыкул/тып, назва, рашэнне суда.
 * Экстрэмісцкае фарміраванне (МУС/КДБ) — фіялетавая палоска і плашка «Фарміраванне · МУС», назва,
 * кароткая назва, спасылкі і падстава. Фізічная асоба (пералік МУС) — бірузовая палоска і плашка
 * адпаведна артыкулаў («экстрэміст», «выказванні», «гр.дз.»), імя, транслітарацыя, дата нараджэння
 * з грамадзянствам і статусам, падстава (прысуд). Пазнака спіса вядомая з індэкса яшчэ да загрузкі фрагмента.
 */
export default function ResultItem({ item, tokens, chunkSize }) {
  const { t } = useLang();
  const rec = useRecord(item.i, chunkSize, item.id);
  const isF = item.list === 'f', isP = item.list === 'p';
  // лэйбл: артыкул з рашэння суда; калі яго ў тэксце няма — тып матэрыялу
  const art = !isF && !isP && rec?.court ? extractArticle(rec.court) : null;
  const pArt = isP ? (item.art || (rec?.articles ? personSeries(rec.articles) : 'other')) : null;
  const facts = isP && rec ? [rec.birth && `${t.born} ${rec.birth}`, rec.citizenship, rec.info].filter(Boolean).join(' · ') : '';
  return (
    <li className={`item${isF ? ' formation' : ''}${isP ? ' person' : ''}${item.removed ? ' removed' : ''}`}>
      <div className="meta">
        {isP ? (
          <span className="type person" title={t.personTitle(pArt)}>{t.personLabel(pArt)}</span>
        ) : isF ? (
          <span className="type form" title={rec?.basis ? rec.basis.replace(/\s+/g, ' ') : t.formationTitle}>{t.formationLabel(rec?.kind, rec?.decidedBy)}</span>
        ) : art ? (
          <span className="type" title={t.articleTitle(art.num, art.code)}>{t.article(art.num, art.code)}</span>
        ) : rec?.type ? (
          <span className="type"><Highlight text={rec.type} tokens={tokens} /></span>
        ) : null}
        {item.date && <span className="num" title={isP ? t.includedTitle : undefined}>{fmtDate(item.date)}</span>}
        {isRecent(item.added) && <span className="badge-new" title={t.addedTitle}>{t.isNew} · {fmtDate(item.added)}</span>}
        {item.removed && <span className="gone">{t.removed} {fmtDate(item.removed)}</span>}
        {/* фізічная асоба без афіцыйнага нумара (свежае дапаўненне) — значок спасылкі замест «б/н» */}
        <a className="num idx" href={href(`r/${item.id}`)} title={isP ? t.permalinkP : isF ? t.permalinkF : t.permalink} aria-label={isP ? t.permalinkP : isF ? t.permalinkF : t.permalink}>
          {isP && !item.n ? (
            <svg className="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1.5 1.5M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.5-1.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          ) : (
            `№${item.n ?? item.i + 1}`
          )}
        </a>
      </div>
      {rec?.error ? (
        <p className="name error">{t.recError(rec.error)}</p>
      ) : rec?.stale ? (
        <p className="name error">{t.recStale}</p>
      ) : rec ? (
        isP ? (
          <>
            <p className="name"><Highlight text={rec.name} tokens={tokens} /></p>
            {rec.translit && <p className="alias"><Highlight text={rec.translit} tokens={tokens} /></p>}
            {facts && <p className="facts"><Highlight text={facts} tokens={tokens} /></p>}
            {rec.basis && <p className="court"><Highlight text={rec.basis} tokens={tokens} /></p>}
          </>
        ) : isF ? (
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
