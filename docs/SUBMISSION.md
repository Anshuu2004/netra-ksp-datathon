# NETRA — Submission Pack (KSP Datathon 2026)

**Challenge:** Problem Statement 1 — *Intelligent Conversational AI for KSP Crime Database*
**Deadline:** 26 Jul 2026, 23:59 IST · **Deploy target:** Zoho Catalyst (mandatory)

---

## 1. Prototype Brief (paste into the form — fits the 1024-char limit)

> NETRA (ನೇತ್ರ, "the eye") is a bilingual (English + Kannada), voice-enabled conversational crime-intelligence copilot for the KSP crime database. Investigators ask in plain language — typed or spoken — and NETRA replies with a living visual (hotspot map, criminal-network graph, offender risk dossier, money trail) plus a clickable evidence trail back to the exact FIRs used. It detects organized gangs (Louvain community detection), forecasts a crime series' next strike (near-repeat space-time analysis), scores repeat offenders, and traces suspicious money flows — turning a passive archive into an investigator that talks back. A nightly Beat Briefing proactively flags emerging hotspots. Trends and socio-economic insights run on REAL Karnataka 2023 crime data; record-level features use a labelled, swappable synthetic stand-in (real FIR data is confidential). Built end-to-end on Zoho Catalyst.

## 2. Problem statement addressed
KSP crime data is rich but siloed; querying it needs technical skill and English fluency, and policing
is largely reactive. NETRA makes the database conversational, multilingual, voice-first, explainable, and
proactive — surfacing networks, hotspots, and forecasts that are invisible in Excel.

## 3. Key features & functionalities
- **Conversational, bilingual, voice** — ask by text or speech in English/ಕನ್ನಡ; spoken answers (TTS).
- **Visual answers** — every reply renders a map, network graph, chart, table, or dossier.
- **Criminal-network analysis** — centrality + Louvain communities (gang discovery) + link prediction (hidden ties).
- **Crime forecasting** — near-repeat space-time scan → next-strike red zone with time window.
- **Explainable offender risk** — transparent factor breakdown; repeat-offender ranking.
- **Financial trail** — transaction graph + structuring detection.
- **Explainable AI** — every answer ships an evidence trail (records used, method, confidence, reasoning path).
- **Governance** — 4 roles + immutable audit log.
- **Proactive Beat Briefing** — nightly auto-intelligence (Catalyst Cron).
- **PDF dossier export** — one-click conversation/case dossier.
- **Real data** — district trends & socio-economic correlation computed on real Karnataka 2023 figures.

## 4. Technology stack
Next.js 15 · React 19 · TypeScript · Tailwind · Cytoscape.js · Recharts · SVG geo-viz ·
Node ESM analytics core (graph/forecast/risk, zero-dep) · Web Speech (dev voice) →
**Zoho Catalyst**: AppSail, Data Store/NoSQL, QuickML (RAG + LLM Serving) + Zia LLM, Zia ASR/TTS,
Zia AutoML, Authentication, Stratus, Cron, Push/Mail · Bhashini/AI4Bharat (Kannada ASR + IndicNER).

## 5. Proposed impact & use case
Any officer — regardless of tech skill or language — interrogates the state crime database in spoken
Kannada and gets explainable, evidence-backed, visual answers in seconds. NETRA exposes organized-crime
networks, scores repeat offenders, forecasts where a series will strike next, and pushes proactive beat
briefings — a deployable blueprint for a state-wide SCRB Crime Intelligence Hub.

---

## 6. Demo video script (~3 minutes)
1. **(0:00–0:20) Problem.** Excel screenshot vs NETRA. "Talk to the crime database in plain Kannada."
2. **(0:20–0:50) Hotspots.** Type *"chain-snatching hotspots in Bengaluru last 6 months"* → map + spike + evidence trail. Toggle the Trust panel.
3. **(0:50–1:25) Gang + hidden link.** *"Find the organized gang in Bengaluru"* → graph, kingpin circled, **dashed predicted tie** ("NETRA suspects X↔Y"). Click a follow-up.
4. **(1:25–1:55) Kannada voice + forecast.** Switch to ಕನ್ನಡ, press mic, **speak** *"ಮೈಸೂರಿನಲ್ಲಿ ಮುಂದಿನ ಕಳ್ಳತನ ಎಲ್ಲಿ?"* → pulsing red **forecast zone** + spoken Kannada answer.
5. **(1:55–2:20) Risk + money trail.** *"Top repeat offenders in Mysuru"* (risk table) → *"trace the money trail"* (structuring graph).
6. **(2:20–2:40) Proactive + dossier.** Open **Beat Briefing**; click **Dossier ⬇** → PDF.
7. **(2:40–3:00) Trust + deploy.** Show evidence trail + role switch + audit; end on the **Catalyst** deployed URL. Mention `npm run validate` (10/10 real-results proof).

## 7. Final submission checklist
- [ ] **Challenge** selected: *Intelligent Conversational AI for KSP Crime Database*
- [ ] **Prototype Brief** (§1) pasted
- [ ] **Public GitHub repo** (this repo) with README + setup
- [ ] **Deployed link** on Catalyst (see `catalyst/DEPLOY.md`) — live & reachable
- [ ] **Demo video** (unlisted YouTube / public Drive) per §6
- [ ] **Prototype Deck** PDF (≤5MB) — print `docs/PITCH_DECK.html`
- [ ] All links verified before deadline
