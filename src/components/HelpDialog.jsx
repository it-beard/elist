import { useEffect, useRef } from 'react';
import { useLang } from '../hooks/useLang.jsx';
import { LINKS } from '../lib/i18n.js';

/** Попап-даведка: што гэта за сайт, як карыстацца, што значыць трапіць у спіс, прыватнасць. */
export default function HelpDialog({ open, onClose }) {
  const { t } = useLang();
  const ref = useRef(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    else if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} className="help" onClose={onClose} onClick={(e) => { if (e.target === ref.current) onClose(); }} aria-label={t.helpTitle}>
      <div className="help-inner">
        <div className="help-head">
          <h2>{t.helpTitle}</h2>
          <button type="button" className="clear" title={t.close} aria-label={t.close} onClick={onClose}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
          </button>
        </div>
        <section>
          <h3>{t.helpAboutTitle}</h3>
          <p>{t.helpAbout}</p>
        </section>
        <section>
          <h3>{t.helpHowTitle}</h3>
          <ol className="help-steps">{t.helpHow.map((s, i) => <li key={i}>{s}</li>)}</ol>
        </section>
        <section>
          <h3>{t.legalTitle}</h3>
          {t.legal.map(([h, p]) => (
            <div key={h}><h4>{h}</h4><p>{p}</p></div>
          ))}
          <ul className="legal-links">
            {t.legalLinks.map(([label, key]) => <li key={key}><a href={LINKS[key]} target="_blank" rel="noopener">{label}</a></li>)}
          </ul>
        </section>
        <section>
          <h3>{t.helpPrivacyTitle}</h3>
          <p>{t.privacy}</p>
          <p>{t.watchPrivacy}</p>
          <p className="travel-warn">⚠️ {t.travelWarn}</p>
        </section>
        <section>
          <h3>{t.helpOpenTitle}</h3>
          <p>{t.helpOpen1}<a href={LINKS.repo} target="_blank" rel="noopener">{t.helpOpen2}</a>{t.helpOpen3}</p>
        </section>
      </div>
    </dialog>
  );
}
