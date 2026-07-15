'use client';
import { useEffect, useState } from 'react';

type Briefing = any;

export default function BriefingPage() {
  const [b, setB] = useState<Briefing | null>(null);
  const [district, setDistrict] = useState('');

  async function load(d: string) {
    const res = await fetch(`/api/briefing${d ? `?district=${encodeURIComponent(d)}` : ''}`);
    setB(await res.json());
  }
  useEffect(() => { load(district); }, [district]);

  if (!b) return (
    <div className="min-h-screen grid place-items-center text-slate-400">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-edge border-t-accent rounded-full animate-spin" />
        <div className="text-sm">Generating briefing…</div>
      </div>
    </div>
  );
  const date = new Date(b.generated_at).toLocaleString('en-IN');

  return (
    <div className="max-w-4xl mx-auto p-6 print:p-0">
      <style>{`@media print { .no-print{display:none} body{background:#fff} }`}</style>

      <div className="flex items-center justify-between mb-4 no-print">
        <a href="/" className="text-accent text-sm">← Back to NETRA</a>
        <div className="flex items-center gap-2">
          <select value={district} onChange={(e) => setDistrict(e.target.value)} className="bg-panel2 border border-edge rounded-lg text-sm px-2 py-1.5 text-slate-200">
            <option value="">All Karnataka</option>
            {['Bengaluru Urban', 'Mysuru', 'Hubballi', 'Dakshina Kannada', 'Belagavi'].map((d) => <option key={d}>{d}</option>)}
          </select>
          <button onClick={() => window.print()} className="px-3 py-1.5 rounded-lg bg-accent text-ink text-sm font-medium">Print / Save PDF</button>
        </div>
      </div>

      <div className="glass rounded-xl p-6 print:border-0 print:shadow-none">
        <div className="flex items-center gap-3 border-b border-edge pb-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-accent to-accent2 grid place-items-center text-ink font-bold">ನೇ</div>
          <div>
            <div className="text-xl font-bold text-white">NETRA — Daily Beat Briefing</div>
            <div className="text-xs text-slate-400">{b.district} · generated {date} · auto-generated intelligence (synthetic demo data)</div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          <Stat label="FIRs (7 days)" value={b.summary.last7_total} />
          <Stat label="Emerging hotspots" value={b.summary.emerging_hotspots} tone="warn" />
          <Stat label="Active series" value={b.summary.active_series} tone="danger" />
          <Stat label="Watch offenders" value={b.summary.watch_offenders} />
        </div>

        <Section title="🚨 Active near-repeat series — deploy tonight">
          {b.active_series.length === 0 ? <Empty /> : b.active_series.map((s: any, i: number) => (
            <div key={i} className="rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 mb-2">
              <div className="text-sm text-white font-medium">{s.crime} near {s.station}, {s.district}</div>
              <div className="text-xs text-slate-300">
                {s.cluster.observed} incidents in 1.5km in 40 days (vs {s.cluster.expected} expected, p={s.cluster.p}).
                {s.forecast && <> Predicted next window: <span className="text-warn">{s.forecast.eta.start.slice(0, 10)} → {s.forecast.eta.end.slice(0, 10)}</span>.</>}
              </div>
            </div>
          ))}
        </Section>

        <Section title="📈 Emerging hotspots (last 14 days)">
          {b.emerging.length === 0 ? <Empty /> : (
            <table className="w-full text-sm">
              <thead><tr className="text-slate-400 text-left"><th className="py-1">Crime</th><th>Station</th><th>District</th><th>Count</th><th>z-score</th></tr></thead>
              <tbody>
                {b.emerging.map((e: any, i: number) => (
                  <tr key={i} className="border-t border-edge/40"><td className="py-1 text-slate-200">{e.crime}</td><td>{e.station}</td><td>{e.district}</td><td>{e.count}</td><td className="text-warn">{e.z}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>

        <Section title="👤 Offenders to watch">
          {b.watch_offenders.length === 0 ? <Empty /> : (
            <table className="w-full text-sm">
              <thead><tr className="text-slate-400 text-left"><th className="py-1">Offender</th><th>Risk</th><th>Band</th><th>MO</th></tr></thead>
              <tbody>
                {b.watch_offenders.map((o: any, i: number) => (
                  <tr key={i} className="border-t border-edge/40"><td className="py-1 text-slate-200">{o.name}</td><td>{o.score}</td><td>{o.band}</td><td className="text-slate-400">{o.mo_fingerprint.slice(0, 3).join(', ')}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>

        <div className="text-[11px] text-slate-500 border-t border-edge pt-3 mt-4">
          Generated by NETRA · Karnataka State Police Crime Intelligence Platform · For official use. All findings are
          computed from records with full evidence trails. (Prototype runs on labelled synthetic data.)
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: string }) {
  const c = tone === 'danger' ? 'text-danger' : tone === 'warn' ? 'text-warn' : 'text-accent';
  return (
    <div className="rounded-lg border border-edge bg-panel2 px-3 py-2 text-center">
      <div className={`text-2xl font-bold ${c}`}>{value}</div>
      <div className="text-[11px] text-slate-400">{label}</div>
    </div>
  );
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="mb-5"><div className="text-sm font-semibold text-white mb-2">{title}</div>{children}</div>;
}
function Empty() { return <div className="text-xs text-slate-500 italic">No items flagged.</div>; }
