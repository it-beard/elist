import { useState, useRef, useEffect, useId } from 'react';
import { fmtDate, fmtLocalDate, fmtTime, relDay, STALE_HOURS, hoursSince } from '../lib/format.js';
import { useLang } from '../hooks/useLang.jsx';
import ThemeToggle from './ThemeToggle.jsx';
import LangToggle from './LangToggle.jsx';

/** Апошняя пазнака праверкі ў меце спіса (checkedAt пішацца пры кожным запуску; старыя кэшы — толькі дата). */
export const stampOf = (m) => m?.checkedAt || m?.checked || m?.updated || '';

/**
 * Даты праверкі па спісах для шапкі: lists — усе, у якіх ёсць пазнака ({ key, label, iso, value, sub }),
 * latest — самая свежая з іх (у бачным радку), астатнія — у папове. Для вышуку РФ sub — дата файла Медыязоны
 * (sourceDate), асобным радком толькі ў папове: іх выбарка абнаўляецца нерэгулярна, і карыстальнік мусіць бачыць,
 * наколькі яна свежая; у бачны радок шапкі яна не трапляе. Чыстая функцыя.
 */
export function listStamps(meta, t, lang) {
  const lists = [
    ['m', t.updatedMaterials, meta],
    ['f', t.formationsChecked, meta?.formations],
    ['p', t.personsChecked, meta?.persons],
    ['w', t.wantedChecked, meta?.wanted],
  ].filter(([, , m]) => stampOf(m)).map(([key, label, m]) => ({
    key, label, iso: stampOf(m), value: updatedLabel(m, t, lang),
    sub: key === 'w' && m.sourceDate ? t.wantedSource(fmtDate(m.sourceDate)) : '',
  }));
  let latest = lists[0] || null;
  for (const it of lists) if ((Date.parse(it.iso) || 0) > (Date.parse(latest.iso) || 0)) latest = it;
  return { lists, latest };
}

export default function Header({ meta, online, onHelp }) {
  const { t, lang } = useLang();
  const [showTip, setShowTip] = useState(false);
  const wrapRef = useRef(null);
  const tipId = useId();

  // Час апошняй праверкі спісу матэрыялаў — для папярэджання «база не абнаўлялася»: калі аўтаматычнае
  // абнаўленне спынілася зусім (cron адключаны, парсер зламаўся, джоб падае), meta на сайце не змяняецца —
  // таму папярэджваем па ўзросце апошняй праверкі на баку кліента.
  const updatedStr = updatedLabel(meta, t, lang);
  const checkedAgo = meta ? hoursSince(stampOf(meta)) : 0;
  const stale = Boolean(online && meta && !meta.sourceError && checkedAgo > STALE_HOURS);
  // другі, трэці і чацвёрты спісы правяраюцца асобнымі крокамі — свае даты і свае папярэджанні
  const fm = meta?.formations, pm = meta?.persons, wm = meta?.wanted;
  const { lists, latest } = listStamps(meta, t, lang);

  // Папоў з датамі па кожным спісе: адкрываецца кнопкай, зачыняецца ёю ж, Escape ці націскам па-за ім;
  // сам не знікае, пакуль чытаюць (даступнасць: hoverable, persistent, dismissible).
  useEffect(() => {
    if (!showTip) return;
    const onDocClick = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setShowTip(false); };
    const onKey = (e) => { if (e.key === 'Escape') setShowTip(false); };
    document.addEventListener('pointerdown', onDocClick);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDocClick);
      window.removeEventListener('keydown', onKey);
    };
  }, [showTip]);

  return (
    <header className="top wrap">
      <div className="top-row">
        <h1>{t.title}</h1>
        <button type="button" className="theme help-btn" title={t.help} aria-label={t.help} onClick={onHelp}>?</button>
        <LangToggle />
        <ThemeToggle />
      </div>
      <p className="sub">
        {meta ? (
          <span className="updated-wrap" ref={wrapRef}>
            <button
              type="button"
              className="updated-btn"
              onClick={() => setShowTip((v) => !v)}
              aria-expanded={showTip}
              aria-describedby={showTip ? tipId : undefined}
            >
              {t.updated} <time dateTime={latest?.iso || stampOf(meta)}>{latest?.value ?? updatedStr}</time>
            </button>
            {showTip && lists.length > 0 && (
              <div id={tipId} className="updated-tip" role="tooltip">
                <div className="updated-tip-desc">{t.updatedTipHint}</div>
                <div className="updated-tip-list">
                  {lists.map((it) => (
                    <div key={it.key} className={`updated-tip-item${it.sub ? ` with-sub ${it.key}` : ''}`}>
                      <div className="updated-tip-row">
                        <span className="tip-label">
                          <span className={`tip-dot ${it.key}`} aria-hidden="true" />
                          <span>{it.label}:</span>
                        </span>
                        <span className="tip-val">{it.value}</span>
                      </div>
                      {it.sub && <div className="updated-tip-sub">{it.sub}</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </span>
        ) : ' '}
      </p>
      {meta?.sourceError && <p className="notice warn">{t.sourceDown(fmtDate(meta.checked || meta.updated))}</p>}
      {meta?.fallback && <p className="notice warn">{t.fallbackSrc}</p>}
      {fm?.sourceError && <p className="notice warn">{t.formationsDown(fmtDate(fm.checked || fm.updated))}</p>}
      {pm?.sourceError && <p className="notice warn">{t.personsDown(fmtDate(pm.checked || pm.updated))}</p>}
      {wm?.sourceError && <p className="notice warn">{t.wantedDown(fmtDate(wm.checked || wm.updated))}</p>}
      {stale && <p className="notice warn">{t.stale(updatedStr)}</p>}
      {!online && meta && <p className="notice">{t.offline(fmtDate(meta.updated))}</p>}
    </header>
  );
}

function updatedLabel(meta, t, lang) {
  if (meta?.checkedAt) {
    const rel = relDay(meta.checkedAt);
    const time = fmtTime(meta.checkedAt, lang);
    if (rel) return `${t[rel]} ${t.at} ${time}`;
    return `${fmtLocalDate(meta.checkedAt)} ${time}`;
  }
  const d = meta?.checked || meta?.updated;
  return d ? fmtDate(d) : '';
}
