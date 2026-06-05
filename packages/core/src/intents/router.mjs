// Intent router + capability handlers. Each handler calls the proven analytics engine and
// returns a uniform AnswerEnvelope { intent, narration_en, narration_kn, surface, evidence,
// followups }. The Trust panel renders `evidence`; the UI renders `surface`; TTS speaks
// narration. An immutable audit entry is written per turn (governance, PS1 §10).

import { firsForPerson, filterFirs, haversineKm } from '../dataset.mjs';
import { buildGraph, degreeCentrality, eigenvectorCentrality, louvain, linkPrediction } from '../analytics/graph.mjs';
import { hotspotStations, kdeGrid, nearRepeatCluster, forecastNextStrike } from '../analytics/forecast.mjs';
import { offenderRisk, repeatOffenders } from '../analytics/risk.mjs';
import { socioCorrelation } from '../analytics/realdata.mjs';
import { understand } from './nlu.mjs';

const CRIME_KN = {
  'Theft': 'ಕಳ್ಳತನ', 'Burglary': 'ಮನೆ ಕಳ್ಳತನ', 'Chain Snatching': 'ಸರ ಕಳ್ಳತನ', 'Robbery': 'ದರೋಡೆ',
  'Motor Vehicle Theft': 'ವಾಹನ ಕಳ್ಳತನ', 'Cyber Fraud': 'ಸೈಬರ್ ವಂಚನೆ', 'Murder': 'ಕೊಲೆ', 'Assault': 'ಹಲ್ಲೆ',
  'Extortion': 'ಸುಲಿಗೆ', 'Kidnapping': 'ಅಪಹರಣ', 'NDPS / Drugs': 'ಮಾದಕ ವಸ್ತು', 'Money Laundering': 'ಹಣ ಅಕ್ರಮ',
  'Cheating': 'ವಂಚನೆ',
};
const DISTRICT_KN = {
  'Bengaluru Urban': 'ಬೆಂಗಳೂರು', 'Mysuru': 'ಮೈಸೂರು', 'Hubballi': 'ಹುಬ್ಬಳ್ಳಿ', 'Dakshina Kannada': 'ದಕ್ಷಿಣ ಕನ್ನಡ',
};
const knCrime = (c) => CRIME_KN[c] || c;
const knArea = (a) => (a ? DISTRICT_KN[a] || a : 'ರಾಜ್ಯದಾದ್ಯಂತ');
const fmtDate = (iso) => new Date(iso).toISOString().slice(0, 10);
const inr = (n) => '₹' + Number(n).toLocaleString('en-IN');

const _audit = [];
export const getAuditLog = () => _audit.slice();

function personLabel(ds, id) {
  const p = ds.index.personById.get(id);
  return p ? { name: p.full_name, name_kn: p.full_name_kn } : { name: id, name_kn: id };
}

// ---------------------------------------------------------------- handlers
function hSearchFirs(ds, slots) {
  const firs = filterFirs(ds, slots).sort((a, b) => new Date(b.occurred_at) - new Date(a.occurred_at));
  const top = firs.slice(0, 50);
  const where = slots.area || 'Karnataka';
  const what = slots.crimeType || 'crime';
  return {
    narration_en: `Found ${firs.length} ${what} record(s) in ${where}${slots.days ? ` in the last ${slots.days} days` : ''}.`,
    narration_kn: `${knArea(slots.area)}ದಲ್ಲಿ ${firs.length} ${knCrime(slots.crimeType || 'ಅಪರಾಧ')} ಪ್ರಕರಣಗಳು ಕಂಡುಬಂದಿವೆ.`,
    surface: {
      kind: 'table',
      columns: [
        { key: 'id', label: 'FIR' }, { key: 'crime_type', label: 'Crime' },
        { key: 'district', label: 'District' }, { key: 'occurred', label: 'Date' },
        { key: 'status', label: 'Status' },
      ],
      rows: top.map((f) => ({ id: f.id, crime_type: f.crime_type, district: f.district, occurred: fmtDate(f.occurred_at), status: f.status })),
    },
    evidence: {
      fir_ids: top.slice(0, 20).map((f) => f.id),
      query: `filter FIRs where crime=${what}, area=${where}, window=${slots.days || 'all'}d`,
      confidence: 0.9,
      reasoning_path: [
        { step: 'Parse', detail: `crime=${what}, area=${where}, time=${slots.days || 'all'}` },
        { step: 'Retrieve', detail: `${firs.length} matching FIRs from Data Store` },
      ],
    },
    followups: [`Show ${what} hotspots in ${where}`, `Who are the repeat offenders in ${where}?`, slots.crimeType ? `${what} trend over time` : 'Break down by crime type'],
  };
}

