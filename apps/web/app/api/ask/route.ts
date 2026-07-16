import { getDataProvider } from '@netra/core/providers';
import { askEnriched } from '@netra/core/router';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Data access goes through the provider adapter: local synthetic seed in dev,
// Catalyst Data Store in prod (NETRA_ENV) — no handler/route changes needed.
const provider = getDataProvider();
function getDataset() { return provider.load(); }

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const message: string = (body?.message || '').toString();
    const role: string = body?.role || 'investigator';
    const lang: string = body?.lang || 'en';
    const history = Array.isArray(body?.history) ? body.history : [];
    if (!message.trim()) {
      return Response.json({ error: 'Empty message' }, { status: 400 });
    }
    const ds = getDataset();
    const envelope = await askEnriched(ds, message, { role, lang, user_id: 'demo', history });

    // Hydrate the evidence FIR ids into lightweight records so the workstation can drive the
    // timeline (occurred_at), the map overlay (lat/lng) and the inspector from one response.
    // Deliberately NON-PII: no names, no narrative — so this can never bypass the router's
    // role-based redaction. Person labels come from the (already redacted) graph surface.
    // Cover BOTH the cited evidence and every incident plotted on the map, so the timeline
    // represents what the analyst can actually see — and brushing it genuinely re-filters the map.
    const ids = new Set<string>(envelope.evidence?.fir_ids || []);
    if (envelope.surface?.kind === 'map') {
      for (const p of (envelope.surface as any).points || []) if (p?.fir_id) ids.add(p.fir_id);
    }
    const byId = ds.index?.firById;
    const records = byId
      ? [...ids]
          .slice(0, 600)
          .map((id: string) => byId.get(id))
          .filter(Boolean)
          .map((f: any) => ({
            id: f.id,
            crime_type: f.crime_type,
            district: f.district,
            ps_code: f.ps_code,
            occurred_at: f.occurred_at,
            status: f.status,
            lat: f.lat,
            lng: f.lng,
            mo_tags: f.mo_tags,
            value_loss: f.value_loss,
          }))
      : [];

    return Response.json({ ...envelope, context: { records } });
  } catch (err: any) {
    return Response.json({ error: err?.message || 'Internal error' }, { status: 500 });
  }
}

export async function GET() {
  const d = getDataset();
  return Response.json({
    ok: true,
    counts: { firs: d.firs.length, persons: d.persons.length, associations: d.associations.length },
  });
}
