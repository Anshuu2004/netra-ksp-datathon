'use client';
import { useEffect, useRef } from 'react';
import cytoscape from 'cytoscape';
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, ZAxis,
} from 'recharts';
import type { AnswerSurface, MapAnswer, GraphAnswer, ChartAnswer, TableAnswer, CardAnswer } from '@/lib/types';
import 'maplibre-gl/dist/maplibre-gl.css';

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

/* ----------------------------- MAP (MapLibre slippy map) ----------------------------- */
function MapView({ s }: { s: MapAnswer }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let map: any; let cancelled = false;
    (async () => {
      const maplibregl = (await import('maplibre-gl')).default;
      if (!ref.current || cancelled) return;
      const pts = s.points.filter((p) => p.lat != null);
      const zones = s.riskZones || [];
      const all: { lat: number; lng: number }[] = [...pts, ...zones];
      const center: [number, number] = s.center ? [s.center.lng, s.center.lat]
        : all.length ? [all[0].lng, all[0].lat] : [76.6, 14.8];

      map = new maplibregl.Map({
        container: ref.current,
        style: {
          version: 8,
          sources: {
            carto: {
              type: 'raster',
              tiles: ['https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png', 'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png'],
              tileSize: 256, attribution: '© OpenStreetMap © CARTO',
            },
          },
          layers: [{ id: 'carto', type: 'raster', source: 'carto' }],
        } as any,
        center, zoom: s.center?.zoom ?? 7, attributionControl: false,
      });
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
      map.addControl(new maplibregl.AttributionControl({ compact: true }));

      map.on('load', () => {
        if ((s._grid || []).length) {
          map.addSource('heat', { type: 'geojson', data: { type: 'FeatureCollection', features: (s._grid || []).map((c) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [c.lng, c.lat] }, properties: { w: c.intensity } })) } });
          map.addLayer({ id: 'heat', type: 'heatmap', source: 'heat', paint: { 'heatmap-weight': ['get', 'w'], 'heatmap-intensity': 1.1, 'heatmap-radius': 30, 'heatmap-opacity': 0.5, 'heatmap-color': ['interpolate', ['linear'], ['heatmap-density'], 0, 'rgba(0,0,0,0)', 0.3, '#22d3ee', 0.6, '#f59e0b', 1, '#f43f5e'] } });
        }
        map.addSource('incidents', { type: 'geojson', data: { type: 'FeatureCollection', features: pts.map((p) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [p.lng, p.lat] }, properties: { label: p.label || p.fir_id || '' } })) } });
        map.addLayer({ id: 'incidents', type: 'circle', source: 'incidents', paint: { 'circle-radius': 4, 'circle-color': '#38bdf8', 'circle-opacity': 0.85, 'circle-stroke-width': 0.5, 'circle-stroke-color': '#0b1220' } });

        const popup = new maplibregl.Popup({ closeButton: false, closeOnMove: true, className: 'netra-popup' });
        map.on('mouseenter', 'incidents', (e: any) => { map.getCanvas().style.cursor = 'pointer'; const f = e.features[0]; popup.setLngLat(f.geometry.coordinates).setHTML(`<span style="font-size:11px">${f.properties.label}</span>`).addTo(map); });
        map.on('mouseleave', 'incidents', () => { map.getCanvas().style.cursor = ''; popup.remove(); });

        for (const z of zones) {
          const el = document.createElement('div'); el.className = 'netra-pulse';
          if (z.window) { const t = document.createElement('div'); t.className = 'netra-pulse-label'; t.textContent = z.window; el.appendChild(t); }
          new maplibregl.Marker({ element: el }).setLngLat([z.lng, z.lat]).addTo(map);
        }
        if (all.length > 1) {
          const b = new maplibregl.LngLatBounds();
          all.forEach((p) => b.extend([p.lng, p.lat]));
          map.fitBounds(b, { padding: 70, maxZoom: 13, duration: 0 });
        }
      });
    })();
    return () => { cancelled = true; if (map) map.remove(); };
  }, [s]);

  return (
    <div className="relative w-full h-full">
      <div ref={ref} className="w-full h-full rounded-lg overflow-hidden bg-[#0c1220]" />
      <div className="absolute bottom-2 left-3 z-10 text-[11px] text-slate-300 bg-ink/70 rounded px-2 py-1 pointer-events-none">
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
