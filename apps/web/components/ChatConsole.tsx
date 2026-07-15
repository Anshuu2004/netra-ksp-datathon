'use client';
import { useEffect, useRef, useState } from 'react';
import type { AnswerEnvelope, Role } from '@/lib/types';
import { AnswerSurfaceView } from './surfaces';
import { TrustPanel } from './TrustPanel';

type Msg = { role: 'user' | 'assistant'; text: string; env?: AnswerEnvelope; error?: boolean };

// Access level drives the visible RBAC indicator (investigators/supervisors see PII;
// constables/policymakers get redacted views — enforced server-side in the router).
const ROLES: { id: Role; label: string; access: 'full' | 'redacted' }[] = [
  { id: 'constable', label: 'Constable', access: 'redacted' },
  { id: 'investigator', label: 'Investigator', access: 'full' },
  { id: 'supervisor', label: 'Supervisor', access: 'full' },
  { id: 'policymaker', label: 'Policymaker', access: 'redacted' },
];

const SUGGESTIONS = [
  { icon: <MapPinIcon />, text: 'Show chain-snatching hotspots in Bengaluru in the last 6 months' },
  { icon: <GraphIcon />, text: 'Find the organized gang operating in Bengaluru' },
  { icon: <ForecastIcon />, text: 'Where will the next burglary strike in Mysuru?' },
  { icon: <RiskIcon />, text: 'Top repeat offenders in Mysuru' },
  { icon: <MoneyIcon />, text: 'Trace the money trail for the laundering ring' },
  { icon: <ChartIcon />, text: 'Correlate crime with urbanisation' },
];

