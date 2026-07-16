'use client';
import { useEffect, useMemo, useRef } from 'react';
import cytoscape from 'cytoscape';
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, ZAxis,
} from 'recharts';
import type { AnswerSurface, MapAnswer, GraphAnswer, ChartAnswer, TableAnswer, CardAnswer } from '@/lib/types';
import { useWorkspace } from './workspace-store';
import 'maplibre-gl/dist/maplibre-gl.css';

/* Graph communities: EXACTLY 5, fixed order, never cycled — 6th+ folds to "Other".
   Validated all-pairs (any two communities can touch on a network): min CVD ΔE 9.5.
   Strictly DISJOINT from the severity ramp — the old palette literally reused the danger token
   for community #4, so "in community 4" and "risk >= 70" rendered in the same red.
   Every community also gets a SHAPE, so identity survives colourblindness entirely. */
const CAT = ['#ae436b', '#846204', '#00a3aa', '#5268b9', '#879f10'];
const CAT_SHAPE = ['ellipse', 'rectangle', 'triangle', 'diamond', 'hexagon'];
const OTHER = '#8a867a';
const catOf = (g: number) => (g >= 0 && g < CAT.length ? CAT[g] : OTHER);
const shapeOf = (g: number) => (g >= 0 && g < CAT_SHAPE.length ? CAT_SHAPE[g] : 'ellipse');

/** Sequential heat. Monotone L 0.269→0.838; the dark end melting into the ground is correct —
 *  zero crime is background, not a colour. */
const SEQ = ['#2b1f3d', '#4a2d63', '#7c3b7e', '#b04a72', '#d95f4a', '#ef8a2c', '#f7c05a'];

const fc = (pts: { lat: number; lng: number; label?: string; fir_id?: string }[]) => ({
  type: 'FeatureCollection' as const,
  features: pts.map((p) => ({
    type: 'Feature' as const,
    geometry: { type: 'Point' as const, coordinates: [p.lng, p.lat] },
    properties: { label: p.label || p.fir_id || '', fir_id: p.fir_id || '' },
  })),
});

export function AnswerSurfaceView({ surface }: { surface: AnswerSurface }) {
  switch (surface.kind) {
    case 'map': return <MapView s={surface} />;
    case 'graph': return <GraphView s={surface} />;
    case 'chart': return <ChartView s={surface} />;
    case 'table': return <TableView s={surface} />;
    case 'card': return <CardView s={surface} />;
    default: return <div className="text-fg-muted text-base p-4">No visual for this answer — see the evidence trail.</div>;
  }
}

