import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, vi } from 'vitest';

import { expectValueEqual } from './phase-02-slice-11-delivery-receiving-upgrade-plan-assertions';
import { attachOwnedResetPorts } from './phase-02-slice-11-delivery-receiving-upgrade-local-owned-reset-fixtures';
import {
  rawProcess,
  supabaseBinary,
} from './phase-02-slice-11-delivery-receiving-upgrade-local-process-fixtures';

import type {
  Document,
  Plan,
} from './phase-02-slice-11-delivery-receiving-upgrade-fixtures';
import {
  MemoryFs,
  rawClock,
  type RawCommand,
} from './phase-02-slice-11-delivery-receiving-upgrade-local-boundary-fixtures';
import {
  altTarget,
  attestation,
  envelope,
  reset,
  type Attestation,
  type Reset,
  type Restoration,
} from './phase-02-slice-11-delivery-receiving-upgrade-target-fixtures';

export const repository = fileURLToPath(new URL('../../', import.meta.url));
export const targetName = '20261016030000_delivery_receiving_contracts.sql';
export const testRoot = join(repository, 'supabase/tests');
export const receiving = join(testRoot, 'phase_02_slice_11_delivery_receiving');
export const promoted = join(repository, 'supabase/migrations');
export { supabaseBinary };
export const hash = (bytes: Buffer | string): string =>
  createHash('sha256').update(bytes).digest('hex');
export const manifestHash = (
  entries: Array<{ path: string; sha256: string }>,
): string =>
  hash(
    entries
      .map((entry) => `${entry.path.split('/').at(-1)}\t${entry.sha256}\n`)
      .join(''),
  );

export type Fixture = Awaited<ReturnType<typeof fixture>>;
export async function fixture(mode: 'negative' | 'positive' = 'negative') {
  const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
  const fs = new MemoryFs();
  const entries = actual
    .readdirSync(promoted)
    .filter((name) => name.endsWith('.sql'))
    .sort()
    .map((name) => {
      const path = join(promoted, name);
      const bytes = actual.readFileSync(path);
      fs.put(path, { bytes: Buffer.from(bytes) });
      return { path, bytes: Buffer.from(bytes), sha256: hash(bytes) };
    });
  const sourcePath = join(promoted, targetName);
  const bytes = actual.readFileSync(sourcePath);
  const include = (path: string, seen = new Set<string>()): void => {
    if (seen.has(path)) return;
    seen.add(path);
    const content = actual.readFileSync(path);
    fs.put(path, { bytes: content });
    for (const match of content
      .toString()
      .matchAll(/^\s*\\ir\s+([^\r\n]+)\s*$/gm)) {
      include(resolve(dirname(path), match[1]!.trim()), seen);
    }
  };
  for (const name of [
    '060-upgrade-world.sqlinc',
    '065-upgrade-empty-world.sqlinc',
    '070-upgrade-snapshot.sqlinc',
    '080-forward-migration.sqlinc',
  ]) {
    include(join(receiving, name));
  }
  include(join(testRoot, 'support/jwt-claims.sqlinc'));
  const target = altTarget();
  fs.put(join(target.workdir, 'supabase/config.toml'), {
    bytes: actual.readFileSync(join(target.workdir, 'supabase/config.toml')),
  });
  fs.put(join(target.workdir, 'supabase/migrations'), { link: promoted });
  fs.put(join(target.workdir, 'supabase/tests'), { link: testRoot });
  fs.put(join(repository, 'supabase/seed.sql'), {
    bytes: actual.readFileSync(join(repository, 'supabase/seed.sql')),
  });
  fs.put(join(target.workdir, 'supabase/seed.sql'), {
    link: join(repository, 'supabase/seed.sql'),
  });
  fs.put(supabaseBinary, {
    bytes: Buffer.from('UNIT_EXTERNAL_CLI_NOT_EXECUTABLE'),
  });
  const prefix = entries.filter(
    (entry) => entry.path.split('/').at(-1)! < targetName,
  );
  const plan: Plan = {
    repository,
    targetMigration: targetName,
    mode,
    runId: 'localunit',
    target,
    source: {
      path: sourcePath,
      bytes: Buffer.from(bytes),
      sha256: hash(bytes),
    },
    witness: Buffer.from(bytes),
    applicationName: `dec197-localunit-${mode}`,
    sourceSha256: hash(bytes),
    witnessSha256: hash(bytes),
    prefixSha256: manifestHash(prefix),
    prefixManifest: {
      expectedPaths: prefix.map((entry) => entry.path),
      entries: prefix,
    },
  };
  const attested = attestation(target, plan.prefixSha256);
  attested.baselineSha256 = manifestHash(entries);
  const locks = attested.lease.locks;
  fs.put('/proc/self', { link: '/proc/4002' });
  fs.put('/proc/4002/status', {
    bytes: Buffer.from('Pid:\t4002\nPPid:\t4001\n'),
  });
  fs.put('/proc/4001/status', { bytes: Buffer.from('Pid:\t4001\nPPid:\t1\n') });
  const lockText = locks.map(
    (lock, index) =>
      `${index + 1}: FLOCK ADVISORY ${lock.mode === 'shared' ? 'READ' : 'WRITE'} 4001 08:01:${lock.inode} 0 EOF`,
  );
  fs.put('/proc/locks', { bytes: Buffer.from(`${lockText.join('\n')}\n`) });
  for (const [index, lock] of locks.entries()) {
    fs.put(lock.path, { bytes: Buffer.alloc(0) }, lock.inode);
    for (const pid of [4001, 4002]) {
      fs.put(`/proc/${pid}/fd/${lock.fd}`, { link: lock.path });
      fs.put(`/proc/${pid}/fdinfo/${lock.fd}`, {
        bytes: Buffer.from(
          `pos:\t0\nflags:\t0100002\nmnt_id:\t1\nino:\t${lock.inode}\nlock:\t${lockText[index]}\n`,
        ),
      });
    }
  }
  const initialHistory = entries.map(({ path }) => {
    const name = path.split('/').at(-1)!;
    return { version: name.slice(0, 14), name: name.slice(15, -4) };
  });
  const raw = rawProcess(plan, fs, initialHistory);
  const ownedReset = attachOwnedResetPorts(plan, raw);
  const { state, readOnlyCalls, resets, children, spawned, process } = raw;
  const { clock, timers } = rawClock();
  return {
    plan,
    fs,
    process,
    clock,
    timers,
    children,
    spawned,
    state,
    ownedReset,
    readOnlyCalls,
    resets,
    attested,
    reset: reset(target, plan.prefixSha256, mode),
    entries,
  };
}

