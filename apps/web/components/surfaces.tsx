'use client';
import { useEffect, useRef } from 'react';
import cytoscape from 'cytoscape';
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, ZAxis,
} from 'recharts';
import type { AnswerSurface, MapAnswer, GraphAnswer, ChartAnswer, TableAnswer, CardAnswer } from '@/lib/types';

const COMMUNITY_COLORS = ['#38bdf8', '#f59e0b', '#34d399', '#f43f5e', '#a78bfa', '#fb7185', '#2dd4bf', '#facc15'];

export function AnswerSurfaceView({ surface }: { surface: AnswerSurface }) {
  switch (surface.kind) {
    case 'map': return <MapView s={surface} />;
    case 'graph': return <GraphView s={surface} />;
    case 'chart': return <ChartView s={surface} />;
    case 'table': return <TableView s={surface} />;
    case 'card': return <CardView s={surface} />;
    default: return <div className="text-slate-400 text-sm p-6">No visual for this answer — see the conversation.</div>;
  }
}

/* ----------------------------- MAP (SVG projection) ----------------------------- */
function MapView({ s }: { s: MapAnswer }) {
  const all = [...s.points, ...(s.riskZones || [])];
  let minLat = 11.5, maxLat = 18.6, minLng = 74, maxLng = 78.7; // Karnataka fallback
  if (all.length) {
    minLat = Math.min(...all.map((p) => p.lat)); maxLat = Math.max(...all.map((p) => p.lat));
    minLng = Math.min(...all.map((p) => p.lng)); maxLng = Math.max(...all.map((p) => p.lng));
    const padLat = (maxLat - minLat) * 0.15 + 0.05, padLng = (maxLng - minLng) * 0.15 + 0.05;
    minLat -= padLat; maxLat += padLat; minLng -= padLng; maxLng += padLng;
  }
  const W = 760, H = 520;
  const x = (lng: number) => ((lng - minLng) / (maxLng - minLng || 1)) * W;
  const y = (lat: number) => H - ((lat - minLat) / (maxLat - minLat || 1)) * H;

  return (
    <div className="relative w-full h-full">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full rounded-lg bg-[#0c1220]">
        <defs>
          <radialGradient id="heat" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#f43f5e" stopOpacity="0" />
          </radialGradient>
        </defs>
        {/* grid */}
        {Array.from({ length: 9 }).map((_, i) => (
          <line key={'v' + i} x1={(i * W) / 8} y1={0} x2={(i * W) / 8} y2={H} stroke="#16203400" />
        ))}
        <rect x={0} y={0} width={W} height={H} fill="none" stroke="#223049" />
        {/* KDE haze */}
        {(s._grid || []).map((c, i) => (
          <circle key={'g' + i} cx={x(c.lng)} cy={y(c.lat)} r={10 + c.intensity * 26} fill="url(#heat)" opacity={0.06 + c.intensity * 0.12} />
        ))}
        {/* incidents */}
        {s.points.map((p, i) => (
          <circle key={'p' + i} cx={x(p.lng)} cy={y(p.lat)} r={3} fill="#38bdf8" opacity={0.8}>
            <title>{p.label || p.fir_id}</title>
          </circle>
        ))}
        {/* risk zones (pulsing) */}
        {(s.riskZones || []).map((z, i) => {
          const rPix = Math.max(14, ((z.radius_km / (maxLng - minLng) / 111) * W) || 26);
          return (
            <g key={'z' + i}>
              <circle cx={x(z.lng)} cy={y(z.lat)} r={rPix} fill="#f43f5e" opacity={0.08 + z.intensity * 0.12} stroke="#f43f5e" strokeOpacity={0.6} />
              <circle cx={x(z.lng)} cy={y(z.lat)} r={rPix} fill="none" stroke="#f43f5e" className="origin-center animate-pulseRing" style={{ transformBox: 'fill-box', transformOrigin: 'center' }} />
              {z.window && <text x={x(z.lng)} y={y(z.lat) - rPix - 4} fill="#fecdd3" fontSize="11" textAnchor="middle">{z.window}</text>}
            </g>
          );
        })}
      </svg>
      <div className="absolute bottom-2 left-3 text-[11px] text-slate-400">
        <span className="inline-block w-2 h-2 rounded-full bg-accent mr-1" /> incident
        <span className="inline-block w-2 h-2 rounded-full bg-danger ml-3 mr-1" /> predicted / hotspot zone
      </div>
    </div>
  );
}

/* ----------------------------- GRAPH (cytoscape) ----------------------------- */
function GraphView({ s }: { s: GraphAnswer }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const maxC = Math.max(1, ...s.nodes.map((n) => n.centrality || 0));
    const cy = cytoscape({
      container: ref.current,
      elements: [
        ...s.nodes.map((n) => ({ data: { id: n.id, label: n.label, group: n.group ?? 0, size: 16 + 30 * ((n.centrality || 0) / maxC), king: n.flags?.includes('kingpin') ? 1 : 0, focus: n.flags?.includes('focus') ? 1 : 0 } })),
        ...s.edges.map((e, i) => ({ data: { id: 'e' + i, source: e.source, target: e.target, predicted: e.predicted ? 1 : 0, flagged: e.flagged ? 1 : 0, w: e.predicted ? `~${e.score ?? ''}` : '' } })),
      ],
      style: [
        { selector: 'node', style: { 'background-color': (n: any) => COMMUNITY_COLORS[(n.data('group') || 0) % COMMUNITY_COLORS.length], label: 'data(label)', color: '#cbd5e1', 'font-size': 9, width: 'data(size)', height: 'data(size)', 'text-valign': 'bottom', 'text-margin-y': 3, 'border-width': 0 } },
        { selector: 'node[king = 1]', style: { 'border-width': 3, 'border-color': '#fde68a' } },
        { selector: 'node[focus = 1]', style: { 'border-width': 3, 'border-color': '#ffffff' } },
        { selector: 'edge', style: { width: 1.5, 'line-color': '#33455f', 'curve-style': 'bezier', 'target-arrow-shape': 'none', label: 'data(w)', 'font-size': 8, color: '#f87171' } },
        { selector: 'edge[predicted = 1]', style: { 'line-color': '#f43f5e', 'line-style': 'dashed', width: 2 } },
        { selector: 'edge[flagged = 1]', style: { 'line-color': '#f59e0b', width: 2.5 } },
      ],
      layout: { name: 'cose', animate: false, padding: 20, nodeRepulsion: 9000, idealEdgeLength: 70 } as any,
      minZoom: 0.3, maxZoom: 2.5, wheelSensitivity: 0.2,
    });
    return () => cy.destroy();
  }, [s]);
  return (
    <div className="w-full h-full relative">
      <div ref={ref} className="w-full h-full rounded-lg bg-[#0c1220]" />
      <div className="absolute top-2 right-3 text-[11px] text-slate-400 text-right">
        <div><span className="inline-block w-3 border-t-2 border-dashed border-danger align-middle mr-1" /> predicted hidden tie</div>
        <div><span className="inline-block w-2 h-2 rounded-full ring-2 ring-yellow-200 align-middle mr-1" /> kingpin · node size = centrality</div>
      </div>
    </div>
  );
}

