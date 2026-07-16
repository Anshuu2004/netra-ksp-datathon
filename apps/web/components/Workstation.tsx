'use client';
// NETRA intelligence workstation.
//
// Shape follows how investigators actually work (Gotham's "common operating picture";
// i2's relational + temporal chart pair) rather than chat UIs: four fixed regions, nothing
// scrolls away, and ONE selection drives every view.
//
//   ┌ command bar ────────────────────────────────┐
//   │ case rail │ coordinated views │ inspector   │
//   │           │ ─── timeline ──── │             │
//   └ status ─────────────────────────────────────┘
import { useCallback, useEffect, useRef, useState } from 'react';
import type { AnswerEnvelope, Role } from '@/lib/types';
import { AnswerSurfaceView } from './surfaces';
import { Inspector } from './Inspector';
import { Timeline } from './Timeline';
import { useWorkspace } from './workspace-store';

type Turn = { id: number; q: string; env?: AnswerEnvelope; error?: string };

const ROLES: { id: Role; label: string; access: 'full' | 'redacted' }[] = [
  { id: 'constable', label: 'Constable', access: 'redacted' },
  { id: 'investigator', label: 'Investigator', access: 'full' },
  { id: 'supervisor', label: 'Supervisor', access: 'full' },
  { id: 'policymaker', label: 'Policymaker', access: 'redacted' },
];

const STARTERS = [
  'Show chain-snatching hotspots in Bengaluru in the last 6 months',
  'Find the organized gang operating in Bengaluru',
  'Where will the next burglary strike in Mysuru?',
  'Top repeat offenders in Mysuru',
  'Trace the money trail for the laundering ring',
  'Is chain-snatching in Bengaluru seasonal?',
  'Correlate crime with urbanisation',
];

// Chrome strings an officer reads. Content strings (narration, reasoning) come from the server.
const T = {
  en: {
    ask: 'Ask', askPh: 'Ask the crime database — hotspots, gangs, offenders, a FIR…',
    commands: 'Commands', workspace: 'Workspace', analysing: 'Analysing…', speak: 'Speak',
    case: 'Case', caseEmpty: 'Your line of enquiry builds here. Every question stays — click one to return to it.',
    export: 'Export dossier', audit: 'Audit log', briefing: 'Beat briefing',
    live: 'live', role: 'role', queries: 'queries', selected: 'selected',
    piiVisible: 'PII visible', piiRedacted: 'PII redacted', demoData: 'synthetic demo data',
    timelineFilter: 'timeline filter active', failed: 'failed',
    headline: 'Interrogate the crime database.',
    sub: 'Ask in English or ಕನ್ನಡ, by text or voice. The answer opens here as a live map or network — select anything in it and the timeline, inspector and evidence follow.',
    start: 'Start',
  },
  kn: {
    ask: 'ಕೇಳಿ', askPh: 'ಅಪರಾಧ ದತ್ತಸಂಚಯವನ್ನು ಕೇಳಿ…',
    commands: 'ಆದೇಶಗಳು', workspace: 'ಕಾರ್ಯಕ್ಷೇತ್ರ', analysing: 'ವಿಶ್ಲೇಷಿಸಲಾಗುತ್ತಿದೆ…', speak: 'ಓದಿ',
    case: 'ಪ್ರಕರಣ', caseEmpty: 'ನಿಮ್ಮ ವಿಚಾರಣೆ ಇಲ್ಲಿ ದಾಖಲಾಗುತ್ತದೆ. ಪ್ರತಿ ಪ್ರಶ್ನೆಯೂ ಉಳಿಯುತ್ತದೆ.',
    export: 'ದಸ್ತಾವೇಜು ರಫ್ತು', audit: 'ಲೆಕ್ಕಪರಿಶೋಧನೆ', briefing: 'ಬೀಟ್ ವರದಿ',
    live: 'ಸಕ್ರಿಯ', role: 'ಪಾತ್ರ', queries: 'ಪ್ರಶ್ನೆಗಳು', selected: 'ಆಯ್ಕೆ',
    piiVisible: 'ವೈಯಕ್ತಿಕ ಮಾಹಿತಿ ಗೋಚರ', piiRedacted: 'ವೈಯಕ್ತಿಕ ಮಾಹಿತಿ ಮರೆಮಾಚಲಾಗಿದೆ',
    demoData: 'ಕೃತಕ ಪ್ರಾತ್ಯಕ್ಷಿಕೆ ದತ್ತಾಂಶ', timelineFilter: 'ಕಾಲರೇಖೆ ಶೋಧಕ ಸಕ್ರಿಯ', failed: 'ವಿಫಲ',
    headline: 'ಅಪರಾಧ ದತ್ತಸಂಚಯವನ್ನು ವಿಚಾರಿಸಿ.',
    sub: 'ಇಂಗ್ಲಿಷ್ ಅಥವಾ ಕನ್ನಡದಲ್ಲಿ ಕೇಳಿ — ಪಠ್ಯ ಅಥವಾ ಧ್ವನಿ ಮೂಲಕ. ಉತ್ತರ ಇಲ್ಲಿ ನಕ್ಷೆ ಅಥವಾ ಜಾಲವಾಗಿ ತೆರೆಯುತ್ತದೆ.',
    start: 'ಪ್ರಾರಂಭಿಸಿ',
  },
} as const;