export type PrefixIo = {
  preparePrefix(plan: Plan): Promise<Attestation>;
  resetBefore(plan: Plan, attestation: Attestation): Promise<Reset>;
  restoreBaseline(plan: Plan, attestation: Attestation): Promise<Restoration>;
};
export type SessionIo = {
  setupWorld(plan: Plan, reset: Reset): Promise<Record<string, unknown>>;
  observe(
    phase: 'before' | 'after',
    plan: Plan,
    reset: Reset,
  ): Promise<ReturnType<typeof envelope> & { document: Document }>;
  executeMigration(
    invocation: RawCommand,
    plan: Plan,
    reset: Reset,
  ): Promise<
    ReturnType<typeof envelope> & {
      status: number;
      stdout: string;
      stderr: string;
    }
  >;
};
export async function localAdapter(
  kind: 'prefix',
  mock: Fixture,
): Promise<PrefixIo>;
export async function localAdapter(
  kind: 'session',
  mock: Fixture,
): Promise<SessionIo>;
export async function localAdapter(kind: 'prefix' | 'session', mock: Fixture) {
  const url = new URL(
    `../../infra/database-upgrades/delivery-receiving-upgrade-local-${kind}.mjs`,
    import.meta.url,
  ).href;
  let module: Record<string, unknown>;
  try {
    module = await import(url);
  } catch (error) {
    throw new Error(
      `DEC197_LOCAL_${kind.toUpperCase()}_UNAVAILABLE: ${String(error)}`,
      { cause: error },
    );
  }
  const name =
    kind === 'prefix'
      ? 'createLocalPrefixAdapter'
      : 'createLocalSessionAdapter';
  expect(module[name], `required real export ${name}`).toBeTypeOf('function');
  const create = module[name] as (options: {
    fs: MemoryFs;
    process: Fixture['process'];
    clock: Fixture['clock'];
    lease: Attestation['lease'];
  }) => PrefixIo | SessionIo;
  return create({
    fs: mock.fs,
    process: mock.process,
    clock: mock.clock,
    lease: mock.attested.lease,
  });
}
export async function turn(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

export const noClient = (mock: Fixture) => {
  expect(mock.process.spawn.mock.calls).toEqual([]);
  expect(mock.children).toEqual([]);
};
export const noMutationProcess = (mock: Fixture, priorResets = 0) => {
  noClient(mock);
  expect(mock.resets).toHaveLength(priorResets);
  expect(
    mock.process.run.mock.calls.filter(
      ([command]) => !mock.readOnlyCalls.includes(command),
    ),
  ).toEqual(mock.resets.map(({ command }) => [command]));
};
export const noReset = (mock: Fixture) => {
  noMutationProcess(mock);
  expect(mock.fs.writes).toEqual([]);
};
export const expectStaged = (
  mock: Fixture,
  index: number,
  entries: Fixture['entries'],
) => {
  expectValueEqual(
    mock.resets[index]?.staged,
    entries.map(({ path, bytes, sha256 }) => ({
      name: path.split('/').at(-1),
      regular: true,
      bytes: Buffer.from(bytes),
      sha256,
    })),
    'staged',
  );
};