/* ───────────────────── MAP — coordinated ───────────────────── */
function MapView({ s }: { s: MapAnswer }) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const { select, timeWindow, visibleRecords, selection, hovered } = useWorkspace();

  const visibleIds = useMemo(() => new Set(visibleRecords.map((r) => r.id)), [visibleRecords]);
  const activeId = hovered.kind === 'fir' ? hovered.id : selection.kind === 'fir' ? selection.id : null;

  const shownPoints = useMemo(() => {
    const pts = s.points.filter((p) => p.lat != null);
    if (!timeWindow) return pts;
    return pts.filter((p) => !p.fir_id || visibleIds.has(p.fir_id));
  }, [s.points, timeWindow, visibleIds]);

  useEffect(() => {
    const m = mapRef.current;
    if (!m?.isStyleLoaded?.()) return;
    m.getSource('incidents')?.setData(fc(shownPoints));
  }, [shownPoints]);

  useEffect(() => {
    const m = mapRef.current;
    if (!m?.isStyleLoaded?.()) return;
    m.getSource('selected')?.setData(fc(shownPoints.filter((p) => p.fir_id && p.fir_id === activeId)));
  }, [activeId, shownPoints]);

  useEffect(() => {
    let map: any; let cancelled = false;
    (async () => {
      const maplibregl = (await import('maplibre-gl')).default;
      if (!ref.current || cancelled) return;
      const pts = s.points.filter((p) => p.lat != null);
      const zones = s.riskZones || [];
      const all = [...pts, ...zones];
      const center: [number, number] = s.center ? [s.center.lng, s.center.lat] : all.length ? [all[0].lng, all[0].lat] : [76.6, 14.8];

      map = new maplibregl.Map({
        container: ref.current,
        style: {
          version: 8,
          sources: { carto: { type: 'raster', tiles: ['https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png', 'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png'], tileSize: 256, attribution: '© OpenStreetMap © CARTO' } },
          layers: [{ id: 'carto', type: 'raster', source: 'carto', paint: { 'raster-saturation': -0.45, 'raster-brightness-max': 0.82 } }],
        } as any,
        center, zoom: s.center?.zoom ?? 7, attributionControl: false,
      });
      mapRef.current = map;
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
      map.addControl(new maplibregl.AttributionControl({ compact: true }));

      map.on('load', () => {
        if ((s._grid || []).length) {
          map.addSource('heat', { type: 'geojson', data: { type: 'FeatureCollection', features: (s._grid || []).map((c) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [c.lng, c.lat] }, properties: { w: c.intensity } })) } });
          map.addLayer({
            id: 'heat', type: 'heatmap', source: 'heat',
            paint: {
              'heatmap-weight': ['get', 'w'], 'heatmap-intensity': 1.1, 'heatmap-radius': 28, 'heatmap-opacity': 0.62,
              'heatmap-color': ['interpolate', ['linear'], ['heatmap-density'],
                0, 'rgba(0,0,0,0)', 0.2, SEQ[1], 0.4, SEQ[2], 0.6, SEQ[3], 0.75, SEQ[4], 0.9, SEQ[5], 1, SEQ[6]],
            },
          });
        }
        map.addSource('incidents', { type: 'geojson', data: fc(pts) });
        map.addLayer({ id: 'incidents', type: 'circle', source: 'incidents', paint: { 'circle-radius': 3.5, 'circle-color': '#f7c05a', 'circle-opacity': 0.9, 'circle-stroke-width': 0.5, 'circle-stroke-color': '#0b0a07' } });

        // Selection ring — jade. The accent is never a data colour; it means "you selected this".
        map.addSource('selected', { type: 'geojson', data: fc([]) });
        map.addLayer({ id: 'selected', type: 'circle', source: 'selected', paint: { 'circle-radius': 9, 'circle-color': 'rgba(75,189,145,0.2)', 'circle-stroke-width': 2, 'circle-stroke-color': '#4bbd91' } });

        const popup = new maplibregl.Popup({ closeButton: false, closeOnMove: true });
        map.on('mouseenter', 'incidents', (e: any) => { map.getCanvas().style.cursor = 'pointer'; const f = e.features[0]; popup.setLngLat(f.geometry.coordinates).setHTML(`<span>${f.properties.label}</span>`).addTo(map); });
        map.on('mouseleave', 'incidents', () => { map.getCanvas().style.cursor = ''; popup.remove(); });
        map.on('click', 'incidents', (e: any) => { const id = e.features?.[0]?.properties?.fir_id; if (id) select('fir', id); });

        for (const z of zones) {
          const el = document.createElement('div'); el.className = 'netra-pulse';
          if (z.window) { const t = document.createElement('div'); t.className = 'netra-pulse-label'; t.textContent = z.window; el.appendChild(t); }
          new maplibregl.Marker({ element: el }).setLngLat([z.lng, z.lat]).addTo(map);
        }
        if (all.length > 1) {
          const b = new maplibregl.LngLatBounds();
          all.forEach((p) => b.extend([p.lng, p.lat]));
          map.fitBounds(b, { padding: 60, maxZoom: 13, duration: 0 });
        }
      });
    })();
    return () => { cancelled = true; mapRef.current = null; if (map) map.remove(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s]);

  return (
    <div className="relative w-full h-full">
      <div ref={ref} className="w-full h-full rounded-sm overflow-hidden bg-sunken" />
      <div className="absolute bottom-1.5 left-2 z-10 text-2xs text-fg-secondary bg-page/85 rounded-sm px-1.5 py-0.5 pointer-events-none border border-hairline">
        <span className="inline-block w-1.5 h-1.5 rounded-full mr-1" style={{ background: '#f7c05a' }} />incident
        <span className="inline-block w-1.5 h-1.5 rounded-full ml-2 mr-1" style={{ background: '#ef8a2c' }} />forecast zone
        <span className="ml-2 text-fg-muted">click a point to trace it</span>
      </div>
      {timeWindow && (
        <div className="absolute top-1.5 left-2 z-10 text-2xs text-accent bg-page/90 border border-accent rounded-sm px-1.5 py-0.5 pointer-events-none tabular-nums">
          filtered by timeline · {shownPoints.length} shown
        </div>
      )}
    </div>
  );
}

