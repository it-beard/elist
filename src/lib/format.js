export const fmtDate = (iso) => (iso ? iso.split('-').reverse().join('.') : '');
export const daysAgo = (iso) => (Date.now() - new Date(iso).getTime()) / 864e5;
export const NEW_DAYS = 30;
export const isRecent = (iso) => Boolean(iso) && daysAgo(iso) <= NEW_DAYS;

/** «11:23» у мясцовым часе прылады (hourCycle, а не hour12 — інакш Chrome дае «24:30»). */
export const fmtTime = (d, lang) => new Date(d).toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

/** «01.09.2026» па мясцовай даце прылады (fmtDate працуе з ISO-радком без пояса). */
export const fmtLocalDate = (d) => fmtDate(new Date(d).toLocaleDateString('sv'));

/** Дзень адносна now у мясцовым часе: 'today' | 'yesterday' | null (даўней). */
export function relDay(d, now = new Date()) {
  const day = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(now) - day(new Date(d))) / 864e5);
  return diff === 0 ? 'today' : diff === 1 ? 'yesterday' : null;
}
