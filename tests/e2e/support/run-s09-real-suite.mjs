import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import retryBoundary from './s09-real-suite-retry.cjs';

const projectRoot = fileURLToPath(new URL('../../../', import.meta.url));
const maxCapturedOutput = 65_536;

const runOnce = () =>
  new Promise((resolve) => {
    let output = '';
    // The Wrangler crash line can scroll out of the bounded tail while later
    // tests keep printing, so the newest log-path line is kept separately.
    let lastLogLine = '';
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
        const logLines = text.match(/Logs were written to "[^"\r\n]+"/gu);
        if (logLines !== null)
          lastLogLine = logLines[logLines.length - 1] ?? '';
      });
    };
    relay(child.stdout, process.stdout);
    relay(child.stderr, process.stderr);
    child.once('error', (error) => {
      launchError = true;
      process.stderr.write(`Real-route test launch failed: ${error.message}\n`);
    });
    child.once('close', (code) =>
      resolve({
        exitCode: launchError ? 1 : (code ?? 1),
        output: lastLogLine === '' ? output : `${output}\n${lastLogLine}`,
      }),
    );
  });

const exitCode = await retryBoundary.runRealRouteWithRetry({
  runOnce,
  readWranglerLog: (path) => readFile(path, 'utf8'),
  onRetry: ({ attempt, maxAttempts }) => {
    process.stderr.write(
      `Local Wrangler infrastructure disconnected; rerunning the complete real-route suite (retry ${attempt} of ${maxAttempts - 1}).\n`,
    );
  },
});
process.exitCode = exitCode;
