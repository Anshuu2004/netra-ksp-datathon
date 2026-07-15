// NETRA synthetic Karnataka crime dataset generator.
// Deterministic (seeded) so the demo is reproducible. Plants known patterns
// (gang ring, near-repeat series, hotspot, laundering ring, Kannada FIRs) and
// records their ground-truth in manifest.json for validation + confident demos.
//
//   node data/generator/generate.mjs            (uses default seed)
//   node data/generator/generate.mjs --seed 7   (custom seed)

import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  DISTRICTS, STATION_AREAS, MALE_FIRST, FEMALE_FIRST, SURNAMES, OCCUPATIONS,
  SOCIO_BANDS, CRIME_TYPES, FIR_STATUSES, BANKS, KN_NARRATIVES,
} from './karnataka.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '..', 'seed');
const DAY = 86400000;
// Anchor "now" to TODAY (noon UTC) so planted "recent" patterns (active near-repeat spree,
// emerging hotspots) stay recent relative to the wall clock the analytics use — the dataset
// never ages out of the demo. Stable within a day; regenerate before the final demo.
const REF_NOW = Math.floor(Date.now() / DAY) * DAY + 12 * 3600000;

// ---- deterministic RNG (mulberry32) ----
const seedArg = process.argv.indexOf('--seed');
const SEED = seedArg !== -1 ? Number(process.argv[seedArg + 1]) : 20260605;
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(SEED);
const randInt = (lo, hi) => Math.floor(rnd() * (hi - lo + 1)) + lo;
const randFloat = (lo, hi) => rnd() * (hi - lo) + lo;
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const chance = (p) => rnd() < p;
const pad = (n, w) => String(n).padStart(w, '0');
const round = (n, d = 6) => Number(n.toFixed(d));
function weightedPick(pairs) { // [[item, weight], ...]
  const total = pairs.reduce((s, [, w]) => s + w, 0);
  let r = rnd() * total;
  for (const [item, w] of pairs) { if ((r -= w) <= 0) return item; }
  return pairs[pairs.length - 1][0];
}
function dateBetween(startMs, endMs) { return new Date(startMs + rnd() * (endMs - startMs)).toISOString(); }
function jitter(lat, lng, km) {
  const dLat = (km / 111) * (rnd() * 2 - 1);
  const dLng = (km / (111 * Math.cos(lat * Math.PI / 180))) * (rnd() * 2 - 1);
  return [round(lat + dLat), round(lng + dLng)];
}

// ---- district codes (unique 3-letter) ----
const distCode = {};
const usedCodes = new Set();
for (const [name] of DISTRICTS) {
  let base = name.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase();
  let code = base, i = 1;
  while (usedCodes.has(code)) code = base.slice(0, 2) + (i++);
  usedCodes.add(code);
  distCode[name] = code;
}

// ---- districts + stations ----
const districts = DISTRICTS.map(([name, lat, lng, urb, lit, unemp]) => ({
  name, lat, lng, code: distCode[name],
  population: randInt(800_000, 12_000_000),
  urbanization_index: urb, literacy_rate: lit, unemployment_proxy: unemp,
}));

const stations = [];
for (const d of districts) {
  const n = d.urbanization_index > 0.7 ? 4 : d.urbanization_index > 0.5 ? 3 : 2;
  // avoid awkward duplications like "Bengaluru Rural Rural PS" by dropping area words
  // already present in the district name
  const areas = STATION_AREAS.filter((a) => !d.name.toLowerCase().includes(a.toLowerCase()))
    .sort(() => rnd() - 0.5).slice(0, n);
  areas.forEach((area, i) => {
    const [lat, lng] = jitter(d.lat, d.lng, 6);
    stations.push({
      ps_code: `PS-${d.code}-${pad(i + 1, 2)}`,
      name: `${d.name} ${area} PS`,
      district: d.name, lat, lng,
    });
  });
}
const stationsByDistrict = (name) => stations.filter((s) => s.district === name);

// ---- persons ----
const persons = [];
let pid = 0;
function makePerson(opts = {}) {
  pid += 1;
  const gender = opts.gender || (chance(0.82) ? 'M' : 'F');
  const [fnEn, fnKn] = pick(gender === 'M' ? MALE_FIRST : FEMALE_FIRST);
  const [snEn, snKn] = pick(SURNAMES);
  const district = opts.district || pick(districts).name;
  const ps = pick(stationsByDistrict(district));
  const p = {
    id: `P-${pad(pid, 5)}`,
    full_name: `${fnEn} ${snEn}`,
    full_name_kn: `${fnKn} ${snKn}`,
    gender,
    age: opts.age || randInt(18, 62),
    occupation: pick(OCCUPATIONS),
    district,
    ps_code: ps.ps_code,
    socio_economic_band: weightedPick([[SOCIO_BANDS[0], 4], [SOCIO_BANDS[1], 3], [SOCIO_BANDS[2], 2], [SOCIO_BANDS[3], 1]]),
    is_repeat_offender: false,
    risk_score: 0,
    mo_fingerprint: [],
    _firs_as_accused: [], // internal, stripped before write
  };
  persons.push(p);
  return p;
}
for (let i = 0; i < 150; i++) makePerson();

