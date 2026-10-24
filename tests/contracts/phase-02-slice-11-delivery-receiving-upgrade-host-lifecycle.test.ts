import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { lifecycle } from './phase-02-slice-11-delivery-receiving-upgrade-host-lifecycle-fixtures';
import {
  copy,
  physical,
} from './phase-02-slice-11-delivery-receiving-upgrade-host-lifecycle-operation-fixtures';
import { request } from './phase-02-slice-11-delivery-receiving-upgrade-host-renewal-fixtures';
import {
  api,
  baseline,
  deferred,
  exact,
  manifest,
  predecessor,
  repository,
  type Request,
  type Transition,
} from './phase-02-slice-11-delivery-receiving-upgrade-renewal-fixtures';

type Harness = Awaited<ReturnType<typeof lifecycle>>;
type Reset = Request['priorIdentity'] & {
  resetEpoch: string;
  transition: Transition;
};
const identity = ({
  target,
  containerId,
  clusterId,
  databaseOid,
  owner,
}: Request['priorIdentity']) => ({
  target,
  containerId,
  clusterId,
  databaseOid,
  owner,
});

function transition(
  h: Harness,
  result: Reset,
  index: number,
  fromEpoch: string | null,
) {
  const prefix = index % 2 === 1;
  expect(result.resetEpoch).toMatch(/^[A-Za-z0-9_.-]{1,128}$/);
  expect(result.resetEpoch).not.toBe(fromEpoch);
  exact(identity(result), physical(index), 'renewed identity');
  exact(
    result.transition,
    {
      kind: 'DEC197_OWNED_RESET_V1',
      purpose: prefix ? 'prefix' : 'baseline',
      sequence: prefix ? 1 : 2,
      from: physical(index - 1),
      to: physical(index),
      fromEpoch,
      toEpoch: result.resetEpoch,
      inventorySha256: manifest(prefix ? [predecessor] : baseline),
      sourceSha256: h.mock.plan.sourceSha256,
      witnessSha256: h.mock.plan.witnessSha256,
    },
    'closed transition literal oracle',
  );
}

async function operationFacts(h: Harness, index: number) {
  const item = h.records[index - 1]!;
  const selected = index % 2 === 1 ? [predecessor] : baseline;
  exact(item.staged, selected, 'actual linked stage bytes');
  exact(item.appliedAfter, selected, 'applied independent raw history');
  exact(
    item.appliedBefore,
    index % 2 === 1 ? baseline : [predecessor],
    'prior history',
  );
  expect(item.trace.commands[0]!.resolvedContainerId).toBe(
    physical(index - 1).containerId,
  );
  expect(item.trace.commands[1]!.resolvedContainerId).toBe(
    physical(index).containerId,
  );
  expect(JSON.parse(item.trace.createResponse.body.toString())).toEqual({
    Id: physical(index).containerId,
    Warnings: [],
  });
  expect(item.live()).toEqual([]);
  expect(item.daemon).toEqual({
    execs: [
      {
        Id: `unit-cycle-exec-${index}`,
        ContainerID: 'd'.repeat(64),
        Running: false,
        ExitCode: 0,
        Pid: 0,
      },
    ],
    jobs: [],
  });
  for (const process of item.trace.processes)
    await expect(h.mock.fs.lstat(`/proc/${process.pid}`)).rejects.toThrow();
}

async function cleanupFacts(h: Harness) {
  expect(await h.mock.fs.realpath(h.link)).toBe(
    join(repository, 'supabase/migrations'),
  );
  exact(await h.staged(), baseline, 'restored baseline link bytes');
  exact(h.applied(), baseline, 'restored applied history');
  expect(h.mock.resets).toEqual([]);
  expect(h.fixtureErrors).toEqual([]);
  expect(h.mock.timers.size).toBe(0);
}

async function cycle(h: Harness, offset = 0) {
  const first = await h.adapter.preparePrefix(h.mock.plan);
  const saved = JSON.stringify(first);
  const binding = JSON.stringify(h.binding);
  exact(identity(first), physical(offset), 'fresh initial attestation');
  const prefix = await h.adapter.resetBefore(h.mock.plan, first);
  transition(h, prefix, offset + 1, null);
  const restored = await h.adapter.restoreBaseline(h.mock.plan, first);
  transition(h, restored, offset + 2, prefix.resetEpoch);
  expect(restored).not.toHaveProperty('recoveryAttempt');
  expect(JSON.stringify(first)).toBe(saved);
  expect(JSON.stringify(h.binding)).toBe(binding);
  for (const index of [offset + 1, offset + 2]) await operationFacts(h, index);
  const requests = h.port.beginOwnedReset.mock.calls.slice(offset, offset + 2);
  exact(
    requests[0]![0].priorIdentity,
    physical(offset),
    'prefix prior identity',
  );
  exact(
    requests[1]![0].priorIdentity,
    physical(offset + 1),
    'baseline prior identity',
  );
  expect(requests.map(([value]) => value.purpose)).toEqual([
    'prefix',
    'baseline',
  ]);
  expect(requests.map(([value]) => value.fromEpoch)).toEqual([
    null,
    prefix.resetEpoch,
  ]);
  exact(requests[0]![0].inventory, [predecessor], 'prefix request bytes');
  exact(requests[1]![0].inventory, baseline, 'baseline request bytes');
  await cleanupFacts(h);
  return { first, saved, prefix, restored };
}

