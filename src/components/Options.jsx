export default function Options({ value, onChange }) {
  const set = (patch) => onChange({ ...value, ...patch });
  return (
    <div className="options">
      <label className="opt"><input type="checkbox" checked={value.any} onChange={(e) => set({ any: e.target.checked })} /> любое са словаў</label>
      <label className="opt"><input type="checkbox" checked={value.onlyNew} onChange={(e) => set({ onlyNew: e.target.checked })} /> толькі новыя (30 дзён)</label>
      <label className="opt">
        сартаваць{' '}
        <select value={value.sort} onChange={(e) => set({ sort: e.target.value })}>
          <option value="source">як у крыніцы</option>
          <option value="newest">спачатку новыя рашэньні</option>
          <option value="oldest">спачатку старыя рашэньні</option>
        </select>
      </label>
      <span className="hint">
        Пошук па ўваходжаньні; рэгістр, «ё/е» і лапкі не ўлічваюцца. Фразу бярыце ў лапкі: <code>"словы запар"</code>. Клавіша <code>/</code> — у поле пошуку.
      </span>
    </div>
  );
}
