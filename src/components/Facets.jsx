import { useLang } from '../hooks/useLang.jsx';
import { fmtNum } from '../lib/faq.js';

const ORDER = ['', 'm', 'f', 'p', 'w'];

/**
 * Укладкі-спісы пад пошукам: «Усе · Матэрыялы · Фарміраванні · Асобы · Вышук РФ» з лічбамі — колькі знойдзена ў кожным спісе
 * (без запыту — колькі запісаў у базе). Націск абмяжоўвае выдачу адным спісам, паўторны — здымае абмежаванне.
 * Замяняюць чыпы «Толькі …» у ліпкім радку: не ліпкія, пераносяцца на вузкім экране і паказваюць, дзе ёсць вынікі.
 * lists — якія дадатковыя спісы ёсць у базе ({ f, p, w }); counts — { all, m, f, p, w }.
 */
export default function Facets({ counts, value = '', onChange, lists = {} }) {
  const { t } = useLang();
  const keys = ORDER.filter((k) => k === '' || k === 'm' || lists[k]);
  return (
    <div className="facets" role="group" aria-label={t.facetsLabel}>
      {keys.map((k) => {
        const n = k ? counts[k] || 0 : counts.all || 0;
        const on = value === k;
        return (
          <button
            key={k || 'all'} type="button"
            className={`facet${k ? ` ${k}` : ''}${on ? ' on' : ''}${!n && !on ? ' zero' : ''}`}
            aria-pressed={on} title={t.facetTitle[k || 'all']}
            onClick={() => onChange(on && k ? '' : k)}
          >
            {k && <i className="dot" aria-hidden="true" />}
            {t.facet[k || 'all']}
            <span className="cnt">{fmtNum(n)}</span>
          </button>
        );
      })}
    </div>
  );
}
