import { Fragment } from 'react';
import { fmtDate, fmtLocalDate, fmtTime, relDay, STALE_HOURS, hoursSince } from '../lib/format.js';
import { useLang } from '../hooks/useLang.jsx';
import ThemeToggle from './ThemeToggle.jsx';
import LangToggle from './LangToggle.jsx';

export default function Header({ meta, online, onHelp }) {
  const { t, lang } = useLang();
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
  const extra = [
    hasStamp(fm) && { key: 'f', label: t.formationsChecked, title: t.formationsDaily, m: fm },
    hasStamp(pm) && { key: 'p', label: t.personsChecked, title: t.personsDaily, m: pm },
  ].filter(Boolean);
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
          extra.length ? (
            <>
              {/* з дадатковымі спісамі — «абноўлена: матэрыялы сёння а 10:54 · фарміраванні ўчора а 04:20 · асобы …»,
                  без іх — як раней. Лічыльнік новых за месяц тут не паказваем — ён ёсць на ўкладцы «Новае». */}
              {t.updated}: {t.updatedMaterials} <time dateTime={meta.checkedAt || meta.updated} title={t.twiceDaily}>{updatedStr}</time>
              {extra.map(({ key, label, title, m }) => (
                <Fragment key={key}>{' · '}{label} <time dateTime={m.checkedAt || m.checked || m.updated} title={title}>{updatedLabel(m, t, lang)}</time></Fragment>
              ))}
            </>
          ) : (
            <>{t.updated} <time dateTime={meta.checkedAt || meta.updated} title={t.twiceDaily}>{updatedStr}</time></>
          )
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
