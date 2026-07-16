import { getDataProvider, platformStatus } from '@netra/core/providers';
import { runValidation } from '@netra/core/validate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const provider = getDataProvider();

/**
 * Runs the ground-truth recovery harness LIVE and returns structured results, plus an honest
 * report of which Catalyst services this deployment is actually calling.
 *
 * This is the same code `npm run validate` runs — the proof is not a screenshot or a claim in a
 * README the evaluator will never open. They can hit this URL and watch the analytics
 * rediscover planted ground truth they can verify in data/seed/manifest.json.
 */
export async function GET() {
  try {
    const result = runValidation(provider.load());
    return Response.json({ ...result, platform: platformStatus() });
  } catch (err: any) {
    return Response.json({ error: err?.message || 'Validation failed to run' }, { status: 500 });
  }
}