// ---- FIR generation helpers ----
const firs = [];
const firAccused = [];
const firVictim = [];
let firSeq = {};
const CRIME_WEIGHTS = [
  ['Theft', 16], ['Burglary', 11], ['Chain Snatching', 9], ['Motor Vehicle Theft', 9],
  ['Cyber Fraud', 11], ['Cheating', 7], ['Assault', 8], ['Robbery', 6],
  ['House Trespass', 4], ['Extortion', 3], ['NDPS / Drugs', 4], ['Dowry Harassment', 4],
  ['Rioting', 2], ['Attempt to Murder', 2], ['Murder', 2], ['Kidnapping', 1],
  ['Counterfeiting', 1], ['Money Laundering', 1],
];

function newFirId(district, dateMs) {
  const year = new Date(dateMs).getFullYear();
  const key = `${year}-${distCode[district]}`;
  firSeq[key] = (firSeq[key] || 0) + 1;
  return `FIR-${year}-${distCode[district]}-${pad(firSeq[key], 5)}`;
}

function makeFir({ crimeType, station, occurredMs, accusedIds = [], mo, knNarrative = false, statusBias }) {
  crimeType = crimeType || weightedPick(CRIME_WEIGHTS);
  station = station || pick(stations);
  occurredMs = occurredMs ?? REF_NOW - randInt(1, 540) * DAY;
  const meta = CRIME_TYPES[crimeType];
  // MO-consistent time-of-day (UTC hour) so time-of-day queries are meaningful & realistic:
  // snatching/robbery in the evening, burglary/vehicle-theft at night, frauds in the daytime.
  const HOURS = {
    'Chain Snatching': [17, 21], 'Robbery': [19, 23], 'Burglary': [0, 4], 'Motor Vehicle Theft': [22, 23],
    'House Trespass': [12, 16], 'Theft': [10, 19], 'Cheating': [10, 18], 'Cyber Fraud': [9, 20],
    'Murder': [20, 23], 'Attempt to Murder': [19, 23], 'Assault': [18, 23], 'Extortion': [11, 17], 'NDPS / Drugs': [21, 23],
  };
  const [h0, h1] = HOURS[crimeType] || [6, 22];
  occurredMs = Math.floor(occurredMs / DAY) * DAY + randInt(h0, h1) * 3600000 + randInt(0, 59) * 60000;
  const [lat, lng] = jitter(station.lat, station.lng, 3);
  const moTags = mo || [...meta.mo].sort(() => rnd() - 0.5).slice(0, randInt(2, Math.min(4, meta.mo.length)));
  const reportedMs = occurredMs + randInt(0, 3) * DAY + randInt(0, 20) * 3600000;
  const ageDays = (REF_NOW - occurredMs) / DAY;
  const status = statusBias || weightedPick(
    ageDays > 180
      ? [['closed', 4], ['chargesheeted', 3], ['under_investigation', 2], ['registered', 1]]
      : [['under_investigation', 4], ['registered', 3], ['chargesheeted', 2], ['closed', 1]]
  );
  const id = newFirId(station.district, occurredMs);
  const place = `${station.name.replace(' PS', '')}`;
  const fir = {
    id,
    title: `${crimeType} reported at ${place}`,
    crime_type: crimeType,
    ipc_bns_sections: meta.sections,
    occurred_at: new Date(occurredMs).toISOString(),
    reported_at: new Date(reportedMs).toISOString(),
    district: station.district,
    ps_code: station.ps_code,
    lat, lng,
    status,
    mo_tags: moTags,
    narrative_en: `On ${new Date(occurredMs).toDateString()}, a case of ${crimeType.toLowerCase()} was reported at ${place}, ${station.district}. Modus operandi observed: ${moTags.join(', ')}.`,
    narrative_kn: knNarrative && KN_NARRATIVES[crimeType]
      ? KN_NARRATIVES[crimeType].replace('{place}', place)
      : null,
    value_loss: ['Theft', 'Burglary', 'Chain Snatching', 'Robbery', 'Cyber Fraud', 'Cheating', 'Motor Vehicle Theft', 'Money Laundering'].includes(crimeType)
      ? randInt(3, 500) * 1000 : 0,
  };
  firs.push(fir);

  // accused
  let accused = accusedIds;
  if (accused.length === 0 && chance(0.6)) {
    const k = weightedPick([[1, 6], [2, 3], [3, 1]]);
    accused = Array.from({ length: k }, () => pick(persons).id);
    accused = [...new Set(accused)];
  }
  for (const personId of accused) {
    firAccused.push({ fir_id: id, person_id: personId, role: chance(0.85) ? 'accused' : 'suspect', arrest_status: weightedPick([['arrested', 5], ['absconding', 2], ['bailed', 3]]) });
    const p = persons.find((x) => x.id === personId);
    if (p) p._firs_as_accused.push(id);
  }
  // victims (a fresh victim person each time for non-victimless crimes)
  if (!['NDPS / Drugs', 'Rioting', 'Counterfeiting', 'Money Laundering'].includes(crimeType)) {
    const v = makePerson({ district: station.district });
    firVictim.push({ fir_id: id, person_id: v.id, injury: weightedPick([['none', 5], ['minor', 3], ['grievous', 1]]), loss_amount: fir.value_loss });
  }
  return fir;
}