function hRetrieveFir(ds, slots) {
  const f = ds.index.firById.get(slots.firId);
  if (!f) return abstain(`I couldn't find ${slots.firId} in the database.`);
  const accused = (ds.index.accusedByFir.get(f.id) || []).map((a) => ({ ...personLabel(ds, a.person_id), role: a.role, arrest: a.arrest_status }));
  const victims = (ds.index.victimsByFir.get(f.id) || []).map((v) => personLabel(ds, v.person_id));
  return {
    narration_en: `${f.id}: ${f.crime_type} at ${f.district} on ${fmtDate(f.occurred_at)}. Status: ${f.status}. ${accused.length} accused, ${victims.length} victim(s).`,
    narration_kn: `${f.id}: ${knArea(f.district)}ದಲ್ಲಿ ${knCrime(f.crime_type)} ಪ್ರಕರಣ. ಸ್ಥಿತಿ: ${f.status}.`,
    surface: {
      kind: 'card', title: `${f.id} — ${f.crime_type}`,
      fields: [
        { label: 'District / PS', value: `${f.district} (${f.ps_code})` },
        { label: 'Occurred', value: fmtDate(f.occurred_at) }, { label: 'Reported', value: fmtDate(f.reported_at) },
        { label: 'Sections', value: f.ipc_bns_sections.join(', ') }, { label: 'Status', value: f.status },
        { label: 'MO', value: f.mo_tags.join(', ') }, { label: 'Loss', value: f.value_loss ? inr(f.value_loss) : '—' },
        { label: 'Accused', value: accused.map((a) => `${a.name} (${a.arrest})`).join('; ') || '—' },
        { label: 'Narrative', value: f.narrative_kn ? `${f.narrative_en}\n${f.narrative_kn}` : f.narrative_en },
      ],
    },
    evidence: { fir_ids: [f.id], query: `getFir(${f.id})`, confidence: 0.99, reasoning_path: [{ step: 'Lookup', detail: `direct record fetch for ${f.id}`, refs: [f.id] }] },
    followups: [`Summarise ${f.id}`, `Find cases similar to ${f.id}`, accused[0] ? `Show network of ${accused[0].name}` : 'Show location on map'],
  };
}

function hHotspot(ds, slots) {
  const days = slots.days || 90;
  const hot = hotspotStations(ds, { crimeType: slots.crimeType, days, topK: 8 });
  const incidents = filterFirs(ds, { crimeType: slots.crimeType, area: slots.area, days });
  const top = hot[0];
  const grid = kdeGrid(incidents, { bandwidthKm: 1.5 });
  return {
    narration_en: top
      ? `Top ${slots.crimeType || 'crime'} hotspot: ${top.station} (${top.count} incidents, ${top.spike ? 'a significant spike' : 'elevated'}, z=${top.z}) in the last ${days} days.`
      : `No notable ${slots.crimeType || 'crime'} hotspots in the last ${days} days.`,
    narration_kn: top ? `${knArea(top.district)}ದ ${top.station} ${knCrime(slots.crimeType || 'ಅಪರಾಧ')} ತಾಣವಾಗಿದೆ (${top.count} ಪ್ರಕರಣಗಳು).` : 'ಯಾವುದೇ ಪ್ರಮುಖ ತಾಣ ಕಂಡುಬಂದಿಲ್ಲ.',
    surface: {
      kind: 'map',
      points: incidents.slice(0, 400).map((f) => ({ lat: f.lat, lng: f.lng, fir_id: f.id, kind: 'incident', label: f.crime_type })),
      riskZones: hot.filter((h) => h.lat).slice(0, 5).map((h) => ({ lat: h.lat, lng: h.lng, radius_km: 1.5, intensity: Math.min(1, h.count / (hot[0].count || 1)), window: `${h.count} in ${days}d` })),
      center: top && top.lat ? { lat: top.lat, lng: top.lng, zoom: 11 } : undefined,
      _grid: grid.cells.slice(0, 600),
    },
    evidence: {
      fir_ids: incidents.slice(0, 20).map((f) => f.id),
      query: `hotspotStations(crime=${slots.crimeType || 'all'}, window=${days}d) + KDE`,
      confidence: 0.88,
      reasoning_path: [
        { step: 'Aggregate', detail: `${incidents.length} incidents by station over ${days}d` },
        { step: 'Score', detail: `z-score vs station mean; KDE surface (bw 1.5km)` },
        { step: 'Rank', detail: top ? `${top.station} highest (z=${top.z})` : 'no spike' },
      ],
    },
    followups: top ? [`Who operates around ${top.station}?`, `Where will the next ${slots.crimeType || 'incident'} strike?`, `${slots.crimeType || 'Crime'} trend in ${top.district}`] : ['Show all crime trends'],
  };
}

