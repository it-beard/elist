import { useLang } from '../hooks/useLang.jsx';
import { LINKS } from '../lib/i18n.js';

/** «Што гэта значыць для мяне» — згорнуты блок з тлумачэннем наступстваў. */
export default function Consequences({ open = false }) {
  const { t } = useLang();
  return (
    <details className="legal" open={open || undefined}>
      <summary>{t.legalTitle}</summary>
      <div className="legal-body">
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
