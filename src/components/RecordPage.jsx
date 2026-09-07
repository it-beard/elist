import { useState } from 'react';
import { useLang } from '../hooks/useLang.jsx';
import { useRecord } from '../hooks/useRecord.js';
import { href } from '../hooks/useHashRoute.js';
import { fmtDate } from '../lib/format.js';
import { articlesLabel } from '../lib/person.js';
import { personName } from '../lib/wanted.js';
import ResultItem from './ResultItem.jsx';
import Consequences from './Consequences.jsx';

/**
 * Старонка аднаго запісу (#/r/<id>): пастаянная спасылка, крыніца, «падзяліцца».
 * Для фарміравання, фізічнай асобы і запісу вышуку РФ — усе палі крыніцы.
 */
export default function RecordPage({ id, items, chunkSize, watch }) {
  const { t } = useLang();
  const item = items.find((it) => it.id === id);
  const rec = useRecord(item ? item.i : 0, chunkSize, item?.id);
  const [copied, setCopied] = useState(false);
  const url = location.href;
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* няма доступу */ }
  };
  const share = () => navigator.share({ title: t.title, url }).catch(() => {});
  const isF = item?.list === 'f', isP = item?.list === 'p', isW = item?.list === 'w';
  // назіраць за назвай запісу — бяром спасылку, калі яна ёсць, інакш першыя словы назвы (для асобы — імя)
  const watchSrc = rec ? `${rec.links || ''}\n${rec.name || ''}` : '';
  const watchQuery = rec?.name ? (watchSrc.match(/(?:https?:\/\/|t\.me\/|@)[^\s,;"]+/) || [(isW ? personName(rec.name) : rec.name).replace(/\s+/g, ' ').slice(0, 60)])[0] : null;
  // прыблізная дата вышуку «<2026-05» → «да 05.2026»
  const wDate = (s) => (!s ? '' : s.startsWith('<') ? `${t.before} ${fmtDate(s.slice(1))}` : fmtDate(s));
  const details = rec && !rec.error && !rec.stale ? (
    isW ? [
      [t.recYear, rec.year ? String(rec.year) : ''],
      [t.recNationality, rec.nationality ? personName(rec.nationality) : ''],
      [t.recRegion, rec.region],
      [t.recAgency, rec.agency ? t.agencyName[rec.agency] || rec.agency : t.agencyUnknown],
      [t.recWantedDate, rec.date ? fmtDate(rec.date) : rec.before ? `${t.before} ${fmtDate(rec.before)}` : ''],
      [t.recFirstWanted, wDate(rec.first)],
      [t.recAliases, rec.aliases?.length ? rec.aliases.map(personName).join(', ') : ''],
      [t.recCategoryW, [rec.category, rec.rf && t.rfLabel[rec.rf]].filter(Boolean).join(' · ')],
      [t.recStatusW, item.removed ? t.wantedOutFull : t.wantedLive],
    ] : isP ? [
      [t.recBirth, rec.birth],
      [t.recCitizenship, rec.citizenship],
      [t.recArticles, articlesLabel(rec.articles)],
      [t.recIncludedP, rec.included],
      [t.recAddressP, rec.address],
      [t.recStatus, rec.info],
      [t.recNum, item?.n ? `№${item.n}` : ''],
    ] : isF ? [
      [t.recIncluded, rec.included ? fmtDate(rec.included) : ''],
      [t.recAddress, rec.address],
      [t.recInfo, rec.info],
      [t.recLogo, rec.logo],
    ] : []
  ).filter(([, v]) => v) : [];

  return (
    <>
      <p className="crumbs"><a href={href('')}>← {t.back}</a></p>
      <h2 className="page-title">{isW ? t.recTitleW : isP ? t.recTitleP : isF ? t.recTitleF : t.recTitle}</h2>
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
            {/* нумар асобы — з індэкса (item.n), каб падказка не залежала ад загрузкі фрагмента */}
            {isW ? t.positionW : isP ? (item.n ? t.positionP(item.n) : t.positionPNew) : isF ? t.positionF(item.n) : t.position(item.n ?? item.i + 1)}
          </p>
          <Consequences open formations={isF} persons={isP} wanted={isW} />
        </>
      )}
    </>
  );
}
