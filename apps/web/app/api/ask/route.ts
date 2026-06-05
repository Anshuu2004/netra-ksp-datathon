import { loadDataset } from '@netra/core/dataset';
import { ask } from '@netra/core/router';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// cache the dataset across requests (loaded once per server process)
let ds: any = null;
function getDataset() {
  if (!ds) ds = loadDataset();
  return ds;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const message: string = (body?.message || '').toString();
    const role: string = body?.role || 'investigator';
    if (!message.trim()) {
      return Response.json({ error: 'Empty message' }, { status: 400 });
    }
    const envelope = ask(getDataset(), message, { role, user_id: 'demo' });
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
