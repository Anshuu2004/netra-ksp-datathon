import { loadDataset } from '@netra/core/dataset';
import { generateBriefing } from '@netra/core/briefing';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

let ds: any = null;
function getDataset() { if (!ds) ds = loadDataset(); return ds; }

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const district = searchParams.get('district') || undefined;
  const briefing = generateBriefing(getDataset(), { district });
  return Response.json(briefing);
}
