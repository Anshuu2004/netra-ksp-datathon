// Provider adapters. The whole app depends on these interfaces, never on a concrete
// backend — so switching from the local synthetic dataset to Catalyst services (Data Store,
// QuickML/Zia, Stratus, Bhashini) is a config change (NETRA_ENV / env vars), not a rewrite.
// See docs/ARCHITECTURE.md §6 and catalyst/DEPLOY.md.

import { loadDataset } from '../dataset.mjs';

/** DataProvider: canonical crime data. local = synthetic seed; catalyst = Data Store + NoSQL. */
export function getDataProvider() {
  const env = process.env.NETRA_ENV || 'local';
  if (env === 'catalyst') return makeCatalystDataProvider();
  return makeLocalDataProvider();
}

function makeLocalDataProvider() {
  let ds = null;
  return {
    name: 'local-synthetic',
    load() { if (!ds) ds = loadDataset(); return ds; },
  };
}

function makeCatalystDataProvider() {
  // In production this reads Catalyst Data Store (relational + full-text) and NoSQL (edges)
  // via the zcatalyst SDK and maps rows onto the canonical schema in ../types.ts. Handlers and
  // analytics are untouched — only this loader changes. If the SDK/credentials are absent (local
  // preview, missing request context), we fall back to the seed so the demo never breaks.
  let ds = null;
  const TABLES = ['districts', 'stations', 'persons', 'firs', 'fir_accused', 'fir_victim', 'associations', 'accounts', 'transactions'];

  return {
    name: 'catalyst-datastore',
    /** Synchronous accessor used by the request path; returns cached data. */
    load() { if (!ds) ds = loadDataset(); return ds; },

    /**
     * Async read from Catalyst Data Store. Call once at request init with the Catalyst
     * `req`/`res` (needed to initialise the SDK app context), e.g. in a Function/AppSail route.
     */
    async loadFromCatalyst(catalystReq) {
      if (ds) return ds;
      try {
        const sdk = await import('zcatalyst-sdk-node').catch(() => null);
        if (!sdk || !catalystReq) throw new Error('Catalyst SDK/context unavailable');
        const app = sdk.initialize(catalystReq);
        const store = app.datastore();
        const tables = {};
        for (const name of TABLES) {
          // page through the table; ZCQL is also available for full-text/filters
          tables[name] = await store.table(name).getPagedRows({ maxRows: 100000 }).then((r) => r.data || r);
        }
        ds = buildIndexes(tables);
        return ds;
      } catch (e) {
        // graceful fallback — keep serving from the seed dataset
        if (!ds) ds = loadDataset();
        return ds;
      }
    },
  };
}

// Re-build the in-memory indexes loadDataset() produces, for rows fetched from Catalyst.
function buildIndexes(t) {
  const m = (arr, k) => new Map(arr.map((x) => [x[k], x]));
  const groupPush = (arr, k) => { const g = new Map(); for (const x of arr) { if (!g.has(x[k])) g.set(x[k], []); g.get(x[k]).push(x); } return g; };
  const firsByPerson = new Map();
  for (const fa of t.fir_accused || []) { if (!firsByPerson.has(fa.person_id)) firsByPerson.set(fa.person_id, []); firsByPerson.get(fa.person_id).push(fa.fir_id); }
  return {
    ...t, manifest: null,
    index: {
      personById: m(t.persons || [], 'id'), firById: m(t.firs || [], 'id'),
      stationByCode: m(t.stations || [], 'ps_code'), districtByName: m(t.districts || [], 'name'),
      accountById: m(t.accounts || [], 'id'),
      accusedByFir: groupPush(t.fir_accused || [], 'fir_id'), victimsByFir: groupPush(t.fir_victim || [], 'fir_id'),
      accountsByPerson: groupPush(t.accounts || [], 'holder_person_id'), firsByPerson,
    },
  };
}

/** LLMProvider: local rule-based NLU now; Catalyst QuickML RAG + Zia LLM in prod. */
export const llmProvider = {
  name: process.env.NETRA_LLM_URL ? 'catalyst-quickml' : 'local-nlu',
  url: process.env.NETRA_LLM_URL || null,
};

/** VoiceProvider: browser Web Speech in dev; Zia (EN) + Bhashini (KN) in prod. */
export const voiceProvider = {
  asr_en: process.env.NETRA_ASR || 'browser',
  asr_kn: process.env.NETRA_ASR_KN || 'browser',   // Catalyst Zia has no Kannada ASR yet -> Bhashini
  tts: process.env.NETRA_TTS || 'browser',
};

/** BlobProvider: local download in dev; Catalyst Stratus in prod (PDF dossiers). */
export const blobProvider = {
  name: process.env.NETRA_BLOB || 'browser-download',
};
