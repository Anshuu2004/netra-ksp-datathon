# NETRA — Master Plan
### Network-Enhanced Threat & Relationship Analytics
**Conversational Crime Intelligence Copilot for Karnataka State Police**

> *ನೇತ್ರ (Netra) = "the eye".* Tagline: **Ask. See. Act.**
> KSP Datathon 2026 · Problem Statement 1 — *Intelligent Conversational AI for KSP Crime Database*
> Deployed on **Zoho Catalyst** (mandatory).

---

## 0. The one-paragraph pitch

NETRA is a bilingual (English + ಕನ್ನಡ), voice-enabled **conversational crime-intelligence copilot**. An investigator asks a question in plain language — by typing or by speaking — and NETRA answers not with a wall of text but with a **living visual**: a hotspot map, a criminal-network graph, an offender risk dossier, a money-trail diagram — *every answer carrying a clickable evidence trail back to the exact FIRs it used*. It turns the state crime database from a passive archive into an investigator that talks back. We deliberately chose the **conversational track over the visualization track** because past KSP hackathons are saturated with dashboards (the 2024 winner was a dashboard; GitHub is full of "KSP-Dashboard" clones) — but almost no one delivers a *robust, multilingual, voice-driven, explainable* copilot. NETRA wins by owning the empty quadrant **and** absorbing the dashboard's visual appeal as its answer surface.

---

## 1. Why this strategy wins (the thesis)

| Lever | How NETRA exploits it |
|---|---|
| **Uncrowded category** | Judges have seen many crime dashboards. A reliable bilingual voice copilot is rare. We stand out instead of competing in a saturated field. |
| **Sponsor alignment** | The brief warns: *"using a third-party alternative when a Catalyst service is available may affect validity."* The conversational track maps 1:1 onto Catalyst's flagship AI services — **QuickML RAG + LLM Serving + Knowledge Base, Zia LLM, Zia ASR/TTS, Authentication, Stratus, Cron, Signals**. We score maximum "platform usage." |
| **Local relevance** | Kannada + voice is an emotional hook for a *Karnataka Police* audience. An officer querying the DB in spoken Kannada is unforgettable in a 3-minute demo. |
| **Demo-proof** | Every answer renders as a visual, so even an imperfect query still *looks* impressive. We never rely on raw text output that can flop. |
| **Criminological credibility** | We name and implement the real methods judges' technical advisors respect: **Near-Repeat Victimization, Risk Terrain Modeling, self-exciting point processes, Louvain community detection, link prediction.** This signals depth, not a toy. |

**Honest framing for the team:** no one can *guarantee* selection. This plan maximizes probability by being differentiated, deeply aligned to the sponsor's platform, locally resonant, demo-safe, and academically grounded.

---

## 2. Full mapping — every PS1 requirement → NETRA feature → Catalyst service

PS1 lists 10 capability blocks. We implement all 10; we go *deep* on the four that demo best and *credible-stub* the rest. Legend: 🟢 deep build · 🟡 functional · ⚪ designed + demo-stub.

| # | PS1 Requirement | NETRA feature | Depth | Catalyst service |
|---|---|---|---|---|
| 1 | Conversational interface, EN + Kannada, FIR/accused/victim/location/status/history retrieval, context-aware follow-ups, **PDF export**, voice | **Chat Copilot** with visual answers, multi-turn memory, bilingual, voice loop, one-click PDF dossier | 🟢 | QuickML (RAG+LLM Serving), Zia LLM, Zia ASR/TTS, Stratus (PDF) |
| 2 | Criminal network & relationship analysis, organized-crime + repeat-offender detection, visualization | **Network Graph** — node-link of persons/locations/accounts/incidents; Louvain community detection flags gangs; centrality flags kingpins; link prediction suggests hidden ties | 🟢 | Data Store + NoSQL (graph) + Cache |
| 3 | Crime pattern & trend analytics; hotspots; emerging clusters; seasonal/event-based | **Pattern Engine** — spatio-temporal hotspots (KDE), MO clustering, trend lines, seasonal decomposition | 🟢 | Data Store, AutoML, Cache |
| 4 | Sociological insights — demographics, social risk factors, urbanization/migration/economic/education correlation | **Socio-Insight overlay** — correlate crime with census/socio-economic indicators per district | 🟡 | Data Store, AutoML |
| 5 | Offender profiling — repeat/habitual, behavioral via MO, **risk scoring** | **Offender Risk Engine** — explainable risk score (priors, MO recency/severity, network centrality) | 🟢 | AutoML + QuickML (explanations) |
| 6 | Investigator decision support — auto case summaries, timelines, similar cases, recommended leads | **Case Copilot** — auto dossier, investigation timeline, MO-similarity "cases like this", next-lead suggestions | 🟢 | Zia LLM (summaries), QuickML (similarity/RAG) |
| 7 | Financial crime & transaction link analysis — money trails, suspicious networks | **Money-Trail view** — transaction graph, suspicious-flow detection, link to incidents | 🟡 | Data Store + NoSQL |
| 8 | Crime forecasting & early warning — emerging patterns, alerts for repeat/gang/organized, predictive hotspots | **Foresight Engine** — Near-Repeat + RTM risk map; red-zone alerts via scheduled scans | 🟢 | AutoML + **Cron** + **Signals/Event Functions** + Push/Mail |
| 9 | Explainable AI — data references, evidence trails, reasoning-path visualization, accountability | **Evidence Trail** on *every* answer + reasoning-path panel ("why NETRA said this") | 🟢 | (cross-cutting) |
| 10 | Secure role-based access & governance — RBAC, audit logs, traceability, data protection | **Governance layer** — 4 roles, PII redaction by role, immutable audit log | 🟢 | **Authentication** + API Gateway + Data Store (audit) |

