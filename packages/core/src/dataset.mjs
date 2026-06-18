// Loads the NETRA dataset (synthetic seed today; swap for Catalyst Data Store in prod)
// and builds in-memory indexes the analytics + intent handlers rely on.

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const DEFAULT_SEED_DIR = join(__dirname, '..', '..', '..', 'data', 'seed');

const TABLES = [
  'districts', 'stations', 'persons', 'firs',
  'fir_accused', 'fir_victim', 'associations', 'accounts', 'transactions',
];

function readJson(path, fallback) {
  if (!existsSync(path)) return fallback;
  return JSON.parse(readFileSync(path, 'utf8'));
}

/** Walk up from `start` looking for a data/seed directory with a generated dataset. */
function findSeedDir(start) {
  let dir = start;
  for (let i = 0; i < 8; i++) {
    const cand = join(dir, 'data', 'seed');
    if (existsSync(join(cand, 'persons.json'))) return cand;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

/** Load all tables + build indexes. Robust to CWD (CLI, Next.js, Catalyst). */
export function loadDataset(seedDir = DEFAULT_SEED_DIR) {
  let dir = seedDir;
  if (!existsSync(join(dir, 'persons.json'))) {
    dir = process.env.NETRA_SEED_DIR || findSeedDir(process.cwd()) || findSeedDir(__dirname) || dir;
  }
  const t = {};
  for (const name of TABLES) t[name] = readJson(join(dir, `${name}.json`), []);
  const manifest = readJson(join(dir, 'manifest.json'), null);

  if (t.persons.length === 0) {
    throw new Error(`No dataset found in ${seedDir}. Run: npm run data:generate`);
  }

  // indexes
  const personById = new Map(t.persons.map((p) => [p.id, p]));
  const firById = new Map(t.firs.map((f) => [f.id, f]));
  const stationByCode = new Map(t.stations.map((s) => [s.ps_code, s]));
  const districtByName = new Map(t.districts.map((d) => [d.name, d]));
  const accountById = new Map(t.accounts.map((a) => [a.id, a]));

  const accusedByFir = new Map();
  const firsByPerson = new Map();
  for (const fa of t.fir_accused) {
    if (!accusedByFir.has(fa.fir_id)) accusedByFir.set(fa.fir_id, []);
    accusedByFir.get(fa.fir_id).push(fa);
    if (!firsByPerson.has(fa.person_id)) firsByPerson.set(fa.person_id, []);
    firsByPerson.get(fa.person_id).push(fa.fir_id);
  }
  const victimsByFir = new Map();
  for (const fv of t.fir_victim) {
    if (!victimsByFir.has(fv.fir_id)) victimsByFir.set(fv.fir_id, []);
    victimsByFir.get(fv.fir_id).push(fv);
  }
  const accountsByPerson = new Map();
  for (const a of t.accounts) {
    if (!accountsByPerson.has(a.holder_person_id)) accountsByPerson.set(a.holder_person_id, []);
    accountsByPerson.get(a.holder_person_id).push(a);
  }

  return {
    ...t, manifest,
    index: {
      personById, firById, stationByCode, districtByName, accountById,
      accusedByFir, firsByPerson, victimsByFir, accountsByPerson,
    },
  };
}

/** FIRs a person is accused/suspected in. */
export function firsForPerson(ds, personId) {
  return (ds.index.firsByPerson.get(personId) || []).map((id) => ds.index.firById.get(id)).filter(Boolean);
}

/** Filter FIRs by optional crime type, district/ps area substring, time window (days), and time-of-day. */
export function filterFirs(ds, { crimeType, area, days, status, afterHour, beforeHour, tod } = {}) {
  const now = Date.now();
  return ds.firs.filter((f) => {
    if (crimeType && f.crime_type.toLowerCase() !== crimeType.toLowerCase()) return false;
    if (status && f.status !== status) return false;
    if (days != null) {
      const ageDays = (now - new Date(f.occurred_at).getTime()) / 86400000;
      if (ageDays > days) return false;
    }
    if (afterHour != null || beforeHour != null || tod) {
      const h = new Date(f.occurred_at).getUTCHours();
      if (afterHour != null && h < afterHour) return false;
      if (beforeHour != null && h >= beforeHour) return false;
      if (tod === 'night' && !(h >= 20 || h < 6)) return false;
      if (tod === 'evening' && !(h >= 17 && h < 21)) return false;
      if (tod === 'morning' && !(h >= 6 && h < 12)) return false;
      if (tod === 'afternoon' && !(h >= 12 && h < 17)) return false;
      if (tod === 'daytime' && !(h >= 9 && h < 18)) return false;
    }
    if (area) {
      const a = area.toLowerCase();
      const st = ds.index.stationByCode.get(f.ps_code);
      const hay = `${f.district} ${st ? st.name : ''} ${f.ps_code}`.toLowerCase();
      if (!hay.includes(a)) return false;
    }
    return true;
  });
}

export const haversineKm = (aLat, aLng, bLat, bLng) => {
  const R = 6371, toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat), dLng = toRad(bLng - aLng);
  const s = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
};
