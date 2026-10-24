/** Explicit ALT command/config/container preflight; no default-stack fallback. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, realpathSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ALT_API = 'http://127.0.0.1:55321';
export const ALT_PROJECT =
  '/home/rob/.codex/worktrees/phase2-slice10/orchestration/altdb';
export const DB = 'supabase_db_wejammin_ev';
const REST = 'supabase_rest_wejammin_ev';
const KONG = 'supabase_kong_wejammin_ev';
export const RELEASE = '2026-10-16-local-alt';
export const root = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../..',
);
export const command = (
  program: string,
  args: string[],
  input?: string,
): string => {
  try {
    return execFileSync(program, args, {
      cwd: root,
      input,
      encoding: 'utf8',
      timeout: 150_000,
      maxBuffer: 8 * 1024 * 1024,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch {
    // A CLI/psql exception may contain credentials, claim fixtures or full private rows.
    throw new Error(
      'DEC194 ALT command failed; inspect privately under the root lock.',
    );
  }
};

const privateUrl = (value: string): URL => {
  try {
    return new URL(value);
  } catch {
    throw new Error('Invalid private ALT endpoint configuration.');
  }
};

type Container = {
  Name: string;
  State: { Running: boolean };
  Config: { Env: string[] };
  NetworkSettings: { Ports: Record<string, { HostPort: string }[] | null> };
};

const inspect = (name: string): Container => {
  const rows = JSON.parse(command('docker', ['inspect', name])) as Container[];
  assert.equal(rows.length, 1, 'one explicit ALT container');
  const container = rows[0]!;
  assert.equal(container.Name, `/${name}`, 'exact ALT container identity');
  assert.equal(
    container.State.Running,
    true,
    'root must start the ALT API first',
  );
  return container;
};

export const readDec194AltEnvironment = (): string => {
  assert.equal(
    process.env.S12_DEC194_RPC_ROOT_RELEASE,
    RELEASE,
    'root runtime release required',
  );
  assert.notEqual(
    realpathSync(root),
    '/home/rob/Projects/WeJammin',
    'protected checkout refused',
  );
  const config = readFileSync(
    resolve(ALT_PROJECT, 'supabase/config.toml'),
    'utf8',
  );
  assert.match(config, /^project_id\s*=\s*"wejammin_ev"\s*$/mu);
  const env = Object.fromEntries(
    command('pnpm', [
      'exec',
      'supabase',
      'status',
      '--workdir',
      ALT_PROJECT,
      '-o',
      'env',
    ])
      .split('\n')
      .flatMap((line) => {
        const match = /^([A-Z_]+)="(.*)"$/u.exec(line);
        return match ? [[match[1]!, match[2]!]] : [];
      }),
  );
  assert.equal(
    env.API_URL,
    ALT_API,
    'CLI API and explicit ALT gateway must match',
  );
  const databaseUrl = privateUrl(env.DB_URL ?? 'invalid:');
  assert.equal(databaseUrl.hostname, '127.0.0.1');
  assert.equal(databaseUrl.port, '55322');
  const db = inspect(DB);
  assert.ok(
    db.NetworkSettings.Ports['5432/tcp']?.some(
      (port) => port.HostPort === '55322',
    ),
  );
  const rest = inspect(REST);
  const exposed = rest.Config.Env.find((item) =>
    item.startsWith('PGRST_DB_SCHEMAS='),
  )
    ?.slice('PGRST_DB_SCHEMAS='.length)
    .split(',')
    .map((name) => name.trim());
  assert.ok(
    exposed?.includes('platform_api') &&
      exposed.every((name) => ['platform_api', 'public_api'].includes(name)),
    'only approved API schemas may be exposed; the probe schema stays private',
  );
  const uri = rest.Config.Env.find((item) => item.startsWith('PGRST_DB_URI='));
  assert.ok(uri, 'ALT REST database URI required');
  const upstream = privateUrl(uri.slice('PGRST_DB_URI='.length));
  assert.equal(
    upstream.hostname,
    DB,
    'REST must connect to the exact ALT database',
  );
  assert.equal(upstream.pathname, '/postgres');
  const kong = inspect(KONG);
  assert.ok(
    kong.NetworkSettings.Ports['8000/tcp']?.some(
      (port) => port.HostPort === '55321',
    ),
  );
  const gateway = command('docker', [
    'exec',
    KONG,
    'cat',
    '/home/kong/kong.yml',
  ]);
  assert.ok(gateway.includes(REST), 'gateway must name the ALT REST upstream');
  const secrets = [
    ...new Set(gateway.match(/sb_secret_[A-Za-z0-9_-]+/gu) ?? []),
  ];
  assert.equal(
    secrets.length,
    1,
    'one existing opaque gateway credential; no minted fallback',
  );
  const secret = secrets[0]!;
  return secret;
};
