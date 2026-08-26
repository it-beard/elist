import { fmtDate, isRecent, NEW_DAYS } from '../lib/format.js';

export default function Header({ meta, items }) {
  const recent = items ? items.filter((it) => isRecent(it.added)).length : 0;
  return (
    <header className="top wrap">
      <h1>Спіс экстрэмісцкіх матэрыялаў</h1>
      <p className="sub">
        {meta ? (
          <>
            <span className="num">{meta.total.toLocaleString('be')}</span> запісаў · абноўлена <time dateTime={meta.updated}>{fmtDate(meta.updated)}</time>
            {recent > 0 && <span className="badge-new">+{recent} за {NEW_DAYS} дзён</span>}
          </>
        ) : ' '}
      </p>
    </header>
  );
}
