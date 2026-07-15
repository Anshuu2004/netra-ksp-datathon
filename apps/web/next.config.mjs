import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..', '..');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Self-contained server bundle for Catalyst AppSail (managed Node runtime).
  // Next traces the runtime dependency graph and vendors a minimal node_modules —
  // including the unpublished @netra/core workspace package — into .next/standalone.
  output: 'standalone',
  // Monorepo: trace from the repo root so packages/core resolves and we can pull in
  // the seed dataset (read via fs at runtime, so the tracer can't discover it itself).
  outputFileTracingRoot: repoRoot,
  outputFileTracingIncludes: {
    '/**/*': ['../../data/seed/**/*', '../../packages/core/src/**/*'],
  },
  // @netra/core is plain Node ESM that reads the seed dataset via fs — keep it external
  // so Next loads it at runtime instead of bundling it for the browser.
  serverExternalPackages: ['@netra/core'],
};

export default nextConfig;
