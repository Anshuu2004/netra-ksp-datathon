// End-to-end conversational demo over the terminal. Proves: question -> intent -> engine
// -> AnswerEnvelope (narration EN+KN + visual surface + evidence trail).
//   node packages/core/ask.mjs                 (runs the scripted demo)
//   node packages/core/ask.mjs "your question" (ask one thing)

import { loadDataset } from './src/dataset.mjs';
import { ask, getAuditLog } from './src/intents/router.mjs';

const ds = loadDataset();
const gt = ds.manifest.patterns;
const kingpin = ds.index.personById.get(gt.organized_gang.kingpin);
const seriesFir = gt.near_repeat_series.fir_ids[0];

const scripted = [
  'Show chain-snatching hotspots in Bengaluru in the last 6 months',
  'Find the organized gang operating in Bengaluru',
  `Tell me about ${kingpin.full_name}`,
  `What is the risk score for ${kingpin.full_name}?`,
  `Show the network of ${kingpin.full_name}`,
  'Where will the next burglary strike in Mysuru?',
  `Summarise ${seriesFir}`,
  'Top repeat offenders in Mysuru',
  'Trace the money trail for the laundering ring',
  'Correlate crime with urbanisation',
  'Burglary trend in Mysuru',
];

const queries = process.argv.slice(2).length ? [process.argv.slice(2).join(' ')] : scripted;

for (const q of queries) {
  const r = ask(ds, q, { role: 'investigator', user_id: 'demo' });
  console.log('\n──────────────────────────────────────────────────────────');
  console.log(`🗣️  ${q}`);
  console.log(`🎯 intent: ${r.intent}  (confidence ${r.evidence.confidence})`);
  console.log(`🇬🇧 ${r.narration_en}`);
  console.log(`🇮🇳 ${r.narration_kn}`);
  console.log(`📊 surface: ${r.surface.kind}${r.surface.kind === 'graph' ? ` (${r.surface.nodes.length} nodes, ${r.surface.edges.length} edges)` : r.surface.kind === 'table' ? ` (${r.surface.rows.length} rows)` : r.surface.kind === 'map' ? ` (${r.surface.points.length} points, ${(r.surface.riskZones || []).length} zones)` : r.surface.kind === 'chart' ? ` (${r.surface.series[0].points.length} pts)` : ''}`);
  console.log(`🔍 evidence: ${r.evidence.fir_ids.length} FIR refs | ${r.evidence.query}`);
  console.log(`➡️  follow-ups: ${r.followups.filter(Boolean).join(' · ')}`);
}

console.log(`\n=== ${queries.length} turns answered. Audit log entries: ${getAuditLog().length} ===`);