function hForecast(ds, slots) {
  const crime = slots.crimeType || 'Burglary';
  const pool = filterFirs(ds, { crimeType: crime, area: slots.area });
  // find densest recent 1.5km cluster
  const recent = pool.filter((f) => (Date.now() - new Date(f.occurred_at)) / 86400000 <= 60 && f.lat != null);
  let seed = null, bestN = 0;
  for (const f of recent) {
    const n = recent.filter((g) => haversineKm(f.lat, f.lng, g.lat, g.lng) <= 1.5).length;
    if (n > bestN) { bestN = n; seed = f; }
  }
  if (!seed || bestN < 3) return abstain(`Not enough recent ${crime.toLowerCase()} activity ${slots.area ? 'in ' + slots.area : ''} to forecast a series.`);
  const series = pool.filter((g) => haversineKm(seed.lat, seed.lng, g.lat, g.lng) <= 1.5);
  const cluster = nearRepeatCluster(pool, { center: { lat: seed.lat, lng: seed.lng }, radiusKm: 1.5, windowDays: 40, sims: 499 });
  const fc = forecastNextStrike(series.filter((g) => (Date.now() - new Date(g.occurred_at)) / 86400000 <= 60));
  const st = ds.index.stationByCode.get(seed.ps_code);
  return {
    narration_en: `Active near-repeat ${crime.toLowerCase()} series near ${st ? st.name : seed.district} — ${cluster.observed} incidents in 1.5km in 40 days vs ${cluster.expected} expected (ratio ${cluster.ratio}, p=${cluster.p}). Predicted next window: ${fc ? fmtDate(fc.eta.start) + ' to ' + fmtDate(fc.eta.end) : 'n/a'}.`,
    narration_kn: `${knArea(seed.district)}ದಲ್ಲಿ ${knCrime(crime)} ಸರಣಿ ಸಕ್ರಿಯವಾಗಿದೆ. ಮುಂದಿನ ಸಂಭವನೀಯ ಅವಧಿ: ${fc ? fmtDate(fc.eta.peak) : 'ಲಭ್ಯವಿಲ್ಲ'} ಸುತ್ತಮುತ್ತ.`,
    surface: {
      kind: 'map',
      points: series.map((f) => ({ lat: f.lat, lng: f.lng, fir_id: f.id, kind: 'incident', label: fmtDate(f.occurred_at) })),
      riskZones: fc ? [{ lat: fc.center.lat, lng: fc.center.lng, radius_km: fc.radiusKm, intensity: 1, window: `${fmtDate(fc.eta.start)}–${fmtDate(fc.eta.end)}` }] : [],
      center: { lat: seed.lat, lng: seed.lng, zoom: 13 },
    },
    evidence: {
      fir_ids: series.slice(0, 20).map((f) => f.id),
      query: `near-repeat scan + next-strike forecast (crime=${crime})`,
      confidence: cluster.significant ? 0.85 : 0.6,
      reasoning_path: [
        { step: 'Detect cluster', detail: `densest 1.5km cluster = ${series.length} incidents` },
        { step: 'Significance', detail: `space-time scan: observed ${cluster.observed} vs expected ${cluster.expected}, p=${cluster.p}` },
        { step: 'Forecast', detail: fc ? `recency-weighted centroid; mean interval ${fc.avgIntervalDays}d` : 'insufficient series' },
      ],
    },
    followups: [`Who are the repeat ${crime.toLowerCase()} offenders here?`, 'Send a beat briefing alert', 'Show the network behind this series'],
  };
}

function offenderSubgraph(ds) {
  const offenderIds = [...ds.index.firsByPerson.keys()];
  return { offenderIds, g: buildGraph(ds, { personIds: offenderIds }) };
}

function hDetectOrgCrime(ds, slots) {
  const { g } = offenderSubgraph(ds);
  if (g.nodes.length === 0) return abstain('No association network available.');
  const comm = louvain(g);
  const deg = degreeCentrality(g);
  // restrict candidates to the requested area if any
  const inArea = (id) => {
    if (!slots.area) return true;
    const p = ds.index.personById.get(id);
    return p && (p.district === slots.area || firsForPerson(ds, id).some((f) => f.district === slots.area));
  };
  const groups = new Map();
  for (const [id, c] of comm) { if (!inArea(id)) continue; if (!groups.has(c)) groups.set(c, []); groups.get(c).push(id); }
  // pick the most strongly-connected sizable community (favour larger real groups,
  // not a tiny dense triangle): score by internal edges + size.
  let best = null;
  for (const [, members] of groups) {
    if (members.length < 3) continue;
    const set = new Set(members);
    let internal = 0;
    for (const m of members) for (const n of g.adj.get(m).keys()) if (set.has(n)) internal++;
    const density = internal / (members.length * (members.length - 1));
    const score = internal + members.length;
    if (!best || score > best.score) best = { members, density, score };
  }
  if (!best) return abstain(`No organized group detected${slots.area ? ' in ' + slots.area : ''}.`);
  const members = best.members.sort((a, b) => deg.get(b) - deg.get(a));
  const kingpin = members[0];
  const lp = linkPrediction(g, { topK: 30, personIds: members });
  const predicted = lp.filter((s) => members.includes(s.a) && members.includes(s.b)).slice(0, 3);
  const k = personLabel(ds, kingpin);
  return {
    narration_en: `Detected an organized group of ${members.length} offenders${slots.area ? ' in ' + slots.area : ''}. Likely kingpin: ${k.name} (most central, ${deg.get(kingpin)} links). ${predicted.length} suspected hidden tie(s) flagged.`,
    narration_kn: `${members.length} ಆರೋಪಿಗಳ ಸಂಘಟಿತ ಗುಂಪು ಪತ್ತೆಯಾಗಿದೆ. ಮುಖ್ಯಸ್ಥ: ${k.name_kn}.`,
    surface: communityGraph(ds, g, members, comm, deg, predicted, kingpin),
    evidence: {
      fir_ids: [...new Set(members.flatMap((m) => (ds.index.firsByPerson.get(m) || [])))].slice(0, 20),
      query: `Louvain community detection + centrality + link prediction on offender graph`,
      confidence: 0.84,
      reasoning_path: [
        { step: 'Build graph', detail: `${g.nodes.length} offenders, association edges` },
        { step: 'Community detection', detail: `Louvain → group of ${members.length} (density ${best.density.toFixed(2)})` },
        { step: 'Centrality', detail: `kingpin ${k.name} ranked top` },
        { step: 'Link prediction', detail: `${predicted.length} suspected hidden tie(s)` },
      ],
    },
    followups: [`Show ${k.name}'s criminal history`, `Money trail for this group`, `Risk score for ${k.name}`],
  };
}

