import { useLang } from '../hooks/useLang.jsx';

export default function LangToggle() {
  const { lang, t, setLang } = useLang();
  const next = lang === 'be' ? 'en' : 'be';
  return (
    <button type="button" className="theme lang" title={t.lang} aria-label={t.lang} onClick={() => setLang(next)}>
      {next.toUpperCase()}
    </button>
  );
}
