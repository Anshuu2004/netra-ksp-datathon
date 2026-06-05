'use client';
import type { Evidence } from '@/lib/types';

export function TrustPanel({ evidence }: { evidence: Evidence }) {
  const pct = Math.round((evidence.confidence || 0) * 100);
  const confColor = pct >= 80 ? 'text-good' : pct >= 55 ? 'text-warn' : 'text-danger';
  return (
    <div className="text-sm">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-slate-300">
          <ShieldIcon />
          <span className="font-medium">Evidence &amp; reasoning</span>
        </div>
        <span className={`text-xs font-semibold ${confColor}`}>confidence {pct}%</span>
      </div>

      <div className="text-[11px] uppercase tracking-wide text-slate-500 mb-1">What NETRA ran</div>
      <code className="block text-xs text-accent2 bg-[#0c1220] border border-edge rounded-md px-2 py-1.5 mb-3 break-words">{evidence.query}</code>

      <div className="text-[11px] uppercase tracking-wide text-slate-500 mb-1">Reasoning path</div>
      <ol className="space-y-1.5 mb-3">
        {evidence.reasoning_path.map((r, i) => (
          <li key={i} className="flex gap-2">
            <span className="mt-0.5 w-5 h-5 shrink-0 rounded-full bg-panel2 border border-edge text-[10px] grid place-items-center text-accent">{i + 1}</span>
            <div>
              <div className="text-slate-200">{r.step}</div>
              <div className="text-xs text-slate-400">{r.detail}</div>
            </div>
          </li>
        ))}
      </ol>

      {evidence.fir_ids.length > 0 && (
        <>
          <div className="text-[11px] uppercase tracking-wide text-slate-500 mb-1">Source records ({evidence.fir_ids.length})</div>
          <div className="flex flex-wrap gap-1.5">
            {evidence.fir_ids.slice(0, 24).map((id) => (
              <span key={id} className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-[#0c1220] border border-edge text-slate-300">{id}</span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function ShieldIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-accent">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}