function hNetwork(ds, slots) {
  if (!slots.personRef) return clarify('Whose network should I explore? Name a person or FIR.');
  const { g } = offenderSubgraph(ds);
  // BFS depth 2
  const start = slots.personRef;
  const seen = new Set([start]); let frontier = [start];
  for (let d = 0; d < 2; d++) {
    const next = [];
    for (const id of frontier) for (const n of (g.adj.get(id)?.keys() || [])) if (!seen.has(n)) { seen.add(n); next.push(n); }
    frontier = next;
  }
  const members = [...seen];
  const deg = degreeCentrality(g);
  const comm = louvain(g);
  const lp = linkPrediction(g, { topK: 30, personIds: members }).slice(0, 4);
  const me = personLabel(ds, start);
  return {
    narration_en: `${me.name} is connected to ${members.length - 1} other individual(s) within 2 hops. ${lp.length} suspected hidden link(s) suggested.`,
    narration_kn: `${me.name_kn} ${members.length - 1} ವ್ಯಕ್ತಿಗಳೊಂದಿಗೆ ಸಂಪರ್ಕ ಹೊಂದಿದ್ದಾರೆ.`,
    surface: communityGraph(ds, g, members, comm, deg, lp.filter((s) => members.includes(s.a) && members.includes(s.b)), start),
    evidence: {
      fir_ids: (ds.index.firsByPerson.get(start) || []).slice(0, 10),
      query: `2-hop ego network of ${start} + link prediction`,
      confidence: 0.8,
      reasoning_path: [
        { step: 'Ego network', detail: `BFS depth 2 from ${me.name}` },
        { step: 'Link prediction', detail: `${lp.length} candidate hidden ties (Adamic-Adar)` },
      ],
    },
    followups: [`Is ${me.name} part of an organized gang?`, `Risk score for ${me.name}`, `Criminal history of ${me.name}`],
  };
}

function communityGraph(ds, g, members, comm, deg, predicted, focus) {
  const set = new Set(members);
  const nodes = members.map((id) => {
    const p = ds.index.personById.get(id);
    return {
      id, label: p ? p.full_name : id, kind: 'person',
      group: comm.get(id) ?? 0, centrality: deg.get(id) || 0,
      flags: [focus === id ? 'focus' : null, id === members[0] ? 'kingpin' : null].filter(Boolean),
    };
  });
  const edges = [];
  const seen = new Set();
  for (const a of members) for (const [b, w] of (g.adj.get(a) || [])) {
    if (!set.has(b)) continue;
    const key = [a, b].sort().join('|'); if (seen.has(key)) continue; seen.add(key);
    edges.push({ source: a, target: b, type: 'association', weight: w });
  }
  for (const s of (predicted || [])) edges.push({ source: s.a, target: s.b, type: 'predicted', predicted: true, score: Number(s.aa.toFixed(2)) });
  return { kind: 'graph', nodes, edges, communities: Object.fromEntries(members.map((id) => [id, comm.get(id) ?? 0])) };
}

