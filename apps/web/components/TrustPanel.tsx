'use client';
import type { Evidence } from '@/lib/types';

export function TrustPanel({ evidence }: { evidence: Evidence }) {
  const pct = Math.round((evidence.confidence || 0) * 100);
  const confColor = pct >= 80 ? 'text-good' : pct >= 55 ? 'text-warn' : 'text-danger';
  const confBar = pct >= 80 ? 'bg-good' : pct >= 55 ? 'bg-warn' : 'bg-danger';
  return (
    <div className="text-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-slate-200">
          <ShieldIcon />
          <span className="font-medium">Evidence &amp; reasoning</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-16 h-1.5 rounded-full bg-white/[0.06] overflow-hidden" aria-hidden>
            <div className={`h-full rounded-full ${confBar}`} style={{ width: `${pct}%` }} />
          </div>
          <span className={`text-xs font-semibold tabular-nums ${confColor}`}>{pct}%</span>
        </div>
      </div>

      <div className="eyebrow mb-1.5">What NETRA ran</div>
      <code className="block text-xs text-accent2 bg-[#0b1120] border border-white/[0.06] rounded-md px-2.5 py-2 mb-4 break-words leading-relaxed">{evidence.query}</code>

      <div className="eyebrow mb-2">Reasoning path</div>
      <ol className="relative space-y-2.5 mb-4 before:absolute before:left-[9px] before:top-1 before:bottom-1 before:w-px before:bg-white/[0.07]">
        {evidence.reasoning_path.map((r, i) => (
          <li key={i} className="relative flex gap-2.5">
            <span className="relative z-10 mt-0.5 w-[19px] h-[19px] shrink-0 rounded-full bg-panel border border-accent/40 text-[10px] font-semibold grid place-items-center text-accent tabular-nums">{i + 1}</span>
            <div className="min-w-0">
              <div className="text-slate-100 font-medium leading-snug">{r.step}</div>
              <div className="text-xs text-slate-400 leading-relaxed">{r.detail}</div>
            </div>
          </li>
        ))}
      </ol>

      {evidence.fir_ids.length > 0 && (
        <>
          <div className="eyebrow mb-1.5">Source records · <span className="tabular-nums text-slate-400">{evidence.fir_ids.length}</span></div>
          <div className="flex flex-wrap gap-1.5">
            {evidence.fir_ids.slice(0, 24).map((id) => (
              <span key={id} className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-[#0b1120] border border-white/[0.06] text-slate-300 hover:border-accent/40 hover:text-accent transition-colors">{id}</span>
            ))}
            {evidence.fir_ids.length > 24 && (
              <span className="text-[11px] font-mono px-1.5 py-0.5 text-slate-500">+{evidence.fir_ids.length - 24} more</span>
            )}
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