export default function Workstation() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [input, setInput] = useState('');
  const [role, setRole] = useState<Role>('investigator');
  const [lang, setLang] = useState<'en' | 'kn'>('en');
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [palette, setPalette] = useState(false);
  const [audit, setAudit] = useState<any[] | null>(null);
  const [live, setLive] = useState('');           // screen-reader announcement for the ask→answer loop
  const recogRef = useRef<any>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { setRecords, selection, timeWindow, clear } = useWorkspace();
  const active = turns.find((t) => t.id === activeId);
  const env = active?.env;
  const t = T[lang];
  const narrate = (e: AnswerEnvelope) => (lang === 'kn' && e.narration_kn ? e.narration_kn : e.narration_en);

  /** Single fetch path. Guards res.ok AND the envelope shape — one 500 used to white-screen
   *  the whole workstation, because `await res.json()` happily returned {error} and every
   *  consumer then called .slice()/.replace() on undefined. */
  const run = useCallback(async (q: string, id: number, forRole: Role) => {
    setBusy(true);
    setLive(t.analysing);
    try {
      const history = turns.slice(-3).map((x) => ({ role: 'user', text: x.q }));
      const res = await fetch('/api/ask', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: q, role: forRole, lang, history }),
      });
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      const envelope = await res.json();
      if (!envelope || envelope.error || !envelope.surface || !envelope.evidence) {
        throw new Error(envelope?.error || 'Malformed response');
      }
      setTurns((ts) => ts.map((x) => (x.id === id ? { ...x, env: envelope, error: undefined } : x)));
      setRecords(envelope.context?.records || []);
      setLive(`${narrate(envelope)} · ${envelope.context?.records?.length || 0} records`);
      speak(envelope);
    } catch (err: any) {
      const msg = err?.message || 'Request failed';
      setTurns((ts) => ts.map((x) => (x.id === id ? { ...x, env: undefined, error: msg } : x)));
      setRecords([]);
      setLive(`Query failed: ${msg}`);
    } finally {
      setBusy(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turns, lang, setRecords, t.analysing]);

  const send = useCallback((text: string) => {
    const q = text.trim();
    if (!q || busy) return;
    const id = Date.now();
    setInput('');
    setPalette(false);
    setTurns((ts) => [...ts, { id, q }]);
    setActiveId(id);
    run(q, id, role);
  }, [busy, role, run]);

  /** GOVERNANCE, FOR REAL. Changing role re-runs the active query against the server so the
   *  pixels on screen actually match the access level the status strip claims. Previously this
   *  only re-labelled the footer — full-PII answers stayed visible under a "PII redacted"
   *  badge, which is the single most dangerous thing to show a police jury. */
  const changeRole = useCallback((next: Role) => {
    setRole(next);
    clear();
    if (active && !busy) run(active.q, active.id, next);
    else setRecords([]);
  }, [active, busy, run, clear, setRecords]);

  const restore = (turn: Turn) => { setActiveId(turn.id); setRecords(turn.env?.context?.records || []); };

  function speak(e: AnswerEnvelope) {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    const u = new SpeechSynthesisUtterance(narrate(e));
    u.lang = lang === 'kn' ? 'kn-IN' : 'en-IN';
    const v = window.speechSynthesis.getVoices().find((x) => x.lang === u.lang);
    if (v) u.voice = v;
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
    r.onresult = (e: any) => { const x = e.results[0][0].transcript; setInput(x); send(x); };
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    recogRef.current = r; setListening(true); r.start();
  }

  async function openAudit() {
    try { const r = await fetch('/api/audit'); const d = await r.json(); setAudit(d.entries || []); }
    catch { setAudit([]); }
  }

  function exportDossier() {
    const esc = (s: string) => (s || '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] as string));
    if (turns.length === 0) { alert('Ask something first — the dossier captures this case.'); return; }
    const rows = turns.map((x) => {
      const ev = x.env?.evidence;
      // Follows the active language: a Kannada-speaking officer's export used to come out in English.
      const answer = x.env ? esc(narrate(x.env)) : esc(x.error || '—');
      return `<div class="u"><b>Q:</b> ${esc(x.q)}</div><div class="a"><b>NETRA:</b> ${answer}${
        ev ? `<div class="ev"><b>Evidence:</b> ${esc(ev.fir_ids.slice(0, 14).join(', ') || '—')}<br/><b>Method:</b> ${esc(ev.query)} · confidence ${Math.round((ev.confidence || 0) * 100)}%</div>` : ''
      }</div>`;
    }).join('');
    const html = `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><title>NETRA Dossier</title>
      <style>body{font-family:'Noto Sans Kannada',system-ui,sans-serif;max-width:760px;margin:24px auto;color:#111;padding:0 16px}
      h1{font-size:20px;margin:0}.sub{color:#666;font-size:12px}
      .u{background:#f0f6f3;padding:8px 12px;border-radius:3px;margin:8px 0}
      .a{background:#f6f6f4;padding:8px 12px;border-radius:3px;margin:8px 0}
      .ev{color:#555;font-size:11px;margin-top:6px;border-top:1px solid #ddd;padding-top:4px}
      .hd{border-bottom:2px solid #111;padding-bottom:8px;margin-bottom:12px}
      .badge{background:#fff7ed;color:#9a3412;border:1px solid #fdba74;border-radius:3px;padding:2px 6px;font-size:10px}
      .foot{color:#888;font-size:10px;border-top:1px solid #ddd;margin-top:16px;padding-top:8px}</style></head>
      <body><div class="hd"><h1>NETRA — Investigation Dossier</h1>
      <div class="sub">Karnataka State Police · Crime Intelligence Workstation · ${new Date().toLocaleString('en-IN')} · role: ${role}</div></div>
      <span class="badge">Prototype · labelled synthetic demo data</span>${rows}
      <div class="foot">Every answer above was computed from records with a full evidence trail. Generated by NETRA.</div>
      <script>window.onload=function(){setTimeout(function(){window.print()},400)}</script></body></html>`;
    const w = window.open('', '_blank');
    if (!w) { alert('Allow pop-ups to export the dossier.'); return; }
    w.document.write(html); w.document.close();
  }

  // Keyboard: ⌘/Ctrl-K palette, / focuses the bar, Escape is LAYERED (topmost overlay first —
  // it used to clear the map selection behind an open modal that couldn't be closed at all).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (document.activeElement as HTMLElement)?.tagName;
      const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (document.activeElement as HTMLElement)?.isContentEditable;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPalette((p) => !p); }
      else if (e.key === '/' && !typing) { e.preventDefault(); inputRef.current?.focus(); }
      else if (e.key === 'Escape') {
        if (audit !== null) setAudit(null);
        else if (palette) setPalette(false);
        else clear();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [clear, audit, palette]);

  const current = ROLES.find((r) => r.id === role)!;
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || '');

  return (
    // 100svh, not 100vh: 100vh includes the retracted mobile URL bar, which was clipping the
    // status strip that carries the PII state and the synthetic-data disclosure.
    <div className="h-[100svh] flex flex-col overflow-hidden" lang={lang}>
      <div role="status" aria-live="polite" className="sr-only">{live}</div>

      {/* ══ COMMAND BAR ══ */}
      <header className="shrink-0 flex items-center gap-2 px-2 h-9 border-b border-hairline bg-panel">
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-5 h-5 rounded-sm bg-fg grid place-items-center text-onfill font-bold text-[10px]" aria-hidden>ನೇ</div>
          <span className="font-semibold text-fg text-sm tracking-wide hidden sm:block">NETRA</span>
        </div>

        <div className="relative flex-1 max-w-3xl">
          <input
            ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && send(input)}
            placeholder={t.askPh} aria-label={t.askPh}
            className="w-full bg-sunken border border-stroke rounded-sm pl-7 pr-20 h-6 text-sm text-fg placeholder:text-fg-muted focus:border-accent transition-colors"
          />
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-fg-muted" aria-hidden><SearchIcon /></span>
          <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-1">
            <button onClick={toggleVoice} aria-label="Voice query"
              className={`btn-ghost w-5 h-5 rounded-sm grid place-items-center ${listening ? 'bg-sev-severe text-onfill' : 'text-fg-muted hover:text-accent'}`}><MicIcon /></button>
            <button onClick={() => send(input)} disabled={busy || !input.trim()}
              className="btn-ghost px-2 h-5 rounded-sm bg-accent text-onfill font-semibold text-xs disabled:bg-accent-dim disabled:text-fg-muted">{t.ask}</button>
          </div>
        </div>

        <button onClick={() => setPalette(true)}
          className="btn-ghost flex items-center gap-1 text-xs text-fg-secondary border border-hairline rounded-sm px-1.5 h-6 hover:text-accent hover:border-accent">
          <span className="hidden md:inline">{t.commands}</span><kbd className="text-2xs border border-stroke rounded-sm px-1">{isMac ? '⌘K' : 'Ctrl K'}</kbd>
        </button>

        <div className="flex items-center gap-1 shrink-0">
          <div className="flex rounded-sm border border-hairline overflow-hidden text-xs" role="group" aria-label="Language">
            <button onClick={() => setLang('en')} aria-pressed={lang === 'en'} className={`btn-ghost px-1.5 h-6 ${lang === 'en' ? 'bg-accent text-onfill' : 'text-fg-secondary hover:text-accent'}`}>EN</button>
            <button onClick={() => setLang('kn')} aria-pressed={lang === 'kn'} lang="kn" className={`btn-ghost px-1.5 h-6 font-kn ${lang === 'kn' ? 'bg-accent text-onfill' : 'text-fg-secondary hover:text-accent'}`}>ಕನ್ನಡ</button>
          </div>
          <label className="flex items-center gap-1 bg-sunken border border-hairline rounded-sm pl-1.5 pr-0.5 h-6"
            title={current.access === 'full' ? 'Full access to PII' : 'PII redacted for this role'}>
            <span className={`w-1.5 h-1.5 rounded-full ${current.access === 'full' ? 'bg-accent' : 'bg-sev-critical'}`} aria-hidden />
            <select value={role} onChange={(e) => changeRole(e.target.value as Role)} aria-label="Access role"
              className="bg-transparent text-xs text-fg appearance-none pr-1 cursor-pointer">
              {ROLES.map((r) => <option key={r.id} value={r.id} className="bg-raised">{r.label}</option>)}
            </select>
          </label>
        </div>
      </header>

      <div className={`progress-rail shrink-0 ${busy ? '' : 'opacity-0'}`} aria-hidden />

      {/* ══ BODY ══ */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[196px_1fr_296px] min-h-0 overflow-hidden">
        {/* ── CASE RAIL ── */}
        <aside className="hidden lg:flex flex-col border-r border-hairline min-h-0 bg-panel">
          <div className="px-2 py-1.5 flex items-center justify-between shrink-0 border-b border-hairline">
            <span className="eyebrow">{t.case}</span>
            {turns.length > 0 && <span className="text-2xs text-fg-muted tabular-nums">{turns.length}</span>}
          </div>
          <div className="flex-1 overflow-auto p-1 space-y-0.5 min-h-0">
            {turns.length === 0 && <p className="px-1 py-2 text-xs text-fg-muted leading-relaxed">{t.caseEmpty}</p>}
            {turns.map((x) => (
              <button key={x.id} onClick={() => restore(x)}
                className={`w-full text-left rounded-sm px-1.5 py-1 text-xs leading-snug border transition-colors ${
                  x.id === activeId ? 'bg-accent-wash border-accent text-fg' : 'border-transparent text-fg-secondary hover:bg-sunken hover:text-fg'
                }`}>
                <span className="line-clamp-2">{x.q}</span>
                {x.env && <span className="block mt-0.5 text-2xs uppercase tracking-wider text-accent">{x.env.intent.replace(/_/g, ' ')}</span>}
                {x.error && <span className="block mt-0.5 text-2xs text-sev-severe">{t.failed}</span>}
              </button>
            ))}
          </div>
          <div className="shrink-0 border-t border-hairline p-1 grid gap-0.5">
            <RailBtn onClick={exportDossier} disabled={!turns.length}><DownloadIcon /> {t.export}</RailBtn>
            <RailBtn onClick={openAudit}><ShieldIcon /> {t.audit}</RailBtn>
            <RailBtn href="/briefing"><BellIcon /> {t.briefing}</RailBtn>
          </div>
        </aside>

        {/* ── COORDINATED VIEWS + TIMELINE ── */}
        <main className="grid grid-rows-[1fr_auto] min-h-0 overflow-hidden bg-page">
          <section className="min-h-0 p-2 pb-1 flex flex-col">
            <div className="flex items-center justify-between gap-2 pb-1.5 shrink-0">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-fg-muted shrink-0" aria-hidden>{env ? surfaceIcon(env.surface?.kind) : <GridIcon />}</span>
                <h1 className="text-base text-fg font-semibold truncate">
                  {env ? prettyIntent(env.intent) : busy ? t.analysing : t.workspace}
                </h1>
                {env && <span className="text-xs text-fg-muted truncate hidden xl:inline min-w-0">· {narrate(env)}</span>}
              </div>
              {env && (
                <button onClick={() => speak(env)} className="btn-ghost text-xs flex items-center gap-1 text-fg-secondary hover:text-accent shrink-0">
                  <SpeakerIcon /> {t.speak}
                </button>
              )}
            </div>
            <div className="flex-1 min-h-0 panel p-1.5">
              {busy && !env ? <Skeleton />
                : active?.error ? <ErrorState msg={active.error} onRetry={() => send(active.q)} />
                : env ? <AnswerSurfaceView surface={env.surface} />
                : <EmptyWorkspace onPick={send} t={t} />}
            </div>
          </section>

          <section className="shrink-0 h-[104px] px-2 pb-2 pt-0.5">
            <div className="h-full panel p-1.5"><Timeline /></div>
          </section>
        </main>

        {/* ── INSPECTOR ── */}
        <aside className="hidden lg:block border-l border-hairline p-2 min-h-0 overflow-hidden bg-panel">
          <Inspector env={env} />
        </aside>
      </div>

      {/* ══ STATUS STRIP ══ */}
      <footer className="shrink-0 h-6 border-t border-hairline bg-panel flex items-center gap-3 px-2 text-xs text-fg-secondary">
        <span className="flex items-center gap-1 shrink-0"><span className="live-dot" aria-hidden /> {t.live}</span>
        <span className="shrink-0">{t.role} <span className="text-fg">{current.label}</span> · {current.access === 'full'
          ? <span className="text-accent">{t.piiVisible}</span>
          : <span className="text-sev-critical">{t.piiRedacted}</span>}</span>
        <span className="hidden sm:inline shrink-0">{t.queries} <span className="text-fg tabular-nums">{turns.length}</span></span>
        {selection.id && <span className="text-accent truncate min-w-0">{t.selected} {selection.id}</span>}
        {timeWindow && <span className="text-accent shrink-0 hidden md:inline">{t.timelineFilter}</span>}
        <span className="ml-auto text-sev-critical shrink-0">{t.demoData}</span>
      </footer>

      {palette && <CommandPalette onClose={() => setPalette(false)} onRun={send} setLang={setLang} setRole={changeRole} onDossier={exportDossier} onAudit={openAudit} />}
      {audit !== null && <AuditModal entries={audit} onClose={() => setAudit(null)} />}
    </div>
  );
}