function hRepeatOffenders(ds, slots) {
  const list = repeatOffenders(ds, { area: slots.area, crimeType: slots.crimeType, topK: 10 });
  if (list.length === 0) return abstain(`No repeat offenders found${slots.area ? ' in ' + slots.area : ''}.`);
  return {
    narration_en: `Top repeat offender${slots.area ? ' in ' + slots.area : ''}: ${list[0].name} — risk ${list[0].score}/100 (${list[0].band}), ${list[0].factors.find((f) => f.name === 'Prior offences')?.detail}.`,
    narration_kn: `ಅತಿ ಹೆಚ್ಚು ಅಪಾಯಕಾರಿ ಪುನರಾವರ್ತಿತ ಅಪರಾಧಿ: ${list[0].name_kn} (ಅಪಾಯ ಅಂಕ ${list[0].score}/100).`,
    surface: {
      kind: 'table',
      columns: [
        { key: 'rank', label: '#' }, { key: 'name', label: 'Offender' }, { key: 'score', label: 'Risk' },
        { key: 'band', label: 'Band' }, { key: 'priors', label: 'Priors' }, { key: 'mo', label: 'MO' },
      ],
      rows: list.map((o, i) => ({ rank: i + 1, name: o.name, score: o.score, band: o.band, priors: o.factors.find((f) => f.name === 'Prior offences')?.detail || '', mo: o.mo_fingerprint.slice(0, 3).join(', ') })),
    },
    evidence: {
      fir_ids: (ds.index.firsByPerson.get(list[0].person_id) || []).slice(0, 10),
      query: `rank persons with >=2 priors by explainable risk (area=${slots.area || 'all'}, crime=${slots.crimeType || 'all'})`,
      confidence: 0.85,
      reasoning_path: [{ step: 'Filter', detail: 'persons with 2+ linked FIRs' }, { step: 'Score', detail: 'weighted: priors, recency, severity, centrality, absconding' }, { step: 'Rank', detail: `${list.length} offenders` }],
    },
    followups: [`Risk breakdown for ${list[0].name}`, `Show ${list[0].name}'s network`, `Criminal history of ${list[0].name}`],
  };
}

function hOffenderRisk(ds, slots) {
  if (!slots.personRef) return clarify('Whose risk score do you want? Name a person or FIR.');
  const r = offenderRisk(ds, slots.personRef);
  return {
    narration_en: `${r.name}: risk ${r.score}/100 (${r.band}). Top driver: ${r.factors[0].name} — ${r.factors[0].detail}.`,
    narration_kn: `${r.name_kn}: ಅಪಾಯ ಅಂಕ ${r.score}/100 (${r.band}).`,
    surface: {
      kind: 'chart', chartType: 'bar', xLabel: 'Risk factor', yLabel: 'Contribution',
      series: [{ name: `${r.name} — risk ${r.score}/100 (${r.band})`, points: r.factors.map((f) => ({ x: f.name, y: f.contribution })) }],
    },
    evidence: {
      fir_ids: (ds.index.firsByPerson.get(slots.personRef) || []).slice(0, 10),
      query: `offenderRisk(${slots.personRef})`,
      confidence: 0.85,
      reasoning_path: r.factors.map((f) => ({ step: f.name, detail: `${f.detail} → +${Math.round(f.contribution)}` })),
    },
    followups: [`Show ${r.name}'s network`, `Criminal history of ${r.name}`, 'Compare with other repeat offenders'],
  };
}

function hPersonProfile(ds, slots) {
  if (!slots.personRef) return clarify('Which person? Give a name or person ID.');
  const p = ds.index.personById.get(slots.personRef);
  if (!p) return abstain(`No record for ${slots.personRef}.`);
  const firs = firsForPerson(ds, p.id);
  const r = offenderRisk(ds, p.id);
  return {
    narration_en: `${p.full_name}, ${p.age}/${p.gender}, ${p.occupation}, ${p.district}. ${firs.length} linked FIR(s); risk ${r.score}/100 (${r.band}).`,
    narration_kn: `${p.full_name_kn}, ${p.age} ವರ್ಷ, ${knArea(p.district)}. ${firs.length} ಪ್ರಕರಣಗಳು; ಅಪಾಯ ${r.score}/100.`,
    surface: {
      kind: 'card', title: `${p.full_name} (${p.id})`,
      fields: [
        { label: 'Kannada', value: p.full_name_kn }, { label: 'Age / Gender', value: `${p.age} / ${p.gender}` },
        { label: 'District', value: p.district }, { label: 'Occupation', value: p.occupation },
        { label: 'Socio-economic', value: p.socio_economic_band }, { label: 'Repeat offender', value: p.is_repeat_offender ? 'Yes' : 'No' },
        { label: 'Risk', value: `${r.score}/100 (${r.band})` }, { label: 'MO fingerprint', value: r.mo_fingerprint.join(', ') || '—' },
        { label: 'Linked FIRs', value: firs.map((f) => f.id).join(', ') || '—' },
      ],
    },
    evidence: { fir_ids: firs.map((f) => f.id).slice(0, 15), query: `getPerson(${p.id}) + risk`, confidence: 0.9, reasoning_path: [{ step: 'Profile', detail: `record + ${firs.length} FIRs`, refs: firs.map((f) => f.id).slice(0, 10) }] },
    followups: [`Criminal history of ${p.full_name}`, `Risk breakdown for ${p.full_name}`, `Show ${p.full_name}'s network`],
  };
}

