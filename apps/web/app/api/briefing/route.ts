import { getDataProvider } from '@netra/core/providers';
import { generateBriefing } from '@netra/core/briefing';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const provider = getDataProvider();
function getDataset() { return provider.load(); }

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const district = searchParams.get('district') || undefined;
  const briefing = generateBriefing(getDataset(), { district });
  return Response.json(briefing);
}
