'use client';
// Beat Briefing — the one artifact in this whole space that terminates in an ACTION for a named
// person at a named time, rather than a picture a human still has to interpret.
//
// Rebuilt on the workstation frame (same command bar / rail / status strip, same Khaki & Ember
// tokens, same SVG icon set). It previously used the retired chat-era design language — solid
// panel2 fills, emoji section headings — and read as a different application.
import { useEffect, useState } from 'react';

const DISTRICTS = ['Bengaluru Urban', 'Mysuru', 'Hubballi', 'Dakshina Kannada', 'Belagavi'];

export default function BriefingPage() {
  const [b, setB] = useState<any>(null);
  const [district, setDistrict] = useState('');
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setB(null); setErr(null);
      try {
        const res = await fetch(`/api/briefing${district ? `?district=${encodeURIComponent(district)}` : ''}`);
        if (!res.ok) throw new Error(`Server returned ${res.status}`);
        const data = await res.json();
        if (!cancelled) setB(data);
      } catch (e: any) {
        if (!cancelled) setErr(e?.message || 'Could not generate the briefing');
      }
    })();
    return () => { cancelled = true; };
  }, [district]);

  return (
    <div className="h-[100svh] flex flex-col overflow-hidden">
      <style>{`@media print { .no-print{display:none!important} body{background:#fff;color:#111} .print-plain{background:#fff!important;border-color:#ccc!important;color:#111!important} }`}</style>

      {/* command bar — same frame as the workstation */}
      <header className="shrink-0 flex items-center gap-2 px-2 h-9 border-b border-hairline bg-panel no-print">
        <a href="/" className="btn-ghost flex items-center gap-1.5 text-xs text-fg-secondary hover:text-accent shrink-0">
          <span aria-hidden>←</span> Workstation
        </a>
        <div className="w-px h-4 bg-hairline" aria-hidden />
        <span className="text-sm font-semibold text-fg">Beat Briefing</span>
        <div className="ml-auto flex items-center gap-1">
          <label className="sr-only" htmlFor="district">Jurisdiction</label>
          <select id="district" value={district} onChange={(e) => setDistrict(e.target.value)}
            className="bg-sunken border border-hairline rounded-sm text-xs px-1.5 h-6 text-fg">
            <option value="">All Karnataka</option>
            {DISTRICTS.map((d) => <option key={d}>{d}</option>)}
          </select>
          <button onClick={() => window.print()} className="btn-ghost px-2 h-6 rounded-sm bg-accent text-onfill text-xs font-semibold">
            Print / Save PDF
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-auto bg-page">
        <div className="max-w-3xl mx-auto p-3">
          {err ? (
            <div className="panel p-4 text-center">
              <div className="text-md font-semibold" style={{ color: '#d95f4a' }}>Briefing unavailable</div>
              <p className="text-base text-fg-secondary mt-1">{err}</p>
              <button onClick={() => setDistrict((d) => d)} className="btn-ghost mt-3 px-3 h-7 rounded-sm bg-accent text-onfill text-base font-semibold">Retry</button>
            </div>
          ) : !b ? (
            <div className="space-y-2" aria-hidden>
              <div className="skeleton h-16" /><div className="skeleton h-28" /><div className="skeleton h-28" />
            </div>
          ) : (
            <article className="panel p-4 print-plain">
              <header className="border-b border-hairline pb-2 mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-sm bg-fg grid place-items-center text-onfill font-bold text-xs print-plain" aria-hidden>ನೇ</div>
                  <div>
                    <h1 className="text-lg font-bold text-fg leading-tight">Daily Beat Briefing</h1>
                    <div className="text-2xs text-fg-secondary tabular-nums">
                      {b.district} · generated {new Date(b.generated_at).toLocaleString('en-IN')} · Karnataka State Police
                    </div>
                  </div>
                </div>
                <div className="mt-2 inline-block text-2xs px-1.5 py-0.5 rounded-sm border" style={{ color: '#ef8a2c', borderColor: '#ef8a2c' }}>
                  Prototype · labelled synthetic demo data
                </div>
              </header>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 mb-4">
                <Stat label="FIRs (7 days)" value={b.summary.last7_total} />
                <Stat label="Emerging hotspots" value={b.summary.emerging_hotspots} c="#b04a72" />
                <Stat label="Active series" value={b.summary.active_series} c="#ef8a2c" />
                <Stat label="Watch offenders" value={b.summary.watch_offenders} c="#d95f4a" />
              </div>

              <Section title="Active near-repeat series" note="deploy tonight">
                {b.active_series.length === 0 ? <Empty /> : b.active_series.map((s: any, i: number) => (
                  <div key={i} className="rounded-sm border border-hairline bg-sunken px-2 py-1.5 mb-1 print-plain">
                    <div className="text-base text-fg font-medium">{s.crime} near {s.station}, {s.district}</div>
                    <div className="text-xs text-fg-secondary tabular-nums mt-0.5">
                      {s.cluster.observed} incidents within 1.5&nbsp;km in 40 days (vs {s.cluster.expected} expected by chance, p={s.cluster.p}).
                      {s.forecast && <> Predicted next window: <span style={{ color: '#ef8a2c' }}>{s.forecast.eta.start.slice(0, 10)} → {s.forecast.eta.end.slice(0, 10)}</span>.</>}
                    </div>
                  </div>
                ))}
              </Section>

              <Section title="Emerging hotspots" note="last 14 days">
                {b.emerging.length === 0 ? <Empty /> : (
                  <Table head={['Crime', 'Station', 'District', 'Count', 'z']}>
                    {b.emerging.map((e: any, i: number) => (
                      <tr key={i} className="border-t border-hairline">
                        <td className="py-1 px-1.5 text-fg">{e.crime}</td>
                        <td className="px-1.5 text-fg-secondary">{e.station}</td>
                        <td className="px-1.5 text-fg-secondary">{e.district}</td>
                        <td className="px-1.5 text-fg tabular-nums">{e.count}</td>
                        <td className="px-1.5 tabular-nums" style={{ color: '#ef8a2c' }}>{e.z}</td>
                      </tr>
                    ))}
                  </Table>
                )}
              </Section>

              <Section title="Offenders to watch">
                {b.watch_offenders.length === 0 ? <Empty /> : (
                  <Table head={['Offender', 'Risk', 'MO fingerprint']}>
                    {b.watch_offenders.map((o: any, i: number) => (
                      <tr key={i} className="border-t border-hairline">
                        <td className="py-1 px-1.5 text-fg">{o.name}</td>
                        <td className="px-1.5"><Risk v={o.score} band={o.band} /></td>
                        <td className="px-1.5 text-fg-secondary">{(o.mo_fingerprint || []).slice(0, 3).join(' · ')}</td>
                      </tr>
                    ))}
                  </Table>
                )}
              </Section>

              <footer className="text-2xs text-fg-muted border-t border-hairline pt-2 mt-3 leading-relaxed">
                Generated by NETRA · Karnataka State Police Crime Intelligence Workstation · For official use.
                Every finding is computed from records with a full evidence trail. Record-level data in this
                prototype is labelled synthetic; district trends use real Karnataka 2023 figures.
              </footer>
            </article>
          )}
        </div>
      </div>

      <footer className="shrink-0 h-6 border-t border-hairline bg-panel flex items-center gap-3 px-2 text-xs text-fg-secondary no-print">
        <span className="flex items-center gap-1"><span className="live-dot" aria-hidden /> live</span>
        <span className="hidden sm:inline">Catalyst Cron dispatches this nightly at 06:00 IST</span>
        <span className="ml-auto" style={{ color: '#ef8a2c' }}>synthetic demo data</span>
      </footer>
    </div>
  );
}