function hCriminalHistory(ds, slots) {
  if (!slots.personRef) return clarify('Whose criminal history?');
  const p = ds.index.personById.get(slots.personRef);
  const firs = firsForPerson(ds, slots.personRef).sort((a, b) => new Date(a.occurred_at) - new Date(b.occurred_at));
  if (firs.length === 0) return abstain(`${p ? p.full_name : slots.personRef} has no linked FIRs.`);
  return {
    narration_en: `${p.full_name} has ${firs.length} linked FIR(s) from ${fmtDate(firs[0].occurred_at)} to ${fmtDate(firs[firs.length - 1].occurred_at)}.`,
    narration_kn: `${p.full_name_kn} ${firs.length} ಪ್ರಕರಣಗಳಲ್ಲಿ ಭಾಗಿಯಾಗಿದ್ದಾರೆ.`,
    surface: {
      kind: 'table',
      columns: [{ key: 'date', label: 'Date' }, { key: 'crime', label: 'Crime' }, { key: 'district', label: 'District' }, { key: 'status', label: 'Status' }, { key: 'id', label: 'FIR' }],
      rows: firs.map((f) => ({ date: fmtDate(f.occurred_at), crime: f.crime_type, district: f.district, status: f.status, id: f.id })),
    },
    evidence: { fir_ids: firs.map((f) => f.id), query: `firsForPerson(${slots.personRef}) ordered by date`, confidence: 0.92, reasoning_path: [{ step: 'Timeline', detail: `${firs.length} FIRs chronologically` }] },
    followups: [`Risk score for ${p.full_name}`, `Show ${p.full_name}'s network`, `Find cases similar to ${firs[firs.length - 1].id}`],
  };
}

function hMoSimilarity(ds, slots) {
  let ref = slots.firId ? ds.index.firById.get(slots.firId) : null;
  if (!ref && slots.personRef) { const fs = firsForPerson(ds, slots.personRef); ref = fs[fs.length - 1]; }
  if (!ref) return clarify('Which case should I match? Give an FIR number.');
  const refTags = new Set(ref.mo_tags);
  const scored = ds.firs.filter((f) => f.id !== ref.id).map((f) => {
    const tags = new Set(f.mo_tags);
    const inter = [...tags].filter((x) => refTags.has(x)).length;
    const union = new Set([...tags, ...refTags]).size;
    const jac = union ? inter / union : 0;
    const sim = 0.6 * jac + (f.crime_type === ref.crime_type ? 0.4 : 0);
    return { f, sim };
  }).filter((x) => x.sim > 0.2).sort((a, b) => b.sim - a.sim).slice(0, 10);
  return {
    narration_en: `Found ${scored.length} case(s) with MO similar to ${ref.id} (${ref.crime_type}; MO: ${ref.mo_tags.join(', ')}).`,
    narration_kn: `${ref.id} ರೀತಿಯ ಕಾರ್ಯವೈಖರಿಯ ${scored.length} ಪ್ರಕರಣಗಳು ಸಿಕ್ಕಿವೆ.`,
    surface: {
      kind: 'table',
      columns: [{ key: 'id', label: 'FIR' }, { key: 'crime', label: 'Crime' }, { key: 'sim', label: 'Similarity' }, { key: 'district', label: 'District' }, { key: 'status', label: 'Status' }],
      rows: scored.map((x) => ({ id: x.f.id, crime: x.f.crime_type, sim: (x.sim * 100).toFixed(0) + '%', district: x.f.district, status: x.f.status })),
    },
    evidence: { fir_ids: [ref.id, ...scored.map((x) => x.f.id)].slice(0, 20), query: `MO Jaccard similarity vs ${ref.id}`, confidence: 0.78, reasoning_path: [{ step: 'Reference MO', detail: ref.mo_tags.join(', '), refs: [ref.id] }, { step: 'Compare', detail: 'Jaccard(MO) + crime-type match across all FIRs' }] },
    followups: [`Summarise ${ref.id}`, scored[0] ? `Are ${ref.id} and ${scored[0].f.id} linked?` : 'Show on map', 'Cluster these by location'],
  };
}

function hCaseSummary(ds, slots) {
  const f = slots.firId ? ds.index.firById.get(slots.firId) : null;
  if (!f) return clarify('Which case should I summarise? Give an FIR number.');
  const accused = (ds.index.accusedByFir.get(f.id) || []).map((a) => personLabel(ds, a.person_id).name);
  const summary = `${f.crime_type} (${f.ipc_bns_sections.join(', ')}) reported at ${f.district} (${f.ps_code}) on ${fmtDate(f.occurred_at)}; reported ${fmtDate(f.reported_at)}. MO: ${f.mo_tags.join(', ')}. ${accused.length ? 'Accused: ' + accused.join(', ') + '.' : 'No accused identified yet.'} ${f.value_loss ? 'Loss ' + inr(f.value_loss) + '.' : ''} Current status: ${f.status}.`;
  return {
    narration_en: summary,
    narration_kn: `${f.id} ಸಾರಾಂಶ: ${knArea(f.district)}ದಲ್ಲಿ ${knCrime(f.crime_type)}; ಸ್ಥಿತಿ ${f.status}.`,
    surface: { kind: 'card', title: `Case summary — ${f.id}`, fields: [{ label: 'Summary', value: summary }, { label: 'MO', value: f.mo_tags.join(', ') }, { label: 'Status', value: f.status }] },
    evidence: { fir_ids: [f.id], query: `summarise(${f.id})`, confidence: 0.9, reasoning_path: [{ step: 'Synthesise', detail: 'structured fields → narrative', refs: [f.id] }] },
    followups: [`Find cases similar to ${f.id}`, accused[0] ? `Network of ${accused[0]}` : 'Show location', 'Suggest investigative leads'],
  };
}

