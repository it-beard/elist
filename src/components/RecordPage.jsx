import { useState } from 'react';
import { useLang } from '../hooks/useLang.jsx';
import { useRecord } from '../hooks/useRecord.js';
import { href } from '../hooks/useHashRoute.js';
import ResultItem from './ResultItem.jsx';
import Consequences from './Consequences.jsx';

/** Старонка аднаго запісу (#/r/<id>): пастаянная спасылка, крыніца, «падзяліцца». */
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
  // назіраць за назвай запісу — бяром першыя словы назвы як запыт (спасылку, калі яна ёсьць)
  const watchQuery = rec?.name ? (rec.name.match(/(?:https?:\/\/|t\.me\/|@)[^\s,;"]+/) || [rec.name.replace(/\s+/g, ' ').slice(0, 60)])[0] : null;

  return (
    <>
      <p className="crumbs"><a href={href('')}>← {t.back}</a></p>
      <h2 className="page-title">{t.recTitle}</h2>
      {!item ? (
        <p className="summary error">{t.recNotFound}</p>
      ) : (
        <>
          <ol className="results"><ResultItem item={item} tokens={[]} chunkSize={chunkSize} /></ol>
          <div className="rec-actions">
            <button type="button" className="chip" onClick={copy}>{copied ? t.copied : t.copyLink}</button>
            {typeof navigator !== 'undefined' && navigator.share && <button type="button" className="chip" onClick={share}>{t.share}</button>}
            {watchQuery && (
              <button type="button" className={`chip${watch.has(watchQuery) ? ' on' : ''}`} onClick={() => (watch.has(watchQuery) ? watch.remove(watchQuery) : watch.add(watchQuery, [item.id]))}>
                {watch.has(watchQuery) ? `★ ${t.watchOn}` : `☆ ${t.watchThis}`}
              </button>
            )}
          </div>
          <p className="hint">{t.position(item.i + 1)}</p>
          <Consequences open />
        </>
      )}
    </>
  );
}
