import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import { basename } from 'node:path';

import { expect, vi } from 'vitest';

import type { rawProcess } from './phase-02-slice-11-delivery-receiving-upgrade-local-process-fixtures';
import type { Plan } from './phase-02-slice-11-delivery-receiving-upgrade-types';

type Raw = ReturnType<typeof rawProcess>;
type History = Array<{ version: string; name: string }>;
type Identity = {
  target: Plan['target'];
  containerId: string;
  clusterId: string;
  databaseOid: string;
  owner: string;
};
type Entry = { path: string; bytes: Buffer; sha256: string };
type Request = {
  command: Parameters<Raw['process']['run']>[0];
  inventory: Entry[];
  inventorySha256: string;
};
type Outcome = { status: number; stdout: string; stderr: string };
type Registered = {
  command: Request['command'];
  inventory: Entry[];
  inventorySha256: string;
  before: Identity;
  phase: 'registered' | 'running' | 'settled';
  drained: boolean;
  recoveryUsed: boolean;
  outcome?: Outcome;
  stagedSha256?: string;
};

const hash = (value: Buffer | string) =>
  createHash('sha256').update(value).digest('hex');
const manifest = (entries: Entry[]) =>
  hash(
    entries
      .map((entry) => `${basename(entry.path)}\t${hash(entry.bytes)}\n`)
      .join(''),
  );

// Opt-in trusted native-process double for the OLD local adapter suites only.
// It supplies raw ownership observations, never a reset epoch/transition or a
// production validation decision. rawProcess remains capability-free by default.
export function attachOwnedResetPorts(plan: Plan, raw: Raw) {
  const records = new WeakMap<object, Registered>();
  let active: object | undefined;
  let latest: object | undefined;
  const control: { historyAfterReset?: History } = {};

  const observe = (): Identity => ({
    target: {
      ...plan.target,
      locks: plan.target.locks.map((lock) => ({ ...lock })),
    },
    containerId: raw.state.containerId,
    clusterId: raw.state.metadata.clusterId,
    databaseOid: raw.state.metadata.databaseOid,
    owner: raw.state.metadata.owner,
  });

  function owned(handle: object) {
    const record = records.get(handle);
    if (!record || latest !== handle || record.recoveryUsed)
      throw new Error('UNOWNED_OR_CONSUMED_LOCAL_RESET_HANDLE');
    return record;
  }

  function stagedDigest(record: Registered, resetIndex: number) {
    const staged = raw.resets[resetIndex]?.staged;
    expect(
      staged,
      'the existing raw reset port captured its staged files',
    ).toBeDefined();
    expect(staged).toHaveLength(record.inventory.length);
    const entries = record.inventory.map((entry, index) => {
      const file = staged![index]!;
      expect(file.name).toBe(basename(entry.path));
      expect(file.regular).toBe(true);
      expect(Buffer.isBuffer(file.bytes)).toBe(true);
      expect(file.bytes!.equals(entry.bytes)).toBe(true);
      expect(file.sha256).toBe(hash(file.bytes!));
      expect(file.sha256).toBe(entry.sha256);
      return { ...entry, bytes: Buffer.from(file.bytes!) };
    });
    return manifest(entries);
  }

  function completion(record: Registered, outcome: Outcome) {
    const after = observe();
    // This old raw process model performs an owned reset without recreating its
    // physical identity. Actual renewal has separate independently literal tests.
    expect(after).toEqual(record.before);
    return {
      ...outcome,
      before: record.before,
      after,
      inventorySha256: record.stagedSha256 ?? record.inventorySha256,
    };
  }

  const beginOwnedReset = vi.fn((request: Request) => {
    if (active) throw new Error('LOCAL_RESET_HANDLE_STILL_ACTIVE');
    const handle = Object.freeze({});
    const inventory = request.inventory.map((entry) => ({
      ...entry,
      bytes: Buffer.from(entry.bytes),
    }));
    records.set(handle, {
      command: { ...request.command, args: [...request.command.args] },
      inventory,
      inventorySha256: manifest(inventory),
      before: observe(),
      phase: 'registered',
      drained: false,
      recoveryUsed: false,
    });
    active = handle;
    latest = handle;
    return handle;
  });

  const completeOwnedReset = vi.fn(async (handle: object) => {
    const record = owned(handle);
    if (active !== handle || record.phase !== 'registered')
      throw new Error('LOCAL_RESET_ALREADY_EXECUTED');
    record.phase = 'running';
    const resetIndex = raw.resets.length;
    try {
      // Keep the exact existing vi.fn boundary, including getMockImplementation
      // holds, call accounting, argv rejection and the original thrown object.
      const outcome = await raw.process.run(record.command);
      record.outcome = outcome;
      record.stagedSha256 = stagedDigest(record, resetIndex);
      expect(record.stagedSha256).toBe(record.inventorySha256);
      if (control.historyAfterReset)
        raw.state.history = control.historyAfterReset.map((row) => ({
          ...row,
        }));
      const answer = completion(record, outcome);
      if (outcome.status === 0) active = undefined;
      return answer;
    } finally {
      // Even a rejection must settle the exact raw promise before recovery.
      record.phase = 'settled';
      record.drained = true;
    }
  });

  const proveRecoveryOwnership = vi.fn(async (handle: object) => {
    const record = owned(handle);
    if (
      (active && active !== handle) ||
      record.phase === 'running' ||
      (record.phase === 'settled' && !record.drained)
    )
      throw new Error('LOCAL_RESET_NOT_DRAINED');
    // A registered-but-unstarted operation never entered raw process.run. A
    // failed operation has settled it. Neither path manufactures applied history.
    const answer = completion(
      record,
      record.outcome ?? { status: 1, stdout: '', stderr: '' },
    );
    record.recoveryUsed = true;
    active = undefined;
    return answer;
  });

  Object.assign(raw.process, {
    beginOwnedReset,
    completeOwnedReset,
    proveRecoveryOwnership,
  });
  return control;
}