export default function ChatConsole() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [role, setRole] = useState<Role>('investigator');
  const [lang, setLang] = useState<'en' | 'kn'>('en');
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [audit, setAudit] = useState<any[] | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const recogRef = useRef<any>(null);

  const active = [...messages].reverse().find((m) => m.env)?.env;

  useEffect(() => { scrollRef.current?.scrollTo({ top: 9e9, behavior: 'smooth' }); }, [messages, busy]);

  async function send(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    setInput('');
    setMessages((m) => [...m, { role: 'user', text: q }]);
    setBusy(true);
    try {
      const history = messages.slice(-6).map((m) => ({ role: m.role, text: m.text }));
      const res = await fetch('/api/ask', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: q, role, lang, history }),
      });
      const env: AnswerEnvelope = await res.json();
      const text = lang === 'kn' && env.narration_kn ? env.narration_kn : env.narration_en;
      setMessages((m) => [...m, { role: 'assistant', text, env }]);
      speak(env);
    } catch {
      setMessages((m) => [...m, { role: 'assistant', text: 'Connection hiccup — try that question again.', error: true }]);
    } finally {
      setBusy(false);
    }
  }

  function downloadDossier() {
    const esc = (s: string) => (s || '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] as string));
    if (messages.length === 0) { alert('Ask a few questions first — the dossier captures this conversation.'); return; }
    const rows = messages.map((m) => {
      if (m.role === 'user') return `<div class="u"><b>Q:</b> ${esc(m.text)}</div>`;
      const ev = m.env?.evidence;
      return `<div class="a"><b>NETRA:</b> ${esc(m.text)}${ev ? `<div class="ev"><b>Evidence:</b> ${esc(ev.fir_ids.slice(0, 14).join(', ') || '—')}<br/><b>Method:</b> ${esc(ev.query)} · confidence ${Math.round((ev.confidence || 0) * 100)}%</div>` : ''}</div>`;
    }).join('');
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>NETRA Dossier</title>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=Noto+Sans+Kannada&display=swap" rel="stylesheet">
      <style>body{font-family:Inter,system-ui,'Noto Sans Kannada',sans-serif;max-width:760px;margin:24px auto;color:#111;padding:0 16px}
      h1{font-size:20px;margin:0}.sub{color:#666;font-size:12px}
      .u{background:#eef6ff;padding:8px 12px;border-radius:8px;margin:8px 0}
      .a{background:#f6f7f9;padding:8px 12px;border-radius:8px;margin:8px 0}
      .ev{color:#555;font-size:11px;margin-top:6px;border-top:1px solid #ddd;padding-top:4px}
      .hd{display:flex;gap:10px;align-items:center;border-bottom:2px solid #111;padding-bottom:8px;margin-bottom:12px}
      .badge{background:#fff7ed;color:#9a3412;border:1px solid #fdba74;border-radius:4px;padding:2px 6px;font-size:10px}
      .foot{color:#888;font-size:10px;border-top:1px solid #ddd;margin-top:16px;padding-top:8px}</style></head>
      <body><div class="hd"><div><h1>NETRA — Investigation Dossier</h1>
      <div class="sub">Karnataka State Police · Crime Intelligence Copilot · ${new Date().toLocaleString('en-IN')}</div></div></div>
      <span class="badge">Prototype · labelled synthetic demo data</span>${rows}
      <div class="foot">Every answer above was computed from records with a full evidence trail. Generated by NETRA.</div>
      <script>window.onload=function(){setTimeout(function(){window.print()},400)}</script></body></html>`;
    const w = window.open('', '_blank');
    if (!w) { alert('Allow pop-ups to download the dossier.'); return; }
    w.document.write(html); w.document.close();
  }

  async function openAudit() {
    try {
      const res = await fetch('/api/audit');
      const data = await res.json();
      setAudit(data.entries || []);
    } catch { setAudit([]); }
  }

  function speak(env: AnswerEnvelope) {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    const text = lang === 'kn' && env.narration_kn ? env.narration_kn : env.narration_en;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang === 'kn' ? 'kn-IN' : 'en-IN';
    const voices = window.speechSynthesis.getVoices();
    const match = voices.find((v) => v.lang === u.lang) || voices.find((v) => v.lang.startsWith(lang === 'kn' ? 'kn' : 'en'));
    if (match) u.voice = match;
    u.rate = 0.98;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  }

  function toggleVoice() {
    const SR = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (!SR) { alert('Voice input needs Chrome/Edge. Production uses Catalyst Zia (English) + Bhashini (Kannada).'); return; }
    if (listening) { recogRef.current?.stop(); return; }
    const r = new SR();
    r.lang = lang === 'kn' ? 'kn-IN' : 'en-IN';
    r.interimResults = false; r.maxAlternatives = 1;
    r.onresult = (e: any) => { const t = e.results[0][0].transcript; setInput(t); send(t); };
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    recogRef.current = r; setListening(true); r.start();
  }

  return (
    <div className="h-screen flex flex-col">
      <Header role={role} setRole={setRole} lang={lang} setLang={setLang} onDossier={downloadDossier} onAudit={openAudit} hasMsgs={messages.length > 0} />
      {audit !== null && <AuditModal entries={audit} onClose={() => setAudit(null)} />}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[minmax(360px,38%)_1fr] gap-3 p-3 overflow-y-auto lg:overflow-hidden">
        {/* LEFT: conversation */}
        <div className="glass rounded-xl flex flex-col overflow-hidden min-h-[50vh] lg:min-h-0">
          <div ref={scrollRef} role="log" aria-live="polite" className="flex-1 overflow-auto p-4 space-y-3 min-h-0">
            {messages.length === 0 && <EmptyState onPick={send} lang={lang} />}
            {messages.map((m, i) => <Bubble key={i} m={m} lang={lang} />)}
            {busy && <Thinking />}
            {active && active.followups?.length > 0 && !busy && (
              <div className="flex flex-wrap gap-2 pt-1">
                {active.followups.filter(Boolean).map((f, i) => <button key={i} className="chip" onClick={() => send(f)}>{f}</button>)}
              </div>
            )}
          </div>
          <Composer input={input} setInput={setInput} onSend={() => send(input)} listening={listening} toggleVoice={toggleVoice} busy={busy} lang={lang} />
        </div>

        {/* RIGHT: answer surface + evidence */}
        <div className="grid grid-rows-[1fr_auto] gap-3 overflow-hidden min-h-0">
          <div className="glass rounded-xl overflow-hidden flex flex-col min-h-[340px] lg:min-h-0">
            <div className="px-3 pt-3">
              <SurfaceHeader env={active} onSpeak={() => active && speak(active)} />
            </div>
            <div className={`progress-rail mt-2 ${busy ? '' : 'opacity-0'}`} aria-hidden />
            <div className="flex-1 overflow-hidden p-3 pt-2 min-h-0">
              {busy && !active ? <SurfaceSkeleton /> : active
                ? <div key={messages.length} className="h-full msg-in"><AnswerSurfaceView surface={active.surface} /></div>
                : <Placeholder />}
            </div>
          </div>
          <div className="glass rounded-xl p-3 max-h-[34vh] overflow-auto">
            {active ? <TrustPanel evidence={active.evidence} /> : <TrustEmpty />}
          </div>
        </div>
      </div>
    </div>
  );
}

function AuditModal({ entries, onClose }: { entries: any[]; onClose: () => void }) {
  return (
    <div role="dialog" aria-modal="true" aria-label="Audit log" className="fixed inset-0 z-[50] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 msg-in" onClick={onClose}>
      <div className="glass rounded-xl w-full max-w-3xl max-h-[80vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-edge">
          <div className="flex items-center gap-2.5">
            <span className="text-good"><ShieldIcon /></span>
            <div>
              <div className="font-semibold text-white leading-tight">Audit log · governance &amp; traceability</div>
              <div className="text-[11px] text-slate-400">{entries.length} entries · every query logged (role · intent · entities · PII). Persisted to Catalyst Data Store in production.</div>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-slate-400 hover:text-white text-2xl leading-none btn-ghost">×</button>
        </div>
        <div className="overflow-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-panel2 text-slate-400">
              <tr><th className="text-left px-3 py-2 font-medium">Time</th><th className="text-left font-medium">Role</th><th className="text-left font-medium">Intent</th><th className="text-left font-medium">Entities</th><th className="text-left font-medium">PII</th></tr>
            </thead>
            <tbody>
              {entries.length === 0 && <tr><td colSpan={5} className="px-3 py-4 text-slate-400">No queries yet — ask something first.</td></tr>}
              {entries.map((e) => (
                <tr key={e.id} className="border-t border-edge/40 hover:bg-panel2/50">
                  <td className="px-3 py-1.5 text-slate-400 whitespace-nowrap tabular-nums">{new Date(e.ts).toLocaleTimeString()}</td>
                  <td className="text-slate-200 capitalize">{e.role}</td>
                  <td className="text-accent2">{e.intent}</td>
                  <td className="text-slate-400 font-mono">{(e.entity_refs || []).slice(0, 3).join(', ') || '—'}</td>
                  <td>{e.pii_revealed
                    ? <span className="inline-flex items-center gap-1 text-warn"><Dot c="warn" />revealed</span>
                    : <span className="inline-flex items-center gap-1 text-good"><Dot c="good" />redacted</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Header({ role, setRole, lang, setLang, onDossier, onAudit, hasMsgs }: any) {
  const current = ROLES.find((r) => r.id === role)!;
  return (
    <header className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-edge">
      <div className="flex items-center gap-3">
        <div className="relative w-9 h-9 rounded-lg bg-gradient-to-br from-accent to-accent2 grid place-items-center text-ink font-bold shadow-[0_0_20px_-4px_rgba(56,189,248,0.6)]">ನೇ</div>
        <div className="leading-tight">
          <div className="font-semibold tracking-wide text-white">NETRA <span className="text-slate-400 font-normal text-sm">· Crime Intelligence Copilot</span></div>
          <div className="text-[11px] text-slate-400">Karnataka State Police · Ask. See. Act.</div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="hidden lg:inline text-[10px] uppercase tracking-wide text-amber-300/90 border border-amber-500/30 bg-amber-500/10 rounded px-2 py-1">Synthetic demo data</span>
        <a href="/briefing" className="btn-ghost hidden sm:inline-flex items-center gap-1.5 text-sm px-2.5 py-1.5 rounded-lg border border-edge text-slate-300 hover:text-accent hover:border-accent"><BellIcon /><span className="hidden md:inline">Briefing</span></a>
        <button onClick={onAudit} className="btn-ghost inline-flex items-center gap-1.5 text-sm px-2.5 py-1.5 rounded-lg border border-edge text-slate-300 hover:text-accent hover:border-accent"><ShieldIcon /><span className="hidden md:inline">Audit</span></button>
        <button onClick={onDossier} disabled={!hasMsgs} className="btn-ghost inline-flex items-center gap-1.5 text-sm px-2.5 py-1.5 rounded-lg border border-edge text-slate-300 hover:text-accent hover:border-accent disabled:opacity-40 disabled:hover:text-slate-300 disabled:hover:border-edge"><DownloadIcon /><span className="hidden md:inline">Dossier</span></button>
        <div className="flex rounded-lg border border-edge overflow-hidden text-sm">
          <button onClick={() => setLang('en')} className={`btn-ghost px-2.5 py-1 ${lang === 'en' ? 'bg-accent text-ink' : 'text-slate-300 hover:text-accent'}`}>EN</button>
          <button onClick={() => setLang('kn')} className={`btn-ghost px-2.5 py-1 font-kn ${lang === 'kn' ? 'bg-accent text-ink' : 'text-slate-300 hover:text-accent'}`}>ಕನ್ನಡ</button>
        </div>
        <label className="relative flex items-center gap-2 bg-panel2 border border-edge rounded-lg pl-2.5 pr-1 py-1" title={current.access === 'full' ? 'Full access to PII' : 'PII redacted for this role'}>
          <Dot c={current.access === 'full' ? 'good' : 'warn'} />
          <select value={role} onChange={(e) => setRole(e.target.value)} aria-label="Access role" className="bg-transparent text-sm text-slate-200 outline-none appearance-none pr-4 cursor-pointer">
            {ROLES.map((r) => <option key={r.id} value={r.id} className="bg-panel2">{r.label}</option>)}
          </select>
          <ChevronIcon />
        </label>
      </div>
    </header>
  );
}

function EmptyState({ onPick, lang }: { onPick: (s: string) => void; lang: 'en' | 'kn' }) {
  return (
    <div className="py-6 msg-in">
      <div className="text-2xl font-semibold text-white text-balance">{lang === 'kn' ? 'ಅಪರಾಧ ದತ್ತಸಂಚಯವನ್ನು ಏನಾದರೂ ಕೇಳಿ.' : 'Ask the crime database anything.'}</div>
      <p className="text-slate-400 text-sm mt-1.5 max-w-[46ch]">English or ಕನ್ನಡ · by text or voice. Every answer renders as a map, graph or chart — with a full evidence trail.</p>
      <div className="text-[11px] uppercase tracking-wide text-slate-500 mt-5 mb-2">Try a query</div>
      <div className="grid gap-2">
        {SUGGESTIONS.map((s) => (
          <button key={s.text} onClick={() => onPick(s.text)}
            className="group flex items-center gap-3 text-left rounded-lg border border-edge bg-panel2/60 hover:bg-panel2 hover:border-accent transition px-3 py-2.5 text-sm text-slate-200">
            <span className="text-slate-500 group-hover:text-accent transition-colors">{s.icon}</span>
            <span className="group-hover:text-white transition-colors">{s.text}</span>
            <span className="ml-auto text-slate-600 group-hover:text-accent transition-colors"><ArrowIcon /></span>
          </button>
        ))}
      </div>
    </div>
  );
}

function Bubble({ m, lang }: { m: Msg; lang: 'en' | 'kn' }) {
  const isUser = m.role === 'user';
  const tone = isUser
    ? 'bg-accent text-ink rounded-br-sm shadow-[0_2px_12px_-4px_rgba(56,189,248,0.5)]'
    : m.error
      ? 'bg-danger/10 border border-danger/40 text-rose-200 rounded-bl-sm'
      : 'bg-panel2 border border-edge text-slate-100 rounded-bl-sm';
  return (
    <div className={`flex msg-in ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[88%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${tone} ${lang === 'kn' ? 'font-kn' : ''}`}>
        {!isUser && m.env && (
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-[9px] uppercase tracking-wider text-accent2 bg-accent2/10 border border-accent2/20 rounded px-1.5 py-0.5">{m.env.intent.replace(/_/g, ' ')}</span>
          </div>
        )}
        {m.error && <span className="mr-1">⚠</span>}
        {m.text}
      </div>
    </div>
  );
}

function Thinking() {
  return (
    <div className="flex items-center gap-2 msg-in text-slate-400 text-sm">
      <span className="flex items-center gap-1 rounded-full bg-panel2 border border-edge px-2.5 py-1.5">
        <span className="thinking-dot" style={{ animationDelay: '0ms' }} />
        <span className="thinking-dot" style={{ animationDelay: '160ms' }} />
        <span className="thinking-dot" style={{ animationDelay: '320ms' }} />
      </span>
      <span>NETRA is analysing the records…</span>
    </div>
  );
}

function Composer({ input, setInput, onSend, listening, toggleVoice, busy, lang }: any) {
  return (
    <div className="border-t border-edge p-2.5">
      <div className="flex items-center gap-2">
        <button onClick={toggleVoice} aria-label="Voice query" title="Voice query (Chrome/Edge)"
          className={`btn-ghost shrink-0 w-10 h-10 rounded-lg grid place-items-center border ${listening ? 'bg-danger/20 border-danger text-danger animate-pulse' : 'border-edge text-slate-300 hover:text-accent hover:border-accent'}`}>
          <MicIcon />
        </button>
        <div className="relative flex-1">
          <input
            value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && onSend()}
            placeholder={lang === 'kn' ? 'ಒಂದು ಪ್ರಶ್ನೆ ಕೇಳಿ…' : 'Ask about hotspots, gangs, offenders, a FIR…'}
            className={`w-full bg-panel2 border border-edge rounded-lg pl-3 pr-8 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:border-accent transition-colors ${lang === 'kn' ? 'font-kn' : ''}`}
          />
          {input && <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-500 border border-edge rounded px-1 py-0.5 bg-ink/60">↵</kbd>}
        </div>
        <button onClick={onSend} disabled={busy || !input.trim()}
          className="btn-ghost shrink-0 px-4 h-10 rounded-lg bg-accent text-ink font-medium text-sm hover:brightness-110 active:brightness-95 disabled:opacity-40 disabled:hover:brightness-100">Ask</button>
      </div>
    </div>
  );
}

function SurfaceHeader({ env, onSpeak }: { env?: AnswerEnvelope; onSpeak: () => void }) {
  const conf = env ? Math.round((env.evidence?.confidence || 0) * 100) : 0;
  const confTone = conf >= 80 ? 'text-good border-good/30 bg-good/10' : conf >= 55 ? 'text-warn border-warn/30 bg-warn/10' : 'text-danger border-danger/30 bg-danger/10';
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-accent shrink-0">{env ? surfaceIcon(env.surface?.kind) : <GridIcon />}</span>
        <span className="text-sm text-slate-200 font-medium truncate">{env ? prettyIntent(env.intent) : 'Answer surface'}</span>
      </div>
      {env && (
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-[10px] font-semibold rounded-full border px-2 py-0.5 tabular-nums ${confTone}`}>{conf}% conf.</span>
          <button onClick={onSpeak} aria-label="Speak answer" className="btn-ghost text-xs flex items-center gap-1 text-slate-300 hover:text-accent">
            <SpeakerIcon /> Speak
          </button>
        </div>
      )}
    </div>
  );
}

function SurfaceSkeleton() {
  return (
    <div className="h-full w-full flex flex-col gap-3">
      <div className="skeleton h-2/3 w-full" />
      <div className="grid grid-cols-3 gap-3 flex-1">
        <div className="skeleton" /><div className="skeleton" /><div className="skeleton" />
      </div>
    </div>
  );
}

function Placeholder() {
  return (
    <div className="h-full grid place-items-center text-center">
      <div className="max-w-[34ch]">
        <div className="mx-auto w-14 h-14 rounded-2xl border border-edge bg-panel2 grid place-items-center text-accent mb-3"><GridIcon big /></div>
        <div className="text-slate-300 text-sm font-medium">Your visual answer appears here</div>
        <div className="text-slate-500 text-xs mt-1">Maps, criminal networks, forecasts and dossiers — each backed by an evidence trail.</div>
      </div>
    </div>
  );
}

function TrustEmpty() {
  return (
    <div className="flex items-start gap-2 text-slate-500 text-sm">
      <span className="mt-0.5 text-slate-600"><ShieldIcon /></span>
      <span>Evidence &amp; reasoning appear here — every answer is auditable, with source FIRs and confidence.</span>
    </div>
  );
}

const prettyIntent = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

function surfaceIcon(kind?: string) {
  if (kind === 'map') return <MapPinIcon />;
  if (kind === 'graph') return <GraphIcon />;
  if (kind === 'chart') return <ChartIcon />;
  if (kind === 'table') return <TableIcon />;
  if (kind === 'card') return <CardIcon />;
  return <GridIcon />;
}

/* ---- inline icons (single consistent 1.8–2px stroke set) ---- */
function Dot({ c }: { c: 'good' | 'warn' | 'danger' | 'accent' }) {
  const m: any = { good: '#34d399', warn: '#f59e0b', danger: '#f43f5e', accent: '#38bdf8' };
  return <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ background: m[c], boxShadow: `0 0 8px -1px ${m[c]}` }} />;
}
const S = (p: any = {}) => ({ width: 15, height: 15, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, ...p });
function MicIcon() { return <svg {...S({ width: 18, height: 18 })}><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10a7 7 0 0 0 14 0M12 17v4" /></svg>; }
function SpeakerIcon() { return <svg {...S({ width: 13, height: 13 })}><path d="M11 5 6 9H2v6h4l5 4zM15.5 8.5a5 5 0 0 1 0 7M19 5a9 9 0 0 1 0 14" /></svg>; }
function ShieldIcon() { return <svg {...S()}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>; }
function BellIcon() { return <svg {...S()}><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.5 21a1.5 1.5 0 0 0 3 0" /></svg>; }
function DownloadIcon() { return <svg {...S()}><path d="M12 3v12m0 0 4-4m-4 4-4-4M4 21h16" /></svg>; }
function ChevronIcon() { return <svg {...S({ width: 13, height: 13 })} className="text-slate-500 pointer-events-none"><path d="m6 9 6 6 6-6" /></svg>; }
function ArrowIcon() { return <svg {...S({ width: 14, height: 14 })}><path d="M5 12h14m-6-6 6 6-6 6" /></svg>; }
function MapPinIcon() { return <svg {...S()}><path d="M12 21s7-6 7-11a7 7 0 1 0-14 0c0 5 7 11 7 11z" /><circle cx="12" cy="10" r="2.5" /></svg>; }
function GraphIcon() { return <svg {...S()}><circle cx="6" cy="6" r="2.5" /><circle cx="18" cy="7" r="2.5" /><circle cx="12" cy="18" r="2.5" /><path d="M8 7.5 16 8m-9 1.5L11 16m6-6.5L13 16" /></svg>; }
function ChartIcon() { return <svg {...S()}><path d="M4 20V4m0 16h16M8 16l4-5 3 3 4-6" /></svg>; }
function TableIcon() { return <svg {...S()}><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9h18M3 14h18M9 4v16" /></svg>; }
function CardIcon() { return <svg {...S()}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 9h18M7 14h5" /></svg>; }
function ForecastIcon() { return <svg {...S()}><path d="M4 14a4 4 0 0 1 1-7.9A5 5 0 0 1 15 6a4 4 0 0 1 1 8H6M9 19l2 2 4-4" /></svg>; }
function RiskIcon() { return <svg {...S()}><path d="M12 3 3 7v5c0 5 4 8 9 9 5-1 9-4 9-9V7z" /><path d="M12 8v4m0 3h.01" /></svg>; }
function MoneyIcon() { return <svg {...S()}><circle cx="12" cy="12" r="8" /><path d="M12 8v8m-2.5-5.5A2.5 2 0 0 1 12 9m0 6a2.5 2 0 0 0 2.5-2" /></svg>; }
function GridIcon({ big }: { big?: boolean }) { return <svg {...S(big ? { width: 22, height: 22 } : {})}><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg>; }