---

## 3. WOW factors (the selection-winning extras)

These go **beyond** the brief. Each is a "lean-forward moment" for judges. The first six are the headline reel.

### ⭐ WOW 1 — Full Kannada voice loop ("ಕನ್ನಡದಲ್ಲಿ ಕೇಳಿ, ಕನ್ನಡದಲ್ಲಿ ಉತ್ತರ")
Speak a question in Kannada → NETRA transcribes (AI4Bharat/Bhashini ASR for Kannada; Zia ASR for English) → answers on screen **and speaks the answer back in Kannada** (TTS). No competitor will nail a closed Kannada voice loop. *Compliance note: Catalyst Zia ASR currently supports English + Hindi only, so for Kannada we use Bhashini (Govt-of-India MeitY stack) — a defensible, audience-flattering choice we state explicitly.*

### ⭐ WOW 2 — Kannada FIR free-text → structured intelligence
Real KSP FIRs contain Kannada narrative text. NETRA runs **IndicNER (AI4Bharat)** over Kannada/English narratives to auto-extract persons, weapons, vehicles, locations, amounts — converting unstructured FIR prose into queryable, linkable entities. This directly attacks the brief's "data silos / fragmented information" pain. Few teams will attempt cross-lingual entity extraction; it screams real-world depth.

### ⭐ WOW 3 — "Show your work" Evidence Trail + Reasoning Path
Every answer has a **Trust panel**: the exact FIR IDs used, the query NETRA ran, a confidence band, and a node-by-node **reasoning path** ("victim → linked accused → shared phone → second FIR"). This is the Explainable-AI requirement turned into a visible, screenshot-worthy feature — and it's exactly what a *law-enforcement accountability* audience wants to see.

### ⭐ WOW 4 — Organized-crime auto-discovery (network + link prediction)
On the relationship graph, **Louvain community detection** auto-circles likely gangs; **centrality** highlights the kingpin; **link prediction** (Adamic-Adar / common-neighbours, GCN-style) draws *dashed "suspected" edges* — connections not yet in the data but statistically likely. "NETRA thinks these two are connected — here's why" is a jaw-drop moment.

### ⭐ WOW 5 — Near-Repeat Foresight map ("where the next one hits")
Using **Near-Repeat Victimization** + **Risk Terrain Modeling**, NETRA forecasts the next likely strike in an active crime series (e.g. a chain-snatching spree) and pulses a red zone on the map with a time window. Criminologically grounded, visually dramatic, and *actionable* (where to deploy patrols tonight).

### ⭐ WOW 6 — One-click Investigation Dossier (auto-PDF)
Any case or conversation → a formatted **PDF dossier**: case summary, timeline, network snapshot, similar past cases & outcomes, suggested leads, evidence citations. Satisfies the "save conversation as PDF" requirement *and* doubles as a real deliverable an officer would hand to a supervisor. Stored in **Catalyst Stratus**.

