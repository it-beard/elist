import { useEffect, useRef, useState } from 'react';
import { useLang } from '../hooks/useLang.jsx';
import { fmtDate, fmtTime } from '../lib/format.js';
import { LINKS } from '../lib/i18n.js';
import { useLocalStorage } from '../hooks/useLocalStorage.js';

/**
 * Спіс назірання: статус («супадзенняў няма» / «новыя супадзенні»),
 * запыты, праверка зноў, апавяшчэнні, ачыстка. Усё — толькі ў localStorage.
 */
export default function WatchPanel({ watch, meta, refreshing, refreshError, checkedAt, onReload, onOpen, onClearAll }) {
  const { t, lang } = useLang();
  const { entries, checks, remove, notify, setNotify } = watch;
  const hits = checks.reduce((n, c) => n + c.matches.length, 0);
  const fresh = checks.reduce((n, c) => n + c.fresh.length, 0);
  const empty = entries.length === 0;
  const tone = empty ? 'idle' : fresh ? 'alert' : hits ? 'warn' : 'ok';
  const [stored, setStored] = useLocalStorage('watchOpen', true);
  const [open, setOpenState] = useState(() => fresh > 0 || (empty ? true : stored));
  const setOpen = (f) => setOpenState((o) => { const n = typeof f === 'function' ? f(o) : f; setStored(n); return n; });
  const opened = useRef(false);
  useEffect(() => { if (fresh > 0 && !opened.current) { setOpen(true); opened.current = true; } }, [fresh]);

  const notifSupported = typeof Notification !== 'undefined';
  const denied = notifSupported && Notification.permission === 'denied';
  const toggleNotify = async () => {
    if (notify) return setNotify(false);
    const p = await Notification.requestPermission();
    if (p === 'granted') setNotify(true);
  };

  const status = empty ? t.watchEmpty : fresh ? t.watchFresh(fresh) : hits ? t.watchHits(hits) : t.watchOk(entries.length);
  const time = checkedAt ? fmtTime(checkedAt, lang) : '';

  return (
    <section className={`watch ${tone}`} aria-label={t.watchTitle}>
      <button type="button" className="watch-head" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span className="dot" aria-hidden="true">{tone === 'ok' ? '✓' : tone === 'idle' ? '☆' : '!'}</span>
        <span className="watch-status">
          <strong>{status}</strong>
          {meta && !empty && <small>{t.watchBase(fmtDate(meta.updated))}{time && ` · ${t.checkedAt(time)}`}</small>}
        </span>
        <svg className={`chev${open ? ' up' : ''}`} viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
      </button>
      {open && (
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
          <p className="hint">{t.tgHint1}<a href={LINKS.telegram} target="_blank" rel="noopener">{t.tgHint2}</a>{t.tgHint3}</p>
        </div>
      )}
    </section>
  );
}
