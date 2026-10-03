const { existsSync } = require('node:fs');
const { spawn } = require('node:child_process');
const { resolve } = require('node:path');

// Node 20 requires this flag for the WebSocket implementation used by the
// Supabase client. Keep any options the developer has already supplied.
if (!process.env.NODE_OPTIONS?.split(/\s+/).includes('--experimental-websocket')) {
  process.env.NODE_OPTIONS = [process.env.NODE_OPTIONS, '--experimental-websocket']
    .filter(Boolean)
    .join(' ');
}

// Some managed Linux workstations provide their trusted corporate CA chain in
// the system bundle but not in Node's default trust store. Use it only when it
// exists and never override an explicit developer setting.
const systemCaBundle = '/etc/ssl/certs/ca-certificates.crt';
if (!process.env.NODE_EXTRA_CA_CERTS && existsSync(systemCaBundle)) {
  process.env.NODE_EXTRA_CA_CERTS = systemCaBundle;
}

const astroCli = resolve(process.cwd(), 'node_modules/astro/astro.js');
const child = spawn(process.execPath, [astroCli, 'dev', ...process.argv.slice(2)], {
  env: process.env,
  stdio: 'inherit',
});

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