describe('DEC-197 real injected host and local-prefix lifecycle', () => {
  it('DR-HL-01 stages and applies P then B through fresh host operations A0→A1→A2', async () => {
    const h = await lifecycle();
    h.queue();
    h.queue();
    await cycle(h);
    expect(h.process.spawn).toHaveBeenCalledTimes(2);
    expect(h.port.completeOwnedReset).toHaveBeenCalledTimes(2);
    expect(h.port.proveRecoveryOwnership).not.toHaveBeenCalled();
    const handles = h.port.completeOwnedReset.mock.calls.map(
      ([handle]) => handle,
    );
    expect(new Set(handles).size).toBe(2);
    expect(h.events.indexOf('closed:1')).toBeLessThan(
      h.events.indexOf('spawn:2'),
    );
  });

  it('DR-HL-02 reuses immutable authority after restoration with fresh operations', async () => {
    const h = await lifecycle();
    const binding = JSON.stringify(h.binding);
    for (let index = 0; index < 4; index++) h.queue();
    const first = await cycle(h);
    const next = await cycle(h, 2);
    expect(JSON.stringify(first.first)).toBe(first.saved);
    expect(JSON.stringify(h.binding)).toBe(binding);
    expect(next.first).not.toBe(first.first);
    exact(
      next.first.lease,
      first.first.lease,
      'same immutable lease authority',
    );
    expect([next.first.prefixSha256, next.first.baselineSha256]).toEqual([
      first.first.prefixSha256,
      first.first.baselineSha256,
    ]);
    for (const [value] of h.port.beginOwnedReset.mock.calls)
      expect([value.sourceSha256, value.witnessSha256]).toEqual([
        h.mock.plan.sourceSha256,
        h.mock.plan.witnessSha256,
      ]);
    const epochs = [
      first.prefix.resetEpoch,
      first.restored.resetEpoch,
      next.prefix.resetEpoch,
      next.restored.resetEpoch,
    ];
    expect(new Set(epochs).size).toBe(4);
    const handles = h.port.completeOwnedReset.mock.calls.map(
      ([handle]) => handle,
    );
    expect(new Set(handles).size).toBe(4);
    const pids = h.records.flatMap((item) =>
      item.trace.processes.map(({ pid }) => pid),
    );
    expect(new Set(pids).size).toBe(20);
    const starts = h.records.map(({ trace }) => trace.child.startTicks);
    expect(new Set(starts).size).toBe(4);
    expect(h.process.spawn).toHaveBeenCalledTimes(4);
    expect(h.port.proveRecoveryOwnership).not.toHaveBeenCalled();
  });

  for (const failure of ['nonzero', 'signal'] as const)
    it(`DR-HL-03 ${failure} P recovers before B; runner retains error/no receipt`, async () => {
      const h = await lifecycle();
      h.queue(
        failure === 'nonzero' ? 1 : 0,
        failure === 'signal' ? 'SIGTERM' : null,
      );
      h.queue();
      const module = await api();
      let firstFailure: unknown;
      const forbidden = vi.fn(() => {
        throw new Error('UNIT_UNEXPECTED_POST_FAILURE_WORK');
      });
      const writeReceipt = vi.fn();
      const restore = vi.fn(h.adapter.restoreBaseline);
      const running = module
        .runReceivingUpgrade({
          plan: h.mock.plan,
          io: {
            preparePrefix: h.adapter.preparePrefix,
            resetBefore: async (
              ...args: Parameters<typeof h.adapter.resetBefore>
            ) => {
              try {
                return await h.adapter.resetBefore(...args);
              } catch (error) {
                firstFailure = error;
                h.control.recoveryGate = deferred<void>();
                throw error;
              }
            },
            setupWorld: forbidden,
            observe: forbidden,
            executeMigration: forbidden,
            restoreBaseline: restore,
            writeReceipt,
          },
        })
        .then(
          (value) => ({ value }),
          (error: unknown) => ({ error }),
        );
      try {
        expect(
          await Promise.race([
            h.recoveryEntered.promise.then(() => 'fresh recovery'),
            running.then(() => 'settled before recovery'),
          ]),
        ).toBe('fresh recovery');
        expect(firstFailure).toBeInstanceOf(Error);
        expect(h.port.proveRecoveryOwnership).toHaveBeenCalledTimes(1);
        expect(h.port.proveRecoveryOwnership.mock.calls[0]![0]).toBe(
          h.port.completeOwnedReset.mock.calls[0]![0],
        );
        expect(h.process.readResetTrace).toHaveBeenCalledTimes(2);
        expect(h.process.observeProcessTree).toHaveBeenCalledTimes(2);
        expect(h.process.observeDaemonWork).toHaveBeenCalledTimes(2);
        expect(h.process.observeBackends).toHaveBeenCalledTimes(2);
        expect(h.process.observeBoundary).toHaveBeenCalledTimes(3);
        expect(h.process.spawn).toHaveBeenCalledTimes(1);
      } finally {
        h.control.recoveryGate?.resolve();
      }
      const outcome = await running;
      expect(outcome).toHaveProperty('error');
      expect((outcome as { error: unknown }).error).toBe(firstFailure);
      const failedCompletion =
        await h.port.completeOwnedReset.mock.results[0]!.value.catch(
          (error: unknown) => error,
        );
      expect(failedCompletion).toBe(firstFailure);
      expect(forbidden).not.toHaveBeenCalled();
      expect(writeReceipt).not.toHaveBeenCalled();
      expect(restore).toHaveBeenCalledTimes(1);
      expect(h.process.spawn).toHaveBeenCalledTimes(2);
      const raw = await h.port.proveRecoveryOwnership.mock.results[0]!.value;
      expect(raw.status).toBe(failure === 'signal' ? -1 : 1);
      expect(raw.inventorySha256).toBe(manifest([predecessor]));
      exact(raw.before, physical(0), 'failed prefix prior');
      exact(raw.after, physical(1), 'independently recovered identity');
      const restored = await restore.mock.results[0]!.value;
      transition(h, restored, 2, null);
      exact(
        restored.recoveryAttempt,
        {
          purpose: 'prefix',
          sequence: 1,
          acceptedEpoch: null,
          from: physical(0),
          to: physical(1),
        },
        'failed reset has no accepted epoch',
      );
      expect(h.port.completeOwnedReset.mock.calls[1]![0]).not.toBe(
        h.port.completeOwnedReset.mock.calls[0]![0],
      );
      const baselineRequest = h.port.beginOwnedReset.mock.calls[1]![0];
      expect(baselineRequest.fromEpoch).toBeNull();
      exact(
        baselineRequest.priorIdentity,
        physical(1),
        'recovery before baseline',
      );
      for (const index of [1, 2]) await operationFacts(h, index);
      expect(h.events.indexOf('recovery-released')).toBeLessThan(
        h.events.indexOf('spawn:2'),
      );
      await cleanupFacts(h);
    });

  for (const fault of [
    'stale prior identity',
    'foreign source',
    'foreign lease',
    'repeated purpose',
  ] as const)
    it(`DR-HL-04 ${fault} refuses before I/O and permits valid restoration`, async () => {
      const h = await lifecycle();
      h.queue();
      h.queue();
      const first = await h.adapter.preparePrefix(h.mock.plan);
      const prefix = await h.adapter.resetBefore(h.mock.plan, first);
      const foreign: Request = {
        ...copy(request(h.mock.plan)),
        purpose: 'baseline',
        sequence: 2,
        priorIdentity: physical(1),
        fromEpoch: prefix.resetEpoch,
        inventory: copy(baseline),
        inventorySha256: manifest(baseline),
      };
      if (fault === 'stale prior identity') foreign.priorIdentity = physical(0);
      if (fault === 'foreign source') {
        foreign.sourceSha256 = 'f'.repeat(64);
        foreign.witnessSha256 = 'f'.repeat(64);
      }
      if (fault === 'foreign lease') foreign.lease.locks[0]!.inode++;
      if (fault === 'repeated purpose')
        Object.assign(foreign, {
          purpose: 'prefix',
          sequence: 1,
          fromEpoch: null,
          inventory: copy([predecessor]),
          inventorySha256: manifest([predecessor]),
        });
      const before = [
        h.process.spawn.mock.calls.length,
        h.mock.readOnlyCalls.length,
        h.process.observeBoundary.mock.calls.length,
        h.mock.fs.writes.length,
      ];
      const reads = [
        'lstat',
        'stat',
        'realpath',
        'readFile',
        'readdir',
        'readlink',
      ] as const;
      const probes = reads.map((method) => vi.spyOn(h.mock.fs, method));
      const ticks = h.clock.now.mock.calls.length;
      expect(() => h.port.beginOwnedReset(foreign)).toThrow();
      for (const probe of probes) expect(probe).not.toHaveBeenCalled();
      expect(h.clock.now).toHaveBeenCalledTimes(ticks);
      expect([
        h.process.spawn.mock.calls.length,
        h.mock.readOnlyCalls.length,
        h.process.observeBoundary.mock.calls.length,
        h.mock.fs.writes.length,
      ]).toEqual(before);
      const restored = await h.adapter.restoreBaseline(h.mock.plan, first);
      transition(h, restored, 2, prefix.resetEpoch);
      expect(restored).not.toHaveProperty('recoveryAttempt');
      expect(h.process.spawn).toHaveBeenCalledTimes(2);
      expect(h.port.proveRecoveryOwnership).not.toHaveBeenCalled();
      for (const index of [1, 2]) await operationFacts(h, index);
      await cleanupFacts(h);
    });
});
