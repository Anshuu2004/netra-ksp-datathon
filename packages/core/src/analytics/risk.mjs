// Explainable offender risk scoring (criminology-based) + repeat-offender ranking.
// Every score returns per-factor contributions so the UI can SHOW WHY (Explainable AI).

import { firsForPerson } from '../dataset.mjs';
import { buildGraph, degreeCentrality } from './graph.mjs';

const SEVERITY = { // crime_type -> base severity 1..5 (mirrors generator taxonomy)
  'Theft': 2, 'House Trespass': 2, 'Burglary': 3, 'Chain Snatching': 3, 'Motor Vehicle Theft': 3,
  'Assault': 3, 'Cheating': 3, 'Cyber Fraud': 3, 'Robbery': 4, 'Extortion': 4, 'Rioting': 4,
  'Dowry Harassment': 4, 'NDPS / Drugs': 4, 'Counterfeiting': 4, 'Money Laundering': 4,
  'Murder': 5, 'Attempt to Murder': 5, 'Kidnapping': 5,
};

let _degreeCache = null;
function degreeOf(ds, personId) {
  if (!_degreeCache || _degreeCache.ds !== ds) {
    _degreeCache = { ds, deg: degreeCentrality(buildGraph(ds)) };
  }
  return _degreeCache.deg.get(personId) || 0;
}

/**
 * Explainable risk score (0-100) for a person, with factor breakdown.
 */
export function offenderRisk(ds, personId) {
  const person = ds.index.personById.get(personId);
  const firs = firsForPerson(ds, personId);
  const now = Date.now();

  const priorCount = firs.length;
  let sevSum = 0, recent90 = 0, violent = 0;
  const moSet = new Set();
  let absconding = 0;
  for (const f of firs) {
    sevSum += SEVERITY[f.crime_type] || 3;
    f.mo_tags.forEach((t) => moSet.add(t));
    const ageDays = (now - new Date(f.occurred_at).getTime()) / 86400000;
    if (ageDays <= 90) recent90++;
    if ((SEVERITY[f.crime_type] || 0) >= 4) violent++;
  }
  for (const fa of ds.fir_accused) if (fa.person_id === personId && fa.arrest_status === 'absconding') absconding++;
  const avgSev = priorCount ? sevSum / priorCount : 0;
  const centrality = degreeOf(ds, personId);

  // weighted, capped contributions (transparent)
  const factors = [
    { name: 'Prior offences', detail: `${priorCount} linked FIR(s)`, contribution: Math.min(30, priorCount * 7) },
    { name: 'Recent activity', detail: `${recent90} in last 90 days`, contribution: Math.min(20, recent90 * 7) },
    { name: 'Offence severity', detail: `avg severity ${avgSev.toFixed(1)}/5`, contribution: Math.min(20, avgSev * 4) },
    { name: 'Violent/serious mix', detail: `${violent} serious offence(s)`, contribution: Math.min(12, violent * 6) },
    { name: 'Network centrality', detail: `${centrality} association link(s)`, contribution: Math.min(12, centrality * 1.5) },
    { name: 'Absconding history', detail: `${absconding} absconding flag(s)`, contribution: Math.min(6, absconding * 6) },
  ];
  const score = Math.min(100, Math.round(factors.reduce((s, f) => s + f.contribution, 0)));
  return {
    person_id: personId,
    name: person ? person.full_name : personId,
    name_kn: person ? person.full_name_kn : '',
    score,
    band: score >= 70 ? 'High' : score >= 40 ? 'Medium' : 'Low',
    is_repeat_offender: priorCount >= 2,
    mo_fingerprint: [...moSet].slice(0, 6),
    factors: factors.sort((a, b) => b.contribution - a.contribution),
  };
}

/** Rank repeat offenders (>=2 priors), optionally filtered by area/crime type. */
export function repeatOffenders(ds, { area, crimeType, topK = 10 } = {}) {
  const candidates = new Set();
  for (const [personId, firIds] of ds.index.firsByPerson) {
    if (firIds.length < 2) continue;
    if (area || crimeType) {
      const firs = firIds.map((id) => ds.index.firById.get(id)).filter(Boolean);
      const hit = firs.some((f) => {
        const okCrime = !crimeType || f.crime_type.toLowerCase() === crimeType.toLowerCase();
        const st = ds.index.stationByCode.get(f.ps_code);
        const okArea = !area || `${f.district} ${st ? st.name : ''}`.toLowerCase().includes(area.toLowerCase());
        return okCrime && okArea;
      });
      if (!hit) continue;
    }
    candidates.add(personId);
  }
  return [...candidates]
    .map((id) => offenderRisk(ds, id))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}
