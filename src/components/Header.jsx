import { fmtDate, isRecent, NEW_DAYS } from '../lib/format.js';
import { useLang } from '../hooks/useLang.jsx';
import ThemeToggle from './ThemeToggle.jsx';
import LangToggle from './LangToggle.jsx';

export default function Header({ meta, items }) {
  const { t, lang } = useLang();
  const recent = items ? items.filter((it) => isRecent(it.added)).length : 0;
  return (
    <header className="top wrap">
      <div className="top-row">
        <h1>{t.title}</h1>
        <LangToggle />
        <ThemeToggle />
      </div>
      <p className="sub">
        {meta ? (
          <>
            <span className="num">{meta.total.toLocaleString(lang)}</span> {t.records} · {t.updated} <time dateTime={meta.updated}>{fmtDate(meta.updated)}</time>
            {recent > 0 && <span className="badge-new">{t.recent(recent, NEW_DAYS)}</span>}
          </>
        ) : ' '}
      </p>
    </header>
  );
}
