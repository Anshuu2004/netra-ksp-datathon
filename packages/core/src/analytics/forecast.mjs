// Spatio-temporal crime analytics grounded in criminology:
//  - hotspot ranking (kernel density over space + z-score spike detection)
//  - Near-Repeat Victimization (Knox-style space-time clustering test)
//  - next-strike forecast for an active series (self-exciting / near-repeat logic)

import { haversineKm } from '../dataset.mjs';

/** Rank police stations by incident count in a window, with a z-score spike flag. */
export function hotspotStations(ds, { crimeType, area, days = 60, topK = 8 } = {}) {
  const now = Date.now();
  const a = area ? area.toLowerCase() : null;
  const counts = new Map();
  for (const f of ds.firs) {
    if (crimeType && f.crime_type.toLowerCase() !== crimeType.toLowerCase()) continue;
    if (a) {
      const st = ds.index.stationByCode.get(f.ps_code);
      const hay = `${f.district} ${st ? st.name : ''} ${f.ps_code}`.toLowerCase();
      if (!hay.includes(a)) continue;
    }
    const ageDays = (now - new Date(f.occurred_at).getTime()) / 86400000;
    if (ageDays > days) continue;
    counts.set(f.ps_code, (counts.get(f.ps_code) || 0) + 1);
  }
  const vals = [...counts.values()];
  const mean = vals.reduce((a, b) => a + b, 0) / (vals.length || 1);
  const sd = Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / (vals.length || 1)) || 1;
  return [...counts.entries()]
    .map(([ps_code, count]) => {
      const st = ds.index.stationByCode.get(ps_code);
      return {
        ps_code, station: st ? st.name : ps_code, district: st ? st.district : '',
        lat: st ? st.lat : null, lng: st ? st.lng : null,
        count, z: Number(((count - mean) / sd).toFixed(2)),
        spike: count > mean + 1.5 * sd,
      };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, topK);
}

/** Kernel-density grid over incident points (for heatmap rendering). */
export function kdeGrid(firs, { bandwidthKm = 1.5, gridSize = 40 } = {}) {
  const pts = firs.filter((f) => f.lat != null && f.lng != null);
  if (pts.length === 0) return { cells: [], bbox: null };
  const lats = pts.map((p) => p.lat), lngs = pts.map((p) => p.lng);
  const bbox = { minLat: Math.min(...lats), maxLat: Math.max(...lats), minLng: Math.min(...lngs), maxLng: Math.max(...lngs) };
  const cells = [];
  for (let i = 0; i < gridSize; i++) {
    for (let j = 0; j < gridSize; j++) {
      const lat = bbox.minLat + ((bbox.maxLat - bbox.minLat) * (i + 0.5)) / gridSize;
      const lng = bbox.minLng + ((bbox.maxLng - bbox.minLng) * (j + 0.5)) / gridSize;
      let density = 0;
      for (const p of pts) {
        const d = haversineKm(lat, lng, p.lat, p.lng);
        density += Math.exp(-(d * d) / (2 * bandwidthKm * bandwidthKm));
      }
      if (density > 0.05) cells.push({ lat: Number(lat.toFixed(5)), lng: Number(lng.toFixed(5)), density: Number(density.toFixed(3)) });
    }
  }
  const max = Math.max(...cells.map((c) => c.density), 1);
  for (const c of cells) c.intensity = Number((c.density / max).toFixed(3));
  return { cells, bbox };
}

/**
 * Knox test for Near-Repeat Victimization: counts incident pairs that are close in
 * BOTH space and time, vs a Monte-Carlo expectation under temporal randomisation.
 * ratio >> 1 with low pseudo-p => significant near-repeat pattern.
 */