/* ───────────────────── GRAPH — coordinated ───────────────────── */
function GraphView({ s }: { s: GraphAnswer }) {
  const ref = useRef<HTMLDivElement>(null);
  const cyRef = useRef<any>(null);
  const { select, selection, hovered } = useWorkspace();
  const activeId = hovered.kind === 'person' ? hovered.id : selection.kind === 'person' ? selection.id : null;

  const groups = useMemo(() => {
    const seen = new Map<number, number>();
    for (const n of s.nodes) seen.set(n.group ?? 0, (seen.get(n.group ?? 0) || 0) + 1);
    return [...seen.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [s.nodes]);

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.batch(() => {
      cy.elements().removeClass('dim focus');
      if (!activeId) return;
      const node = cy.getElementById(activeId);
      if (!node || node.empty()) return;
      cy.elements().difference(node.closedNeighborhood()).addClass('dim');
      node.addClass('focus');
    });
  }, [activeId]);

  useEffect(() => {
    if (!ref.current) return;
    const maxC = Math.max(1, ...s.nodes.map((n) => n.centrality || 0));
    const cy = cytoscape({
      container: ref.current,
      elements: [
        ...s.nodes.map((n) => ({ data: {
          id: n.id, label: n.label, group: n.group ?? 0,
          size: 14 + 26 * ((n.centrality || 0) / maxC),
          col: catOf(n.group ?? 0), shp: shapeOf(n.group ?? 0),
          king: n.flags?.includes('kingpin') ? 1 : 0,
        } })),
        ...s.edges.map((e, i) => ({ data: { id: 'e' + i, source: e.source, target: e.target, predicted: e.predicted ? 1 : 0, flagged: e.flagged ? 1 : 0, w: e.predicted ? `~${e.score ?? ''}` : '' } })),
      ],
      style: [
        { selector: 'node', style: {
          'background-color': 'data(col)', shape: 'data(shp)', label: 'data(label)',
          color: '#bbb7ab', 'font-size': 9, width: 'data(size)', height: 'data(size)',
          'text-valign': 'bottom', 'text-margin-y': 3, 'border-width': 0,
        } },
        { selector: 'node[king = 1]', style: { 'border-width': 2, 'border-color': '#f7c05a' } },
        { selector: 'edge', style: { width: 1.2, 'line-color': '#4b483e', 'curve-style': 'bezier', label: 'data(w)', 'font-size': 8, color: '#d95f4a' } },
        { selector: 'edge[predicted = 1]', style: { 'line-color': '#d95f4a', 'line-style': 'dashed', width: 1.8 } },
        { selector: 'edge[flagged = 1]', style: { 'line-color': '#ef8a2c', width: 2 } },
        { selector: '.dim', style: { opacity: 0.14 } },
        // Jade is NEVER a node fill — it is the selection ring only.
        { selector: 'node.focus', style: { 'border-width': 3, 'border-color': '#4bbd91', color: '#eeebe2', 'font-size': 10 } },
        // cytoscape's NodeShape type rejects the data() mapper string, but it resolves fine at runtime.
      ] as any,
      // randomize:false — asking the same question twice used to yield a visibly different
      // network, which quietly undermines confidence that the analysis is deterministic.
      layout: { name: 'cose', animate: false, randomize: false, padding: 16, nodeRepulsion: 9000, idealEdgeLength: 66 } as any,
      minZoom: 0.3, maxZoom: 2.5, wheelSensitivity: 0.2,
    });
    cyRef.current = cy;
    cy.on('tap', 'node', (e: any) => select('person', e.target.id()));
    cy.on('tap', (e: any) => { if (e.target === cy) select('person', null); });
    cy.nodes().ungrabify();
    return () => { cyRef.current = null; cy.destroy(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s]);

  return (
    <div className="w-full h-full relative grid grid-cols-[1fr_auto] gap-1.5">
      <div ref={ref} className="w-full h-full rounded-sm bg-sunken min-w-0" />

      {/* Keyboard path + text alternative. The graph was 100% mouse-only, which made the entire
          gang/kingpin capability unreachable without a pointer (and invisible to AT). */}
      <div className="w-40 h-full overflow-auto border-l border-hairline pl-1.5 hidden md:block">
        <div className="eyebrow mb-1">Network</div>
        <ul className="space-y-0.5 mb-2">
          {s.nodes.map((n) => {
            const links = s.edges.filter((e) => e.source === n.id || e.target === n.id).length;
            const on = activeId === n.id;
            return (
              <li key={n.id}>
                <button onClick={() => select('person', n.id)}
                  aria-label={`${n.label} — ${links} links, centrality ${n.centrality ?? 0}`}
                  className={`w-full text-left text-2xs px-1 py-0.5 rounded-sm border truncate ${on ? 'bg-accent-wash border-accent text-fg' : 'border-transparent text-fg-secondary hover:bg-sunken'}`}>
                  <span className="inline-block w-1.5 h-1.5 mr-1 align-middle" style={{ background: catOf(n.group ?? 0) }} aria-hidden />
                  {n.label}
                  {n.flags?.includes('kingpin') && <span className="text-2xs" style={{ color: '#f7c05a' }}> ★</span>}
                  <span className="text-fg-muted tabular-nums"> {links}</span>
                </button>
              </li>
            );
          })}
        </ul>
        <div className="eyebrow mb-1">Legend</div>
        <ul className="space-y-0.5 text-2xs text-fg-muted">
          {groups.map(([g, count], i) => (
            <li key={g} className="flex items-center gap-1">
              <span className="inline-block w-1.5 h-1.5" style={{ background: catOf(i) }} aria-hidden />
              community {i + 1} <span className="tabular-nums">({count})</span>
            </li>
          ))}
          <li className="flex items-center gap-1 pt-0.5"><span className="inline-block w-3 border-t border-dashed" style={{ borderColor: '#d95f4a' }} aria-hidden /> predicted tie</li>
          <li className="flex items-center gap-1">★ kingpin · size = centrality</li>
        </ul>
      </div>
    </div>
  );
}

/* ───────────────────── CHART ───────────────────── */
function ChartView({ s }: { s: ChartAnswer }) {
  const data = s.series[0].points.map((p) => ({ x: p.x, y: p.y }));
  const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const tip = { background: '#28251e', border: '1px solid #4b483e', borderRadius: 2, fontSize: 11, color: '#eeebe2' };
  return (
    <div className="w-full h-full flex flex-col">
      <div className="text-xs text-fg-secondary mb-1.5">{s.series[0].name}</div>
      <ResponsiveContainer width="100%" height="100%">
        {s.chartType === 'bar' ? (
          <BarChart data={data} margin={{ top: 6, right: 12, bottom: 24, left: 0 }}>
            <CartesianGrid stroke="#333028" strokeDasharray="2 3" vertical={false} />
            <XAxis dataKey="x" tick={{ fill: '#8a867a', fontSize: 9 }} angle={-20} textAnchor="end" interval={0} height={50} />
            <YAxis tick={{ fill: '#8a867a', fontSize: 10 }} width={30} />
            <Tooltip contentStyle={tip} cursor={{ fill: 'rgba(75,189,145,0.08)' }} />
            <Bar dataKey="y" fill="#4bbd91" radius={[2, 2, 0, 0]} isAnimationActive={!reduced} />
          </BarChart>
        ) : s.chartType === 'scatter' ? (
          <ScatterChart margin={{ top: 6, right: 12, bottom: 24, left: 0 }}>
            <CartesianGrid stroke="#333028" strokeDasharray="2 3" />
            <XAxis type="number" dataKey="x" name={s.xLabel} tick={{ fill: '#8a867a', fontSize: 10 }} />
            <YAxis type="number" dataKey="y" name={s.yLabel} tick={{ fill: '#8a867a', fontSize: 10 }} width={30} />
            <ZAxis range={[50, 50]} />
            <Tooltip contentStyle={tip} cursor={{ strokeDasharray: '3 3' }} />
            <Scatter data={data} fill="#4bbd91" isAnimationActive={!reduced} />
          </ScatterChart>
        ) : (
          <LineChart data={data} margin={{ top: 6, right: 12, bottom: 24, left: 0 }}>
            <CartesianGrid stroke="#333028" strokeDasharray="2 3" vertical={false} />
            <XAxis dataKey="x" tick={{ fill: '#8a867a', fontSize: 9 }} angle={-20} textAnchor="end" interval={2} height={50} />
            <YAxis tick={{ fill: '#8a867a', fontSize: 10 }} width={30} />
            <Tooltip contentStyle={tip} />
            <Line type="monotone" dataKey="y" stroke="#4bbd91" strokeWidth={2} dot={false} isAnimationActive={!reduced} />
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

/* ───────────────────── TABLE — coordinated where the row names an entity ───────────────────── */
function TableView({ s }: { s: TableAnswer }) {
  const { select, isActive, hover } = useWorkspace();
  const isFir = (v: any) => typeof v === 'string' && /^FIR-/.test(v);
  return (
    <div className="w-full h-full overflow-auto">
      <table className="w-full text-base border-collapse">
        <thead className="sticky top-0 bg-panel">
          <tr>{s.columns.map((c) => <th key={c.key} className="text-left font-medium text-fg-muted px-2 py-1 border-b border-hairline whitespace-nowrap text-xs uppercase tracking-wider">{c.label}</th>)}</tr>
        </thead>
        <tbody>
          {s.rows.map((r, i) => {
            const firId = isFir(r.id) ? String(r.id) : null;
            const on = firId ? isActive('fir', firId) : false;
            return (
              <tr key={i}
                onClick={() => firId && select('fir', firId)}
                onPointerEnter={() => firId && hover('fir', firId)}
                onPointerLeave={() => firId && hover(null, null)}
                className={`${firId ? 'cursor-pointer' : ''} ${on ? 'bg-accent-wash' : 'hover:bg-sunken'}`}>
                {s.columns.map((c) => (
                  <td key={c.key} className={`px-2 py-1 border-b border-hairline ${c.key === 'id' ? 'font-mono text-fg-secondary' : 'text-fg'} ${typeof r[c.key] === 'number' ? 'tabular-nums' : ''}`}>
                    {c.key === 'score' ? <RiskPill v={Number(r[c.key])} /> : String(r[c.key] ?? '')}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Risk encoded THREE redundant ways — number, luminosity, and bar length — so it survives
 *  colourblindness and greyscale printing. Bands use evidence language (Recorded Future's
 *  convention), not a bare "Low", because "Low" invites a reader to dismiss it. */
function RiskPill({ v }: { v: number }) {
  const n = Number.isFinite(v) ? v : 0;
  const band =
    n >= 85 ? { label: 'Critical', c: '#ef8a2c' } :
    n >= 70 ? { label: 'Malicious', c: '#d95f4a' } :
    n >= 45 ? { label: 'Suspicious', c: '#b04a72' } :
    n >= 20 ? { label: 'Unusual', c: '#7c3b7e' } :
              { label: 'No current evidence', c: '#8a867a' };
  return (
    <span className="inline-flex items-center gap-1.5" title={`${n}/100 · ${band.label}`}>
      <span className="w-8 h-1 bg-hairline rounded-sm overflow-hidden shrink-0" aria-hidden>
        <span className="block h-full rounded-sm" style={{ width: `${Math.max(2, Math.min(100, n))}%`, background: band.c }} />
      </span>
      <span className="tabular-nums text-fg font-semibold">{n}</span>
      <span className="text-2xs" style={{ color: band.c }}>{band.label}</span>
    </span>
  );
}

/* ───────────────────── CARD ───────────────────── */
function CardView({ s }: { s: CardAnswer }) {
  return (
    <div className="w-full h-full overflow-auto">
      <h3 className="text-md font-semibold text-fg mb-2">{s.title}</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
        {s.fields.map((f, i) => (
          <div key={i} className="rounded-sm border border-hairline bg-sunken px-2 py-1.5">
            <div className="text-2xs uppercase tracking-wider text-fg-muted">{f.label}</div>
            <div className="text-base text-fg whitespace-pre-wrap mt-0.5 break-words">{f.value || '—'}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
