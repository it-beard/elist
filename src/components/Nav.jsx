import { useLang } from '../hooks/useLang.jsx';
import { href } from '../hooks/useHashRoute.js';

export default function Nav({ route, newCount }) {
  const { t } = useLang();
  const tab = (name, label, extra) => (
    <a href={href(name)} className={`tab${route === name ? ' on' : ''}`} aria-current={route === name ? 'page' : undefined}>
      {label}{extra}
    </a>
  );
  return (
    <nav className="wrap tabs" aria-label="Sections">
      {tab('', t.navSearch)}
      {tab('new', t.navNew, newCount > 0 && <span className="pill">+{newCount}</span>)}
      <a href={`${import.meta.env.BASE_URL}feed.xml`} className="tab rss" title={t.navRss} aria-label={t.navRss}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="19" r="2" fill="currentColor"/><path d="M4 10a10 10 0 0 1 10 10M4 4a16 16 0 0 1 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/></svg>
        <span>RSS</span>
      </a>
    </nav>
  );
}
