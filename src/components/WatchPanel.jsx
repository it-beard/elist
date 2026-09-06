import { useEffect, useId, useRef, useState } from 'react';
import { useLang } from '../hooks/useLang.jsx';
import { useLocalStorage } from '../hooks/useLocalStorage.js';
import { fmtDate, fmtTime } from '../lib/format.js';
import { ChevronIcon, CloseIcon, StarIcon } from './icons.jsx';

/**
 * Спіс назірання: статус («супадзенняў няма» / «новыя супадзенні»),
 * запыты, праверка зноў, апавяшчэнні, ачыстка. Усё — толькі ў localStorage.
 */
export default function WatchPanel({ watch, meta, refreshing, refreshError, checkedAt, onReload, onOpen, onClearAll, visible = true, renderControls }) {
  const { t, lang } = useLang();
  const { entries, checks, remove, notify, setNotify } = watch;
  const hits = checks.reduce((n, c) => n + c.matches.length, 0);
  const fresh = checks.reduce((n, c) => n + c.fresh.length, 0);
  const empty = entries.length === 0;
  const tone = empty ? 'idle' : fresh ? 'alert' : hits ? 'warn' : 'ok';
  // Пры першым наведванні панэль схаваная; далей стан памятаецца ў localStorage — і калі карыстальнік пераключыў
  // сам, і калі панэль раскрылася сама праз новыя супадзенні (тады яна застаецца адкрытай да яго рашэння).
  // auto — раскрыць адразу ў першым рэндэры, без мільгання, пакуль эфект не запіша стан.
  const [stored, setStored] = useLocalStorage('watchOpen', false);
  const [auto, setAuto] = useState(() => visible && fresh > 0);
  const open = auto || stored === true;
  const toggleOpen = () => { setAuto(false); setStored((prev) => !(auto || prev === true)); };
  const opened = useRef(false);
  const panelId = useId();
  useEffect(() => { if (visible && fresh > 0 && !opened.current) { opened.current = true; setStored(true); setAuto(false); } }, [visible, fresh]);

  const notifSupported = typeof Notification !== 'undefined';
  const denied = notifSupported && Notification.permission === 'denied';
  const toggleNotify = async () => {
    if (notify) return setNotify(false);
    const p = await Notification.requestPermission();
    if (p === 'granted') setNotify(true);
  };

  const status = empty ? t.watchEmpty : fresh ? t.watchFresh(fresh) : hits ? t.watchHits(hits) : t.watchOk(entries.length);
  const time = checkedAt ? fmtTime(checkedAt, lang) : '';
  const toggle = visible ? (
    <button type="button" className={`chip watch-toggle ${tone}`} aria-expanded={open} aria-controls={panelId} aria-label={`${t.watchTitle}: ${status}`} title={status} onClick={toggleOpen}>
      {tone === 'idle' ? <StarIcon /> : <span className="dot" aria-hidden="true">{tone === 'ok' ? '✓' : '!'}</span>}
      <span className="watch-label">{t.watchLabel}</span>
      {!empty && <span className="watch-count">{hits > 0 ? `${entries.length}/${hits}` : entries.length}</span>}
      <ChevronIcon className={`chev${open ? ' up' : ''}`} />
    </button>
  ) : null;

  return (
    <>
      {renderControls ? renderControls(toggle) : toggle}
      <section id={panelId} className={`watch ${tone}`} aria-label={t.watchTitle} hidden={!visible || !open}>
        <div className="watch-head">
          <span className="watch-status">
            <strong>{status}</strong>
            {meta && !empty && <small>{t.watchBase(fmtDate(meta.updated))}{time && ` · ${t.checkedAt(time)}`}</small>}
          </span>
        </div>
        {visible && open && (
          <div className="watch-body">
            {empty ? (
              <p className="hint">{t.watchHint}</p>
            ) : (
              <ul className="watch-list">
                {checks.map(({ entry, matches, fresh: fr }) => (
                  <li key={entry.q} className={fr.length ? 'fresh' : matches.length ? 'hit' : ''}>
                    <button type="button" className="watch-q" title={t.watchOpen} onClick={() => onOpen(entry, matches)}>
                      <span className="q">{entry.q}</span>
                      <span className="cnt">
                        {fr.length > 0 && <span className="badge-new">{t.watchNew(fr.length)}</span>}
                        <span className={matches.length ? 'n hit' : 'n'}>{t.watchMatches(matches.length)}</span>
                      </span>
                    </button>
                    <button type="button" className="x" title={t.watchRemove} aria-label={`${t.watchRemove}: ${entry.q}`} onClick={() => remove(entry.q)}>
                      <CloseIcon />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="watch-actions">
              <button type="button" className="chip" disabled={refreshing} onClick={onReload}>{refreshing ? t.rechecking : t.recheck}</button>
              {notifSupported && !empty && (
                <button type="button" className={`chip${notify ? ' on' : ''}`} aria-pressed={notify} disabled={denied} title={denied ? t.notifyDenied : undefined} onClick={toggleNotify}>
                  {notify ? t.notifyOn : t.notifyOff}
                </button>
              )}
              {!empty && <button type="button" className="chip danger" title={t.clearAllTitle} onClick={onClearAll}>{t.clearAll}</button>}
            </div>
            {refreshError && <p className="hint error">{t.recheckError(refreshError)}</p>}
            <p className="hint">{t.watchPrivacy}</p>
            <p className="hint travel-warn">⚠️ {t.travelWarn}</p>
          </div>
        )}
      </section>
    </>
  );
}