export function nearRepeatKnox(firs, { spaceKm = 2, timeDays = 14, sims = 199 } = {}) {
  const pts = firs.filter((f) => f.lat != null).map((f) => ({
    lat: f.lat, lng: f.lng, t: new Date(f.occurred_at).getTime() / 86400000,
  }));
  const n = pts.length;
  if (n < 4) return { pairs: 0, observed: 0, expected: 0, ratio: 1, p: 1, significant: false, n };
  const closeSpace = [];
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    if (haversineKm(pts[i].lat, pts[i].lng, pts[j].lat, pts[j].lng) <= spaceKm) closeSpace.push([i, j]);
  }
  const countClose = (times) => closeSpace.reduce((c, [i, j]) => c + (Math.abs(times[i] - times[j]) <= timeDays ? 1 : 0), 0);
  const times = pts.map((p) => p.t);
  const observed = countClose(times);
  let ge = 1, sum = 0;
  for (let s = 0; s < sims; s++) {
    const shuffled = times.slice();
    for (let k = shuffled.length - 1; k > 0; k--) { const r = Math.floor(Math.random() * (k + 1)); [shuffled[k], shuffled[r]] = [shuffled[r], shuffled[k]]; }
    const c = countClose(shuffled); sum += c; if (c >= observed) ge++;
  }
  const expected = sum / sims;
  return {
    pairs: closeSpace.length, observed, expected: Number(expected.toFixed(2)),
    ratio: Number((observed / (expected || 1)).toFixed(2)),
    p: Number((ge / (sims + 1)).toFixed(3)),
    significant: ge / (sims + 1) < 0.05 && observed > expected, n,
  };
}

/**
 * Space-time cluster (scan) test for an ACTIVE near-repeat spree.
 * Holds locations fixed and permutes event times: shows that incidents inside a small
 * radius are concentrated in the recent window far beyond chance. This is the right test
 * for confirming a single live series (Knox is for area-wide near-repeat tendency).
 */
export function nearRepeatCluster(firs, { center, radiusKm = 1.5, windowDays = 40, sims = 999 } = {}) {
  const now = Date.now() / 86400000;
  const pts = firs.filter((f) => f.lat != null).map((f) => ({
    d: haversineKm(center.lat, center.lng, f.lat, f.lng),
    t: new Date(f.occurred_at).getTime() / 86400000,
  }));
  if (pts.length < 5) return { inCircle: 0, observed: 0, expected: 0, ratio: 1, p: 1, significant: false };
  const times = pts.map((p) => p.t);
  const circle = pts.filter((p) => p.d <= radiusKm);
  const recent = (t) => now - t <= windowDays;
  const observed = circle.filter((p) => recent(p.t)).length;
  let ge = 1, sum = 0;
  for (let s = 0; s < sims; s++) {
    let c = 0;
    for (let k = 0; k < circle.length; k++) if (recent(times[Math.floor(Math.random() * times.length)])) c++;
    sum += c; if (c >= observed) ge++;
  }
  const expected = sum / sims;
  return {
    inCircle: circle.length, observed, expected: Number(expected.toFixed(2)),
    ratio: Number((observed / (expected || 1)).toFixed(2)),
    p: Number((ge / (sims + 1)).toFixed(4)),
    significant: ge / (sims + 1) < 0.05 && observed > expected,
  };
}

/**
 * Forecast the next strike of an active near-repeat series.
 * Uses recency-weighted centroid for WHERE and average inter-event interval for WHEN.
 */
export function forecastNextStrike(firs) {
  const series = firs.filter((f) => f.lat != null)
    .sort((a, b) => new Date(a.occurred_at) - new Date(b.occurred_at));
  if (series.length < 3) return null;
  const recent = series.slice(-6);
  // recency-weighted centroid
  let wsum = 0, lat = 0, lng = 0;
  recent.forEach((f, i) => { const w = i + 1; wsum += w; lat += f.lat * w; lng += f.lng * w; });
  lat /= wsum; lng /= wsum;
  // radius = mean distance of recent points to centroid
  const radiusKm = Number((recent.reduce((s, f) => s + haversineKm(lat, lng, f.lat, f.lng), 0) / recent.length).toFixed(2)) || 1;
  // timing
  const times = series.map((f) => new Date(f.occurred_at).getTime());
  const gaps = [];
  for (let i = 1; i < times.length; i++) gaps.push((times[i] - times[i - 1]) / 86400000);
  const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  const sdGap = Math.sqrt(gaps.reduce((a, b) => a + (b - avgGap) ** 2, 0) / gaps.length) || 1;
  const last = times[times.length - 1];
  const etaStart = new Date(last + Math.max(0, avgGap - sdGap) * 86400000);
  const etaPeak = new Date(last + avgGap * 86400000);
  const etaEnd = new Date(last + (avgGap + sdGap) * 86400000);
  return {
    center: { lat: Number(lat.toFixed(5)), lng: Number(lng.toFixed(5)) },
    radiusKm,
    eta: { start: etaStart.toISOString(), peak: etaPeak.toISOString(), end: etaEnd.toISOString() },
    avgIntervalDays: Number(avgGap.toFixed(1)),
    basis: `${series.length} incidents; recency-weighted centroid; mean interval ${avgGap.toFixed(1)}d`,
  };
}