### ⭐ WOW 7 — Proactive "Beat Briefing" (agentic, scheduled)
A **Catalyst Cron** job runs nightly, scans for anomalies/emerging clusters, and pushes each police station a **morning briefing** ("3 chain-snatchings near Majestic this week — predicted hotspot for tonight: …") via Push/Mail. Moves the product from reactive Q&A to proactive intelligence — embodying the brief's "reactive → proactive" theme.

### ⭐ WOW 8 — Conversational "what-if" + drill-anywhere
Follow-ups like *"only show the ones after 9 PM"* or *"what if we add a patrol at MG Road?"* re-render the same visual instantly. The map, graph, and charts are all conversational surfaces, not dead images.

### ⭐ WOW 9 — Privacy-by-design demo toggle
A visible **role switch** (Constable → Investigator → Supervisor → Policymaker) live-redacts PII and changes available actions on screen — proving the governance story instead of just claiming it. Every action writes to a visible **audit log**.

### ⭐ WOW 10 — "Crime DNA" MO fingerprint
Each offender gets an MO embedding ("crime DNA"); *"find offenders whose MO matches this unsolved case"* returns ranked suspects with similarity explanations. Connects offender profiling (PS §5) to decision support (PS §6) in one feature.

---

## 4. Experience walkthrough (the demo script we are building toward)

1. **Login** as *Investigator* (role badge visible). Audit log starts ticking.
2. Type: *"Show chain-snatching hotspots in Bengaluru South in the last 6 months."* → **heatmap** renders + 1-line summary + Evidence Trail (FIR list).
3. **Voice, in Kannada:** *"ಈ ಪ್ರದೇಶದಲ್ಲಿ ಪುನರಾವರ್ತಿತ ಅಪರಾಧಿಗಳು ಯಾರು?"* (who are the repeat offenders here?) → ranked **offender table** with risk scores; NETRA **speaks** the top answer in Kannada.
4. Click an offender → **network graph** expands; Louvain circles a gang; a dashed **predicted link** appears → "NETRA suspects X ↔ Y (shared vehicle, 0.81)."
5. *"Show me the money trail for this group."* → **transaction graph**, suspicious flows highlighted.
6. *"Where will they likely strike next?"* → **Near-Repeat red zone** pulses with a 72-hour window.
7. *"Summarise this case and find similar past cases."* → **case dossier** + "cases like this" with outcomes + suggested leads.
8. **One click → PDF dossier** downloads (and is saved to Stratus).
9. Flip role to **Policymaker** → PII redacts, view switches to district strategic trends.
10. Cut to the **Beat Briefing** email that arrived this morning — proactive, automated.

Each numbered beat is a feature we build and a shot in the demo video.

---

## 5. System architecture (high level)

```
                       ┌────────────────────────────────────────────┐
                       │   NETRA Web App (Next.js, Catalyst AppSail) │
                       │  Chat UI · Map · Graph · Charts · Trust panel│
                       └───────────────┬────────────────────────────┘
                                       │  HTTPS (API Gateway, JWT/roles)
                       ┌───────────────▼────────────────────────────┐
                       │        Orchestrator (Catalyst Functions)     │
                       │  ┌────────────┐  ┌─────────────────────────┐ │
   voice in ──ASR──►   │  │ Intent     │  │ Tool / capability layer │ │  ──► voice out (TTS)
  (Bhashini/Zia)       │  │ Router     │─►│ retrieve · graph ·      │ │
                       │  │ (semantic) │  │ forecast · profile ·    │ │
                       │  └────────────┘  │ summarise · pdf · alert │ │
                       │   guardrails +   └───────────┬─────────────┘ │
                       │   evidence trail             │               │
                       └───────────────┬──────────────┼───────────────┘
            ┌──────────────────────────┼──────────────┼───────────────────────┐
            ▼                          ▼              ▼                       ▼
   ┌─────────────────┐      ┌──────────────────┐ ┌──────────────┐   ┌──────────────────┐
   │ Catalyst        │      │ Catalyst QuickML │ │ Catalyst     │   │ Catalyst Zia     │
   │ Data Store      │      │ RAG + LLM Serving│ │ AutoML       │   │ ASR/TTS, IndicNER│
   │ (FIRs, persons, │      │ + Knowledge Base │ │ (risk, fcast)│   │ (entity extract) │
   │ links, txns,    │      │ (Zia LLM)        │ └──────────────┘   └──────────────────┘
   │ audit) + NoSQL  │      └──────────────────┘
   │ + Cache + Stratus│
   └─────────────────┘     Cron + Signals/Event Functions → Beat Briefing (Push/Mail)
```

