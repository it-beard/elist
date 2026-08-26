import { fmtDate, isRecent, NEW_DAYS } from '../lib/format.js';
import { nextUpdate } from '../lib/schedule.js';
import { useLang } from '../hooks/useLang.jsx';
import ThemeToggle from './ThemeToggle.jsx';
import LangToggle from './LangToggle.jsx';

export default function Header({ meta, items, online, onHelp }) {
  const { t, lang } = useLang();
  const recent = items ? items.filter((it) => isRecent(it.added)).length : 0;
  const next = nextUpdate();
  const day = next.getDate() === new Date().getDate() ? t.today : t.tomorrow;
  const nextStr = `${day} ${t.at} ${next.toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit', hour12: false })}`;
  return (
    <header className="top wrap">
      <div className="top-row">
        <img className="logo" src={`${import.meta.env.BASE_URL}icon-96.png`} width="44" height="44" alt="" />
        <h1>{t.title}</h1>
        <button type="button" className="theme help-btn" title={t.help} aria-label={t.help} onClick={onHelp}>?</button>
        <LangToggle />
        <ThemeToggle />
      </div>
      <p className="sub">
        {meta ? (
          <>
            {t.updated} <time dateTime={meta.updated}>{fmtDate(meta.updated)}</time>
            {' · '}<span className="next" title={next.toLocaleString(lang)}>{t.nextUpdate(nextStr)}</span>
            {recent > 0 && <span className="badge-new">{t.recent(recent, NEW_DAYS)}</span>}
          </>
        ) : ' '}
      </p>
      {meta?.sourceError && <p className="notice warn">{t.sourceDown(fmtDate(meta.checked || meta.updated))}</p>}
      {!online && meta && <p className="notice">{t.offline(fmtDate(meta.updated))}</p>}
    </header>
  );
}