function Stat({ label, value, c }: { label: string; value: number; c?: string }) {
  return (
    <div className="rounded-sm border border-hairline bg-sunken px-2 py-1.5 print-plain">
      <div className="text-lg font-bold tabular-nums" style={{ color: c || '#eeebe2' }}>{value}</div>
      <div className="text-2xs text-fg-secondary leading-tight">{label}</div>
    </div>
  );
}

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="mb-4">
      <div className="flex items-baseline gap-2 mb-1.5">
        <h2 className="eyebrow">{title}</h2>
        {note && <span className="text-2xs text-fg-muted">— {note}</span>}
        <span className="h-px flex-1 bg-hairline" aria-hidden />
      </div>
      {children}
    </section>
  );
}

function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-base border-collapse">
        <thead><tr>{head.map((h) => <th key={h} className="text-left text-2xs uppercase tracking-wider text-fg-muted font-medium px-1.5 pb-1">{h}</th>)}</tr></thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

/** Same redundant encoding as the workstation: number + luminosity + bar length. */
function Risk({ v, band }: { v: number; band?: string }) {
  const c = v >= 85 ? '#ef8a2c' : v >= 70 ? '#d95f4a' : v >= 45 ? '#b04a72' : v >= 20 ? '#7c3b7e' : '#8a867a';
  return (
    <span className="inline-flex items-center gap-1.5" title={`${v}/100${band ? ' · ' + band : ''}`}>
      <span className="w-8 h-1 bg-hairline rounded-sm overflow-hidden shrink-0" aria-hidden>
        <span className="block h-full" style={{ width: `${Math.max(2, Math.min(100, v))}%`, background: c }} />
      </span>
      <span className="tabular-nums text-fg font-semibold">{v}</span>
    </span>
  );
}

function Empty() { return <div className="text-xs text-fg-muted">Nothing flagged for this jurisdiction.</div>; }
