import { getAuditLog } from '@netra/core/router';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Governance/traceability (PS1 §10): every query is logged with who/role/intent/entities and
// whether PII was revealed. In production these are also persisted to the Catalyst Data Store
// audit table; here we surface the in-process log for the live demo.
export async function GET() {
  const log = getAuditLog();
  return Response.json({ count: log.length, entries: log.slice(-100).reverse() });
}
