import { useLang } from '../hooks/useLang.jsx';

/**
 * Чыпы-опцыі пошуку. lists — якія дадатковыя спісы ёсць у базе ({ f: фарміраванні, p: фізічныя асобы }):
 * чыпы «Толькі матэрыялы» / «Толькі фарміраванні» / «Толькі асобы» абмяжоўваюць пошук адным спісам
 * (паўторны націск здымае абмежаванне). «Новыя за N дзён» тут няма — гэта ўкладка «Новае».
 */
const LIST_CLASS = { f: ' form', p: ' person' };

export default function Options({ value, onChange, watch, share, lists = {} }) {
  const { t } = useLang();
  const set = (patch) => onChange({ ...value, ...patch });
  const Chip = ({ k, children }) => (
    <button type="button" className={`chip${value[k] ? ' on' : ''}`} aria-pressed={value[k]} onClick={() => set({ [k]: !value[k] })}>
      {children}
    </button>
  );
  const list = value.list || '';
  const hasLists = Boolean(lists.f || lists.p);
  const ListChip = ({ k, children }) => (
    <button
      type="button" className={`chip${list === k ? ` on${LIST_CLASS[k] || ''}` : ''}`} aria-pressed={list === k}
      title={t.listFilterTitle} onClick={() => set({ list: list === k ? '' : k })}
    >
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
        <button type="button" className={`chip${share.copied ? ' on' : ''}`} title={t.shareQueryTitle} onClick={share.copy}>
          {share.copied ? t.copied : t.shareQuery}
        </button>
      )}
      {hasLists && <ListChip k="m">{t.listMaterials}</ListChip>}
      {lists.f && <ListChip k="f">{t.listFormations}</ListChip>}
      {lists.p && <ListChip k="p">{t.listPersons}</ListChip>}
      <Chip k="any">{t.any}</Chip>
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
