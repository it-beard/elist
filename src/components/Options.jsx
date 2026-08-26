export default function Options({ value, onChange }) {
  const set = (patch) => onChange({ ...value, ...patch });
  const Chip = ({ k, children }) => (
    <button type="button" className={`chip${value[k] ? ' on' : ''}`} aria-pressed={value[k]} onClick={() => set({ [k]: !value[k] })}>
      {children}
    </button>
  );
  return (
    <div className="options">
      <Chip k="onlyNew">Новыя за 30 дзён</Chip>
      <Chip k="any">Любое са словаў</Chip>
      <label className="sort">
        <span className="vh">Сартаваць</span>
        <select value={value.sort} onChange={(e) => set({ sort: e.target.value })}>
          <option value="newest">Спачатку новыя</option>
          <option value="oldest">Спачатку старыя</option>
          <option value="source">Як у крыніцы</option>
        </select>
      </label>
    </div>
  );
}
