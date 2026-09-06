import { useEffect, useId, useRef, useState } from 'react';
import { useLang } from '../hooks/useLang.jsx';
import { fmtDate, fmtTime } from '../lib/format.js';

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
  // Па змаўчанні — схаваны. Захоўваем стан у localStorage, калі карыстальнік сам адкрыў ці схаваў.
  const [open, setOpenState] = useState(() => {
    if (visible && fresh > 0) return true;
    try {
      const v = typeof localStorage !== 'undefined' ? localStorage.getItem('watchOpen') : null;
      return v === null ? false : JSON.parse(v) === true;
    } catch {
      return false;
    }
  });
  const setOpen = (f) => {
    const next = typeof f === 'function' ? f(open) : f;
    try {
      if (typeof localStorage !== 'undefined') localStorage.setItem('watchOpen', JSON.stringify(next));
    } catch {}
    setOpenState(next);
  };
  const opened = useRef(false);
  const panelId = useId();
  useEffect(() => { if (visible && fresh > 0 && !opened.current) { setOpen(true); opened.current = true; } }, [visible, fresh]);

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
    <button type="button" className={`chip watch-toggle ${tone}`} aria-expanded={open} aria-controls={panelId} aria-label={`${t.watchTitle}: ${status}`} title={status} onClick={() => setOpen((o) => !o)}>
      {tone === 'idle' ? (
        <svg className="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
      ) : (
        <span className="dot" aria-hidden="true">{tone === 'ok' ? '✓' : '!'}</span>
      )}
      <span className="watch-label">{t.watchLabel}</span>
      <span className="watch-label-short">{t.watchShort}</span>
      {!empty && <span className="watch-count">{hits > 0 ? `${entries.length}/${hits}` : entries.length}</span>}
      <svg className={`chev${open ? ' up' : ''}`} viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
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
                      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
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
