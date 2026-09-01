/**
 * Агрэгацыя запісаў для таймлайна: дзённыя лічыльнікі → карзіны (дзень/тыдзень/
 * месяц/квартал/год) па тыпах артыкула, лінія тэндэнцыі, восі. Чыстыя функцыі,
 * усе даты — UTC-мілісекунды (даты рашэнняў у базе без часу).
 */
export const SERIES = ['gpk', 'kgs', 'none']; // фіксаваны парадак = фіксаваныя колеры
export const GRAINS = ['day', 'week', 'month', 'quarter', 'year'];
export const DAY = 864e5;
export const GRAIN_MS = { day: DAY, week: 7 * DAY, month: 30.44 * DAY, quarter: 91.31 * DAY, year: 365.25 * DAY };
/** Акно слізгальнага сярэдняга (у карзінах) для лініі тэндэнцыі. */
export const TREND_WINDOW = { day: 14, week: 8, month: 6, quarter: 4, year: 3 };

const ymd = (t) => { const d = new Date(t); return [d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()]; };

/** Пачатак карзіны, у якую трапляе момант t. Тыдзень — з панядзелка. */
export function floorTo(t, grain) {
  const [y, m, d] = ymd(t);
  switch (grain) {
    case 'day': return Date.UTC(y, m, d);
    case 'week': return Date.UTC(y, m, d - ((new Date(t).getUTCDay() + 6) % 7));
    case 'month': return Date.UTC(y, m, 1);
    case 'quarter': return Date.UTC(y, m - (m % 3), 1);
    default: return Date.UTC(y, 0, 1);
  }
}

/** Пачатак наступнай карзіны пасля той, што пачынаецца ў t. */
export function nextOf(t, grain) {
  const [y, m, d] = ymd(t);
  switch (grain) {
    case 'day': return Date.UTC(y, m, d + 1);
    case 'week': return Date.UTC(y, m, d + 7);
    case 'month': return Date.UTC(y, m + 1, 1);
    case 'quarter': return Date.UTC(y, m + 3, 1);
    default: return Date.UTC(y + 1, 0, 1);
  }
}

/** Запісы → адсартаваны масіў [дзень(ms), [gpk, kgs, none]]. Без даты — прапускаем. */
export function dailyCounts(items) {
  const map = new Map();
  for (const it of items) {
    if (!it.date) continue;
    const t = Date.parse(it.date);
    if (Number.isNaN(t)) continue;
    const s = Math.max(0, SERIES.indexOf(it.art || 'none'));
    const c = map.get(t) || map.set(t, [0, 0, 0]).get(t);
    c[s] += 1;
  }
  return [...map.entries()].sort((a, b) => a[0] - b[0]);
}

/** Дзённыя лічыльнікі → суцэльны шэраг карзін ад першага запісу да `until` (пустыя — таксама). */
export function buckets(daily, grain, until) {
  if (!daily.length) return [];
  const out = [];
  const push = (start) => { const b = { start, end: nextOf(start, grain), counts: [0, 0, 0], total: 0 }; out.push(b); return b; };
  let cur = push(floorTo(daily[0][0], grain));
  for (const [t, c] of daily) {
    while (t >= cur.end) cur = push(cur.end);
    for (let i = 0; i < 3; i++) cur.counts[i] += c[i];
    cur.total += c[0] + c[1] + c[2];
  }
  const last = until ?? daily[daily.length - 1][0];
  while (last >= cur.end) cur = push(cur.end);
  return out;
}

/** Цэнтраванае слізгальнае сярэдняе сумы бачных серый (на краях — часткавае акно). */
export function trend(list, win, hidden = new Set()) {
  const vals = list.map((b) => b.counts.reduce((s, v, i) => (hidden.has(SERIES[i]) ? s : s + v), 0));
  const h = Math.floor(win / 2);
  return vals.map((_, i) => {
    const a = Math.max(0, i - h), z = Math.min(vals.length - 1, i + h);
    let s = 0;
    for (let j = a; j <= z; j++) s += vals[j];
    return s / (z - a + 1);
  });
}

/** Найдрабнейшая карзіна, пры якой слот бара не вузейшы за minSlot пікселяў. */
export function pickGrain(spanMs, plotWidth, minSlot = 8) {
  return GRAINS.find((g) => (spanMs / GRAIN_MS[g]) * minSlot <= plotWidth) || 'year';
}

/** Круглыя дзяленні восі Y: 0 … ≥max, не больш за n крокаў. */
export function niceTicks(max, n = 4) {
  if (!(max > 0)) return [0, 1];
  const raw = max / n;
  const p = 10 ** Math.floor(Math.log10(raw));
  // лічым цэлыя запісы — крок не драбнейшы за 1, а 2.5 толькі для 25/250/…
  const step = p < 1 ? 1 : (p >= 10 ? [1, 2, 2.5, 5, 10] : [1, 2, 5, 10]).map((s) => s * p).find((s) => max / s <= n);
  const out = [];
  for (let v = 0; v <= max + 1e-9; v += step) out.push(Math.round(v * 100) / 100);
  if (out[out.length - 1] < max) out.push(out[out.length - 1] + step);
  return out;
}

/** Абмежаваць дыяпазон: не менш за minSpan, не выходзіць за [min, max]. */
export function clampRange([t0, t1], min, max, minSpan) {
  let span = Math.min(Math.max(t1 - t0, minSpan), max - min);
  let a = t0;
  if (a < min) a = min;
  if (a + span > max) a = max - span;
  return [a, a + span];
}

/** Маштаб у f разоў вакол моманту at (па змаўчанні — цэнтр). */
export const zoomRange = ([t0, t1], f, at = (t0 + t1) / 2) => [at - (at - t0) / f, at + (t1 - at) / f];

/** Лічбы для плітак: усяго, за 365/30 дзён (+ папярэднія перыяды), пікавы месяц. */
export function summary(daily, now) {
  const sumBetween = (a, b) => daily.reduce((s, [t, c]) => (t >= a && t < b ? s + c[0] + c[1] + c[2] : s), 0);
  const total = sumBetween(-Infinity, Infinity);
  const d30 = now - 30 * DAY, d60 = now - 60 * DAY, y1 = now - 365 * DAY, y2 = now - 730 * DAY;
  const months = buckets(daily, 'month', now);
  const peak = months.reduce((best, b) => (b.total > (best?.total ?? -1) ? b : best), null);
  return {
    total,
    last30: sumBetween(d30, now + DAY), prev30: sumBetween(d60, d30),
    last365: sumBetween(y1, now + DAY), prev365: sumBetween(y2, y1),
    peak,
    first: daily[0]?.[0] ?? null,
  };
}
