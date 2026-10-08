import { execFileSync, spawn } from 'node:child_process';
import { readFileSync, rmSync } from 'node:fs';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createHoldingProxy } from './s09-hold-proxy.mjs';

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
// The web Worker listens on an inner port; the holding proxy owns `webPort`.
const innerWebPort = parsePort('S09_WEB_INNER_PORT', webPort + 1000);
const apiOrigin = `http://127.0.0.1:${apiPort}`;
const innerWebOrigin = `http://127.0.0.1:${innerWebPort}`;
// A web server that keeps dying is a real fault, not a flake: stop after this.
const maxWebRestarts = 20;
const startupTimeoutMs = 120_000;
const children = [];
const detachedChildren = new Set();
const runToken = `${Date.now()}-${process.pid}`;
const apiName = `wejammin-s09-real-api-${runToken}`;
const webName = `wejammin-s09-real-web-${runToken}`;
const runtimeConfigDirectory = await mkdtemp(
  join(tmpdir(), 'wejammin-s09-real-'),
);
const webConfig = join(runtimeConfigDirectory, 'wrangler.jsonc');
// The service key never goes on a command line: it travels in a 0600 file inside
// the 0700 runtime directory, which the exit hook removes with the web config.
const apiEnvironmentFile = join(runtimeConfigDirectory, 'api.env');
let shuttingDown = false;

/**
 * The Slice 10 editorial routes run against the REAL local Supabase stack
 * (Kong -> PostgREST -> the newest SQL), never a stub. The Worker credential is
 * the stack's own opaque service key; it is read here at run time and handed to
 * the API Worker through a private env file, so no secret lives in source.
 *
 * A missing stack must not take the Slice 09 and Slice 12 real-route specs down
 * with it (they need no database), and it must never be papered over with a
 * fixture: the launcher says so loudly and leaves the editorial routes
 * unregistered (the Worker answers 404), and every Slice 10 spec refuses to run
 * against that (s10-real-world.ts probes the route before it seeds anything).
 */
const supabaseApiUrl = () => {
  try {
    const output = execFileSync(
      'pnpm',
      ['exec', 'supabase', 'status', '-o', 'env'],
      {
        cwd: projectRoot,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      },
    );
    const match = /^API_URL="([^"]+)"$/mu.exec(output);
    if (match?.[1] !== undefined) return match[1];
  } catch {
    // fall through to the documented local default
  }
  return 'http://127.0.0.1:54321';
};

const supabaseServiceKey = () => {
  try {
    const key = execFileSync(
      'docker',
      [
        'exec',
        process.env.POSTGREST_API_KONG_CONTAINER ?? 'supabase_kong_wejammin',
        'sh',
        '-c',
        "grep -o 'sb_secret_[A-Za-z0-9_-]*' /home/kong/kong.yml | head -1",
      ],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    ).trim();
    if (key.startsWith('sb_secret_')) return key;
  } catch {
    // reported by the caller with the remedy
  }
  return null;
};