/* ───────────────────────── command palette (⌘K) ───────────────────────── */
function CommandPalette({ onClose, onRun, setLang, setRole, onDossier, onAudit }: any) {
  const [q, setQ] = useState('');
  const [i, setI] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const cmds = [
    ...STARTERS.map((s) => ({ group: 'Ask', label: s, run: () => onRun(s) })),
    { group: 'Go', label: 'Open beat briefing', run: () => { window.location.href = '/briefing'; } },
    { group: 'View', label: 'Switch to ಕನ್ನಡ', run: () => setLang('kn') },
    { group: 'View', label: 'Switch to English', run: () => setLang('en') },
    { group: 'Access', label: 'Role: Investigator (PII visible)', run: () => setRole('investigator') },
    { group: 'Access', label: 'Role: Constable (PII redacted)', run: () => setRole('constable') },
    { group: 'Access', label: 'Role: Supervisor', run: () => setRole('supervisor') },
    { group: 'Access', label: 'Role: Policymaker (PII redacted)', run: () => setRole('policymaker') },
    { group: 'Case', label: 'Export dossier (PDF)', run: onDossier },
    { group: 'Case', label: 'Open audit log', run: onAudit },
  ];
  const hits = cmds.filter((c) => c.label.toLowerCase().includes(q.toLowerCase()));
  const clamped = Math.min(i, Math.max(0, hits.length - 1));

  // Enter used to always run hits[0] regardless of what the user was looking at — which
  // defeats the entire point of a palette.
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setI((n) => Math.min(n + 1, hits.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setI((n) => Math.max(n - 1, 0)); }
    else if (e.key === 'Home') { e.preventDefault(); setI(0); }
    else if (e.key === 'End') { e.preventDefault(); setI(hits.length - 1); }
    else if (e.key === 'Enter') { e.preventDefault(); if (hits[clamped]) { hits[clamped].run(); onClose(); } else if (q.trim()) { onRun(q); } }
  };
  useEffect(() => { listRef.current?.querySelector('[data-on="1"]')?.scrollIntoView({ block: 'nearest' }); }, [clamped]);

  return (
    <div role="dialog" aria-modal="true" aria-label="Command palette"
      className="fixed inset-0 z-[50] bg-black/70 flex items-start justify-center pt-[12vh] p-4 msg-in" onClick={onClose}>
      <div className="raised w-full max-w-xl overflow-hidden flex flex-col max-h-[65vh]" onClick={(e) => e.stopPropagation()}>
        <input autoFocus value={q} onChange={(e) => { setQ(e.target.value); setI(0); }} onKeyDown={onKey}
          placeholder="Type a command or a question…" aria-label="Command palette"
          className="w-full bg-transparent border-b border-hairline px-3 h-9 text-md text-fg placeholder:text-fg-muted" />
        <div ref={listRef} className="overflow-auto py-1" role="listbox">
          {hits.length === 0 && <div className="px-3 py-5 text-center text-xs text-fg-muted">Nothing matches. Press Enter to ask it anyway.</div>}
          {hits.map((c, n) => (
            <button key={n} data-on={n === clamped ? '1' : '0'} role="option" aria-selected={n === clamped}
              onMouseEnter={() => setI(n)} onClick={() => { c.run(); onClose(); }}
              className={`w-full text-left px-3 py-1.5 text-base flex items-center gap-2 ${n === clamped ? 'bg-accent-wash text-fg' : 'text-fg-secondary'}`}>
              <span className="text-2xs uppercase tracking-wider text-fg-muted w-10 shrink-0">{c.group}</span>
              <span className="truncate">{c.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── bits ───────────────────────── */
function EmptyWorkspace({ onPick, t }: { onPick: (s: string) => void; t: any }) {
  return (
    <div className="h-full grid place-items-center p-3 overflow-auto">
      <div className="max-w-md w-full">
        <h2 className="text-lg font-semibold text-fg text-balance">{t.headline}</h2>
        <p className="text-base text-fg-secondary mt-1.5 leading-relaxed">{t.sub}</p>
        <div className="eyebrow mt-4 mb-1.5 flex items-center gap-2"><span>{t.start}</span><span className="h-px flex-1 bg-hairline" /></div>
        <div className="grid gap-1">
          {STARTERS.slice(0, 4).map((s) => (
            <button key={s} onClick={() => onPick(s)}
              className="group flex items-center gap-2 text-left rounded-sm border border-hairline bg-sunken hover:border-accent transition-colors px-2 py-1.5 text-base text-fg-secondary hover:text-fg">
              <span className="text-fg-muted group-hover:text-accent" aria-hidden>→</span>
              <span>{s}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function ErrorState({ msg, onRetry }: { msg: string; onRetry: () => void }) {
  return (
    <div className="h-full grid place-items-center p-4 text-center">
      <div className="max-w-sm">
        <div className="text-sev-severe text-md font-semibold">The query didn’t complete</div>
        <p className="text-base text-fg-secondary mt-1.5">{msg}. The workstation is still running — nothing was lost.</p>
        <button onClick={onRetry} className="btn-ghost mt-3 px-3 h-7 rounded-sm bg-accent text-onfill text-base font-semibold">Retry</button>
      </div>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="h-full w-full flex flex-col gap-1.5" aria-hidden>
      <div className="skeleton flex-1" />
      <div className="grid grid-cols-3 gap-1.5 h-12"><div className="skeleton" /><div className="skeleton" /><div className="skeleton" /></div>
    </div>
  );
}

function RailBtn({ children, onClick, href, disabled }: any) {
  const cls = 'btn-ghost w-full flex items-center gap-1.5 text-xs px-1.5 py-1 rounded-sm border border-hairline text-fg-secondary hover:text-accent hover:border-accent disabled:text-fg-muted disabled:border-hairline';
  if (href) return <a href={href} className={cls}>{children}</a>;
  return <button onClick={onClick} disabled={disabled} className={cls}>{children}</button>;
}

function AuditModal({ entries, onClose }: { entries: any[]; onClose: () => void }) {
  return (
    <div role="dialog" aria-modal="true" aria-label="Audit log"
      className="fixed inset-0 z-[50] bg-black/70 flex items-center justify-center p-4 msg-in" onClick={onClose}>
      <div className="raised w-full max-w-3xl max-h-[80vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-3 py-2 border-b border-hairline">
          <div>
            <div className="font-semibold text-fg text-md">Audit log · governance &amp; traceability</div>
            <div className="text-xs text-fg-muted tabular-nums">{entries.length} entries · every query logged (role · intent · entities · PII).</div>
          </div>
          <button onClick={onClose} aria-label="Close" className="btn-ghost text-fg-secondary hover:text-fg text-lg leading-none">×</button>
        </div>
        <div className="overflow-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-raised text-fg-muted">
              <tr><th className="text-left px-2 py-1.5 font-medium">Time</th><th className="text-left font-medium">Role</th><th className="text-left font-medium">Intent</th><th className="text-left font-medium">Entities</th><th className="text-left font-medium">PII</th></tr>
            </thead>
            <tbody>
              {entries.length === 0 && <tr><td colSpan={5} className="px-2 py-3 text-fg-muted">No queries yet.</td></tr>}
              {entries.map((e) => (
                <tr key={e.id} className="border-t border-hairline">
                  <td className="px-2 py-1 text-fg-muted whitespace-nowrap tabular-nums">{new Date(e.ts).toLocaleTimeString()}</td>
                  <td className="text-fg capitalize">{e.role}</td>
                  <td className="text-accent">{e.intent}</td>
                  <td className="text-fg-muted font-mono">{(e.entity_refs || []).slice(0, 3).join(', ') || '—'}</td>
                  <td className={e.pii_revealed ? 'text-sev-critical' : 'text-accent'}>{e.pii_revealed ? 'revealed' : 'redacted'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const prettyIntent = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
function surfaceIcon(kind?: string) {
  if (kind === 'map') return <MapPinIcon />;
  if (kind === 'graph') return <GraphIcon />;
  if (kind === 'chart') return <ChartIcon />;
  return <GridIcon />;
}

const S = (p: any = {}) => ({ width: 13, height: 13, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, ...p });
function SearchIcon() { return <svg {...S({ width: 12, height: 12 })}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>; }
function MicIcon() { return <svg {...S({ width: 12, height: 12 })}><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10a7 7 0 0 0 14 0M12 17v4" /></svg>; }
function SpeakerIcon() { return <svg {...S({ width: 11, height: 11 })}><path d="M11 5 6 9H2v6h4l5 4zM15.5 8.5a5 5 0 0 1 0 7" /></svg>; }
function ShieldIcon() { return <svg {...S({ width: 11, height: 11 })}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>; }
function BellIcon() { return <svg {...S({ width: 11, height: 11 })}><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.5 21a1.5 1.5 0 0 0 3 0" /></svg>; }
function DownloadIcon() { return <svg {...S({ width: 11, height: 11 })}><path d="M12 3v12m0 0 4-4m-4 4-4-4M4 21h16" /></svg>; }
function MapPinIcon() { return <svg {...S()}><path d="M12 21s7-6 7-11a7 7 0 1 0-14 0c0 5 7 11 7 11z" /><circle cx="12" cy="10" r="2.5" /></svg>; }
function GraphIcon() { return <svg {...S()}><circle cx="6" cy="6" r="2.5" /><circle cx="18" cy="7" r="2.5" /><circle cx="12" cy="18" r="2.5" /><path d="M8 7.5 16 8m-9 1.5L11 16m6-6.5L13 16" /></svg>; }
function ChartIcon() { return <svg {...S()}><path d="M4 20V4m0 16h16M8 16l4-5 3 3 4-6" /></svg>; }
function GridIcon() { return <svg {...S()}><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>; }
