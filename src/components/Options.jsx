import { useLang } from '../hooks/useLang.jsx';
import { LinkIcon, ChevronIcon } from './icons.jsx';

/**
 * Чыпы-опцыі пошуку ў ліпкім радку: «Любое са слоў» (для двух і больш слоў), «Сачыць» і «Спасылка» (пры запыце),
 * спіс назірання і сартаванне. Радок пераносіцца, а не пракручваецца.
 * Абмежаванне спісам — не тут, а ва ўкладках пад пошукам (Facets). «Новыя за N дзён» — гэта ўкладка «Новае».
 */
export default function Options({ value, onChange, watch, share, watchPanel, multiWord = false }) {
  const { t } = useLang();
  const set = (patch) => onChange({ ...value, ...patch });
  return (
    <div className="options">
      {watchPanel}
      {multiWord && (
        <button type="button" className={`chip option-any${value.any ? ' on' : ''}`} aria-pressed={value.any} title={t.anyTitle} onClick={() => set({ any: !value.any })}>
          {t.any}
        </button>
      )}
      {(watch || share) && <div className="option-actions">
        {watch && (
          <button type="button" className={`chip star${watch.on ? ' on' : ''}`} aria-pressed={watch.on} title={t.watchAddTitle} onClick={watch.toggle}>
            {watch.on ? '★ ' : '☆ '}{watch.on ? t.watchOn : t.watchAdd}
          </button>
        )}
        {share && (
          // на вузкім экране — толькі іконка (подпіс застаецца ў title/aria-label), пасля капіявання — «Скапіявана»
          <button type="button" className={`chip share${share.copied ? ' on' : ''}`} title={t.shareQueryTitle} aria-label={t.shareQuery} onClick={share.copy}>
            <LinkIcon />
            <span className="lbl">{share.copied ? t.copied : t.shareQuery}</span>
          </button>
        )}
      </div>}
      <label className="sort" title={t.sortTitle}>
        <span className="vh">{t.sort}</span>
        <select value={value.sort} title={t.sortTitle} onChange={(e) => set({ sort: e.target.value })}>
          <option value="newest">{t.sortNewest}</option>
          <option value="oldest">{t.sortOldest}</option>
          <option value="source">{t.sortSource}</option>
        </select>
        <ChevronIcon />
      </label>
    </div>
  );
}
