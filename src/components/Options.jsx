import { useLang } from '../hooks/useLang.jsx';

/**
 * Чыпы-опцыі пошуку ў ліпкім радку: «Сачыць» і «Спасылка» (пры запыце), «Любое са слоў» (толькі калі ў запыце
 * два і больш словы — для аднаго яно бессэнсоўнае) і сартаванне. Радок пераносіцца, а не пракручваецца.
 * Абмежаванне спісам — не тут, а ва ўкладках пад пошукам (Facets). «Новыя за N дзён» — гэта ўкладка «Новае».
 */
export default function Options({ value, onChange, watch, share, multiWord = false }) {
  const { t } = useLang();
  const set = (patch) => onChange({ ...value, ...patch });
  const Chip = ({ k, children }) => (
    <button type="button" className={`chip${value[k] ? ' on' : ''}`} aria-pressed={value[k]} onClick={() => set({ [k]: !value[k] })}>
      {children}
    </button>
  );
  return (
    <div className="options">
      {watch && (
        <button type="button" className={`chip star${watch.on ? ' on' : ''}`} aria-pressed={watch.on} title={t.watchAddTitle} onClick={watch.toggle}>
          {watch.on ? '★ ' : '☆ '}{watch.on ? t.watchOn : t.watchAdd}
        </button>
      )}
      {share && (
        // на вузкім экране — толькі іконка (подпіс застаецца ў title/aria-label), пасля капіявання — «Скапіявана»
        <button type="button" className={`chip share${share.copied ? ' on' : ''}`} title={t.shareQueryTitle} aria-label={t.shareQuery} onClick={share.copy}>
          <svg className="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1.5 1.5M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.5-1.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          <span className="lbl">{share.copied ? t.copied : t.shareQuery}</span>
        </button>
      )}
      {multiWord && <Chip k="any">{t.any}</Chip>}
      <label className="sort" title={t.sortTitle}>
        <span className="vh">{t.sort}</span>
        <select value={value.sort} title={t.sortTitle} onChange={(e) => set({ sort: e.target.value })}>
          <option value="newest">{t.sortNewest}</option>
          <option value="oldest">{t.sortOldest}</option>
          <option value="source">{t.sortSource}</option>
        </select>
      </label>
    </div>
  );
}