// ---- baseline FIRs ----
for (let i = 0; i < 600; i++) makeFir({ knNarrative: chance(0.06) });

// =========================================================================
// PLANTED PATTERNS
// =========================================================================
const manifest = { seed: SEED, generated_at: new Date(REF_NOW).toISOString(), patterns: {} };

// --- Pattern 1: organized chain-snatching gang in Bengaluru Urban South ---
const blrSouth = stationsByDistrict('Bengaluru Urban').filter((s) => /South|Market|City|Cantonment/.test(s.name));
const gangStations = blrSouth.length ? blrSouth : stationsByDistrict('Bengaluru Urban');
const gang = Array.from({ length: 8 }, () => makePerson({ gender: 'M', district: 'Bengaluru Urban', age: randInt(20, 35) }));
const kingpin = gang[0];
const gangMo = ['two-wheeler', 'pillion-rider', 'evening', 'gold-chain', 'main-road'];
const gangFirIds = [];
for (let i = 0; i < 14; i++) {
  // kingpin appears in most; 1-2 other members per job
  const members = [chance(0.75) ? kingpin.id : pick(gang).id, pick(gang).id, ...(chance(0.4) ? [pick(gang).id] : [])];
  const f = makeFir({
    crimeType: 'Chain Snatching',
    station: pick(gangStations),
    occurredMs: REF_NOW - randInt(5, 180) * DAY,
    accusedIds: [...new Set(members)],
    mo: gangMo,
    knNarrative: i % 4 === 0,
  });
  gangFirIds.push(f.id);
}
manifest.patterns.organized_gang = {
  description: 'Chain-snatching gang operating in Bengaluru Urban South.',
  kingpin: kingpin.id, members: gang.map((g) => g.id), fir_ids: gangFirIds,
};

// --- Pattern 2: near-repeat burglary series (tight space-time cluster) ---
const nrStation = pick(stationsByDistrict('Mysuru'));
const nrAccused = [makePerson({ gender: 'M', district: 'Mysuru', age: randInt(24, 40) }).id];
const nrCenter = jitter(nrStation.lat, nrStation.lng, 1);
const nrFirIds = [];
// tight space-time spree: 12 break-ins within ~1km, every ~2.7 days over ~30 days
for (let i = 0; i < 12; i++) {
  const [lat, lng] = jitter(nrCenter[0], nrCenter[1], 0.5); // cluster radius < ~1km
  const occurredMs = REF_NOW - Math.round(33 - i * 2.7) * DAY;
  const f = makeFir({
    crimeType: 'Burglary',
    station: nrStation,
    occurredMs,
    accusedIds: i < 8 ? nrAccused : [], // last ones unsolved -> "predict next"
    mo: ['night', 'rear-entry', 'cut-grill', 'unoccupied-house'],
    statusBias: i >= 8 ? 'under_investigation' : undefined,
  });
  f.lat = lat; f.lng = lng;
  nrFirIds.push(f.id);
}
manifest.patterns.near_repeat_series = {
  description: 'Near-repeat residential burglary series in Mysuru (use for next-strike forecast).',
  center: nrCenter, radius_km: 2, ps_code: nrStation.ps_code, fir_ids: nrFirIds, suspect: nrAccused[0],
};
// realistic burglary baseline across Mysuru over the past ~18 months, located away from the
// spree's tight circle — so the spree reads as a genuine spatio-temporal SPIKE, not the whole signal.
for (let i = 0; i < 45; i++) {
  makeFir({ crimeType: 'Burglary', station: pick(stationsByDistrict('Mysuru')), occurredMs: REF_NOW - randInt(45, 540) * DAY });
}

