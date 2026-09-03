import { useState } from 'react';
import { useLang } from '../hooks/useLang.jsx';
import { useRecord } from '../hooks/useRecord.js';
import { href } from '../hooks/useHashRoute.js';
import { fmtDate } from '../lib/format.js';
import ResultItem from './ResultItem.jsx';
import Consequences from './Consequences.jsx';

/** Старонка аднаго запісу (#/r/<id>): пастаянная спасылка, крыніца, «падзяліцца». Для фарміравання — усе палі пераліку. */
export default function RecordPage({ id, items, chunkSize, watch }) {
  const { t } = useLang();
  const item = items.find((it) => it.id === id);
  const rec = useRecord(item ? item.i : 0, chunkSize);
  const [copied, setCopied] = useState(false);
  const url = location.href;
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* няма доступу */ }
  };
  const share = () => navigator.share({ title: t.title, url }).catch(() => {});
  const isF = item?.list === 'f';
  // назіраць за назвай запісу — бяром спасылку, калі яна ёсць, інакш першыя словы назвы
  const watchSrc = rec ? `${rec.links || ''}\n${rec.name || ''}` : '';
  const watchQuery = rec?.name ? (watchSrc.match(/(?:https?:\/\/|t\.me\/|@)[^\s,;"]+/) || [rec.name.replace(/\s+/g, ' ').slice(0, 60)])[0] : null;
  const details = isF && rec && !rec.error ? [
    [t.recIncluded, rec.included ? fmtDate(rec.included) : ''],
    [t.recAddress, rec.address],
    [t.recInfo, rec.info],
    [t.recLogo, rec.logo],
  ].filter(([, v]) => v) : [];

  return (
    <>
      <p className="crumbs"><a href={href('')}>← {t.back}</a></p>
      <h2 className="page-title">{isF ? t.recTitleF : t.recTitle}</h2>
      {!item ? (
        <p className="summary error">{t.recNotFound}</p>
      ) : (
        <>
          {item.replacedBy && (
            <p className="notice warn">{t.recReplaced} <a href={href(`r/${item.replacedBy}`)}>{t.recOpenNew}</a></p>
          )}
          <ol className="results"><ResultItem item={item} tokens={[]} chunkSize={chunkSize} /></ol>
          {details.length > 0 && (
            <dl className="rec-details">
              {details.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
            </dl>
          )}
          <div className="rec-actions">
            <button type="button" className="chip" onClick={copy}>{copied ? t.copied : t.copyLink}</button>
            {typeof navigator !== 'undefined' && navigator.share && <button type="button" className="chip" onClick={share}>{t.share}</button>}
            {watchQuery && (
              <button type="button" className={`chip${watch.has(watchQuery) ? ' on' : ''}`} onClick={() => (watch.has(watchQuery) ? watch.remove(watchQuery) : watch.add(watchQuery))}>
                {watch.has(watchQuery) ? `★ ${t.watchOn}` : `☆ ${t.watchThis}`}
              </button>
            )}
          </div>
          <p className="hint">
            {isF ? t.positionF(item.n) : t.position(item.n ?? item.i + 1)}
          </p>
          <Consequences open formations={isF} />
        </>
      )}
    </>
  );
}
