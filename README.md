# NETRA — Conversational Crime Intelligence Copilot
### Network-Enhanced Threat & Relationship Analytics · KSP Datathon 2026 (Problem Statement 1)

> ನೇತ್ರ (*Netra*) — "the eye." **Ask. See. Act.**
> A bilingual (English + ಕನ್ನಡ), voice-enabled conversational copilot over the KSP crime database.
> Every answer is a living visual — a hotspot map, a criminal-network graph, an offender dossier —
> with a clickable **evidence trail** back to the exact FIRs it used. Built for **Zoho Catalyst**.

---

## Why NETRA

Karnataka State Police crime data is rich but siloed. NETRA lets any officer interrogate it in
plain language — typed or spoken, in English or Kannada — and get explainable, evidence-backed,
*visual* answers in seconds. It surfaces organized-crime networks invisible in Excel, scores
repeat offenders, and forecasts where a crime series is likely to strike next.

See [`docs/MASTER_PLAN.md`](docs/MASTER_PLAN.md) and [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
for the full strategy, feature map, wow factors, and system design.

## Status

🚧 Early build. Foundation in progress (synthetic data, core types, intent router).

## Repository layout

```
docs/        strategy + architecture
data/        synthetic Karnataka crime data generator + seed output
packages/    core: shared types, intent router, analytics (graph/forecast/risk), provider adapters
apps/web/    Next.js app (chat UI + visual answer surfaces) → deploys to Catalyst AppSail
catalyst/    Catalyst deployment config (added in Week 3)
```

## Quick start (local dev)

Requires Node.js >= 20.

```bash
npm install                 # install workspaces
npm run data:generate       # generate the synthetic Karnataka crime dataset → data/seed/
npm run dev                 # start the web app (once scaffolded)
```

The synthetic dataset is privacy-safe and contains **planted patterns** (a gang ring, a near-repeat
crime series, a hotspot, a money-laundering ring, Kannada-narrative FIRs) so every analytics feature
has something real to discover. Ground-truth of those patterns is recorded in `data/seed/manifest.json`.

## Tech stack

Next.js · TypeScript · MapLibre/deck.gl · Cytoscape.js · Recharts · Catalyst Functions ·
Catalyst Data Store / NoSQL / Cache / Stratus · Catalyst QuickML (RAG + LLM Serving) · Zia LLM ·
Zia ASR/TTS + Bhashini/AI4Bharat (Kannada) · Zia AutoML · Catalyst Authentication.

## License

MIT (for the hackathon prototype).
