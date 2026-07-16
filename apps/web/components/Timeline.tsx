'use client';
// Temporal analysis axis (i2's second chart family). Every record is a tick on a real time
// scale; drag to brush a window and every coordinated view re-filters. Clicking a tick selects
// that FIR across the whole workstation.
//
// The two date inputs are not a fallback — they are the keyboard-native path (WCAG 2.1.1),
// self-documenting, and more useful to sighted analysts than arrow-key brushing would be.
import { useMemo, useRef, useState, useCallback } from 'react';
import { useWorkspace } from './workspace-store';

const PAD = { l: 8, r: 8, t: 14, b: 16 };
const fmt = (t: number) => new Date(t).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' });
const toInput = (t: number) => new Date(t).toISOString().slice(0, 10);

export function Timeline() {
  const { records, timeWindow, setTimeWindow, select, hover, isActive, selection } = useWorkspace();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(800);
  const [drag, setDrag] = useState<{ x0: number; x1: number } | null>(null);
  const H = 66;

  const setWrap = useCallback((el: HTMLDivElement | null) => {
    (wrapRef as any).current = el;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(240, e.contentRect.width)));
    ro.observe(el);
  }, []);

  const { min, max, ticks } = useMemo(() => {
    const ts = records.map((r) => new Date(r.occurred_at).getTime()).filter((n) => !Number.isNaN(n));
    if (ts.length === 0) return { min: 0, max: 0, ticks: [] as { t: number; r: any }[] };
    let lo = Math.min(...ts), hi = Math.max(...ts);
    if (lo === hi) { lo -= 864e5 * 3; hi += 864e5 * 3; }
    const pad = (hi - lo) * 0.04;
    return {
      min: lo - pad, max: hi + pad,
      ticks: records.map((r) => ({ t: new Date(r.occurred_at).getTime(), r }))
        .filter((d) => !Number.isNaN(d.t)).sort((a, b) => a.t - b.t),
    };
  }, [records]);

  const innerW = Math.max(1, w - PAD.l - PAD.r);
  const xOf = (t: number) => PAD.l + ((t - min) / Math.max(1, max - min)) * innerW;
  const tOf = (x: number) => min + ((x - PAD.l) / innerW) * (max - min);

  const onDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!ticks.length) return;
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({ x0: e.clientX - r.left, x1: e.clientX - r.left });
  };
  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!drag) return;
    const r = e.currentTarget.getBoundingClientRect();
    setDrag({ ...drag, x1: e.clientX - r.left });
  };
  const onUp = () => {
    if (!drag) return;
    const [a, b] = [drag.x0, drag.x1].sort((p, q) => p - q);
    if (Math.abs(b - a) < 6) setTimeWindow(null);        // a click, not a drag → clear
    else setTimeWindow({ from: tOf(a), to: tOf(b) });
    setDrag(null);
  };

  const brush = drag
    ? { a: Math.min(drag.x0, drag.x1), b: Math.max(drag.x0, drag.x1) }
    : timeWindow ? { a: xOf(timeWindow.from), b: xOf(timeWindow.to) } : null;

  const inWindow = (t: number) => !timeWindow || (t >= timeWindow.from && t <= timeWindow.to);
  const shown = ticks.filter((d) => inWindow(d.t)).length;

  const setBound = (which: 'from' | 'to', v: string) => {
    if (!v) return;
    const t = new Date(v + 'T00:00:00').getTime();
    const cur = timeWindow || { from: min, to: max };
    const next = which === 'from' ? { ...cur, from: t } : { ...cur, to: t };
    if (next.from <= next.to) setTimeWindow(next);
  };

  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="flex items-center justify-between gap-2 pb-1 shrink-0 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="eyebrow">Timeline</span>
          <span className="text-2xs text-fg-muted tabular-nums">
            {ticks.length ? `${shown}/${ticks.length} records` : 'no dated records'}
          </span>
        </div>
        {ticks.length > 0 && (
          <div className="flex items-center gap-1">
            <label className="sr-only" htmlFor="tl-from">Filter from date</label>
            <input id="tl-from" type="date" value={toInput(timeWindow?.from ?? min)} onChange={(e) => setBound('from', e.target.value)}
              className="bg-sunken border border-hairline rounded-sm px-1 h-5 text-2xs text-fg-secondary tabular-nums" />
            <span className="text-2xs text-fg-muted">→</span>
            <label className="sr-only" htmlFor="tl-to">Filter to date</label>
            <input id="tl-to" type="date" value={toInput(timeWindow?.to ?? max)} onChange={(e) => setBound('to', e.target.value)}
              className="bg-sunken border border-hairline rounded-sm px-1 h-5 text-2xs text-fg-secondary tabular-nums" />
            {timeWindow && (
              <button onClick={() => setTimeWindow(null)}
                className="btn-ghost text-2xs px-1.5 h-5 rounded-sm border border-accent text-accent hover:bg-accent-wash">clear</button>
            )}
          </div>
        )}
      </div>

      <div ref={setWrap} className="flex-1 min-h-0">
        {ticks.length === 0 ? (
          <div className="h-full grid place-items-center text-2xs text-fg-muted border border-dashed border-hairline rounded-sm">
            Ask a question — its source records plot here on a real time axis.
          </div>
        ) : (
          <svg
            width="100%" height={H} viewBox={`0 0 ${w} ${H}`}
            // role="group", NOT role="img": role="img" makes the entire subtree presentational,
            // which would actively hide every tick from assistive tech.
            role="group" aria-label={`Timeline of ${ticks.length} records. Drag to filter, or use the date fields above.`}
            className={`select-none ${drag ? 'cursor-grabbing' : 'cursor-crosshair'}`}
            onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp}
          >
            <line x1={PAD.l} x2={w - PAD.r} y1={H - PAD.b} y2={H - PAD.b} stroke="#4b483e" strokeWidth="1" />

            {brush && (
              <rect x={brush.a} y={PAD.t - 6} width={Math.max(1, brush.b - brush.a)} height={H - PAD.b - PAD.t + 6}
                fill="rgba(75,189,145,0.14)" stroke="#4bbd91" strokeWidth="1" />
            )}

            {ticks.map(({ t, r }, i) => {
              const x = xOf(t);
              const on = inWindow(t);
              const act = isActive('fir', r.id);
              const sel = selection.kind === 'fir' && selection.id === r.id;
              return (
                <g key={r.id + i}
                  onPointerDown={(e) => { e.stopPropagation(); select('fir', r.id); }}
                  onPointerEnter={() => hover('fir', r.id)} onPointerLeave={() => hover(null, null)}
                  className="cursor-pointer">
                  <rect x={x - 5} y={PAD.t - 6} width={10} height={H - PAD.b - PAD.t + 8} fill="transparent" />
                  <line x1={x} x2={x} y1={act ? PAD.t - 5 : PAD.t + 2} y2={H - PAD.b}
                    stroke={act ? '#6fd6ab' : on ? '#8a867a' : '#333028'} strokeWidth={act ? 2 : 1} />
                  {sel && <circle cx={x} cy={PAD.t - 6} r="2.5" fill="#4bbd91" />}
                </g>
              );
            })}

            <text x={PAD.l} y={H - 4} fill="#8a867a" fontSize="9" className="tabular-nums">{fmt(min)}</text>
            <text x={w - PAD.r} y={H - 4} fill="#8a867a" fontSize="9" textAnchor="end" className="tabular-nums">{fmt(max)}</text>
          </svg>
        )}
      </div>
    </div>
  );
}
