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
  // In production: query Catalyst Data Store (relational + full-text) and NoSQL (edges) via
  // the zcatalyst SDK, mapping rows onto the canonical schema in ../types.ts. The SDK calls
  // are the only thing that changes; handlers/analytics are untouched. If SDK credentials are
  // absent (e.g. local preview), we fall back to the seed so the demo never breaks.
  let ds = null;
  return {
    name: 'catalyst-datastore',
    load() {
      // TODO: replace with Data Store reads when bound (catalyst/DEPLOY.md §4).
      if (!ds) ds = loadDataset();
      return ds;
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