**The core idea — a constrained semantic layer, not raw text-to-SQL.** Research shows free-form LLM→SQL is unreliable (hallucinated queries). NETRA instead routes each question to one of ~18 **typed intent templates** (parameterised, validated queries). The LLM's job is *classification + slot-filling + narration*, not authoring SQL. This makes answers reliable, fast, auditable, and demo-safe, while still feeling fully conversational. Unknown/ambiguous → NETRA **clarifies or abstains** ("Did you mean…?") rather than guessing.

See `docs/ARCHITECTURE.md` for the data model, intent catalogue, and adapter design.

---

## 6. Technology stack

| Layer | Choice | Notes |
|---|---|---|
| Frontend | **Next.js (App Router) + React + TypeScript + Tailwind + shadcn/ui** | Deployed to **Catalyst AppSail** (managed Node runtime) |
| Maps | **MapLibre GL + deck.gl** | Open-source; heatmaps, hexbins, time-slider |
| Network graph | **Cytoscape.js** (or sigma.js) | Community colouring, centrality sizing, dashed predicted edges |
| Charts | **Recharts / visx** | Trends, seasonal, demographics |
| Backend | **Catalyst Functions (Node.js)** behind **API Gateway** | Orchestrator + capability tools |
| Conversational AI | **Catalyst QuickML** (RAG + LLM Serving + Knowledge Base), **Zia LLM** | Provider behind an adapter (swappable in dev) |
| Voice | **Zia ASR/TTS** (English/Hindi) + **Bhashini/AI4Bharat** (Kannada) | Closed voice loop |
| Entity extraction | **AI4Bharat IndicNER** (Kannada/English NER) | FIR free-text → entities |
| Tabular ML | **Zia AutoML** | Offender risk, forecasting features |
| Data | **Catalyst Data Store** (relational + full-text), **NoSQL** (graph/edges), **Cache**, **Stratus** (PDFs/blobs) | |
| Auth/RBAC | **Catalyst Authentication** | 4 roles, audit |
| Schedule/Events | **Catalyst Cron** + **Signals/Event Functions** + Push/Mail | Beat Briefing, alerts |
| CI/CD | **Catalyst Pipelines** | |

**Dev-vs-prod adapters.** To build fast locally while staying Catalyst-native in production, every external dependency sits behind an adapter interface: `DataProvider` (local SQLite ⇄ Catalyst Data Store), `LLMProvider` (local model/API ⇄ QuickML/Zia), `VoiceProvider`, `BlobProvider` (local FS ⇄ Stratus). Production config selects Catalyst implementations. This keeps the submission valid (Catalyst-first) without slowing development.

---

## 7. Data plan

The dataset is the foundation — and we **plant patterns** so the analytics actually reveal something on stage.

- **Geography:** real Karnataka districts, commissionerates, and ~50 representative police stations with plausible lat/long.
- **Entities:** persons (accused + victims) with demographics (age, gender, socio-economic proxy), addresses; FIRs (crime type, IPC/BNS sections, date/time, location, PS, status, MO tags, EN + Kannada narrative); accused↔FIR, victim↔FIR links; person↔person associations; financial accounts + transactions.
- **Planted signals (so demos land):**
  - a **gang** (community of ~8 persons across districts, shared MO) → for network/community detection,
  - a **near-repeat burglary/chain-snatching series** (tight space-time cluster) → for foresight,
  - a **hotspot** (one PS limit spiking vs historical average) → for pattern engine + red-zone alert,
  - a **money-laundering ring** (layered transactions) → for the money-trail view,
  - a handful of **Kannada-narrative FIRs** → for the IndicNER extraction demo.
- **Reproducible:** seeded RNG; generator script committed; output to JSON/CSV/SQL.
- **Swap-in real data:** if KSP provides a dataset, the same schema + loaders ingest it; synthetic data is only the fallback/augmentation. Synthetic, privacy-safe data is also the *right* thing to demo publicly.

---

## 8. Four-week workflow (deadline ≈ 2026-07-05, started 2026-06-05)

> Team is fully skilled. Suggested split: **2 frontend/UX, 2 backend/AI, 1 data/ML, 1 integrations/Catalyst+demo** (scale to your size). Daily 15-min standup, shared board.

