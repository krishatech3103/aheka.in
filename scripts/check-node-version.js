const majorVersion = Number(process.versions.node.split('.')[0]);

if (!Number.isFinite(majorVersion) || majorVersion < 20) {
  console.error(`Aheka requires Node.js 20 or newer. Current version: ${process.version}`);
  console.error('Switch to Node 20 (for example: nvm use) and run npm run dev again.');
  process.exit(1);
}
