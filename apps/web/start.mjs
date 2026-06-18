// Production start launcher. Catalyst AppSail injects the listen port via the
// X_ZOHO_CATALYST_LISTEN_PORT env var (default 9000; ports <=1024 are disallowed).
// Locally we fall back to PORT or 3000. Using a Node launcher avoids shell-expansion
// differences between AppSail (no shell) and Windows/macOS dev.
import { spawn } from 'node:child_process';

const port = process.env.X_ZOHO_CATALYST_LISTEN_PORT || process.env.PORT || '3000';
const bin = process.platform === 'win32' ? 'next.cmd' : 'next';
console.log(`[netra] starting Next.js on port ${port}`);
const child = spawn(bin, ['start', '-p', String(port)], { stdio: 'inherit' });
child.on('exit', (code) => process.exit(code ?? 0));
