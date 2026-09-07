import { useLayoutEffect } from 'react';
import { useLang } from '../hooks/useLang.jsx';
import { useRecord } from '../hooks/useRecord.js';
import { useCopy } from '../hooks/useCopy.js';
import { href } from '../hooks/useHashRoute.js';
import { fmtDate } from '../lib/format.js';
import { articlesLabel } from '../lib/person.js';
import { mediazonaRecordUrl, personName } from '../lib/wanted.js';
import { LINKS } from '../lib/i18n.js';
import ResultItem from './ResultItem.jsx';
import ExtLink from './ExtLink.jsx';
import Consequences from './Consequences.jsx';

/**
 * Старонка аднаго запісу (#/r/<id>): радок з кнопкай «Да пошуку» злева і дзеяннямі справа («Скапіяваць спасылку»,
 * «Сачыць» — поўнае тлумачэнне ў title), загаловак, картка, палі крыніцы. Нумар у спісе (пазіцыя ў публікацыі, для фізічнай асобы — афіцыйны нумар МУС ці
 * пазнака, што яшчэ не прысвоены) — сярод палёў, а апошняе поле — спасылка на .doc-частку пераліку, у якой чалавек
 * ёсць цяпер (знік з крыніцы — спасылкі няма). Даведка з пераліку («судзімасць не пагашана») не паказваецца: МУС
 * не абнаўляе яе ва ўжо апублікаваных частках. Для запісу вышуку РФ у канцы карткі палёў, за пункцірнай лініяй
 * (як адрыўны корак білета), — заўвага пра крыніцу са спасылкай на гэты запіс у віджэце Медыязоны (знешняя, з папярэджаннем).
 */
export default function RecordPage({ id, items, chunkSize, watch, meta }) {
  const { t } = useLang();
  const item = items.find((it) => it.id === id);
  const rec = useRecord(item ? item.i : 0, chunkSize, item?.id);
  const [copied, copy] = useCopy();
  const url = location.href;
  // пераход з доўгай выдачы па спасылцы ў картцы — хэш мяняецца, а пракрутка застаецца, і старонка запісу адкрываецца
  // «знізу»; да малявання — уверх (useLayoutEffect, каб не міргала)
  useLayoutEffect(() => { scrollTo(0, 0); }, [id]);
  const isF = item?.list === 'f', isP = item?.list === 'p', isW = item?.list === 'w';
  // назіраць за назвай запісу — бяром спасылку, калі яна ёсць, інакш першыя словы назвы (для асобы — імя)
  const watchSrc = rec ? `${rec.links || ''}\n${rec.name || ''}` : '';
  const watchQuery = rec?.name ? (watchSrc.match(/(?:https?:\/\/|t\.me\/|@)[^\s,;"]+/) || [(isW ? personName(rec.name) : rec.name).replace(/\s+/g, ' ').slice(0, 60)])[0] : null;
  // прыблізная дата вышуку «<2026-05» → «да 05.2026»
  const wDate = (s) => (!s ? '' : s.startsWith('<') ? `${t.before} ${fmtDate(s.slice(1))}` : fmtDate(s));
  // нумар — з індэкса (item.n), каб не залежаў ад загрузкі фрагмента; у вышуку РФ нумароў няма
  const num = item?.n ? `№${item.n}` : '';
  // .doc-частка пераліку МУС, у якой цяпер ёсць гэты чалавек (rec.part — з апошняга разбору, адрасы — з меты).
  // Для запісу, які знік з крыніцы, спасылкі няма: у файле яго ўжо не будзе.
  const partUrl = isP && !item?.removed && rec?.part ? (meta?.persons?.files || [])[rec.part - 1] : null;
  const partLink = partUrl && (
    <ExtLink href={partUrl} title={t.recSourcePTitle}>{t.partFile(rec.part, (partUrl.match(/\.(docx?)(?:[?#]|$)/i) || [, 'doc'])[1].toLowerCase())} ↗</ExtLink>
  );
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
      [t.recNum, num || t.recNumPending],
      [t.recSourceP, partLink],
    ] : isF ? [
      [t.recIncluded, rec.included ? fmtDate(rec.included) : ''],
      [t.recAddress, rec.address],
      [t.recInfo, rec.info],
      [t.recLogo, rec.logo],
      [t.recNum, num],
    ] : [
      [t.recNumM, num],
    ]
  ).filter(([, v]) => v) : [];

  return (
    <>
      <div className="rec-bar">
        <a className="chip back" href={href('')}>← {t.back}</a>
        {item && (
          <div className="rec-actions">
            <button type="button" className="chip" onClick={() => copy(url)}>{copied ? t.copied : t.copyLink}</button>
            {watchQuery && (
              <button
                type="button" className={`chip${watch.has(watchQuery) ? ' on' : ''}`} title={watch.has(watchQuery) ? t.watchOffTitle : t.watchThisTitle}
                onClick={() => (watch.has(watchQuery) ? watch.remove(watchQuery) : watch.add(watchQuery))}
              >
                {watch.has(watchQuery) ? `★ ${t.watchOn}` : `☆ ${t.watchAdd}`}
              </button>
            )}
          </div>
        )}
      </div>
      <h2 className="page-title">{isW ? t.recTitleW : isP ? t.recTitleP : isF ? t.recTitleF : t.recTitle}</h2>
      {!item ? (
        <p className="summary error">{t.recNotFound}</p>
      ) : (
        <>
          {item.replacedBy && (
            <p className="notice warn">{t.recReplaced} <a href={href(`r/${item.replacedBy}`)}>{t.recOpenNew}</a></p>
          )}
          <ol className="results"><ResultItem item={item} tokens={[]} chunkSize={chunkSize} linked={false} /></ol>
          {details.length > 0 && (
            <div className="rec-details">
              <dl>
                {details.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
              </dl>
              {isW && (
                <p className="rec-stub">
                  {t.positionW1}<ExtLink href={mediazonaRecordUrl(LINKS.mediazona, rec.name)}>{t.positionWLink} ↗</ExtLink>{t.positionW2}
                </p>
              )}
            </div>
          )}
          <Consequences open materials={!isF && !isP && !isW} formations={isF} persons={isP} wanted={isW} />
        </>
      )}
    </>
  );
}
