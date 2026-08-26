import { useRecord } from '../hooks/useRecord.js';
import { fmtDate, isRecent } from '../lib/format.js';
import Highlight from './Highlight.jsx';

export default function ResultItem({ item, tokens, chunkSize }) {
  const rec = useRecord(item.i, chunkSize);
  return (
    <li className={`item${item.removed ? ' removed' : ''}${rec ? '' : ' loading'}`}>
      <div className="meta">
        {rec?.type && <span className="type"><Highlight text={rec.type} tokens={tokens} /></span>}
        {item.date && <span className="num">рашэньне {fmtDate(item.date)}</span>}
        {isRecent(item.added) && <span className="badge-new">новае · {fmtDate(item.added)}</span>}
        {item.removed && <span>адсутнічае ў спісе з {fmtDate(item.removed)}</span>}
        <span className="num">№ {item.i + 1}</span>
      </div>
      {rec?.error ? (
        <p className="name error">Памылка загрузкі: {rec.error}</p>
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
