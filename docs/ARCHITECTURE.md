# NETRA — Architecture

Companion to `MASTER_PLAN.md`. This document defines the **data model**, the **intent catalogue** (the reliability spine), the **orchestrator flow**, and the **adapter interfaces** that keep us Catalyst-native in production but fast in local dev.

---

## 1. Repository layout (monorepo)

```
KSP-datathon/
├── docs/
│   ├── MASTER_PLAN.md
│   └── ARCHITECTURE.md
├── data/
│   ├── generator/            # synthetic Karnataka crime data generator (Node/TS)
│   │   ├── karnataka.ts      # districts, stations, name pools, geo
│   │   ├── generate.ts       # main generator (seeded RNG, planted patterns)
│   │   └── rng.ts            # deterministic PRNG
│   └── seed/                 # generated output (json/csv/sql) — git-ignored except samples
├── packages/
│   └── core/                 # shared, framework-agnostic intelligence
│       ├── types.ts          # canonical domain types (FIR, Person, Edge, Txn…)
│       ├── intents/          # intent catalogue + router + slot schemas
│       ├── analytics/        # graph (centrality/Louvain/linkpred), forecast (NRV/RTM/KDE), risk
│       ├── providers/        # adapter INTERFACES: DataProvider, LLMProvider, VoiceProvider, BlobProvider
│       └── providers.local/  # local dev implementations (SQLite, etc.)
├── apps/
│   └── web/                  # Next.js app (UI + API routes for dev) → Catalyst AppSail
│       ├── app/              # routes: /chat, /api/*
│       ├── components/       # chat, MapAnswer, GraphAnswer, ChartAnswer, TrustPanel, RoleSwitch
│       └── lib/              # client helpers
├── catalyst/                 # Catalyst deployment (functions, datastore schema, config) — added Week 3
├── package.json              # workspaces root
└── README.md
```

---

## 2. Data model (canonical entities)

All IDs are stable strings. This maps cleanly onto **Catalyst Data Store** tables (relational + full-text) with **NoSQL** for the edge/graph store and **Cache** for hot aggregates.

### Core tables
- **person** — `id, full_name, full_name_kn, gender, dob/age, address, district, ps_code, socio_economic_band, occupation, is_repeat_offender, risk_score, mo_fingerprint[]`
- **fir** — `id (e.g. FIR-2025-BLR-00123), title, crime_type, ipc_bns_sections[], occurred_at, reported_at, district, ps_code, lat, lng, status (registered|under_investigation|chargesheeted|closed), mo_tags[], narrative_en, narrative_kn, value_loss`
- **fir_accused** — `fir_id, person_id, role (accused|suspect|absconding), arrest_status`
- **fir_victim** — `fir_id, person_id, injury, loss_amount`
- **association** — `person_a, person_b, type (family|associate|covictim|cooffender|phone|vehicle|financial), weight, source_fir_ids[]` *(the graph edges)*
- **account** — `id, holder_person_id, bank, account_no_masked, kyc_band`
- **transaction** — `id, from_account, to_account, amount, ts, channel, flagged_reason?` *(money-trail edges)*
- **station** — `ps_code, name, district, lat, lng`
- **district** — `name, population, urbanization_index, literacy_rate, unemployment_proxy` *(socio-economic overlay)*
- **audit_log** — `id, ts, user_id, role, action, intent, entity_refs[], pii_revealed (bool)` *(governance/traceability)*

### Derived / computed (cached)
- hotspot grids (KDE per crime_type/time-band), district trend series, community assignments (Louvain), centrality scores, near-repeat risk surfaces, MO clusters.

### Planted-pattern manifest (`data/seed/manifest.json`)
Records the ground-truth of injected patterns (gang member ids, near-repeat series fir ids, hotspot ps_code, laundering ring accounts) so we can (a) demo confidently and (b) **validate** that our analytics actually recover them — a credibility win.

---

## 3. Intent catalogue — the reliability spine

