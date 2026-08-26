export const fmtDate = (iso) => (iso ? iso.split('-').reverse().join('.') : '');
export const daysAgo = (iso) => (Date.now() - new Date(iso).getTime()) / 864e5;
export const NEW_DAYS = 30;
export const isRecent = (iso) => Boolean(iso) && daysAgo(iso) <= NEW_DAYS;
