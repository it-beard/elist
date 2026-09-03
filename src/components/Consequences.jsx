import { useLang } from '../hooks/useLang.jsx';
import { LINKS } from '../lib/i18n.js';

/**
 * «Што гэта значыць для мяне» — згорнуты блок з тлумачэннем наступстваў.
 * formations — сярод вынікаў ёсць экстрэмісцкія фарміраванні (МУС/КДБ): зверху заўвага пра крымінальную адказнасць.
 */
export default function Consequences({ open = false, formations = false }) {
  const { t } = useLang();
  return (
    <details className="legal" open={open || undefined}>
      <summary>{t.legalTitle}</summary>
      <div className="legal-body">
        {formations && <p className="crime">{t.crimeNote}</p>}
        {t.legal.map(([h, p]) => (
          <section key={h}><h3>{h}</h3><p>{p}</p></section>
        ))}
        <ul className="legal-links">
          {t.legalLinks.map(([label, key]) => (
            <li key={key}><a href={LINKS[key]} target="_blank" rel="noopener">{label}</a></li>
          ))}
        </ul>
      </div>
    </details>
  );
}
