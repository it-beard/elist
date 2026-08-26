export default function SearchBar({ value, onChange }) {
  return (
    <div className="field">
      <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="m20 20-4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <input
        id="q"
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Назва, аўтар, канал, спасылка, суд… (напр. «t.me/name» або «Радыё Свабода»)"
        autoFocus
        autoComplete="off"
        spellCheck={false}
        aria-label="Пошук"
      />
      {value && (
        <button type="button" className="clear" title="Ачысьціць" aria-label="Ачысьціць" onClick={() => { onChange(''); document.getElementById('q')?.focus(); }}>
          ×
        </button>
      )}
    </div>
  );
}