Instead of free-form text-to-SQL (unreliable), the LLM classifies each user message into **one typed intent** and fills its **slots**. Each intent is backed by a validated, parameterised query/handler. Unknown/low-confidence → `clarify` or `abstain`.

| Intent | Example utterance | Key slots | Answer surface |
|---|---|---|---|
| `retrieve_fir` | "show details of FIR 2025-BLR-123" | fir_id | Card + Evidence |
| `search_firs` | "thefts in Mysuru last month" | crime_type, area, time_range, status | Table + mini-map |
| `person_profile` | "tell me about accused Ramesh K" | person_ref | Profile + history timeline |
| `criminal_history` | "priors for this person" | person_ref | Timeline + table |
| `hotspot_map` | "chain-snatching hotspots in Bengaluru South" | crime_type, area, time_range | **Heatmap** |
| `trend_analysis` | "burglary trend this year" | crime_type, area, granularity | **Trend chart** |
| `seasonal_pattern` | "is theft seasonal here?" | crime_type, area | Seasonal decomposition |
| `network_explore` | "who is connected to X" | person_ref, depth | **Graph** |
| `detect_org_crime` | "find gangs operating in Hubli" | area, crime_type | **Graph + communities** |
| `repeat_offenders` | "repeat offenders in this PS" | area, crime_type | Ranked table + risk |
| `offender_risk` | "risk score for this person" | person_ref | Score + SHAP-style reasons |
| `mo_similarity` | "cases with similar MO to FIR-…" | fir_id / mo_tags | Ranked similar cases |
| `similar_cases` | "past cases like this & outcomes" | fir_id | Table + outcomes |
| `case_summary` | "summarise this case" | fir_id | LLM summary + timeline |
| `suggest_leads` | "what should I investigate next?" | fir_id / person_ref | Lead list w/ rationale |
| `money_trail` | "money trail for this group" | person_ref / account | **Transaction graph** |
| `forecast_hotspot` | "where will they strike next?" | crime_type, area | **Near-repeat red zone** |
| `socio_insight` | "link crime to unemployment in district" | district, crime_type, indicator | Correlation chart |
| `clarify` | (ambiguous) | — | Clarifying question |
| `abstain` | (out-of-scope/unsafe) | — | Honest "can't answer" |

Each intent handler returns a **uniform envelope**:
```ts
type AnswerEnvelope = {
  intent: string;
  narration_en: string;        // short natural-language answer
  narration_kn?: string;       // Kannada narration (for TTS + display)
  surface: MapAnswer | GraphAnswer | ChartAnswer | TableAnswer | CardAnswer | TextAnswer;
  evidence: { fir_ids: string[]; query: string; confidence: number; reasoning_path: ReasoningStep[] };
  followups: string[];         // suggested next questions
};
```
The **Trust panel** renders `evidence`; the **answer surface** renders `surface`; **TTS** speaks `narration_kn|en`. This uniform envelope is what makes "every answer is visual + explainable" trivial across all intents.

---

## 4. Orchestrator flow (per turn)

```
user input (text or voice)
   │  (voice → ASR: Zia[en] / Bhashini[kn])
   ▼
[1] language detect + normalise
   ▼
[2] LLM intent classification + slot filling   ── uses short rolling context (last N turns)
   │     low confidence ─────────────► clarify / abstain
   ▼
[3] slot validation + entity resolution (names → person_ids via Data Store full-text)
   ▼
[4] capability handler runs (retrieval / analytics module) → builds `surface` + `evidence`
   ▼
[5] LLM narration (EN + Kannada) grounded ONLY on handler output (no free invention)
   ▼
[6] audit_log write (role, intent, entities, pii flag)
   ▼
AnswerEnvelope → UI (surface + Trust panel) ──► optional TTS reply
```

Guardrails: the narration step is **constrained to the handler's data** (RAG-style grounding) so the model can't fabricate facts; numbers/IDs come from handlers, not the LLM.

---

## 5. Analytics modules (`packages/core/analytics`)