function hTrend(ds, slots) {
  const months = 18;
  const now = new Date();
  const buckets = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({ key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, y: 0 });
  }
  const idx = new Map(buckets.map((b, i) => [b.key, i]));
  for (const f of filterFirs(ds, { crimeType: slots.crimeType, area: slots.area })) {
    const d = new Date(f.occurred_at); const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (idx.has(key)) buckets[idx.get(key)].y++;
  }
  const firstHalf = buckets.slice(0, 9).reduce((s, b) => s + b.y, 0), secondHalf = buckets.slice(9).reduce((s, b) => s + b.y, 0);
  const dir = secondHalf > firstHalf * 1.1 ? 'rising' : secondHalf < firstHalf * 0.9 ? 'falling' : 'stable';
  return {
    narration_en: `${slots.crimeType || 'Crime'} trend${slots.area ? ' in ' + slots.area : ''} over ${months} months is ${dir} (${firstHalf} → ${secondHalf}).`,
    narration_kn: `${knArea(slots.area)}ದಲ್ಲಿ ${knCrime(slots.crimeType || 'ಅಪರಾಧ')} ಪ್ರವೃತ್ತಿ: ${dir === 'rising' ? 'ಏರಿಕೆ' : dir === 'falling' ? 'ಇಳಿಕೆ' : 'ಸ್ಥಿರ'}.`,
    surface: { kind: 'chart', chartType: 'line', xLabel: 'Month', yLabel: 'Incidents', series: [{ name: `${slots.crimeType || 'All crime'}${slots.area ? ' — ' + slots.area : ''}`, points: buckets.map((b) => ({ x: b.key, y: b.y })) }] },
    evidence: { fir_ids: [], query: `monthly counts (crime=${slots.crimeType || 'all'}, area=${slots.area || 'all'})`, confidence: 0.85, reasoning_path: [{ step: 'Bucket', detail: `${months} monthly bins` }, { step: 'Trend', detail: `first half ${firstHalf} vs second half ${secondHalf} → ${dir}` }] },
    followups: [`Show ${slots.crimeType || 'crime'} hotspots`, 'Is this seasonal?', `Forecast next ${slots.crimeType || 'crime'} hotspot`],
  };
}

function hSocio(ds, slots) {
  const t = (slots._text || '').toLowerCase();
  const indicator = t.includes('literacy') ? 'literacy_rate' : t.includes('unemploy') ? 'unemployment_proxy' : 'urbanization_index';
  const corr = socioCorrelation(ds, indicator);
  const label = { urbanization_index: 'urbanisation', literacy_rate: 'literacy', unemployment_proxy: 'unemployment' }[indicator];
  return {
    narration_en: corr.r != null
      ? `Correlation between district ${label} and REAL 2023 crime totals: Pearson r = ${corr.r} across ${corr.n} districts.`
      : `Not enough matched districts to correlate ${label}.`,
    narration_kn: `ಜಿಲ್ಲಾ ${label === 'literacy' ? 'ಸಾಕ್ಷರತೆ' : label === 'unemployment' ? 'ನಿರುದ್ಯೋಗ' : 'ನಗರೀಕರಣ'} ಮತ್ತು ನೈಜ ಅಪರಾಧ ಸಂಖ್ಯೆ: r = ${corr.r}.`,
    surface: { kind: 'chart', chartType: 'scatter', xLabel: label, yLabel: 'Real 2023 crimes', series: [{ name: `${label} vs crime (r=${corr.r})`, points: (corr.points || []).map((p) => ({ x: p.x, y: p.y })) }] },
    evidence: { fir_ids: [], query: `Pearson correlation: district ${indicator} vs real Karnataka 2023 crime totals`, confidence: 0.8, reasoning_path: [{ step: 'Real data', detail: corr.source || 'OpenCity/NCRB 2023' }, { step: 'Correlate', detail: `r=${corr.r} over ${corr.n} districts` }] },
    followups: ['Correlate with literacy instead', 'Correlate with unemployment', 'Show district crime trend'],
  };
}

