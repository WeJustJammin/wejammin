import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

import { expect } from 'vitest';

import {
  MemoryFs,
  rawClock,
} from './phase-02-slice-11-delivery-receiving-upgrade-local-boundary-fixtures';
import {
  rawProcess,
  supabaseBinary,
} from './phase-02-slice-11-delivery-receiving-upgrade-local-process-fixtures';
import { expectValueEqual } from './phase-02-slice-11-delivery-receiving-upgrade-plan-assertions';
import {
  altTarget,
  attestation,
  type Identity,
} from './phase-02-slice-11-delivery-receiving-upgrade-target-fixtures';
import type {
  Api,
  Mode,
  Plan,
  PlanInput,
} from './phase-02-slice-11-delivery-receiving-upgrade-types';

// External in-memory I/O only. No native adapter, process, CLI or database runs.
export const repository = '/unit/dec197-renewal';
export const migration = '20261016030000_delivery_receiving_contracts.sql';
export const hash = (bytes: Buffer | string): string =>
  createHash('sha256').update(bytes).digest('hex');
export const exact = expectValueEqual;
export const source = Buffer.from('begin;\nselect 1;\ncommit;\n');
export const predecessor = {
  path: join(repository, 'supabase/migrations/20261015000000_before.sql'),
  bytes: Buffer.from('select 0;\n'),
  sha256: hash('select 0;\n'),
};
export const baseline = [
  predecessor,
  {
    path: join(repository, 'supabase/migrations', migration),
    bytes: Buffer.from(source),
    sha256: hash(source),
  },
];
export const manifest = (entries: typeof baseline): string =>
  hash(
    entries
      .map((entry) => `${entry.path.split('/').at(-1)}\t${entry.sha256}\n`)
      .join(''),
  );

export function input(mode: Mode = 'negative'): PlanInput {
  return {
    repository,
    targetMigration: migration,
    mode,
    runId: 'renewal',
    target: altTarget(),
    source: {
      path: join(repository, 'supabase/migrations', migration),
      bytes: Buffer.from(source),
      sha256: hash(source),
    },
    witness: Buffer.from(source),
    prefixManifest: {
      entries: [{ ...predecessor, bytes: Buffer.from(predecessor.bytes) }],
      expectedPaths: [predecessor.path],
    },
  };
}

const containers = ['a'.repeat(64), 'b'.repeat(64), 'c'.repeat(64)];
const clusters = [
  '7697190935127949349',
  '7697193352066895909',
  '7697194000000000001',
];
export function image(index: number): Identity {
  return {
    target: altTarget(),
    containerId: containers[index]!,
    clusterId: clusters[index]!,
    databaseOid: '5',
    owner: 'postgres',
  };
}
export function initial(plan: Plan) {
  return {
    ...attestation(plan.target, plan.prefixSha256),
    ...image(0),
    baselineSha256: manifest(baseline),
  };
}
export function transition(plan: Plan, purpose: 'prefix' | 'baseline') {
  const prefix = purpose === 'prefix';
  return {
    kind: 'DEC197_OWNED_RESET_V1',
    purpose,
    sequence: prefix ? 1 : 2,
    from: image(prefix ? 0 : 1),
    to: image(prefix ? 1 : 2),
    fromEpoch: prefix ? null : 'renewal-prefix-1',
    toEpoch: prefix ? 'renewal-prefix-1' : 'renewal-baseline-2',
    inventorySha256: prefix ? manifest([predecessor]) : manifest(baseline),
    sourceSha256: plan.sourceSha256,
    witnessSha256: plan.witnessSha256,
  };
}
export const resetImage = (plan: Plan) => ({
  ...image(1),
  resetEpoch: 'renewal-prefix-1',
  prefixSha256: plan.prefixSha256,
  transition: transition(plan, 'prefix'),
});
export const restoredImage = (plan: Plan) => ({
  ...image(2),
  resetEpoch: 'renewal-baseline-2',
  baselineSha256: manifest(baseline),
  transition: transition(plan, 'baseline'),
});
export type Transition = ReturnType<typeof transition>;
export type RenewalReset = ReturnType<typeof resetImage>;
export type Request = {
  command: { command: string; args: string[] };
  target: ReturnType<typeof altTarget>;
  priorIdentity: Identity;
  fromEpoch: string | null;
  purpose: 'prefix' | 'baseline';
  sequence: number;
  inventory: typeof baseline;
  inventorySha256: string;
  sourceSha256: string;
  witnessSha256: string;
  lease: ReturnType<typeof initial>['lease'];
};
export type RawCompletion = {
  status: number;
  stdout: string;
  stderr: string;
  before: Identity;
  after: Identity;
  inventorySha256: string;
};
// An absent future seam fails inside each test, never aborts collection or skips.
export async function realModule(path: string, names: string[]) {
  let module: Record<string, unknown> | undefined;
  let failure: unknown;
  try {
    module = await import(new URL(`../../${path}`, import.meta.url).href);
  } catch (error) {
    failure = error;
  }
  expect(
    failure,
    `DEC197 required implementation ${path}: ${String(failure)}`,
  ).toBeUndefined();
  for (const name of names)
    expect(typeof module?.[name], `DEC197 required export ${name}`).toBe(
      'function',
    );
  return module!;
}
export async function api(): Promise<Api> {
  const plan = await realModule(
    'infra/database-upgrades/delivery-receiving-upgrade-plan.mjs',
    ['buildUpgradePlan'],
  );
  const runner = await realModule('infra/run-delivery-receiving-upgrade.mjs', [
    'runReceivingUpgrade',
  ]);
  return { ...plan, ...runner } as Api;
}
export function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

