import { useLang } from '../hooks/useLang.jsx';
import { href } from '../hooks/useHashRoute.js';
import { LINKS } from '../lib/i18n.js';

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
      <a href={href('stats')} className={`tab rss stats${route === 'stats' ? ' on' : ''}`} title={t.navStats} aria-label={t.navStats} aria-current={route === 'stats' ? 'page' : undefined}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 20v-7M11 20V5M17 20v-10M2.5 20h19" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/></svg>
        <span>{t.navStats}</span>
      </a>
      <a href={LINKS.telegram} className="tab rss tg" target="_blank" rel="noopener" title={t.navTg} aria-label={t.navTg}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21.5 4.5 3.2 11.6c-1 .4-1 1 0 1.3l4.5 1.4 1.7 5.3c.2.6.6.7 1.1.3l2.5-2.1 4.7 3.5c.7.4 1.2.2 1.4-.7l3-14.5c.3-1.1-.4-1.6-1.6-1.1Z" fill="currentColor"/></svg>
        <span>Telegram</span>
      </a>
      <a href={`${import.meta.env.BASE_URL}feed.xml`} className="tab rss" title={t.navRss} aria-label={t.navRss}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="19" r="2" fill="currentColor"/><path d="M4 10a10 10 0 0 1 10 10M4 4a16 16 0 0 1 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/></svg>
        <span>RSS</span>
      </a>
    </nav>
  );
}
