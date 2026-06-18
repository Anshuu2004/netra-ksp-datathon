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
    const envelope = await askEnriched(getDataset(), message, { role, lang, user_id: 'demo', history });
    return Response.json(envelope);
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
