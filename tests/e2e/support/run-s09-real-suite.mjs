import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import retryBoundary from './s09-real-suite-retry.cjs';

const projectRoot = fileURLToPath(new URL('../../../', import.meta.url));
const maxCapturedOutput = 65_536;

const runOnce = () =>
  new Promise((resolve) => {
    let output = '';
    let launchError = false;
    const child = spawn(
      'pnpm',
      ['exec', 'playwright', 'test', '--config=playwright.s09-real.config.ts'],
      {
        cwd: projectRoot,
        env: process.env,
        stdio: ['inherit', 'pipe', 'pipe'],
      },
    );
    const relay = (stream, destination) => {
      stream.on('data', (chunk) => {
        const text = chunk.toString('utf8');
        destination.write(chunk);
        output = (output + text).slice(-maxCapturedOutput);
      });
    };
    relay(child.stdout, process.stdout);
    relay(child.stderr, process.stderr);
    child.once('error', (error) => {
      launchError = true;
      process.stderr.write(`Real-route test launch failed: ${error.message}\n`);
    });
    child.once('close', (code) =>
      resolve({ exitCode: launchError ? 1 : (code ?? 1), output }),
    );
  });

const exitCode = await retryBoundary.runRealRouteWithRetry({
  runOnce,
  readWranglerLog: (path) => readFile(path, 'utf8'),
  onRetry: () => {
    process.stderr.write(
      'Local Wrangler ProxyWorker disconnected; retrying the complete ten-test real-route suite once.\n',
    );
  },
});
process.exitCode = exitCode;