const resolveSupabaseStack = async () => {
  const url = supabaseApiUrl();
  const secret = supabaseServiceKey();
  if (secret === null) {
    console.error(
      'S10 real-route launcher: cannot read the local Supabase service key; the Slice 10 editorial routes stay unregistered and the Slice 10 specs will refuse to run. Start the stack: pnpm db:start && pnpm db:reset.',
    );
    return null;
  }
  // A database reset restarts the stack under the shared lock; give a reset that
  // is already in flight time to finish before concluding the stack is absent.
  let lastError = 'not attempted';
  for (let attempt = 0; attempt < 45; attempt += 1) {
    try {
      const response = await fetch(`${url}/rest/v1/`, {
        headers: { apikey: secret },
      });
      if (response.status === 200) return { url, secret };
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await sleep(1_000);
  }
  console.error(
    `S10 real-route launcher: the local Supabase API at ${url} is not answering (${lastError}); the Slice 10 editorial routes stay unregistered and the Slice 10 specs will refuse to run. Start it: pnpm db:start && pnpm db:reset.`,
  );
  return null;
};

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
  if (detachedChildren.has(child)) {
    // A detached child leads its own process group: take the whole tree.
    try {
      process.kill(-child.pid, signal);
    } catch {
      // The group may already have exited between the checks above.
    }
    return;
  }
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

let holdingProxy = null;

const shutdown = (code) => {
  if (shuttingDown) return;
  shuttingDown = true;
  cleanupRuntimeConfig();
  void holdingProxy?.close();
  // Detached trees first (they are not in this process group), then the group.
  for (const child of [...children].reverse())
    if (detachedChildren.has(child)) killGroup(child, 'SIGKILL');
  for (const child of [...children].reverse())
    if (!detachedChildren.has(child)) killGroup(child, 'SIGKILL');
  process.exit(code);
};

// If the process that started this launcher (Playwright) dies without sending a
// signal, nothing may be left serving the loopback ports for the next run.
const originalParentId = process.ppid;
setInterval(() => {
  if (process.ppid !== originalParentId) shutdown(1);
}, 1_000).unref();

process.once('SIGINT', () => void shutdown(0));
process.once('SIGTERM', () => void shutdown(0));

const spawnChild = (command, args, watch, detached = false) => {
  const child = spawn(command, args, {
    cwd: projectRoot,
    env: process.env,
    stdio: 'inherit',
    detached,
  });
  children.push(child);
  if (detached) detachedChildren.add(child);
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
  const supabase = await resolveSupabaseStack();
  await writeFile(
    apiEnvironmentFile,
    supabase === null
      ? ''
      : `SUPABASE_URL=${supabase.url}\nSUPABASE_SECRET_KEY=${supabase.secret}\n`,
    { encoding: 'utf8', mode: 0o600 },
  );
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
      '--env-file',
      apiEnvironmentFile,
      '--var',
      `S10_HUMAN_ORIGINS:http://127.0.0.1:${String(webPort)},https://platform-api.internal`,
    ],
    true,
    true,
  );
  await waitFor(`${apiOrigin}/api/v1/health`, 200);

  // The web Worker is stateless (the lane world lives in the API session), and
  // `wrangler dev` exits when its ProxyWorker meets a network error while it
  // forwards a request. The launcher therefore supervises the web session and
  // restarts it; the holding proxy on `webPort` keeps the browser from seeing
  // the gap.
  let webGeneration = 0;
  let webRestarts = 0;
  let webReady = Promise.resolve();

  const startWeb = async () => {
    webGeneration += 1;
    const generation = webGeneration;
    const child = spawnChild(
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
        `${webName}-${String(generation)}`,
        '--ip',
        '127.0.0.1',
        '--port',
        String(innerWebPort),
        '--show-interactive-dev-session=false',
      ],
      false,
      true,
    );
    child.once('exit', (code, signal) => {
      if (shuttingDown || generation !== webGeneration) return;
      console.error(
        `S09 web server exited before teardown (code=${String(code)}, signal=${String(signal)}); restarting (${String(webRestarts + 1)}/${String(maxWebRestarts)})`,
      );
      // Anything the dead session left behind (an orphaned workerd) must not
      // hold the inner port: take its whole process group, exited or not.
      try {
        process.kill(-child.pid, 'SIGKILL');
      } catch {
        // The group is already empty.
      }
      webRestarts += 1;
      if (webRestarts > maxWebRestarts) {
        console.error('S09 web server keeps exiting; giving up.');
        shutdown(1);
        return;
      }
      webReady = startWeb().catch((error) => {
        console.error(error instanceof Error ? error.message : String(error));
        shutdown(1);
      });
    });
    for (let probe = 0; probe < 3; probe += 1) {
      await waitFor(`${innerWebOrigin}/_s09/ready`, 200);
      await sleep(250);
    }
  };

  webReady = startWeb();
  await webReady;
  holdingProxy = createHoldingProxy({
    port: webPort,
    upstreamPort: () => innerWebPort,
    // A restart replaces `webReady`; re-read it on every hold.
    ready: () => webReady,
    onRetry: ({ method, url, code, attempt }) =>
      console.error(
        `S09 held ${method} ${url} (${code}, attempt ${String(attempt)}) until the web server is ready`,
      ),
  });
  await holdingProxy.listen();
  await new Promise(() => undefined);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  shutdown(1);
}
