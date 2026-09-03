import { useEffect, useRef } from 'react';
import { SERIES, niceTicks, zoomRange } from '../lib/stats.js';

const PAD = { top: 14, right: 10, bottom: 26, left: 40 };
const GAP = 2;      // прасвет колеру паверхні паміж сегментамі стоса
const MAX_BAR = 24; // бар не таўсцейшы за 24px — рэшта слота застаецца паветрам

/**
 * SVG-таймлайн: стос бараў па серыях + лінія тэндэнцыі.
 * Жэсты: цягнуць — пракрутка; шчыпок / Ctrl+кола / двайны тап — маштаб;
 * тап ці навядзенне — выбар карзіны; клавіятура: ←/→ выбар, Shift+←/→ пракрутка, +/− маштаб.
 */
export default function Timeline({ width, height, range, onRange, visible, hidden, now, focus, onHover, onSelect, xTicks, ariaLabel, emptyText, series = SERIES }) {
  const svgRef = useRef(null);
  const ptrs = useRef(new Map());
  const gesture = useRef(null);
  const lastTap = useRef(0);
  const live = useRef({});
  live.current = { range, onRange, visible, onSelect, onHover, focus };

  const plotX = PAD.left, plotW = Math.max(10, width - PAD.left - PAD.right);
  const plotY = PAD.top, plotH = Math.max(10, height - PAD.top - PAD.bottom);
  const [t0, t1] = range;
  const X = (t) => plotX + ((t - t0) / (t1 - t0)) * plotW;
  const T = (x, [a, b] = live.current.range) => a + ((x - plotX) / plotW) * (b - a);

  const shown = (i) => !hidden.has(series[i]);
  const yMax = visible.reduce((m, b) => Math.max(m, b.counts.reduce((s, v, i) => (shown(i) ? s + v : s), 0)), 0);
  const ticks = niceTicks(yMax);
  const top = ticks[ticks.length - 1];
  const Y = (v) => plotY + plotH - (v / top) * plotH;

  // ---- жэсты ----
  const px = (e) => e.clientX - svgRef.current.getBoundingClientRect().left;
  const bucketAt = (x) => { const t = T(x); return live.current.visible.find((b) => t >= b.start && t < b.end) || null; };
  const zoomAt = (f, at) => live.current.onRange(zoomRange(live.current.range, f, at));

  const onPointerDown = (e) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    e.currentTarget.setPointerCapture(e.pointerId);
    ptrs.current.set(e.pointerId, px(e));
    const xs = [...ptrs.current.values()];
    if (xs.length === 1) gesture.current = { mode: 'pan', x: xs[0], range: live.current.range, moved: false };
    else if (xs.length === 2) gesture.current = { mode: 'pinch', a: xs[0], b: xs[1], range: live.current.range };
  };
  const onPointerMove = (e) => {
    const x = px(e);
    if (!ptrs.current.has(e.pointerId)) { if (e.pointerType === 'mouse') live.current.onHover(bucketAt(x)?.start ?? null); return; }
    ptrs.current.set(e.pointerId, x);
    const g = gesture.current;
    if (!g) return;
    if (g.mode === 'pan') {
      const dx = x - g.x;
      if (Math.abs(dx) > 4) g.moved = true;
      if (!g.moved) return;
      const span = g.range[1] - g.range[0];
      const dt = (-dx / plotW) * span;
      live.current.onRange([g.range[0] + dt, g.range[1] + dt]);
    } else if (ptrs.current.size === 2) {
      let [a, b] = [...ptrs.current.values()];
      let [ga, gb] = [g.a, g.b];
      if (a > b) { [a, b] = [b, a]; [ga, gb] = [gb, ga]; }
      if (b - a < 12) return;
      const ta = T(ga, g.range), tb = T(gb, g.range);
      const span = ((tb - ta) * plotW) / (b - a);
      const start = ta - ((a - plotX) / plotW) * span;
      live.current.onRange([start, start + span]);
    }
  };
  const onPointerUp = (e) => {
    const x = px(e);
    const g = gesture.current;
    const tap = e.type === 'pointerup' && g?.mode === 'pan' && !g.moved;
    ptrs.current.delete(e.pointerId);
    if (tap) {
      const b = bucketAt(x);
      if (b) live.current.onSelect(b.start);
      const t = Date.now();
      if (e.pointerType !== 'mouse' && t - lastTap.current < 320) zoomAt(2, T(x));
      lastTap.current = t;
    }
    const xs = [...ptrs.current.values()];
    gesture.current = xs.length === 1 ? { mode: 'pan', x: xs[0], range: live.current.range, moved: true } : null;
  };
  const onDoubleClick = (e) => zoomAt(2, T(px(e)));
  const onKeyDown = (e) => {
    const { visible: vis, focus: f, range: r, onRange: set, onSelect: sel } = live.current;
    const span = r[1] - r[0];
    if (e.key === '+' || e.key === '=') { set(zoomRange(r, 1.6)); }
    else if (e.key === '-' || e.key === '_') { set(zoomRange(r, 1 / 1.6)); }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      const dir = e.key === 'ArrowLeft' ? -1 : 1;
      if (e.shiftKey) set([r[0] + dir * span * 0.2, r[1] + dir * span * 0.2]);
      else if (vis.length) {
        const i = vis.findIndex((b) => b.start === f);
        const n = vis[Math.min(vis.length - 1, Math.max(0, (i < 0 ? vis.length - 1 : i) + dir))];
        if (n) sel(n.start);
      }
    } else return;
    e.preventDefault();
  };

  // Кола: Ctrl/⌘ (і шчыпок на трэкпадзе) — маштаб, гарызантальнае — пракрутка, звычайнае — старонка.
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const h = (e) => {
      if (e.ctrlKey || e.metaKey) { e.preventDefault(); zoomAt(Math.exp(-e.deltaY * 0.01), T(e.clientX - el.getBoundingClientRect().left)); }
      else if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        e.preventDefault();
        const r = live.current.range, dt = (e.deltaX / plotW) * (r[1] - r[0]);
        live.current.onRange([r[0] + dt, r[1] + dt]);
      }
    };
    el.addEventListener('wheel', h, { passive: false });
    return () => el.removeEventListener('wheel', h);
  }, [plotW, plotX]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- геаметрыя бараў ----
  const bars = visible.map((b) => {
    const xs = X(b.start), xe = X(b.end);
    const slot = xe - xs;
    const bw = Math.min(MAX_BAR, Math.max(2, slot * 0.72));
    const x = xs + (slot - bw) / 2;
    const segs = [];
    let y0 = Y(0);
    for (let i = 0; i < series.length; i++) {
      if (!shown(i) || !b.counts[i]) continue;
      const hpx = (b.counts[i] / top) * plotH;
      segs.push({ s: series[i], y: y0 - hpx, h: hpx });
      y0 -= hpx;
    }
    return { b, xs, slot, x, bw, segs, partial: b.end > now };
  });
  const focused = bars.find(({ b }) => b.start === focus);
  const trendPts = bars.filter(({ b }) => b.trend != null).map(({ xs, slot, b }) => `${(xs + slot / 2).toFixed(1)},${Y(b.trend).toFixed(1)}`).join(' ');

  const topPath = (x, y, w, h) => {
    const r = Math.min(3, h / 2, w / 2);
    return `M${x},${y + r}a${r},${r} 0 0 1 ${r},-${r}h${w - 2 * r}a${r},${r} 0 0 1 ${r},${r}v${h - r}h-${w}z`;
  };

  return (
    <svg
      ref={svgRef} className="tl" width={width} height={height} viewBox={`0 0 ${width} ${height}`}
      role="img" aria-label={ariaLabel} tabIndex={0}
      onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
      onPointerLeave={() => onHover(null)} onDoubleClick={onDoubleClick} onKeyDown={onKeyDown}
    >
      <defs>
        <clipPath id="tl-clip"><rect x={plotX} y={0} width={plotW} height={height} /></clipPath>
        <pattern id="tl-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6" className="hatch" /></pattern>
      </defs>
      {ticks.map((v) => (
        <g key={v}>
          <line className={v === 0 ? 'base' : 'grid'} x1={plotX} x2={plotX + plotW} y1={Y(v)} y2={Y(v)} />
          <text x={plotX - 6} y={Y(v) + 4} textAnchor="end">{v}</text>
        </g>
      ))}
      <g clipPath="url(#tl-clip)">
        {focused && <rect className="band" x={focused.xs} y={plotY} width={focused.slot} height={plotH} />}
        {bars.map(({ b, x, bw, segs, partial }) => (
          <g key={b.start}>
            {segs.map((sg, i) => {
              const isTop = i === segs.length - 1;
              const gap = isTop ? 0 : GAP;
              if (sg.h - gap < 0.5) return null;
              return isTop
                ? <path key={sg.s} className={`s-${sg.s}`} d={topPath(x, sg.y, bw, sg.h)} />
                : <rect key={sg.s} className={`s-${sg.s}`} x={x} y={sg.y + gap} width={bw} height={sg.h - gap} />;
            })}
            {partial && segs.length > 0 && <rect className="partial" x={x} y={segs[segs.length - 1].y} width={bw} height={Y(0) - segs[segs.length - 1].y} />}
          </g>
        ))}
        {bars.length > 1 && <polyline className="trend" points={trendPts} />}
        {xTicks.map(({ t, label }) => (
          <g key={t}>
            <line className="tick" x1={X(t)} x2={X(t)} y1={plotY + plotH} y2={plotY + plotH + 4} />
            <text x={X(t)} y={height - 8} textAnchor="middle">{label}</text>
          </g>
        ))}
      </g>
      {!yMax && <text className="empty" x={plotX + plotW / 2} y={plotY + plotH / 2} textAnchor="middle">{emptyText}</text>}
    </svg>
  );
}