### Week 1 (Jun 5–11) — Foundation & spine
- ✅ Master plan + architecture (this doc).
- Repo, monorepo scaffold, CI lint/build.
- **Synthetic data generator** + seed dataset with planted patterns. *(in progress)*
- Data model + `DataProvider` (local SQLite first).
- **Intent router v1** with 6 core intents + guardrails/abstain.
- Frontend shell: chat panel + answer-surface container + role switch.
- **Milestone M1:** type a question → get a real retrieval answer + evidence trail (text + table), end-to-end locally.

### Week 2 (Jun 12–18) — The visual answer surface
- Map (hotspots/KDE, time-slider) + Charts (trends/seasonal/demographics).
- **Network graph** with centrality + Louvain communities.
- Offender risk engine v1 (explainable score).
- Case dossier + investigation timeline + "similar cases" (MO similarity).
- Expand intents to ~14; multi-turn context memory.
- **Milestone M2:** beats 2–4 and 7 of the demo script work locally (map, graph, offender table, case summary).

### Week 3 (Jun 19–25) — WOW + Catalyst
- **Voice loop** (EN via Zia, Kannada via Bhashini) + TTS reply.
- **IndicNER** Kannada FIR extraction.
- **Near-Repeat / RTM foresight** red-zone map + link prediction edges.
- **Money-trail** view.
- **Catalyst migration:** Data Store, QuickML RAG/LLM Serving, Auth/RBAC, Stratus PDF, Cron Beat Briefing. Switch adapters to Catalyst impls.
- **PDF dossier** export.
- **Milestone M3:** full demo script runs on Catalyst staging; voice + Kannada + foresight live.

### Week 4 (Jun 26–Jul 5) — Polish, deploy, submit
- Explainability/Trust panel polish; reasoning-path viz.
- Audit log + governance demo; PII redaction by role.
- Performance (Cache), error/empty/abstain states, accessibility, mobile-ish.
- **Production deploy on Catalyst** + custom domain + SSL (Domain Mappings).
- Record **demo video** (script in §4), write **Prototype Brief**, finalise **README** + setup instructions, fill the **official submission template**, public **GitHub** repo.
- Dry-run the whole submission checklist (§10). Buffer days = bug bash.
- **Milestone M4:** submitted, all links live and verified.

---

## 9. Risk register & mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| LLM→query unreliability / hallucination | High if naive | **Constrained intent templates** (no raw SQL), validation, **abstain/clarify** fallback, pre-seeded demo queries |
| Kannada ASR not in Catalyst | Certain (today) | Use **Bhashini/AI4Bharat** for Kannada; document why (Catalyst gap) — turns a limitation into a Govt-stack positive |
| Scope creep (10 PS blocks) | High | Depth on 4, credible-stub the rest; strict milestone gates |
| Catalyst service unfamiliarity | Medium | Catalyst spike in Week 1 (deploy "hello world" early), adapters isolate risk, Pipelines for repeatable deploys |
| Demo fragility (live AI on stage) | Medium | Record a clean run; seed deterministic demo data; have offline fallback narration |
| Real KSP data unavailable/sensitive | Medium | Synthetic, privacy-safe dataset with planted patterns — also the *correct* public-demo choice |
| Path/tooling (Windows, apostrophe in folder) | Low | Verified Node 24/npm 11/git; absolute paths; consider renaming folder to avoid quoting edge-cases |

---

## 10. Submission checklist (from the brief — pre-wired)

- [ ] **Prototype Brief** — problem statement, key features, tech stack, impact/use-case (draft from this doc).
- [ ] **Public GitHub repo** — full source, README with setup + execution instructions.
- [ ] **Demo video** (unlisted YouTube or public Drive) — problem overview, working prototype, key workflows (script = §4).
- [ ] **Deployed link — on Catalyst (mandatory)** with working public URL (+ custom domain/SSL).
- [ ] **Official submission template** — filled exactly as provided.
- [ ] **All links verified live** before deadline.

---

## 11. Impact statement (for the brief)

NETRA collapses the gap between a constable's question and the state's collective memory. It lets any officer — regardless of technical skill or English fluency — interrogate the crime database in spoken Kannada and receive an explainable, evidence-backed, visual answer in seconds; it surfaces organized-crime networks invisible in siloed Excel sheets; and it shifts policing from reactive to proactive with criminologically-grounded forecasts and automated beat briefings. Built entirely on Zoho Catalyst, it is a deployable blueprint for a state-wide Crime Intelligence Hub for the SCRB.

---

*Next docs: `ARCHITECTURE.md` (data model + intent catalogue + adapters), `README.md` (run instructions). Build starts with the synthetic data generator — the spine everything else hangs on.*
