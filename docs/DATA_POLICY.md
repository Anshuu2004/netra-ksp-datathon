# NETRA — Data Policy & Provenance

This document is part of the submission. It states exactly where every number in NETRA
comes from, why we made each choice, and how NETRA plugs into KSP's real database. It exists
because the challenge explicitly requires **data-protection compliance and an evidence trail** —
so we make our data provenance auditable.

## Principle: real algorithms, traceable data, zero fabricated results

NETRA never hardcodes or fakes an answer. Every hotspot, network, score, and forecast is
**computed at runtime** by a real algorithm over a real dataset, and each answer carries an
**evidence trail** (the records used + the method run). What varies is the *source* of the
input records — and for crime data that choice is constrained by law.

## Three data tiers

| Tier | Used for | Source | Realness |
|---|---|---|---|
| **A. Real public aggregate** | District/city crime trends, hotspot ranking, socio-economic correlation | **Govt-of-India open data** — Karnataka 2023 district/city crime (OpenCity/NCRB, data.gov.in) | 100% real government figures |
| **B. Organizer dataset** | Everything, once available | KSP / Hack2skill provided dataset | Real (anonymized) — *primary source when supplied* |
| **C. Synthetic stand-in** | Record-level features that have **no legal public source**: FIR retrieval, criminal networks, individual offender risk/profiling | NETRA generator (`data/generator`) | Privacy-safe, schema-faithful, **clearly labelled, swappable** |

### Why Tier C is necessary (and correct)
Record-level FIR data — individual names, accused/victim links, criminal networks, personal
financial trails — is **confidential by law** and is **not** released publicly. We verified this:
every public Indian crime dataset (NCRB, data.gov.in, OpenCity, Kaggle) is **aggregate** (district/
state counts), never individual records. Putting real citizens' FIR records into a public GitHub
repo and demo video would itself **violate** the data-protection compliance this challenge demands.

Therefore, for record-level features, the only compliant options are (B) the organizer's dataset or
(C) a synthetic stand-in. We use **C** for the public prototype and design so that **B drops in
through a single ingestion layer with zero code changes**. Inside KSP's secure environment, NETRA
points at the real Data Store and every feature works identically on real records.

### How we make the synthetic stand-in trustworthy, not a "toy"
1. **Schema-faithful** to real KSP/CCTNS concepts (FIR, IPC/BNS sections, accused/victim roles,
   PS jurisdiction, MO tags, status lifecycle).
2. **Statistically anchored to real data** — synthetic FIR volumes per district are aligned to the
   *real* Karnataka 2023 totals (Tier A), so aggregate distributions match reality.
3. **Bilingual** (English + Kannada narratives) like real Karnataka FIRs.
4. **Ground-truth manifest** (`data/seed/manifest.json`) records every planted pattern so our
   analytics can be **validated to recover real structure** (see `packages/core/validate.mjs`).
5. **Clearly labelled** as synthetic everywhere it appears in the UI and repo — never presented as
   real KSP records.

## Swappability — the ingestion contract
All data access goes through `DataProvider` (see `docs/ARCHITECTURE.md` §6). Implementations:
- `LocalDataProvider` → loads the synthetic seed (dev/public demo).
- `CatalystDataProvider` → Catalyst Data Store (production / organizer dataset).
A loader maps any source (organizer CSV/DB dump, KSP Data Store) onto the canonical schema in
`packages/core/src/types.ts`. Switching sources is a config change (`NETRA_ENV`), not a rewrite.

## Real public datasets used (Tier A)
- **Karnataka District & City-wise Crimes 2023** (IPC + SLL cases) — OpenCity / Govt of Karnataka.
  Files in `data/real/`. 214,234 total cases statewide (real figure).
- District-wise IPC crime statistics — NCRB via data.gov.in.

> Citations are kept in `data/real/SOURCES.md`. If KSP provides an official dataset, it becomes the
> primary source and supersedes Tiers A/C for the deployed solution.
