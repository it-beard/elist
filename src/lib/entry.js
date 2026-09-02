/**
 * Запыт з уваходнай спасылкі: «?q=…» (старыя спасылкі, JSON-LD SearchAction) або «#q=…»
 * (кнопка «Спасылка», OpenSearch). Пасля чытання запыт пераносіцца ў history.state,
 * а адрас ачышчаецца: у адрасным радку, гісторыі браўзера, кэшы service worker'а
 * і логах хостынгу пошукавых запытаў няма. history.state жыве толькі ў гэтай укладцы
 * і перажывае перазагрузку старонкі.
 */
const HASH_Q = /^#q=(.*)$/;

const decode = (s) => { try { return decodeURIComponent(s.replace(/\+/g, ' ')); } catch { return s; } };

/** Чыстая функцыя: { q, url } — запыт і адрас без яго; q === null, калі запыту ў адрасе няма. */
export function parseEntryUrl(href) {
  const u = new URL(href);
  const m = u.hash.match(HASH_Q);
  const q = m ? decode(m[1]) : u.searchParams.get('q');
  if (q === null) return { q: null, url: u.href };
  u.searchParams.delete('q');
  if (m) u.hash = '';
  return { q, url: u.href };
}

/** Спасылка на запыт для «падзяліцца»: хэш не адпраўляецца на сервер. */
export const queryLink = (q, base = '/') => `${location.origin}${base}#q=${encodeURIComponent(q)}`;

/** Забірае запыт з адраса ў history.state; вяртае бягучы запыт укладкі. */
export function takeEntryQuery() {
  const { q, url } = parseEntryUrl(location.href);
  if (q === null) return history.state?.q ?? '';
  history.replaceState({ ...history.state, q }, '', url);
  return q;
}

/** Запомніць запыт у history.state (не ў адрасе). */
export function rememberQuery(q) {
  try { history.replaceState({ ...history.state, q }, '', location.href); } catch { /* ignore */ }
}
