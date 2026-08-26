import { NEW_DAYS } from '../lib/format.js';
import { useLang } from '../hooks/useLang.jsx';

export default function Options({ value, onChange }) {
  const { t } = useLang();
  const set = (patch) => onChange({ ...value, ...patch });
  const Chip = ({ k, children }) => (
    <button type="button" className={`chip${value[k] ? ' on' : ''}`} aria-pressed={value[k]} onClick={() => set({ [k]: !value[k] })}>
      {children}
    </button>
  );
  return (
    <div className="options">
      <Chip k="onlyNew">{t.onlyNew(NEW_DAYS)}</Chip>
      <Chip k="any">{t.any}</Chip>
      <label className="sort">
        <span className="vh">{t.sort}</span>
        <select value={value.sort} onChange={(e) => set({ sort: e.target.value })}>
          <option value="newest">{t.sortNewest}</option>
          <option value="oldest">{t.sortOldest}</option>
          <option value="source">{t.sortSource}</option>
        </select>
      </label>
    </div>
  );
}
