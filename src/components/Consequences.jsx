import { useLang } from '../hooks/useLang.jsx';
import { LINKS } from '../lib/i18n.js';

/**
 * «Што гэта значыць для мяне» — згорнуты блок з тлумачэннем наступстваў. Спачатку агаворка «не юрыдычная
 * кансультацыя», потым каляровы блок на кожны спіс, які ёсць у выдачы (ці якому належыць адкрыты запіс) — кожны факт
 * толькі ў адным месцы, без агульнага пераказу ўсіх спісаў:
 * materials — Рэспубліканскі спіс экстрэмісцкіх матэрыялаў (суды): адміністрацыйная адказнасць і падпіскі;
 * formations — пералік экстрэмісцкіх фарміраванняў (МУС/КДБ): крымінальная адказнасць;
 * persons — пералік фізічных асоб (МУС): што гэта за пералік і якія абмежаванні ён цягне;
 * wanted — база вышуку РФ (паводле Медыязоны): што азначае расійскі вышук па запыце Беларусі.
 * У канцы — што рабіць, калі знайшлі сябе, і спасылкі на праваабаронцаў.
 */
export default function Consequences({ open = false, materials = false, formations = false, persons = false, wanted = false }) {
  const { t } = useLang();
  return (
    <details className="legal" open={open || undefined}>
      <summary>{t.legalTitle}</summary>
      <div className="legal-body">
        <section><h3>{t.legalIntro[0]}</h3><p>{t.legalIntro[1]}</p></section>
        {materials && <p className="crime material">{t.materialNote}</p>}
        {formations && <p className="crime">{t.crimeNote}</p>}
        {persons && <p className="crime person">{t.personNote}</p>}
        {wanted && <p className="crime wanted">{t.wantedNote}</p>}
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
