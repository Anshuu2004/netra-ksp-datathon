// Loader for REAL public Karnataka crime data (Tier A) — genuine Govt figures used for
// district-level trend / hotspot / socio-economic analytics. See docs/DATA_POLICY.md.

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const REAL_DIR = join(__dirname, '..', '..', '..', '..', 'data', 'real');

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  const headers = lines[0].split(',').map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cells = line.split(',');
    const row = {};
    headers.forEach((h, i) => { row[h] = (cells[i] ?? '').trim(); });
    return row;
  });
}

/**
 * Real Karnataka 2023 district/city-wise crime totals (IPC + SLL).
 * Returns [{ district, ipc, sll, total }] excluding the TOTAL row.
 */
export function loadKarnatakaCrime2023(file = join(REAL_DIR, 'ka_total_crimes_2023.csv')) {
  if (!existsSync(file)) return { rows: [], total: 0, source: 'OpenCity/NCRB (file missing)' };
  const rows = parseCsv(readFileSync(file, 'utf8'))
    .filter((r) => r.Districts && r.Districts.toUpperCase() !== 'TOTAL')
    .map((r) => ({
      district: r.Districts,
      ipc: Number(r['IPC Cases'] || 0),
      sll: Number(r['SLL Cases'] || 0),
      total: Number(r.Total || 0),
    }));
  const total = rows.reduce((s, r) => s + r.total, 0);
  return { rows, total, year: 2023, source: 'OpenCity / Govt of Karnataka (real)' };
}

/**
 * Correlate real district crime totals with a socio-economic indicator from our
 * district table (urbanization / literacy / unemployment). Pearson r.
 * Demonstrates PS1 §4 (sociological insights) on REAL crime counts.
 */
export function socioCorrelation(ds, indicator = 'urbanization_index') {
  const real = loadKarnatakaCrime2023();
  const norm = (s) => s.toLowerCase().replace(/\b(city|district|urban|rural)\b/g, '').replace(/[^a-z]/g, '');
  const realByDistrict = new Map(real.rows.map((r) => [norm(r.district), r.total]));
  const points = [];
  for (const d of ds.districts) {
    const key = norm(d.name);
    // try exact, then prefix match
    let val = realByDistrict.get(key);
    if (val == null) {
      for (const [k, v] of realByDistrict) if (k.startsWith(key) || key.startsWith(k)) { val = v; break; }
    }
    if (val != null && d[indicator] != null) points.push({ district: d.name, x: d[indicator], y: val });
  }
  if (points.length < 3) return { r: null, n: points.length, indicator, points };
  const xs = points.map((p) => p.x), ys = points.map((p) => p.y);
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length, my = ys.reduce((a, b) => a + b, 0) / ys.length;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < xs.length; i++) { num += (xs[i] - mx) * (ys[i] - my); dx += (xs[i] - mx) ** 2; dy += (ys[i] - my) ** 2; }
  const r = num / (Math.sqrt(dx * dy) || 1);
  return { r: Number(r.toFixed(3)), n: points.length, indicator, points, source: real.source };
}
