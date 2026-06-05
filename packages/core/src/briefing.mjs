// Proactive "Beat Briefing" generator — the agentic, scheduled side of NETRA.
// A Catalyst Cron job calls this nightly; it scans for emerging spikes, active
// near-repeat series, and high-risk offenders, and produces a per-jurisdiction
// briefing pushed to stations (Catalyst Push/Mail). Moves policing reactive -> proactive.

import { haversineKm } from './dataset.mjs';
import { hotspotStations, nearRepeatCluster, forecastNextStrike } from './analytics/forecast.mjs';
import { repeatOffenders } from './analytics/risk.mjs';

export function generateBriefing(ds, { district } = {}) {
  const now = Date.now();
  const within = (f, days) => (now - new Date(f.occurred_at).getTime()) / 86400000 <= days;
  const inDistrict = (f) => !district || f.district === district;

  const last7 = ds.firs.filter((f) => within(f, 7) && inDistrict(f));

  // emerging hotspots: per-crime-type station spikes over the last 30 days
  const crimeTypes = [...new Set(ds.firs.map((f) => f.crime_type))];
  const emerging = [];
  for (const ct of crimeTypes) {
    const hs = hotspotStations(ds, { crimeType: ct, days: 30, topK: 1 });
    if (hs[0] && hs[0].spike && (!district || hs[0].district === district)) emerging.push({ crime: ct, ...hs[0] });
  }
  emerging.sort((a, b) => b.z - a.z);

  // active near-repeat series for property crimes (with next-strike forecast)
  const active_series = [];
  for (const ct of ['Burglary', 'Chain Snatching', 'Motor Vehicle Theft']) {
    const pool = ds.firs.filter((f) => f.crime_type === ct && inDistrict(f) && f.lat != null);
    const recent = pool.filter((f) => within(f, 45));
    let seed = null, bestN = 0;
    for (const f of recent) {
      const n = recent.filter((g) => haversineKm(f.lat, f.lng, g.lat, g.lng) <= 1.5).length;
      if (n > bestN) { bestN = n; seed = f; }
    }
    if (seed && bestN >= 4) {
      const cluster = nearRepeatCluster(pool, { center: { lat: seed.lat, lng: seed.lng }, radiusKm: 1.5, windowDays: 40, sims: 299 });
      if (cluster.significant) {
        const fc = forecastNextStrike(recent.filter((g) => haversineKm(seed.lat, seed.lng, g.lat, g.lng) <= 1.5));
        const st = ds.index.stationByCode.get(seed.ps_code);
        active_series.push({ crime: ct, station: st ? st.name : seed.district, district: seed.district, cluster, forecast: fc });
      }
    }
  }

  const watch_offenders = repeatOffenders(ds, { area: district, topK: 5 }).filter((o) => o.band !== 'Low');

  return {
    generated_at: new Date(now).toISOString(),
    district: district || 'All Karnataka',
    summary: { last7_total: last7.length, emerging_hotspots: emerging.length, active_series: active_series.length, watch_offenders: watch_offenders.length },
    emerging: emerging.slice(0, 6),
    active_series,
    watch_offenders,
  };
}
