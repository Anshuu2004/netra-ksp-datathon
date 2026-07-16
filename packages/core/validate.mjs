// PROOF-OF-REAL-RESULTS harness (CLI).
//
// Thin wrapper over src/validate.mjs so the terminal proof and the in-app proof (/api/validate,
// rendered in the workstation) run the EXACT same checks and can never drift apart.
// Run: npm run validate

import { runValidation } from './src/validate.mjs';

const { checks, passed, failed } = runValidation();

console.log('\n=== NETRA analytics validation (recover planted ground-truth) ===\n');
for (const c of checks) {
  console.log(`${c.pass ? '✅ PASS' : '❌ FAIL'}  ${c.name}${c.detail ? `  — ${c.detail}` : ''}`);
  console.log(`         method: ${c.method}`);
}
console.log(`\n=== ${passed} passed, ${failed} failed ===`);
process.exit(failed > 0 ? 1 : 0);