// --- Pattern 3: theft hotspot spike (last 60 days, single station) ---
const hotStation = pick(stationsByDistrict('Hubballi'));
const hotFirIds = [];
for (let i = 0; i < 22; i++) {
  const f = makeFir({
    crimeType: weightedPick([['Theft', 6], ['Motor Vehicle Theft', 3], ['Chain Snatching', 2]]),
    station: hotStation,
    occurredMs: REF_NOW - randInt(1, 60) * DAY,
  });
  hotFirIds.push(f.id);
}
manifest.patterns.hotspot = {
  description: 'Theft hotspot spike at a Hubballi station over the last 60 days.',
  ps_code: hotStation.ps_code, station: hotStation.name, fir_ids: hotFirIds,
};

// =========================================================================
// ASSOCIATIONS (graph edges)
// =========================================================================
const associations = [];
const edgeKey = (a, b) => [a, b].sort().join('|');
const edgeMap = new Map();
function addEdge(a, b, type, sourceFir) {
  if (a === b) return;
  const key = `${edgeKey(a, b)}|${type}`;
  let e = edgeMap.get(key);
  if (!e) { e = { person_a: [a, b].sort()[0], person_b: [a, b].sort()[1], type, weight: 0, source_fir_ids: [] }; edgeMap.set(key, e); associations.push(e); }
  e.weight += 1;
  if (sourceFir && !e.source_fir_ids.includes(sourceFir)) e.source_fir_ids.push(sourceFir);
}
// co-offender edges from shared FIRs
const accusedByFir = {};
for (const fa of firAccused) (accusedByFir[fa.fir_id] ||= []).push(fa.person_id);
for (const [firId, ids] of Object.entries(accusedByFir)) {
  for (let i = 0; i < ids.length; i++)
    for (let j = i + 1; j < ids.length; j++) addEdge(ids[i], ids[j], 'cooffender', firId);
}
// some family / associate / phone / vehicle edges
const offenders = persons.filter((p) => p._firs_as_accused.length > 0);
for (let i = 0; i < 60; i++) {
  const a = pick(offenders), b = pick(persons);
  addEdge(a.id, b.id, weightedPick([['associate', 4], ['family', 2], ['phone', 2], ['vehicle', 1]]));
}
// planted HIDDEN link: two offenders who share three neighbours but have NO direct tie.
// Fresh persons each with a solo FIR (so they never co-offend with each other); a shared
// associate hub + shared vehicle + shared phone -> NETRA should predict the missing edge.
const lpA = makePerson({ gender: 'M', district: 'Bengaluru Urban', age: randInt(22, 38) });
const lpB = makePerson({ gender: 'M', district: 'Bengaluru Urban', age: randInt(22, 38) });
makeFir({ crimeType: 'Motor Vehicle Theft', station: pick(gangStations), occurredMs: REF_NOW - randInt(20, 160) * DAY, accusedIds: [lpA.id] });
makeFir({ crimeType: 'Theft', station: pick(gangStations), occurredMs: REF_NOW - randInt(20, 160) * DAY, accusedIds: [lpB.id] });
const lpHub = makePerson({ gender: 'M', district: 'Bengaluru Urban', age: randInt(25, 45) });
addEdge(lpA.id, gang[2].id, 'vehicle'); addEdge(lpB.id, gang[2].id, 'vehicle');
addEdge(lpA.id, gang[3].id, 'phone');   addEdge(lpB.id, gang[3].id, 'phone');
addEdge(lpA.id, lpHub.id, 'associate'); addEdge(lpB.id, lpHub.id, 'associate');
manifest.patterns.predicted_link = {
  description: 'Two offenders share three neighbours (common associate + shared vehicle + shared phone) but have NO direct edge — NETRA should predict this hidden tie.',
  expected_pair: [lpA.id, lpB.id],
};

