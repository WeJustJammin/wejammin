import { spawn } from 'node:child_process';
import { readFileSync, rmSync } from 'node:fs';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('../../../', import.meta.url));
const apiScript = `${projectRoot}/tests/e2e/support/content-schema-registry-api.ts`;
const apiConfig = `${projectRoot}/tests/e2e/support/wrangler.s09-api.jsonc`;
const webScript = `${projectRoot}/apps/web/content-schema-registry-web.mjs`;
const webConfigTemplate = `${projectRoot}/apps/web/wrangler.s09-real.jsonc`;

const parsePort = (name, fallback) => {
  const value = process.env[name] ?? String(fallback);
  if (!/^[1-9][0-9]{2,4}$/u.test(value))
    throw new TypeError(`${name} must be a TCP port`);
  return Number(value);
};

const apiPort = parsePort('S09_API_PORT', 8788);
const webPort = parsePort('S09_WEB_PORT', 4324);
const apiOrigin = `http://127.0.0.1:${apiPort}`;
const webOrigin = `http://127.0.0.1:${webPort}`;
const startupTimeoutMs = 120_000;
const children = [];
const runToken = `${Date.now()}-${process.pid}`;
const apiName = `wejammin-s09-real-api-${runToken}`;
const webName = `wejammin-s09-real-web-${runToken}`;
const runtimeConfigDirectory = await mkdtemp(
  join(tmpdir(), 'wejammin-s09-real-'),
);
const webConfig = join(runtimeConfigDirectory, 'wrangler.jsonc');
let shuttingDown = false;

const processGroupId = () => {
  try {
    const stat = readFileSync('/proc/self/stat', 'utf8');
    const fields = stat.slice(stat.lastIndexOf(')') + 2).split(' ');
    return Number(fields[2]);
  } catch {
    return null;
  }
};
const ownProcessGroupId = processGroupId();

// The runtime config lives outside the repository. The exit hook covers clean
// completion; shutdown handles signals and child failures synchronously.
const cleanupRuntimeConfig = () =>
  rmSync(runtimeConfigDirectory, { recursive: true, force: true });
process.once('exit', cleanupRuntimeConfig);

const sleep = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

const killGroup = (child, signal) => {
  if (child.exitCode !== null || child.signalCode !== null) return;
  if (ownProcessGroupId === process.pid) {
    try {
      process.kill(-process.pid, signal);
    } catch {
      // The group may already have exited between the checks above.
    }
    return;
  }
  child.kill(signal);
};

const shutdown = (code) => {
  if (shuttingDown) return;
  shuttingDown = true;
  cleanupRuntimeConfig();
  for (const child of [...children].reverse()) killGroup(child, 'SIGKILL');
  process.exit(code);
};

process.once('SIGINT', () => void shutdown(0));
process.once('SIGTERM', () => void shutdown(0));

const spawnChild = (command, args, watch) => {
  const child = spawn(command, args, {
    cwd: projectRoot,
    env: process.env,
    stdio: 'inherit',
  });
  children.push(child);
  if (watch)
    child.once('exit', (code, signal) => {
      if (!shuttingDown) {
        console.error(
          `S09 ${args[1]} server exited before teardown (code=${String(code)}, signal=${String(signal)})`,
        );
        shutdown(code === null || code === 0 ? 1 : code);
      }
    });
  return child;
};

const runChecked = (command, args) =>
  new Promise((resolve, reject) => {
    const child = spawnChild(command, args, false);
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (code === 0) resolve();
      else
        reject(
          new Error(
            `${command} exited with code=${String(code)}, signal=${String(signal)}`,
          ),
        );
    });
  });

const waitFor = async (url, expectedStatus) => {
  const deadline = Date.now() + startupTimeoutMs;
  let lastError = 'not attempted';
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { redirect: 'manual' });
      if (response.status === expectedStatus) return;
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await sleep(250);
  }
  throw new Error(`Timed out waiting for ${url} (${lastError})`);
};

try {
  await runChecked('pnpm', ['--filter', '@wejammin/web', 'build']);
  const template = await readFile(webConfigTemplate, 'utf8');
  await writeFile(
    webConfig,
    template
      .replaceAll(
        '"./content-schema-registry-web.mjs"',
        JSON.stringify(webScript),
      )
      .replaceAll(
        '"./dist/client"',
        JSON.stringify(`${projectRoot}/apps/web/dist/client`),
      )
      .replaceAll('wejammin-s09-real-api', apiName)
      .replaceAll('wejammin-s09-real-web', webName),
    'utf8',
  );

  spawnChild(
    'pnpm',
    [
      '--filter',
      '@wejammin/worker',
      'exec',
      'wrangler',
      'dev',
      apiScript,
      '--config',
      apiConfig,
      '--name',
      apiName,
      '--ip',
      '127.0.0.1',
      '--port',
      String(apiPort),
      '--show-interactive-dev-session=false',
    ],
    true,
  );
  await waitFor(`${apiOrigin}/api/v1/health`, 200);

  spawnChild(
    'pnpm',
    [
      '--filter',
      '@wejammin/web',
      'exec',
      'wrangler',
      'dev',
      webScript,
      '--config',
      webConfig,
      '--name',
      webName,
      '--ip',
      '127.0.0.1',
      '--port',
      String(webPort),
      '--show-interactive-dev-session=false',
    ],
    true,
  );
  for (let probe = 0; probe < 3; probe += 1) {
    await waitFor(`${webOrigin}/_s09/ready`, 200);
    await sleep(250);
  }
  await new Promise(() => undefined);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  shutdown(1);
}
