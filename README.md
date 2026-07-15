# NETRA — Conversational Crime Intelligence Copilot
### Network-Enhanced Threat & Relationship Analytics · KSP Datathon 2026 (Problem Statement 1)

> ನೇತ್ರ (*Netra*) — "the eye." **Ask. See. Act.**
> A bilingual (English + ಕನ್ನಡ), voice-enabled conversational copilot over the KSP crime database.
> Every answer is a living visual — a hotspot map, a criminal-network graph, an offender dossier —
> with a clickable **evidence trail** back to the exact FIRs it used. Built for **Zoho Catalyst**.

---

## Why NETRA
Karnataka State Police crime data is rich but siloed; querying it needs technical skill and English
fluency, and policing is largely reactive. NETRA makes the database **conversational, multilingual,
voice-first, explainable, and proactive** — surfacing networks, hotspots, and forecasts that are
invisible in Excel.

## What it does
- **Conversational + voice + multi-turn, EN/ಕನ್ನಡ** — ask by text or speech; anaphoric follow-ups ("only the ones after 9 PM") resolve from context; spoken answers.
- **Visual answers** — map / network graph / chart / table / dossier for every reply.
- **Criminal networks** — centrality + Louvain community detection (gangs) + link prediction (hidden ties).
- **Forecasting** — near-repeat space-time scan → next-strike red zone with a time window.
- **Explainable offender risk** — transparent factor breakdown + repeat-offender ranking.
- **Sociological** — district socio-economic correlation (real data) + offender age/gender demographics.
- **Financial trail** — transaction graph + **query-time** fan-in / sub-threshold structuring detection, joined to FIRs.
- **Explainable AI** — evidence trail (records, method, confidence, reasoning) on every answer.
- **Governance** — 4 roles with **real PII redaction by role** + a per-query audit log (in-app viewer + API; persisted to Catalyst Data Store in production).
- **Proactive Beat Briefing** — per-jurisdiction intelligence on-demand at `/briefing`; a Catalyst Cron **function + schedule are included** (`catalyst/functions/beatBriefing`) and dispatch nightly via Mail/Push once deployed.
- **PDF dossier export** — one-click conversation/case dossier.
- **Real data** — district trends & socio-economic correlation on **real Karnataka 2023** figures.

> **Status (honest):** Working prototype on labelled **synthetic** record-level data (real FIR data is
> confidential — see [`docs/DATA_POLICY.md`](docs/DATA_POLICY.md)) + **real** Karnataka 2023 aggregates.
> Runs fully locally today; Catalyst services (Data Store, QuickML/Zia, Auth, Cron, Stratus) are wired
> behind provider adapters and **activate on deploy** with credentials (see [`catalyst/DEPLOY.md`](catalyst/DEPLOY.md)).
> Kannada voice uses the browser locally and **Bhashini** in production (Catalyst Zia has no Kannada ASR yet).

## Repository layout
```
docs/        strategy (MASTER_PLAN), ARCHITECTURE, DATA_POLICY, SUBMISSION, PITCH_DECK.html
data/        generator/ (synthetic Karnataka data)  ·  real/ (real KA 2023 crime CSVs)  ·  seed/ (output)
packages/core/  intelligence engine: analytics (graph/forecast/risk), intent router, providers, types
apps/web/    Next.js app — chat console + visual answer surfaces (deploys to Catalyst AppSail)
catalyst/    Catalyst deployment config + DEPLOY.md (service mapping)
```

## Quick start (local)
Requires Node.js ≥ 20.
```bash
npm install
npm run data:generate     # build the synthetic Karnataka dataset → data/seed/
npm run validate          # PROVE the analytics are real: recovers planted ground-truth (10/10)
npm run ask               # terminal conversational demo (no UI)
npm run dev               # web app at http://localhost:3000  (use Chrome/Edge for voice)
```

Try: *"Find the organized gang operating in Bengaluru"* · *"Where will the next burglary strike in
Mysuru?"* · *"Top repeat offenders in Mysuru"* · *"Trace the money trail for the laundering ring"* ·
toggle **EN/ಕನ್ನಡ**, use the **mic**, open **Beat Briefing**, click **Dossier ⬇**.

## Proof the results are real (not mock)
`npm run validate` runs the analytics against hidden ground-truth recorded in
`data/seed/manifest.json` and checks they **rediscover** it — gang via community detection, kingpin via
centrality, hidden link via link prediction, spree via space-time scan, etc. **10/10 pass.** Nothing is
hardcoded. See [`docs/DATA_POLICY.md`](docs/DATA_POLICY.md) for full data provenance and the
real-vs-synthetic policy (record-level FIR data is confidential by law; we use a labelled, swappable
synthetic stand-in + real public aggregates).

## Deploy on Catalyst (mandatory for the datathon)
**→ [`docs/MANUAL_STEPS.md`](docs/MANUAL_STEPS.md) is the ordered, click-by-click checklist** (claim
credits → login → deploy → Data Store → Auth → QuickML → voice → submission form).
See also [`catalyst/DEPLOY.md`](catalyst/DEPLOY.md) — `apps/web` deploys to **Catalyst AppSail**; each
capability maps to a Catalyst service (Data Store, QuickML/Zia, Authentication, Stratus, Cron…).
The app runs without external keys (local providers) and **upgrades to Catalyst services via env vars,
no code changes** (`packages/core/src/providers`).

## Tech stack
Next.js 15 · React 19 · TypeScript · Tailwind · Cytoscape.js · Recharts · zero-dependency Node ESM
analytics core · Web Speech (dev voice) → **Zoho Catalyst** (AppSail, Data Store/NoSQL, QuickML + Zia
LLM, Zia ASR/TTS, AutoML, Authentication, Stratus, Cron, Push/Mail) · Bhashini/AI4Bharat (Kannada).

## Scripts
| Command | Purpose |
|---|---|
| `npm run data:generate` | Generate the synthetic Karnataka dataset |
| `npm run validate` | Prove analytics recover ground-truth (10/10) |
| `npm run ask "..."` | One-off terminal query (or scripted demo) |
| `npm run dev` / `build` | Run / build the web app |

## Submission
See [`docs/SUBMISSION.md`](docs/SUBMISSION.md) — Prototype Brief, demo video script, checklist.
Pitch deck: open [`docs/PITCH_DECK.html`](docs/PITCH_DECK.html) → print to PDF.

## License
MIT (hackathon prototype). Built for the Karnataka State Police Datathon 2026.
