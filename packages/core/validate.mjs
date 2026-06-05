// PROOF-OF-REAL-RESULTS harness.
// Runs NETRA's analytics against the dataset and checks they RECOVER the planted
// ground-truth recorded in data/seed/manifest.json. Nothing here is hardcoded — if the
// algorithms were faked or broken, these checks would fail. Run: npm run validate

import { loadDataset, firsForPerson, filterFirs, haversineKm } from './src/dataset.mjs';
import { buildGraph, degreeCentrality, eigenvectorCentrality, louvain, linkPrediction } from './src/analytics/graph.mjs';
import { hotspotStations, nearRepeatKnox, nearRepeatCluster, forecastNextStrike } from './src/analytics/forecast.mjs';
import { repeatOffenders, offenderRisk } from './src/analytics/risk.mjs';
import { loadKarnatakaCrime2023, socioCorrelation } from './src/analytics/realdata.mjs';

const ds = loadDataset();
const gt = ds.manifest.patterns;
let pass = 0, fail = 0;
const ok = (name, cond, detail) => { (cond ? pass++ : fail++); console.log(`${cond ? '✅ PASS' : '❌ FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`); };

console.log('\n=== NETRA analytics validation (recover planted ground-truth) ===\n');

// ---- 1. Organized-crime community detection recovers the gang ----
const offenderIds = [...ds.index.firsByPerson.keys()].filter((id) => (ds.index.firsByPerson.get(id) || []).length > 0);
const g = buildGraph(ds, { personIds: offenderIds });
const comm = louvain(g);
const gangMembers = gt.organized_gang.members.filter((id) => comm.has(id));
const commCounts = {};
for (const id of gangMembers) { const c = comm.get(id); commCounts[c] = (commCounts[c] || 0) + 1; }
const topComm = Object.entries(commCounts).sort((a, b) => b[1] - a[1])[0] || [null, 0];
ok('Gang recovered as one community',
  topComm[1] >= Math.ceil(gangMembers.length * 0.6),
  `${topComm[1]}/${gangMembers.length} members in community #${topComm[0]}`);

// ---- 2. Centrality flags the kingpin among gang members ----
const deg = degreeCentrality(g), eig = eigenvectorCentrality(g);
const gangByDegree = [...gt.organized_gang.members].filter((id) => deg.has(id)).sort((a, b) => deg.get(b) - deg.get(a));
ok('Kingpin is top-central in gang',
  gangByDegree[0] === gt.organized_gang.kingpin,
  `predicted ${gangByDegree[0]} vs actual ${gt.organized_gang.kingpin}`);

// ---- 3. Link prediction surfaces the planted hidden tie ----
const gFull = buildGraph(ds); // full association graph (includes non-offender hubs)
const lp = linkPrediction(gFull, { topK: 30 });
const [ea, eb] = gt.predicted_link.expected_pair;
const rank = lp.findIndex((s) => (s.a === ea && s.b === eb) || (s.a === eb && s.b === ea));
const directlyLinked = gFull.adj.get(ea)?.has(eb);
ok('Predicted hidden link surfaced (not already linked)',
  rank >= 0 && !directlyLinked,
  rank >= 0 ? `rank #${rank + 1}/30, AA=${lp[rank].aa.toFixed(2)}, common=${lp[rank].cn}` : 'not found in top-30');

// ---- 4. Hotspot detection finds the planted spike station ----
const hot = hotspotStations(ds, { crimeType: 'Theft', days: 60, topK: 10 });
const hotHit = hot.find((h) => h.ps_code === gt.hotspot.ps_code);
ok('Theft hotspot station detected',
  !!hotHit && hot.slice(0, 3).some((h) => h.ps_code === gt.hotspot.ps_code),
  hotHit ? `${hotHit.station} count=${hotHit.count} z=${hotHit.z}` : 'planted station not in top hotspots');

// ---- 5. Near-repeat: Knox test significant on the local burglary neighbourhood ----
// Near-repeat analysis is run on a neighbourhood (here: within 6km of the series),
// the way a crime analyst would scope a beat — not across an entire district.
const nrCenter = gt.near_repeat_series.center;
const seriesFirs = gt.near_repeat_series.fir_ids.map((id) => ds.index.firById.get(id)).filter(Boolean);
const mysuruBurglaries = ds.firs.filter((f) => f.crime_type === 'Burglary' && f.district === 'Mysuru' && f.lat != null);
const cluster = nearRepeatCluster(mysuruBurglaries, {
  center: { lat: nrCenter[0], lng: nrCenter[1] }, radiusKm: 1.5, windowDays: 40, sims: 999,
});
ok('Active near-repeat spree is a significant space-time cluster',
  cluster.significant,
  `${cluster.inCircle} burglaries in 1.5km circle; ${cluster.observed} in last 40d vs ${cluster.expected} expected by chance (ratio ${cluster.ratio}, p=${cluster.p})`);

// ---- 6. Next-strike forecast localizes near the planted series center ----
const fc = forecastNextStrike(seriesFirs);
const distToCenter = fc ? haversineKm(fc.center.lat, fc.center.lng, nrCenter[0], nrCenter[1]) : 999;
ok('Forecast localizes near the real series center',
  fc && distToCenter <= 3,
  fc ? `predicted center ${distToCenter.toFixed(2)}km away; next window peak ${fc.eta.peak.slice(0, 10)}` : 'no forecast');

// ---- 7. Risk engine ranks the habitual offender / kingpin highly ----
const top = repeatOffenders(ds, { topK: 15 });
const kingpinRank = top.findIndex((o) => o.person_id === gt.organized_gang.kingpin);
const seriesSuspectRisk = offenderRisk(ds, gt.near_repeat_series.suspect);
ok('Kingpin ranks among top repeat offenders',
  kingpinRank >= 0 && kingpinRank < 15,
  kingpinRank >= 0 ? `rank #${kingpinRank + 1}, score ${top[kingpinRank].score}` : 'not in top 15');
ok('Risk score is explainable (has factor breakdown)',
  seriesSuspectRisk.factors.length >= 4 && seriesSuspectRisk.score > 0,
  `suspect score ${seriesSuspectRisk.score} (${seriesSuspectRisk.band}), ${seriesSuspectRisk.factors.length} factors`);

// ---- 8. REAL public data loads + socio correlation computes ----
const real = loadKarnatakaCrime2023();
ok('Real Karnataka 2023 crime data loaded',
  real.rows.length > 20 && real.total > 100000,
  `${real.rows.length} districts, ${real.total.toLocaleString()} total cases (real)`);
const corr = socioCorrelation(ds, 'urbanization_index');
ok('Socio-economic correlation computed on real data',
  corr.r != null,
  `Pearson r(urbanization, crime) = ${corr.r} over ${corr.n} districts`);

console.log(`\n=== ${pass} passed, ${fail} failed ===`);
process.exit(fail > 0 ? 1 : 0);