/* ----------------------------- CHART (recharts) ----------------------------- */
function ChartView({ s }: { s: ChartAnswer }) {
  const data = s.series[0].points.map((p) => ({ x: p.x, y: p.y }));
  return (
    <div className="w-full h-full flex flex-col">
      <div className="text-sm text-slate-300 mb-2">{s.series[0].name}</div>
      <ResponsiveContainer width="100%" height="100%">
        {s.chartType === 'bar' ? (
          <BarChart data={data} margin={{ top: 8, right: 16, bottom: 28, left: 4 }}>
            <CartesianGrid stroke="#1c2940" strokeDasharray="3 3" />
            <XAxis dataKey="x" tick={{ fill: '#94a3b8', fontSize: 10 }} angle={-20} textAnchor="end" interval={0} height={60} />
            <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
            <Tooltip contentStyle={{ background: '#111722', border: '1px solid #223049', borderRadius: 8 }} />
            <Bar dataKey="y" fill="#38bdf8" radius={[4, 4, 0, 0]} />
          </BarChart>
        ) : s.chartType === 'scatter' ? (
          <ScatterChart margin={{ top: 8, right: 16, bottom: 28, left: 4 }}>
            <CartesianGrid stroke="#1c2940" />
            <XAxis type="number" dataKey="x" name={s.xLabel} tick={{ fill: '#94a3b8', fontSize: 11 }} />
            <YAxis type="number" dataKey="y" name={s.yLabel} tick={{ fill: '#94a3b8', fontSize: 11 }} />
            <ZAxis range={[60, 60]} />
            <Tooltip contentStyle={{ background: '#111722', border: '1px solid #223049', borderRadius: 8 }} cursor={{ strokeDasharray: '3 3' }} />
            <Scatter data={data} fill="#22d3ee" />
          </ScatterChart>
        ) : (
          <LineChart data={data} margin={{ top: 8, right: 16, bottom: 28, left: 4 }}>
            <CartesianGrid stroke="#1c2940" strokeDasharray="3 3" />
            <XAxis dataKey="x" tick={{ fill: '#94a3b8', fontSize: 10 }} angle={-20} textAnchor="end" interval={2} height={60} />
            <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
            <Tooltip contentStyle={{ background: '#111722', border: '1px solid #223049', borderRadius: 8 }} />
            <Line type="monotone" dataKey="y" stroke="#38bdf8" strokeWidth={2} dot={false} />
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

/* ----------------------------- TABLE ----------------------------- */
function TableView({ s }: { s: TableAnswer }) {
  return (
    <div className="w-full h-full overflow-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-panel2">
          <tr>{s.columns.map((c) => <th key={c.key} className="text-left font-medium text-slate-300 px-3 py-2 border-b border-edge">{c.label}</th>)}</tr>
        </thead>
        <tbody>
          {s.rows.map((r, i) => (
            <tr key={i} className="hover:bg-panel2/60">
              {s.columns.map((c) => (
                <td key={c.key} className="px-3 py-2 border-b border-edge/40 text-slate-200">
                  {c.key === 'score' ? <RiskPill v={Number(r[c.key])} /> : String(r[c.key] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function RiskPill({ v }: { v: number }) {
  const color = v >= 70 ? 'bg-danger/20 text-danger' : v >= 40 ? 'bg-warn/20 text-warn' : 'bg-good/20 text-good';
  return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${color}`}>{v}</span>;
}

/* ----------------------------- CARD ----------------------------- */
function CardView({ s }: { s: CardAnswer }) {
  return (
    <div className="w-full h-full overflow-auto">
      <h3 className="text-lg font-semibold text-white mb-3">{s.title}</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {s.fields.map((f, i) => (
          <div key={i} className="rounded-lg border border-edge bg-panel2 px-3 py-2">
            <div className="text-[11px] uppercase tracking-wide text-slate-400">{f.label}</div>
            <div className="text-sm text-slate-100 whitespace-pre-wrap mt-0.5">{f.value || '—'}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
