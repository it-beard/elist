import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLang } from '../hooks/useLang.jsx';
import { fmtDate } from '../lib/format.js';
import { fmtNum } from '../lib/faq.js';
import { SERIES, DAY, GRAINS, GRAIN_MS, TREND_WINDOW, dailyCounts, buckets, trend, pickGrain, clampRange, zoomRange, floorTo, nextOf, summary } from '../lib/stats.js';
import Timeline from './Timeline.jsx';

const MIN_SPAN = 14 * DAY;
const HEIGHT = 300, HEIGHT_SM = 250;

/** Шырыня элемента (ResizeObserver) — каб графік займаў усю картку. */
function useWidth(ref) {
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(el);
    setW(el.clientWidth);
    return () => ro.disconnect();
  }, [ref]);
  return w;
}

const iso = (t) => new Date(t).toISOString().slice(0, 10);
const pct = (n, d) => (d ? Math.round((n / d) * 100) : 0);
const delta = (cur, prev) => (prev ? Math.round(((cur - prev) / prev) * 100) : null);

/** Старонка «Статыстыка»: пліткі, таймлайн з маштабам, легенда, картка перыяду, табліца. */
export default function StatsPage({ items }) {
  const { t } = useLang();
  const now = useMemo(() => floorTo(Date.now(), 'day'), []);
  const daily = useMemo(() => dailyCounts(items), [items]);
  const minT = daily[0]?.[0] ?? now - 365 * DAY;
  const maxT = nextOf(now, 'day');
  const presets = useMemo(() => ({
    y1: [floorTo(now - 365 * DAY, 'month'), maxT],
    y3: [floorTo(now - 3 * 365 * DAY, 'month'), maxT],
    s2021: [Date.UTC(2021, 0, 1), maxT],
    all: [minT, maxT],
  }), [now, maxT, minT]);

  const [state, setState] = useState(() => ({ range: clampRange(presets.y3, minT, maxT, MIN_SPAN), preset: 'y3' }));
  const setRange = useCallback((r, preset = null) => setState({ range: clampRange(r, minT, maxT, MIN_SPAN), preset }), [minT, maxT]);
  const { range, preset } = state;
  const [hidden, setHidden] = useState(() => new Set());
  const [sel, setSel] = useState(null);
  const [hover, setHover] = useState(null);

  const wrapRef = useRef(null);
  const width = useWidth(wrapRef);
  const narrow = width > 0 && width < 480;
  const height = narrow ? HEIGHT_SM : HEIGHT;
  const plotW = Math.max(100, width - 50);
  const grain = pickGrain(range[1] - range[0], plotW);
  const full = useMemo(() => buckets(daily, grain, now), [daily, grain, now]);
  const tr = useMemo(() => trend(full, TREND_WINDOW[grain], hidden), [full, grain, hidden]);
  const withTrend = useMemo(() => full.map((b, i) => ({ ...b, trend: tr[i] })), [full, tr]);
  const visible = useMemo(() => withTrend.filter((b) => b.end > range[0] && b.start < range[1]), [withTrend, range]);

  const focusStart = hover ?? sel;
  // па змаўчанні — апошні завершаны перыяд (бягучы няпоўны паказваем толькі калі іншых няма)
  const focus = visible.find((b) => b.start === focusStart) || [...visible].reverse().find((b) => b.end <= now) || visible[visible.length - 1] || null;
  const focusIdx = focus ? full.findIndex((b) => b.start === focus.start) : -1;
  const step = (dir) => {
    const b = full[focusIdx + dir];
    if (!b) return;
    setSel(b.start); setHover(null);
    if (b.start < range[0] || b.end > range[1]) setRange([range[0] + dir * (b.end - b.start), range[1] + dir * (b.end - b.start)]);
  };
  useEffect(() => { setSel(null); }, [grain]);

  // ---- подпісы ----
  const fmtBucket = (b, g = grain) => {
    const d = new Date(b.start), y = d.getUTCFullYear(), m = d.getUTCMonth();
    switch (g) {
      case 'day': return fmtDate(iso(b.start));
      case 'week': return `${fmtDate(iso(b.start)).slice(0, 5)}–${fmtDate(iso(b.end - DAY))}`;
      case 'month': return `${t.months[m]} ${y}`;
      case 'quarter': return `${t.quarters[m / 3]} ${y}`;
      default: return String(y);
    }
  };
  const xTicks = useMemo(() => {
    const span = range[1] - range[0], maxN = plotW / 58;
    const unit = GRAINS.find((g) => span / GRAIN_MS[g] <= maxN) || 'year';
    // калі нават гады не змяшчаюцца — падпісваем кожны k-ты год
    const every = unit === 'year' ? Math.max(1, Math.ceil(span / GRAIN_MS.year / maxN)) : 1;
    const out = [];
    for (let tt = floorTo(range[0], unit); tt < range[1]; tt = nextOf(tt, unit)) {
      if (tt < range[0]) continue;
      const d = new Date(tt), y = d.getUTCFullYear(), m = d.getUTCMonth();
      if (y % every) continue;
      const label = unit === 'year' ? String(y)
        : unit === 'quarter' ? (m === 0 ? String(y) : t.quarters[m / 3])
          : unit === 'month' ? (m === 0 ? String(y) : t.monthsShort[m])
            : `${String(d.getUTCDate()).padStart(2, '0')}.${String(m + 1).padStart(2, '0')}`;
      out.push({ t: tt, label });
    }
    return out;
  }, [range, plotW, t]);

  const sum = useMemo(() => summary(daily, now), [daily, now]);
  const visTotals = SERIES.map((_, i) => visible.reduce((s, b) => s + b.counts[i], 0));
  const visSum = visTotals.reduce((a, b) => a + b, 0);
  const toggle = (s) => setHidden((h) => { const n = new Set(h); if (n.has(s)) n.delete(s); else n.add(s); return n; });
  const d30 = delta(sum.last30, sum.prev30), d365 = delta(sum.last365, sum.prev365);
  const fmtDelta = (d) => (d == null ? null : <><b>{d > 0 ? '+' : d < 0 ? '−' : ''}{Math.abs(d)}%</b> {t.vsPrev}</>);
  const focusTotal = focus ? focus.counts.reduce((s, v, i) => (hidden.has(SERIES[i]) ? s : s + v), 0) : 0;

  return (
    <>
      <h2 className="page-title">{t.statsTitle}</h2>
      <p className="hint">{t.statsIntro}</p>

      <div className="tiles">
        <div className="tile"><span className="lbl">{t.tileTotal}</span><span className="val">{fmtNum(sum.total)}</span>{sum.first && <span className="dlt">{t.since(fmtDate(iso(sum.first)))}</span>}</div>
        <div className="tile"><span className="lbl">{t.tile365}</span><span className="val">{fmtNum(sum.last365)}</span><span className="dlt">{fmtDelta(d365)}</span></div>
        <div className="tile"><span className="lbl">{t.tile30}</span><span className="val">{fmtNum(sum.last30)}</span><span className="dlt">{fmtDelta(d30)}</span></div>
        <div className="tile"><span className="lbl">{t.tilePeak}</span><span className="val">{fmtNum(sum.peak?.total ?? 0)}</span>{sum.peak && <span className="dlt">{fmtBucket(sum.peak, 'month')}</span>}</div>
      </div>

      <div className="chart-card">
        <div className="chart-bar">
          <div className="seg" role="group">
            {Object.keys(presets).map((k) => (
              <button key={k} type="button" aria-pressed={preset === k} onClick={() => { setRange(presets[k], k); setSel(null); }}>{t.presets[k]}</button>
            ))}
          </div>
          <div className="seg" role="group">
            <button type="button" className="z" title={t.zoomOut} aria-label={t.zoomOut} disabled={range[1] - range[0] >= maxT - minT} onClick={() => setRange(zoomRange(range, 1 / 1.6))}>−</button>
            <button type="button" className="z" title={t.zoomIn} aria-label={t.zoomIn} disabled={range[1] - range[0] <= MIN_SPAN} onClick={() => setRange(zoomRange(range, 1.6))}>+</button>
          </div>
          <span className="grain">{t.grainLabel(grain)}</span>
        </div>
        <div ref={wrapRef}>
          {width > 0 && (
            <Timeline
              width={width} height={height} range={range} onRange={setRange} visible={visible} hidden={hidden} now={now}
              focus={focus?.start ?? null} onHover={setHover} onSelect={(s) => { setSel(s); setHover(null); }} xTicks={xTicks} ariaLabel={t.chartAria} emptyText={t.newNone}
            />
          )}
        </div>
        <ul className="legend">
          {SERIES.map((s, i) => (
            <li key={s}>
              <button type="button" aria-pressed={!hidden.has(s)} title={`${t.seriesTitle[s]} — ${t.toggleSeries}`} onClick={() => toggle(s)}>
                <i className={`key s-${s}`} aria-hidden="true" />{t.series[s]}<span className="cnt">{fmtNum(visTotals[i])} · {pct(visTotals[i], visSum)}%</span>
              </button>
            </li>
          ))}
          <li><span className="trend-key" title={t.trendTitle(TREND_WINDOW[grain], grain)}><i className="key line" aria-hidden="true" />{t.trendLabel}</span></li>
        </ul>
      </div>

      {focus && (
        <div className="readout" aria-live="polite">
          <button type="button" className="nav" title={t.prevPeriod} aria-label={t.prevPeriod} disabled={focusIdx <= 0} onClick={() => step(-1)}>‹</button>
          <div className="body">
            <div className="period">{fmtBucket(focus)}{focus.end > now && <small>· {t.partial}</small>}</div>
            <div className="big">{fmtNum(focusTotal)} <small>{t.entries(focusTotal)}</small></div>
            <ul className="rows">
              {SERIES.map((s, i) => !hidden.has(s) && (
                <li key={s}><i className={`key s-${s}`} aria-hidden="true" /><b>{fmtNum(focus.counts[i])}</b> {t.series[s]}</li>
              ))}
              <li title={t.trendTitle(TREND_WINDOW[grain], grain)}><i className="key line" aria-hidden="true" /><b>{focus.trend >= 10 ? Math.round(focus.trend) : focus.trend.toFixed(1)}</b> {t.trendLabel} · {t.perGrain[grain]}</li>
            </ul>
          </div>
          <button type="button" className="nav" title={t.nextPeriod} aria-label={t.nextPeriod} disabled={focusIdx < 0 || focusIdx >= full.length - 1} onClick={() => step(1)}>›</button>
        </div>
      )}

      <p className="hint">{t.statsGestures}</p>

      <details className="stats-table">
        <summary>{t.tableToggle}</summary>
        <div className="tbl-wrap">
          <table>
            <thead><tr><th>{t.thPeriod}</th>{SERIES.map((s) => <th key={s}><i className={`key s-${s}`} aria-hidden="true" />{t.series[s]}</th>)}<th>{t.thTotal}</th></tr></thead>
            <tbody>
              {visible.map((b) => (
                <tr key={b.start}><td>{fmtBucket(b)}</td>{b.counts.map((v, i) => <td key={SERIES[i]}>{fmtNum(v)}</td>)}<td>{fmtNum(b.total)}</td></tr>
              ))}
            </tbody>
            <tfoot><tr><td>{t.thSum}</td>{visTotals.map((v, i) => <td key={SERIES[i]}>{fmtNum(v)}</td>)}<td>{fmtNum(visSum)}</td></tr></tfoot>
          </table>
        </div>
      </details>
    </>
  );
}
