import { useState, useRef, useEffect } from 'react';
import { fmtDate, fmtLocalDate, fmtTime, relDay, STALE_HOURS, hoursSince } from '../lib/format.js';
import { useLang } from '../hooks/useLang.jsx';
import ThemeToggle from './ThemeToggle.jsx';
import LangToggle from './LangToggle.jsx';

export default function Header({ meta, online, onHelp }) {
  const { t, lang } = useLang();
  const [showTip, setShowTip] = useState(false);
  const timerRef = useRef(null);
  const wrapRef = useRef(null);

  // Час апошняга абнаўлення базы (checkedAt пішацца пры кожным паспяховым запуску
  // update.mjs). Старыя кэшы meta без checkedAt — толькі дата.
  const updatedStr = updatedLabel(meta, t, lang);
  // Калі аўтаматычнае абнаўленне спынілася зусім (cron адключаны, парсер зламаўся, джоб падае),
  // meta на сайце не змяняецца — таму папярэджваем па ўзросце апошняй праверкі на баку кліента.
  const checkedAgo = meta ? hoursSince(meta.checkedAt || meta.checked || meta.updated) : 0;
  const stale = Boolean(online && meta && !meta.sourceError && checkedAgo > STALE_HOURS);
  // другі і трэці спісы (пералікі МУС) правяраюцца асобнымі крокамі — свае даты і свае папярэджанні
  const fm = meta?.formations, pm = meta?.persons;
  const hasStamp = (m) => Boolean(m && (m.checkedAt || m.checked || m.updated));
  const lists = [
    hasStamp(meta) && { key: 'm', label: t.updatedMaterials, m: meta },
    hasStamp(fm) && { key: 'f', label: t.formationsChecked, m: fm },
    hasStamp(pm) && { key: 'p', label: t.personsChecked, m: pm },
  ].filter(Boolean);

  const getStampTime = (m) => {
    if (!m) return 0;
    const val = m.checkedAt || m.checked || m.updated;
    return val ? Date.parse(val) || 0 : 0;
  };

  let latest = lists[0] || null;
  for (const it of lists) {
    if (getStampTime(it.m) > getStampTime(latest?.m)) {
      latest = it;
    }
  }

  const latestStr = updatedLabel(latest?.m || meta, t, lang);
  const latestIso = latest?.m?.checkedAt || latest?.m?.checked || latest?.m?.updated || meta?.checkedAt || meta?.updated;
  const tooltip = lists.length
    ? `${t.updatedTipHint}\n\n` + lists.map((it) => `${it.label}: ${updatedLabel(it.m, t, lang)}`).join('\n')
    : undefined;

  const toggleTip = () => {
    setShowTip((prev) => {
      const next = !prev;
      clearTimeout(timerRef.current);
      if (next) {
        timerRef.current = setTimeout(() => setShowTip(false), 3500);
      }
      return next;
    });
  };

  useEffect(() => {
    return () => clearTimeout(timerRef.current);
  }, []);

  useEffect(() => {
    if (!showTip) return;
    const onDocClick = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setShowTip(false);
      }
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setShowTip(false);
    };
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
      <p className="sub" title={tooltip}>
        {meta ? (
          <span className="updated-wrap" ref={wrapRef}>
            <button
              type="button"
              className="updated-btn"
              onClick={toggleTip}
              aria-expanded={showTip}
              title={tooltip}
            >
              {t.updated} <time dateTime={latestIso}>{latestStr}</time>
            </button>
            {showTip && lists.length > 0 && (
              <div
                className="updated-tip"
                role="tooltip"
                onMouseEnter={() => clearTimeout(timerRef.current)}
                onMouseLeave={() => {
                  clearTimeout(timerRef.current);
                  timerRef.current = setTimeout(() => setShowTip(false), 2000);
                }}
              >
                <div className="updated-tip-desc">{t.updatedTipHint}</div>
                <div className="updated-tip-list">
                  {lists.map((it) => (
                    <div key={it.key} className="updated-tip-row">
                      <span className="tip-label">
                        <span className={`tip-dot ${it.key}`} aria-hidden="true" />
                        <span>{it.label}:</span>
                      </span>
                      <span className="tip-val">{updatedLabel(it.m, t, lang)}</span>
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
