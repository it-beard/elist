/** Разклад аўтаабнаўлення: GitHub Action штодня 04:17 UTC, зборка ~10 хвілін. */
export const UPDATE_UTC = { h: 4, m: 30 };

/** Момант наступнага абнаўлення (у мясцовым часе прылады). */
export function nextUpdate(now = new Date()) {
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), UPDATE_UTC.h, UPDATE_UTC.m));
  if (next <= now) next.setUTCDate(next.getUTCDate() + 1);
  return next;
}
