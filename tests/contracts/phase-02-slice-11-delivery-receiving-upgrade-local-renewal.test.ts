import { Buffer } from 'node:buffer';
import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import {
  api,
  baseline,
  deferred,
  exact,
  image,
  initial,
  manifest,
  predecessor,
  realModule,
  smallLocal,
  type RenewalReset,
  type RawCompletion,
  type Request,
  type restoredImage,
} from './phase-02-slice-11-delivery-receiving-upgrade-renewal-fixtures';
import type { Plan } from './phase-02-slice-11-delivery-receiving-upgrade-types';

type Local = Awaited<ReturnType<typeof smallLocal>>;
async function prefix(mock: Awaited<ReturnType<typeof smallLocal>>) {
  const module = await realModule(
    'infra/database-upgrades/delivery-receiving-upgrade-local-prefix.mjs',
    ['createLocalPrefixAdapter'],
  );
  const create = module.createLocalPrefixAdapter as (options: {
    fs: Local['fs'];
    process: typeof mock.process;
    clock: typeof mock.clock;
    lease: ReturnType<typeof initial>['lease'];
  }) => {
    preparePrefix(plan: Plan): Promise<ReturnType<typeof initial>>;
    resetBefore(
      plan: Plan,
      authority: ReturnType<typeof initial>,
    ): Promise<RenewalReset>;
    restoreBaseline(
      plan: Plan,
      authority: ReturnType<typeof initial>,
    ): Promise<
      ReturnType<typeof restoredImage> & { recoveryAttempt?: unknown }
    >;
  };
  return create({
    fs: mock.fs,
    process: mock.process,
    clock: mock.clock,
    lease: mock.authority.lease,
  });
}
// Trusted native-process boundary double, not an implementation of prefix logic.
// Its private-handle validation is independently required by host-renewal tests.
function nativePort(mock: Local) {
  const records = new Map<object, Request>();
  const calls: string[] = [];
  const entered = deferred<void>();
  const recovering = deferred<void>();
  const control: {
    error?: Error;
    status?: number;
    inventory?: string;
    gate?: ReturnType<typeof deferred<void>>;
    recoveryGate?: ReturnType<typeof deferred<void>>;
    recoveryError?: Error;
  } = {};
  const run = mock.process.run;
  const beginOwnedReset = vi.fn((request: Request) => {
    const handle = Object.freeze({});
    records.set(handle, request);
    calls.push(`begin:${request.purpose}`);
    return handle;
  });
  const completeOwnedReset = vi.fn(
    async (handle: object): Promise<RawCompletion> => {
      const request = records.get(handle);
      if (!request) throw new Error('UNOWNED_NATIVE_HANDLE');
      calls.push(`execute:${request.purpose}`);
      const result = await run(request.command);
      const next = image(request.sequence);
      mock.state.containerId = next.containerId;
      mock.state.metadata.clusterId = next.clusterId;
      entered.resolve();
      if (request.sequence === 1 && control.gate) await control.gate.promise;
      calls.push(`drained:${request.purpose}`);
      if (request.sequence === 1 && control.error) throw control.error;
      return {
        ...result,
        status: request.sequence === 1 ? (control.status ?? 0) : 0,
        before: request.priorIdentity,
        after: next,
        inventorySha256:
          request.sequence === 1
            ? (control.inventory ?? request.inventorySha256)
            : request.inventorySha256,
      };
    },
  );
  const proveRecoveryOwnership = vi.fn(
    async (handle: object): Promise<RawCompletion> => {
      const request = records.get(handle);
      if (!request) throw new Error('UNOWNED_RECOVERY_HANDLE');
      calls.push('recovery:observe');
      recovering.resolve();
      if (control.recoveryGate) await control.recoveryGate.promise;
      if (control.recoveryError) throw control.recoveryError;
      calls.push('recovery:drained-owned');
      return {
        status: control.status ?? 1,
        stdout: '',
        stderr: 'owned failed attempt',
        before: request.priorIdentity,
        after: image(1),
        inventorySha256: request.inventorySha256,
      };
    },
  );
  Object.assign(mock.process, {
    beginOwnedReset,
    completeOwnedReset,
    proveRecoveryOwnership,
  });
  return {
    control,
    calls,
    entered,
    recovering,
    beginOwnedReset,
    completeOwnedReset,
    proveRecoveryOwnership,
  };
}
async function prepared() {
  const mock = await smallLocal();
  const native = nativePort(mock);
  const adapter = await prefix(mock);
  const authority = await adapter.preparePrefix(mock.plan);
  return { mock, native, adapter, authority };
}