function hMoneyTrail(ds, slots) {
  // resolve a focus account set
  let accounts = [];
  if (slots.personRef) accounts = ds.index.accountsByPerson.get(slots.personRef) || [];
  if (accounts.length === 0) {
    // fall back to the account receiving the most structuring-flagged inflows
    const inflow = new Map();
    for (const tx of ds.transactions) if (tx.flagged_reason) inflow.set(tx.to_account, (inflow.get(tx.to_account) || 0) + 1);
    const master = [...inflow.entries()].sort((a, b) => b[1] - a[1])[0];
    if (master) accounts = [ds.index.accountById.get(master[0])].filter(Boolean);
  }
  if (accounts.length === 0) return abstain('No financial accounts linked to that query.');
  const focus = new Set(accounts.map((a) => a.id));
  // 1-hop neighbourhood
  const txns = ds.transactions.filter((tx) => focus.has(tx.from_account) || focus.has(tx.to_account));
  const acctIds = new Set(txns.flatMap((tx) => [tx.from_account, tx.to_account]));
  const flaggedTotal = txns.filter((tx) => tx.flagged_reason).reduce((s, tx) => s + tx.amount, 0);
  const nodes = [...acctIds].map((id) => {
    const a = ds.index.accountById.get(id);
    const holder = a ? personLabel(ds, a.holder_person_id).name : id;
    return { id, label: `${holder} · ${a ? a.bank : ''}`, kind: 'account', flags: focus.has(id) ? ['focus'] : [] };
  });
  const edges = txns.map((tx) => ({ source: tx.from_account, target: tx.to_account, type: tx.flagged_reason || 'transfer', weight: tx.amount, predicted: false, score: tx.amount, flagged: !!tx.flagged_reason }));
  return {
    narration_en: `Mapped ${txns.length} transaction(s) across ${acctIds.size} account(s). ${flaggedTotal ? 'Suspicious flows (structuring) total ' + inr(flaggedTotal) + '.' : 'No flagged flows.'}`,
    narration_kn: `${acctIds.size} ಖಾತೆಗಳ ${txns.length} ವ್ಯವಹಾರಗಳು. ಶಂಕಿತ ಮೊತ್ತ: ${flaggedTotal ? inr(flaggedTotal) : '—'}.`,
    surface: { kind: 'graph', nodes, edges },
    evidence: { fir_ids: [], query: `transaction graph around ${[...focus].join(', ')}; flag structuring`, confidence: 0.8, reasoning_path: [{ step: 'Resolve accounts', detail: `${focus.size} focus account(s)` }, { step: 'Trace', detail: `${txns.length} transactions, 1-hop` }, { step: 'Flag', detail: `structuring inflows = ${inr(flaggedTotal)}` }] },
    followups: ['Who controls the master account?', 'Link these accounts to FIRs', 'Show the network of these holders'],
  };
}

// ---------------------------------------------------------------- fallbacks
function clarify(msg) {
  return { narration_en: msg, narration_kn: 'ದಯವಿಟ್ಟು ಸ್ವಲ್ಪ ಸ್ಪಷ್ಟಪಡಿಸಿ.', surface: { kind: 'text' }, evidence: { fir_ids: [], query: 'clarify', confidence: 0.3, reasoning_path: [{ step: 'Clarify', detail: msg }] }, followups: ['Show chain-snatching hotspots in Bengaluru', 'Top repeat offenders in Mysuru', 'Forecast the next burglary in Mysuru'] };
}
function abstain(msg) {
  return { narration_en: msg, narration_kn: 'ಕ್ಷಮಿಸಿ, ಆ ಮಾಹಿತಿ ಲಭ್ಯವಿಲ್ಲ.', surface: { kind: 'text' }, evidence: { fir_ids: [], query: 'abstain', confidence: 0.2, reasoning_path: [{ step: 'Abstain', detail: msg }] }, followups: [] };
}

const HANDLERS = {
  search_firs: hSearchFirs, retrieve_fir: hRetrieveFir, hotspot_map: hHotspot, forecast_hotspot: hForecast,
  detect_org_crime: hDetectOrgCrime, network_explore: hNetwork, repeat_offenders: hRepeatOffenders,
  offender_risk: hOffenderRisk, person_profile: hPersonProfile, criminal_history: hCriminalHistory,
  mo_similarity: hMoSimilarity, case_summary: hCaseSummary, trend_analysis: hTrend, socio_insight: hSocio,
  money_trail: hMoneyTrail,
};

/**
 * ask(ds, message, ctx) -> AnswerEnvelope. ctx = { role, user_id, history? }.
 * This is the single entry point the API/UI calls.
 */
export function ask(ds, message, ctx = {}) {
  const nlu = understand(message, ds);
  nlu.slots._text = message;
  const handler = HANDLERS[nlu.intent] || (nlu.intent === 'abstain' ? () => abstain("I can't answer that.") : () => clarify("I didn't quite get that. Try asking about hotspots, offenders, networks, or a specific FIR."));
  const out = handler(ds, nlu.slots);
  const envelope = { intent: nlu.intent, ...out, evidence: { ...out.evidence, confidence: out.evidence.confidence ?? nlu.confidence } };

  // governance: immutable audit entry (PS1 §10)
  _audit.push({
    id: `AUD-${_audit.length + 1}`, ts: new Date().toISOString(),
    user_id: ctx.user_id || 'demo', role: ctx.role || 'investigator',
    action: 'query', intent: nlu.intent, entity_refs: envelope.evidence.fir_ids.slice(0, 10),
    pii_revealed: ['person_profile', 'criminal_history', 'retrieve_fir'].includes(nlu.intent),
  });
  return envelope;
}
