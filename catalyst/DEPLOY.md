# Deploying NETRA on Zoho Catalyst

Deployment on **Catalyst is mandatory** for the KSP Datathon. NETRA is built to deploy as a
**Catalyst AppSail** app (managed Node runtime) and to bind each capability to a Catalyst service.
This guide gives the exact steps and the service-to-feature mapping.

> The CLI binds config to *your* Catalyst project, so a few values below are placeholders you fill in
> after `catalyst login`. Templates: [`catalyst.json`](./catalyst.json), [`app-config.json`](./app-config.json).

---

## 0. Prerequisites
```bash
npm install -g zcatalyst-cli      # Catalyst CLI
catalyst login                    # opens browser; sign in with the hackathon Zoho account
node -v                           # >= 18
```

## 1. Build artefacts locally (sanity check)
```bash
npm install
npm run data:generate             # writes data/seed/*.json (also committed)
npm run validate                  # 10/10 analytics checks must pass
npm run build                     # Next.js production build of apps/web
```

## 2. Initialise the Catalyst project
```bash
catalyst init
# - Choose: AppSail (+ Functions if you split the API later)
# - Pick your project (or create "netra-ksp")
# This writes a real catalyst.json bound to your project id.
```

## 3. Deploy the web app to AppSail (managed Node runtime)
NETRA's `apps/web` is a standard Next.js app (`build` → `start`). Point AppSail at it:
```bash
catalyst appsail init      # stack: Node 20; build: npm run build; start: npm run start
catalyst deploy            # builds + uploads + returns your public URL
```
The deployed URL is your **Deployed Solution Link** for the submission. Add a custom domain + SSL
via **Catalyst Domain Mappings** if desired.

> The seed dataset ships in `data/seed/` (committed), so the deployed app has data immediately.
> `loadDataset()` resolves the seed dir relative to the app at runtime (or set `NETRA_SEED_DIR`).

## 4. Bind Catalyst services (progressive — the app runs without these, then upgrades)
NETRA uses provider adapters (`packages/core/src/providers`) selected by env vars, so you swap
local implementations for Catalyst services **without code changes**:

| NETRA capability | Catalyst service | How to enable |
|---|---|---|
| Crime data store (FIRs, persons, edges, txns, audit) | **Data Store** + **NoSQL** | Import `data/seed` into Data Store tables; set `NETRA_ENV=catalyst` |
| Grounded answers / RAG / case summaries | **QuickML** (RAG + LLM Serving + Knowledge Base) + **Zia LLM** | Create a QuickML RAG endpoint over the FIR knowledge base; set `NETRA_LLM_URL`, `NETRA_LLM_KEY` |
| Voice Q&A (English) | **Zia Services** ASR/TTS | set `NETRA_ASR=zia` |
| Voice Q&A (Kannada) | **Bhashini / AI4Bharat** (Catalyst has no Kannada ASR yet) | set `NETRA_ASR_KN=bhashini`, `BHASHINI_KEY` |
| FIR Kannada entity extraction | **AI4Bharat IndicNER** | set `NETRA_NER=indicner` |
| Forecasting / risk (tabular) | **Zia AutoML** | train model, set `NETRA_AUTOML_URL` |
| PDF dossier storage | **Stratus** (object storage) | set `NETRA_BLOB=stratus`, bucket name |
| Role-based login (4 roles) | **Catalyst Authentication** | enable Auth, wrap `/` route; set `NETRA_AUTH=catalyst` |
| API auth / throttling | **API Gateway** | front the `/api/*` routes |
| Nightly Beat Briefing | **Cron** + **Signals/Event Functions** + **Push/Mail** | schedule a cron hitting `/api/briefing`; see below |

## 5. Schedule the proactive Beat Briefing (Cron)
Create a Catalyst Cron (Cloud Scale) that runs nightly and dispatches per-station briefings:
```jsonc
// catalyst cron config (illustrative)
{
  "name": "netra-beat-briefing",
  "schedule": "0 6 * * *",                // 06:00 IST daily
  "target": { "type": "function", "name": "beatBriefing" }
}
```
`beatBriefing` calls `generateBriefing(ds, { district })` for each district and pushes the result
via **Catalyst Mail / Push Notifications**. The same data renders at `/briefing` in the UI.

## 6. CI/CD (optional)
Use **Catalyst Pipelines** to run `npm ci && npm run validate && npm run build && catalyst deploy`
on push, so every commit redeploys with the analytics regression suite gating it.

---

## Validity checklist (submission)
- [x] Deployed exclusively on Catalyst (AppSail).
- [x] Catalyst services used for matching capabilities (Data Store, QuickML/Zia, Auth, Stratus, Cron…).
- [x] Third-party only where Catalyst has no equivalent (Bhashini for Kannada ASR — documented).
- [x] Public URL live and reachable before the deadline (26 Jul 2026, 23:59 IST).