describe('DEC-197 local reset adapter owns the only identity-renewal boundary', () => {
  it('DR-RN-L01 independently observes renewed prefix and ordinary baseline, preserving A0/source/link', async () => {
    const { mock, native, adapter, authority } = await prepared();
    const saved = JSON.stringify(authority);
    const reset = await adapter.resetBefore(mock.plan, authority);
    expect(reset).toMatchObject({
      ...image(1),
      prefixSha256: manifest([predecessor]),
    });
    expect(reset.transition).toEqual({
      kind: 'DEC197_OWNED_RESET_V1',
      purpose: 'prefix',
      sequence: 1,
      from: image(0),
      to: image(1),
      fromEpoch: null,
      toEpoch: reset.resetEpoch,
      inventorySha256: manifest([predecessor]),
      sourceSha256: mock.plan.sourceSha256,
      witnessSha256: mock.plan.witnessSha256,
    });
    expect(reset.resetEpoch).toMatch(/^[A-Za-z0-9_.-]{1,128}$/);
    const restored = await adapter.restoreBaseline(mock.plan, authority);
    expect(restored).toMatchObject({
      ...image(2),
      baselineSha256: manifest(baseline),
    });
    expect(restored.transition).toEqual({
      kind: 'DEC197_OWNED_RESET_V1',
      purpose: 'baseline',
      sequence: 2,
      from: image(1),
      to: image(2),
      fromEpoch: reset.resetEpoch,
      toEpoch: restored.resetEpoch,
      inventorySha256: manifest(baseline),
      sourceSha256: mock.plan.sourceSha256,
      witnessSha256: mock.plan.witnessSha256,
    });
    expect(restored.resetEpoch).not.toBe(reset.resetEpoch);
    expect(JSON.stringify(authority)).toBe(saved);
    expect(authority).toEqual(initial(mock.plan));
    expect(
      native.beginOwnedReset.mock.calls.map(([r]) => [
        r.purpose,
        r.sequence,
        r.priorIdentity,
      ]),
    ).toEqual([
      ['prefix', 1, image(0)],
      ['baseline', 2, image(1)],
    ]);
    for (const [index, entries] of [
      [0, [predecessor]],
      [1, baseline],
    ] as const) {
      const request = native.beginOwnedReset.mock.calls[index]![0];
      exact(request.inventory, entries, 'independent inventory');
      expect(request.inventorySha256).toBe(manifest([...entries]));
      exact(
        mock.resets[index]!.staged.map((entry) => entry.bytes),
        entries.map((entry) => entry.bytes),
        'complete staged bytes',
      );
    }
    expect(
      await mock.fs.readlink(
        join(mock.plan.target.workdir, 'supabase/migrations'),
      ),
    ).toBe(join(mock.plan.repository, 'supabase/migrations'));
    expect(native.proveRecoveryOwnership).not.toHaveBeenCalled();
    expect(mock.process.spawn).not.toHaveBeenCalled();
  });

  it('DR-RN-L02 legacy CLI status0 alone cannot authorize reset or renewal', async () => {
    const mock = await smallLocal();
    await expect(async () => {
      const adapter = await prefix(mock);
      const authority = await adapter.preparePrefix(mock.plan);
      return adapter.resetBefore(mock.plan, authority);
    }).rejects.toThrow();
    expect(mock.resets).toEqual([]);
    expect(mock.fs.writes).toEqual([]);
  });

  it('DR-RN-L03 refuses overlap while an owned reset is pending; explicit drain releases it', async () => {
    const { mock, native, adapter, authority } = await prepared();
    native.control.gate = deferred<void>();
    const pending = adapter.resetBefore(mock.plan, authority);
    try {
      expect(
        await Promise.race([
          native.entered.promise.then(() => 'owned boundary'),
          pending.then(
            () => 'completed without boundary',
            () => 'failed before boundary',
          ),
        ]),
      ).toBe('owned boundary');
      await expect(adapter.resetBefore(mock.plan, authority)).rejects.toThrow();
      await expect(
        adapter.restoreBaseline(mock.plan, authority),
      ).rejects.toThrow();
      expect(native.beginOwnedReset).toHaveBeenCalledTimes(1);
      expect(native.calls).not.toContain('drained:prefix');
    } finally {
      native.control.gate.resolve();
      await pending.catch(() => {});
    }
    await pending;
    await adapter.restoreBaseline(mock.plan, authority);
    expect(native.beginOwnedReset).toHaveBeenCalledTimes(2);
  });

  for (const failure of ['nonzero', 'ambiguous'] as const)
    it(`DR-RN-L04 ${failure} recreation is recovery-only, then verified baseline restoration`, async () => {
      const { mock, native, adapter, authority } = await prepared();
      const error = new Error('OWNED_RESET_AMBIGUOUS');
      if (failure === 'nonzero') native.control.status = 1;
      else native.control.error = error;
      await expect(adapter.resetBefore(mock.plan, authority)).rejects.toThrow();
      expect(mock.state.containerId).toBe(image(1).containerId);
      native.control.recoveryGate = deferred<void>();
      const restoring = adapter.restoreBaseline(mock.plan, authority);
      try {
        expect(
          await Promise.race([
            native.recovering.promise.then(() => 'recovery boundary'),
            restoring.then(
              () => 'restored without proof',
              () => 'failed before proof',
            ),
          ]),
        ).toBe('recovery boundary');
        expect(native.beginOwnedReset).toHaveBeenCalledTimes(1);
      } finally {
        native.control.recoveryGate.resolve();
        await restoring.catch(() => {});
      }
      const restored = await restoring;
      expect(restored).toMatchObject({
        ...image(2),
        baselineSha256: manifest(baseline),
      });
      expect(native.proveRecoveryOwnership).toHaveBeenCalledWith(
        native.beginOwnedReset.mock.results[0]!.value,
      );
      expect(native.calls.indexOf('recovery:drained-owned')).toBeLessThan(
        native.calls.indexOf('begin:baseline'),
      );
      expect(restored.transition.from).toEqual(image(1));
      expect(restored.transition.fromEpoch).toBeNull();
      expect(restored.recoveryAttempt).toMatchObject({
        purpose: 'prefix',
        sequence: 1,
        from: image(0),
        to: image(1),
        acceptedEpoch: null,
      });
      expect(authority).toEqual(initial(mock.plan));
    });

  it('DR-RN-L05 ambiguous reset + successful recovery restoration still rejects original error/no receipt', async () => {
    const mock = await smallLocal();
    const native = nativePort(mock);
    const adapter = await prefix(mock);
    const error = new Error('NATIVE_PARTIAL_RECREATE');
    native.control.error = error;
    const forbidden = vi.fn(() => {
      throw new Error('CASE_MUST_NOT_START');
    });
    const writeReceipt = vi.fn();
    await expect(
      (await api()).runReceivingUpgrade({
        plan: mock.plan,
        io: {
          ...adapter,
          setupWorld: forbidden,
          observe: forbidden,
          executeMigration: forbidden,
          writeReceipt,
        },
      }),
    ).rejects.toBe(error);
    expect(native.beginOwnedReset).toHaveBeenCalledTimes(2);
    expect(mock.state.containerId).toBe(image(2).containerId);
    expect(forbidden).not.toHaveBeenCalled();
    expect(writeReceipt).not.toHaveBeenCalled();
  });

  for (const fault of ['foreign candidate', 'undrained backend'] as const)
    it(`DR-RN-L06 ${fault} after partial reset forbids automatic restoration`, async () => {
      const { mock, native, adapter, authority } = await prepared();
      native.control.error = new Error('PARTIAL_RESET');
      await expect(adapter.resetBefore(mock.plan, authority)).rejects.toThrow();
      native.control.recoveryError = new Error(fault);
      if (fault === 'foreign candidate')
        mock.state.containerId = 'f'.repeat(64);
      await expect(
        adapter.restoreBaseline(mock.plan, authority),
      ).rejects.toThrow();
      expect(native.beginOwnedReset).toHaveBeenCalledTimes(1);
      expect(mock.resets).toHaveLength(1);
    });

  for (const fault of [
    'source',
    'lease',
    'owner',
    'OID',
    'native inventory',
  ] as const)
    it(`DR-RN-L07 refuses ${fault} despite consistent renewal DTOs`, async () => {
      const { mock, native, adapter, authority } = await prepared();
      if (fault === 'source')
        mock.fs.put(predecessor.path, { bytes: Buffer.from('select 9;\n') });
      if (fault === 'lease')
        mock.fs.put('/proc/locks', { bytes: Buffer.alloc(0) });
      if (fault === 'owner') mock.state.metadata.owner = 'foreign';
      if (fault === 'OID') mock.state.metadata.databaseOid = '6';
      if (fault === 'native inventory')
        native.control.inventory = 'f'.repeat(64);
      await expect(adapter.resetBefore(mock.plan, authority)).rejects.toThrow();
      expect(native.beginOwnedReset).toHaveBeenCalledTimes(
        fault === 'native inventory' ? 1 : 0,
      );
      expect(authority).toEqual(initial(mock.plan));
    });

  it('DR-RN-L08 unplanned post-case drift, borrowed authority and repeated reset never open another boundary', async () => {
    const { mock, native, adapter, authority } = await prepared();
    const reset = await adapter.resetBefore(mock.plan, authority);
    await expect(adapter.resetBefore(mock.plan, authority)).rejects.toThrow();
    mock.state.containerId = image(2).containerId;
    await expect(
      adapter.restoreBaseline(mock.plan, { ...authority, ...reset }),
    ).rejects.toThrow();
    await expect(
      adapter.restoreBaseline(mock.plan, authority),
    ).rejects.toThrow();
    expect(native.beginOwnedReset).toHaveBeenCalledTimes(1);
    expect(mock.resets).toHaveLength(1);
  });
});