// =========================================================================
// FINANCIAL: accounts + transactions + laundering ring
// =========================================================================
const accounts = [];
const transactions = [];
let acSeq = 0, txSeq = 0;
function makeAccount(personId) {
  acSeq += 1;
  const ac = { id: `AC-${pad(acSeq, 4)}`, holder_person_id: personId, bank: pick(BANKS), account_no_masked: `XXXX${randInt(1000, 9999)}`, kyc_band: weightedPick([['full', 5], ['minimal', 3], ['unverified', 2]]) };
  accounts.push(ac);
  return ac;
}
const acctHolders = [...offenders].sort(() => rnd() - 0.5).slice(0, 45);
const acctByPerson = {};
for (const p of acctHolders) acctByPerson[p.id] = makeAccount(p.id);
const allAccts = accounts.slice();
function makeTxn(from, to, amount, tsMs, flagged) {
  txSeq += 1;
  transactions.push({ id: `TX-${pad(txSeq, 5)}`, from_account: from, to_account: to, amount, ts: new Date(tsMs).toISOString(), channel: pick(['UPI', 'IMPS', 'NEFT', 'CASH-DEPOSIT']), flagged_reason: flagged || null });
}
// normal background transactions
for (let i = 0; i < 220; i++) {
  const a = pick(allAccts), b = pick(allAccts);
  if (a.id !== b.id) makeTxn(a.id, b.id, randInt(1, 80) * 1000, REF_NOW - randInt(1, 400) * DAY);
}
// laundering ring: 6 mule accounts funnel into a master within a tight window (structuring)
const mules = Array.from({ length: 6 }, () => makeAccount(makePerson({ age: randInt(21, 45) }).id));
const masterHolder = makePerson({ age: randInt(30, 50) });
const master = makeAccount(masterHolder.id);
const ringStart = REF_NOW - 25 * DAY;
for (const m of mules) {
  const n = randInt(3, 5);
  for (let k = 0; k < n; k++) makeTxn(m.id, master.id, randInt(40, 99) * 1000, ringStart + randInt(0, 18) * DAY, 'structuring');
}
// link ring holders financially (graph) + tie to an extortion FIR
for (const m of mules) addEdge(m.holder_person_id, masterHolder.id, 'financial');
const ringFir = makeFir({ crimeType: 'Money Laundering', station: pick(stationsByDistrict('Bengaluru Urban')), occurredMs: ringStart + 10 * DAY, accusedIds: [masterHolder.id, mules[0].holder_person_id], knNarrative: false, statusBias: 'under_investigation' });
manifest.patterns.laundering_ring = {
  description: 'Layering ring: 6 mule accounts structuring deposits into one master account.',
  master_account: master.id, master_person: masterHolder.id, mule_accounts: mules.map((m) => m.id), fir_id: ringFir.id,
};

// =========================================================================
// DERIVE offender attributes (repeat flag, MO fingerprint, simple risk score)
// =========================================================================
for (const p of persons) {
  const myFirs = firs.filter((f) => p._firs_as_accused.includes(f.id));
  if (myFirs.length === 0) continue;
  p.is_repeat_offender = myFirs.length >= 2;
  const moCount = {};
  let sevSum = 0, recencyBonus = 0;
  for (const f of myFirs) {
    for (const t of f.mo_tags) moCount[t] = (moCount[t] || 0) + 1;
    sevSum += CRIME_TYPES[f.crime_type].severity;
    const ageDays = (REF_NOW - new Date(f.occurred_at).getTime()) / DAY;
    if (ageDays < 90) recencyBonus += 4;
  }
  p.mo_fingerprint = Object.entries(moCount).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([t]) => t);
  const priorCount = myFirs.length;
  const avgSev = sevSum / priorCount;
  p.risk_score = Math.min(100, Math.round(priorCount * 11 + avgSev * 6 + Math.min(recencyBonus, 22)));
}

// strip internals
for (const p of persons) delete p._firs_as_accused;

// =========================================================================
// WRITE
// =========================================================================
mkdirSync(OUT_DIR, { recursive: true });
const tables = {
  districts, stations, persons, firs,
  fir_accused: firAccused, fir_victim: firVictim,
  associations, accounts, transactions,
};
for (const [name, rows] of Object.entries(tables)) {
  writeFileSync(join(OUT_DIR, `${name}.json`), JSON.stringify(rows, null, 1));
}
manifest.counts = Object.fromEntries(Object.entries(tables).map(([k, v]) => [k, v.length]));
writeFileSync(join(OUT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));

// small committed sample for repo browsing
writeFileSync(join(OUT_DIR, 'sample.json'), JSON.stringify({
  note: 'Small sample for browsing. Run `npm run data:generate` to build the full dataset.',
  districts: districts.slice(0, 3), stations: stations.slice(0, 3),
  persons: persons.slice(0, 5), firs: firs.slice(0, 5),
  associations: associations.slice(0, 5), transactions: transactions.slice(0, 5),
}, null, 2));

console.log(`NETRA dataset generated (seed ${SEED}) →`, OUT_DIR);
console.table(manifest.counts);
console.log('Planted patterns:', Object.keys(manifest.patterns).join(', '));
