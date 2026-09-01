import { fmtDate, fmtLocalDate, fmtTime, relDay, isRecent, NEW_DAYS } from '../lib/format.js';
import { useLang } from '../hooks/useLang.jsx';
import ThemeToggle from './ThemeToggle.jsx';
import LangToggle from './LangToggle.jsx';

export default function Header({ meta, items, online, onHelp }) {
  const { t, lang } = useLang();
  const recent = items ? items.filter((it) => isRecent(it.added)).length : 0;
  // Час апошняга абнаўлення базы (checkedAt пішацца пры кожным паспяховым запуску
  // update.mjs). Старыя кэшы meta без checkedAt — толькі дата.
  const updatedStr = updatedLabel(meta, t, lang);
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
          <>
            {t.updated} <time dateTime={meta.checkedAt || meta.updated} title={t.twiceDaily}>{updatedStr}</time>
            {recent > 0 && <span className="badge-new">{t.recent(recent, NEW_DAYS)}</span>}
          </>
        ) : ' '}
      </p>
      {meta?.sourceError && <p className="notice warn">{t.sourceDown(fmtDate(meta.checked || meta.updated))}</p>}
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