export async function smallLocal() {
  const p = (await api()).buildUpgradePlan(input());
  const fs = new MemoryFs();
  for (const entry of baseline)
    fs.put(entry.path, { bytes: Buffer.from(entry.bytes) });
  fs.put(p.source.path, { bytes: Buffer.from(source) });
  const tests = join(repository, 'supabase/tests');
  fs.put(
    join(
      tests,
      'phase_02_slice_11_delivery_receiving/080-forward-migration.sqlinc',
    ),
    { bytes: Buffer.from(source) },
  );
  fs.put(join(repository, 'supabase/seed.sql'), {
    bytes: Buffer.from('select 0;\n'),
  });
  fs.put(join(p.target.workdir, 'supabase/config.toml'), {
    bytes: Buffer.from(
      'project_id = "wejammin_ev"\n[api]\nport = 55321\n[db]\nport = 55322\nmajor_version = 17\n',
    ),
  });
  fs.put(join(p.target.workdir, 'supabase/migrations'), {
    link: join(repository, 'supabase/migrations'),
  });
  fs.put(join(p.target.workdir, 'supabase/tests'), { link: tests });
  fs.put(join(p.target.workdir, 'supabase/seed.sql'), {
    link: join(repository, 'supabase/seed.sql'),
  });
  fs.put(supabaseBinary, { bytes: Buffer.from('UNIT_ONLY_NEVER_EXECUTE') });
  const authority = initial(p);
  fs.put('/proc/4002/status', {
    bytes: Buffer.from('Pid:\t4002\nPPid:\t4001\n'),
  });
  fs.put('/proc/4001/status', { bytes: Buffer.from('Pid:\t4001\nPPid:\t1\n') });
  const rows = authority.lease.locks.map(
    (lock, index) =>
      `${index + 1}: FLOCK ADVISORY ${lock.mode === 'shared' ? 'READ' : 'WRITE'} 4001 08:01:${lock.inode} 0 EOF`,
  );
  fs.put('/proc/locks', { bytes: Buffer.from(rows.join('\n') + '\n') });
  for (const [index, lock] of authority.lease.locks.entries()) {
    fs.put(lock.path, { bytes: Buffer.alloc(0) }, lock.inode);
    for (const pid of [4001, 4002]) {
      fs.put(`/proc/${pid}/fd/${lock.fd}`, { link: lock.path });
      fs.put(`/proc/${pid}/fdinfo/${lock.fd}`, {
        bytes: Buffer.from(`ino:\t${lock.inode}\nlock:\t${rows[index]}\n`),
      });
    }
  }
  const raw = rawProcess(
    p,
    fs,
    baseline.map(({ path }) => ({
      version: path.split('/').at(-1)!.slice(0, 14),
      name: path.split('/').at(-1)!.slice(15, -4),
    })),
  );
  raw.state.metadata.clusterId = image(0).clusterId;
  const { clock, timers } = rawClock();
  return { plan: p, fs, authority, clock, timers, ...raw };
}
