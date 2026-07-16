'use client';
// Answers "what exactly am I looking at?" for whatever is selected anywhere in the workstation,
// and holds the evidence trail. Evidence chips are navigation, not decoration: clicking one
// selects that FIR across the map, network and timeline.
import type { AnswerEnvelope, GraphAnswer } from '@/lib/types';
import { useWorkspace } from './workspace-store';

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
const inr = (n: number) => '₹' + Number(n || 0).toLocaleString('en-IN');

export function Inspector({ env }: { env?: AnswerEnvelope }) {
  const { selection, select, records, isActive, hover } = useWorkspace();

  const fir = selection.kind === 'fir' ? records.find((r) => r.id === selection.id) : undefined;
  const node = selection.kind === 'person' && env?.surface?.kind === 'graph'
    ? (env.surface as GraphAnswer).nodes.find((n) => n.id === selection.id) : undefined;
  const edges = node && env?.surface?.kind === 'graph'
    ? (env.surface as GraphAnswer).edges.filter((e) => e.source === node.id || e.target === node.id) : [];

  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="shrink-0 border-b border-hairline pb-2 mb-2">
        <div className="eyebrow mb-1.5">Inspector</div>

        {!fir && !node && (
          <p className="text-xs text-fg-muted leading-relaxed">
            Nothing selected. Click a point on the map, a node in the network, a tick on the
            timeline, or an evidence record below — it highlights everywhere at once.
          </p>
        )}

        {fir && (
          <div>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-mono text-xs text-fg-secondary break-all">{fir.id}</div>
                <div className="text-md text-fg font-semibold leading-tight mt-0.5">{fir.crime_type}</div>
              </div>
              <button onClick={() => select('fir', null)} aria-label="Clear selection"
                className="btn-ghost text-fg-muted hover:text-fg text-md leading-none shrink-0">×</button>
            </div>
            <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 text-xs mt-2">
              <dt className="text-fg-secondary">District</dt><dd className="text-fg">{fir.district} <span className="text-fg-muted font-mono">{fir.ps_code}</span></dd>
              <dt className="text-fg-secondary">Occurred</dt><dd className="text-fg tabular-nums">{fmtDate(fir.occurred_at)}</dd>
              <dt className="text-fg-secondary">Status</dt><dd><StatusPill s={fir.status} /></dd>
              {fir.value_loss > 0 && (<><dt className="text-fg-secondary">Loss</dt><dd className="text-fg tabular-nums">{inr(fir.value_loss)}</dd></>)}
              {fir.mo_tags?.length > 0 && (<><dt className="text-fg-secondary">MO</dt><dd className="text-fg break-words">{fir.mo_tags.join(' · ')}</dd></>)}
            </dl>
          </div>
        )}

        {node && (
          <div>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-md text-fg font-semibold leading-tight break-words">{node.label}</div>
                <div className="font-mono text-2xs text-fg-muted mt-0.5">{node.id}</div>
              </div>
              <button onClick={() => select('person', null)} aria-label="Clear selection"
                className="btn-ghost text-fg-muted hover:text-fg text-md leading-none shrink-0">×</button>
            </div>
            <div className="flex flex-wrap gap-1 mt-1.5">
              {node.flags?.includes('kingpin') && <Flag c="#f7c05a">most central · likely kingpin</Flag>}
              {node.flags?.includes('focus') && <Flag c="#4bbd91">focus of enquiry</Flag>}
              {node.flags?.includes('suspect') && <Flag c="#ef8a2c">suspect account</Flag>}
            </div>
            <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 text-xs mt-2">
              <dt className="text-fg-secondary">Links</dt><dd className="text-fg tabular-nums">{edges.length}</dd>
              {typeof node.centrality === 'number' && (<><dt className="text-fg-secondary">Centrality</dt><dd className="text-fg tabular-nums">{node.centrality}</dd></>)}
              {typeof node.group === 'number' && (<><dt className="text-fg-secondary">Community</dt><dd className="text-fg tabular-nums">#{node.group}</dd></>)}
            </dl>
            {edges.some((e) => e.predicted) && (
              <p className="text-2xs mt-2 leading-relaxed border-l-0 pl-0" style={{ color: '#d95f4a' }}>
                NETRA suspects a hidden tie here (dashed edge). Unproven — a lead, not a fact.
              </p>
            )}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-auto min-h-0">
        {!env ? (
          <p className="text-xs text-fg-muted">Evidence appears once you ask something.</p>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <div className="eyebrow">Evidence &amp; reasoning</div>
              <Confidence pct={Math.round((env.evidence?.confidence || 0) * 100)} />
            </div>

            <code className="block text-2xs text-fg-secondary bg-sunken border border-hairline rounded-sm px-1.5 py-1 break-words leading-relaxed mb-2 font-mono">
              {env.evidence.query}
            </code>

            <ol className="relative space-y-1.5 mb-2 before:absolute before:left-[7px] before:top-1 before:bottom-1 before:w-px before:bg-hairline">
              {env.evidence.reasoning_path.map((r, i) => (
                <li key={i} className="relative flex gap-1.5">
                  <span className="relative z-10 mt-0.5 w-[15px] h-[15px] shrink-0 rounded-full bg-panel border border-accent text-2xs font-semibold grid place-items-center text-accent tabular-nums">{i + 1}</span>
                  <div className="min-w-0">
                    <div className="text-xs text-fg font-medium leading-snug">{r.step}</div>
                    <div className="text-2xs text-fg-secondary leading-relaxed break-words">{r.detail}</div>
                  </div>
                </li>
              ))}
            </ol>

            {records.length > 0 && (
              <div>
                <div className="eyebrow mb-1">Source records · <span className="tabular-nums text-fg-muted">{records.length}</span></div>
                <div className="flex flex-wrap gap-0.5">
                  {records.slice(0, 60).map((r) => (
                    <button key={r.id} onClick={() => select('fir', r.id)}
                      onPointerEnter={() => hover('fir', r.id)} onPointerLeave={() => hover(null, null)}
                      title={`${r.crime_type} · ${r.district} · ${fmtDate(r.occurred_at)}`}
                      className={`text-2xs font-mono px-1 py-0.5 rounded-sm border transition-colors ${
                        isActive('fir', r.id) ? 'bg-accent text-onfill border-accent' : 'bg-sunken border-hairline text-fg-secondary hover:border-accent hover:text-accent'
                      }`}>
                      {r.id.replace('FIR-', '')}
                    </button>
                  ))}
                  {records.length > 60 && <span className="text-2xs text-fg-muted px-1 py-0.5 tabular-nums">+{records.length - 60}</span>}
                </div>
                <p className="text-2xs text-fg-muted mt-1">Click a record to trace it across every view.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Confidence({ pct }: { pct: number }) {
  // Confidence is not severity — it stays achromatic + jade so it can never be misread as risk.
  return (
    <div className="flex items-center gap-1" title={`Confidence ${pct}%`}>
      <div className="w-8 h-1 rounded-sm bg-hairline overflow-hidden" aria-hidden>
        <div className="h-full bg-accent" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-2xs font-semibold tabular-nums text-fg-secondary">{pct}%</span>
    </div>
  );
}

function StatusPill({ s }: { s: string }) {
  const map: Record<string, string> = {
    chargesheeted: 'text-accent border-accent',
    under_investigation: 'text-fg border-stroke',
    registered: 'text-fg-secondary border-hairline',
    closed: 'text-fg-muted border-hairline',
  };
  return <span className={`inline-block text-2xs px-1 py-0.5 rounded-sm border ${map[s] || map.registered}`}>{s.replace(/_/g, ' ')}</span>;
}

function Flag({ c, children }: { c: string; children: React.ReactNode }) {
  return <span className="text-2xs uppercase tracking-wider px-1 py-0.5 rounded-sm border" style={{ color: c, borderColor: c }}>{children}</span>;
}
