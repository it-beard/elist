import { fmtDate, isRecent, NEW_DAYS } from '../lib/format.js';

export default function Header({ meta, items }) {
  const recent = items ? items.filter((it) => isRecent(it.added)).length : 0;
  return (
    <header className="top">
      <div className="wrap">
        <h1>Рэспубліканскі спіс экстрэмісцкіх матэрыялаў</h1>
        <p className="sub">
          {meta ? (
            <>
              {meta.total.toLocaleString('be')} запісаў · абноўлена <time dateTime={meta.updated}>{fmtDate(meta.updated)}</time> · крыніца:{' '}
              <a href={meta.sourcePage} target="_blank" rel="noopener">zviazda.by</a>
              {recent > 0 && <span className="badge-new">+{recent} за {NEW_DAYS} дзён</span>}
            </>
          ) : '…'}
        </p>
      </div>
    </header>
  );
}
