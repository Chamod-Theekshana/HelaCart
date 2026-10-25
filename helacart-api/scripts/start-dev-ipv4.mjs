import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const nestCli = fileURLToPath(
  new URL('../node_modules/@nestjs/cli/bin/nest.js', import.meta.url),
);
const nodeOptions = [
  process.env.NODE_OPTIONS,
  '--no-network-family-autoselection',
  '--dns-result-order=ipv4first',
]
  .filter(Boolean)
  .join(' ');

const child = spawn(process.execPath, [nestCli, 'start', '--watch'], {
  stdio: 'inherit',
  env: { ...process.env, NODE_OPTIONS: nodeOptions },
});

child.on('error', (error) => {
  console.error('Unable to start Nest:', error.message);
  process.exitCode = 1;
});

child.on('exit', (code) => {
  process.exitCode = code ?? 1;
});
