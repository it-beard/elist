import { useEffect } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage.js';
import { useLang } from '../hooks/useLang.jsx';

const MODES = ['light', 'dark', 'system'];

export default function ThemeToggle() {
  const { t } = useLang();
  const [mode, setMode] = useLocalStorage('theme', 'light');
  useEffect(() => {
    const root = document.documentElement;
    if (mode === 'system') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', mode);
  }, [mode]);
  const next = MODES[(MODES.indexOf(mode) + 1) % MODES.length];
  return (
    <button type="button" className="theme" title={`${t.theme[mode]} — ${t.themeHint}`} aria-label={t.theme[mode]} onClick={() => setMode(next)}>
      {mode === 'light' && <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>}
      {mode === 'dark' && <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/></svg>}
      {mode === 'system' && <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2"/><path d="M12 3a9 9 0 0 1 0 18Z" fill="currentColor"/></svg>}
    </button>
  );
}