- **graph.ts** — build adjacency from `association` (+ co-offence, shared phone/vehicle/account); **degree/betweenness/eigenvector centrality**; **Louvain community detection**; **link prediction** (Adamic-Adar, common-neighbours; pluggable GCN later). Output feeds `network_explore`, `detect_org_crime`.
- **forecast.ts** — **KDE hotspots**; **Near-Repeat Victimization** (space-time window scan, Knox-style) and a lightweight **self-exciting (Hawkes-style) / Risk Terrain** score to rank next-strike cells. Output feeds `hotspot_map`, `forecast_hotspot`, beat-briefing alerts.
- **risk.ts** — explainable **offender risk score**: weighted features (prior count, recency, severity, MO diversity, network centrality, absconding) → 0–100 with per-feature contributions ("why"). Feeds `offender_risk`, `repeat_offenders`.
- **mo.ts** — MO fingerprint/embedding from `mo_tags` + crime attributes; cosine similarity for `mo_similarity` / `similar_cases` ("crime DNA").
- **socio.ts** — correlate district crime rates with `urbanization_index`, `literacy_rate`, `unemployment_proxy`; feeds `socio_insight`.

All modules are pure functions over canonical types → unit-testable, and validated against the **planted-pattern manifest**.

---

## 6. Adapter interfaces (Catalyst-native in prod, local in dev)

```ts
interface DataProvider {            // SQLite (dev) ⇄ Catalyst Data Store + NoSQL (prod)
  getFir(id): Promise<Fir>;
  searchFirs(filter): Promise<Fir[]>;
  getPerson(ref): Promise<Person>;
  getEdges(personIds, depth): Promise<Association[]>;
  getTransactions(filter): Promise<Transaction[]>;
  getDistrictStats(name): Promise<District>;
  writeAudit(entry): Promise<void>;
}
interface LLMProvider {             // local model/API (dev) ⇄ Catalyst QuickML/Zia LLM (prod)
  classifyIntent(msg, ctx): Promise<{intent; slots; confidence}>;
  narrate(handlerOutput, lang): Promise<string>;
  embed(text): Promise<number[]>;   // RAG / MO similarity
}
interface VoiceProvider {           // Zia ASR/TTS (en) + Bhashini (kn)
  transcribe(audio, lang): Promise<string>;
  synthesize(text, lang): Promise<AudioBuffer>;
}
interface BlobProvider {            // local FS (dev) ⇄ Catalyst Stratus (prod)
  putPdf(name, bytes): Promise<{url}>;
}
interface NerProvider {             // IndicNER (AI4Bharat) — Kannada/English entity extraction
  extract(text, lang): Promise<Entity[]>;
}
```
`packages/core/providers/index.ts` selects implementation from `NETRA_ENV` (`local` | `catalyst`). UI and handlers depend only on interfaces — so the Week-3 Catalyst migration is config, not rewrites.

---

## 7. Security & governance (PS §10)

- **4 roles** via Catalyst Authentication: `constable`, `investigator`, `supervisor`, `policymaker`.
- **PII redaction policy** applied server-side per role (names/addresses/account numbers masked for lower roles & policymaker-strategic view).
- **Immutable audit log** for every query (who/what/when/which entities/pii-revealed) — surfaced in a live UI panel for the governance demo.
- **API Gateway** enforces auth + throttling in front of Functions.
- Principle: the LLM never sees more than the requesting role is allowed to see (redaction happens before grounding).

---

## 8. Testing & validation

- Unit tests for each analytics module against the **planted-pattern manifest** (does Louvain recover the gang? does NRV flag the planted series? does risk rank the seeded habitual offender top?).
- Intent-router test suite: a labelled set of ~80 utterances (EN + Kannada) → expected intent/slots; track accuracy + abstain behaviour.
- Golden demo-script run as an integration smoke test.

---

*Build order: data generator → core types → DataProvider(local) → intent router(6) → web shell → answer surfaces → analytics → voice/NER → Catalyst migration. See MASTER_PLAN §8 milestones.*
