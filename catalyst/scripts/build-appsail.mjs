// Produces a SELF-CONTAINED Catalyst AppSail bundle from the Next.js standalone output.
//
// Why this exists: NETRA is an npm-workspace monorepo whose web app depends on the
// UNPUBLISHED @netra/core package and reads data/seed/*.json from disk at runtime.
// `next build` (output:'standalone') traces a minimal node_modules, but (a) it does not
// copy .next/static, (b) it drops @netra/core's package.json so the /router,/providers,
// /briefing subpath exports won't resolve, and (c) fs-read data files aren't discoverable
// by the tracer. This script repairs all three and drops in an AppSail port launcher, so
// the bundle at apps/web/.next/standalone runs with a bare `node launch.mjs`.
//
// Run:  node catalyst/scripts/build-appsail.mjs   (from the repo root)

import { execSync } from 'node:child_process';
import { cpSync, writeFileSync, existsSync, rmSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..');
const web = join(repoRoot, 'apps', 'web');
const standalone = join(web, '.next', 'standalone');

const log = (m) => console.log(`[build-appsail] ${m}`);

// 1. Production build with standalone output (wipes/regenerates .next/standalone).
log('building apps/web (next standalone)…');
execSync('npm run build --workspace=apps/web', { cwd: repoRoot, stdio: 'inherit' });

// 2. Standalone omits static assets — copy them into the mirrored app path.
log('copying .next/static …');
cpSync(join(web, '.next', 'static'), join(standalone, 'apps', 'web', '.next', 'static'), { recursive: true });
if (existsSync(join(web, 'public'))) {
  cpSync(join(web, 'public'), join(standalone, 'apps', 'web', 'public'), { recursive: true });
}

// 3. Vendor @netra/core as a REAL node_modules package (package.json exports map + src),
//    so `@netra/core`, `@netra/core/router`, `/providers`, `/briefing` all resolve at runtime.
log('vendoring @netra/core into node_modules …');
const coreDst = join(standalone, 'node_modules', '@netra', 'core');
rmSync(coreDst, { recursive: true, force: true });
mkdirSync(coreDst, { recursive: true });
cpSync(join(repoRoot, 'packages', 'core', 'package.json'), join(coreDst, 'package.json'));
cpSync(join(repoRoot, 'packages', 'core', 'src'), join(coreDst, 'src'), { recursive: true });

// 4. Ensure the seed dataset is present at the bundle root (tracer include is best-effort).
const seedDst = join(standalone, 'data', 'seed');
if (!existsSync(join(seedDst, 'persons.json'))) {
  log('copying data/seed …');
  cpSync(join(repoRoot, 'data', 'seed'), seedDst, { recursive: true });
}

// 5. Replace the bundle-root package.json. Next copies the monorepo ROOT package.json
//    (workspaces + the unpublished "@netra/core":"*" dep) into the standalone root. If the
//    AppSail managed runtime runs `npm install` on it, npm tries to resolve those and CRASHES
//    the container (→ 503). Everything is already vendored in node_modules, so no install is
//    needed — ship a minimal, install-safe manifest instead.
log('writing minimal root package.json …');
writeFileSync(join(standalone, 'package.json'), JSON.stringify({
  name: 'netra-web',
  version: '0.1.0',
  private: true,
  type: 'module',
  scripts: { start: 'node launch.mjs' },
  engines: { node: '>=18' },
}, null, 2) + '\n');

// 6. AppSail launcher: map the injected listen port → PORT, pin NETRA_SEED_DIR to an
//    absolute path (cwd-independent), then hand off to the Next standalone server.
log('writing launch.mjs …');
writeFileSync(join(standalone, 'launch.mjs'), `import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const here = dirname(fileURLToPath(import.meta.url));
// AppSail injects the listen port via X_ZOHO_CATALYST_LISTEN_PORT; its default is 9000.
// Fall back to 9000 (NOT 3000) so the health check finds us even if the var is absent.
const port = process.env.X_ZOHO_CATALYST_LISTEN_PORT || process.env.PORT || '9000';
process.env.PORT = String(port);
process.env.HOSTNAME = '0.0.0.0';          // bind all interfaces so the health check reaches us
process.env.NETRA_SEED_DIR = process.env.NETRA_SEED_DIR || join(here, 'data', 'seed');
process.on('uncaughtException', (e) => console.error('[netra] uncaughtException:', e));
process.on('unhandledRejection', (e) => console.error('[netra] unhandledRejection:', e));
console.log('[netra] cwd=' + process.cwd() + ' here=' + here);
console.log('[netra] starting Next standalone on 0.0.0.0:' + port + ' · seed=' + process.env.NETRA_SEED_DIR);
try {
  await import('./apps/web/server.js');
} catch (e) {
  console.error('[netra] FAILED to start server.js:', e);
  process.exit(1);
}
`);

// 7. Assemble the Catalyst deploy STRUCTURE the way the official sample proves works. The
//    KEY the logs revealed: the CLI CLEANS buildPath and repopulates it by running the
//    app-config `predeploy` script — so an unpopulated (or pre-populated-then-wiped)
//    buildPath ships an EMPTY /catalyst → "Cannot read /catalyst/package.json" → crash-loop.
//    Fix: keep the self-contained bundle in a STAGING dir (bundle/, which the CLI leaves
//    alone) and have predeploy copy bundle/ → build/ at deploy time.
//
//    Layout (all OUTSIDE the repo so .gitignore can't strip node_modules/):
//      <deployRoot>/                    ← catalyst.json "source" (CLI preserves this tree)
//        app-config.json                ← command + absolute buildPath + stack + memory + predeploy
//        prepare.mjs                    ← predeploy: copies ./bundle → ./build
//        bundle/                        ← the self-contained bundle (staging, survives clean)
//        build/                         ← buildPath: predeploy fills it; CONTENTS upload to /catalyst
//    catalyst.json is written at the repo root (where `catalyst deploy` runs, next to .catalystrc).
const toPosix = (p) => p.replace(/\\/g, '/');
const deployRoot = join(repoRoot, '..', 'netra-appsail');
const stagingDir = join(deployRoot, 'bundle');
const buildPath = join(deployRoot, 'build');
log(`assembling Catalyst deploy structure → ${deployRoot} …`);
rmSync(deployRoot, { recursive: true, force: true });
mkdirSync(deployRoot, { recursive: true });
cpSync(standalone, stagingDir, { recursive: true });   // staging (survives CLI clean)
cpSync(standalone, buildPath, { recursive: true });    // initial fill (in case predeploy is skipped)

// predeploy script: repopulate build/ from the staging bundle/. Runs with CWD = source dir.
writeFileSync(join(deployRoot, 'prepare.mjs'), `import { cpSync, rmSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const here = dirname(fileURLToPath(import.meta.url));
const build = join(here, 'build');
rmSync(build, { recursive: true, force: true });
mkdirSync(build, { recursive: true });
cpSync(join(here, 'bundle'), build, { recursive: true });
console.log('[prepare] build/ repopulated from bundle/');
`);

// app-config.json lives in the source dir; buildPath is ABSOLUTE (POSIX slashes). npm run
// start (→ node launch.mjs) matches the working sample and locates package.json via npm.
writeFileSync(join(deployRoot, 'app-config.json'), JSON.stringify({
  command: 'npm run start',
  buildPath: toPosix(buildPath),
  stack: 'node20',
  memory: 512,
  env_variables: {},
  scripts: { predeploy: 'node prepare.mjs' },
}, null, 2) + '\n');

// catalyst.json registers the AppSail resource for `catalyst deploy` (name matches the
// existing console app so it deploys in place).
writeFileSync(join(repoRoot, 'catalyst.json'), JSON.stringify({
  appsail: [{ source: toPosix(deployRoot), name: 'netra-web' }],
}, null, 2) + '\n');

log(`bundle ready → ${buildPath}`);
log('deploy with (from repo root):  catalyst deploy --only appsail');
