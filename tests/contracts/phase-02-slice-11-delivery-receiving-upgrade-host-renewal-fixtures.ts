import { Buffer } from 'node:buffer';
import { basename, join } from 'node:path';

import { expect, vi } from 'vitest';

import { Child } from './phase-02-slice-11-delivery-receiving-upgrade-local-boundary-fixtures';
import { supabaseBinary } from './phase-02-slice-11-delivery-receiving-upgrade-local-process-fixtures';
import {
  deferred,
  hash,
  image,
  initial,
  manifest,
  predecessor,
  smallLocal,
  type RawCompletion,
  type Request,
} from './phase-02-slice-11-delivery-receiving-upgrade-renewal-fixtures';
import type { Plan } from './phase-02-slice-11-delivery-receiving-upgrade-types';
import { launcherFixture } from './phase-02-slice-11-delivery-receiving-upgrade-host-launcher-fixtures';

// Raw observations and explicit test-gate assertions. No native I/O or validator.
export type OwnedPort = {
  beginOwnedReset(request: Request): object;
  completeOwnedReset(handle: object): Promise<RawCompletion>;
  proveRecoveryOwnership(handle: object): Promise<RawCompletion>;
};
export function request(plan: Plan): Request {
  return {
    command: {
      command: supabaseBinary,
      args: ['db', 'reset', '--local', '--workdir', plan.target.workdir],
    },
    target: plan.target,
    priorIdentity: image(0),
    fromEpoch: null,
    purpose: 'prefix',
    sequence: 1,
    inventory: [{ ...predecessor, bytes: Buffer.from(predecessor.bytes) }],
    inventorySha256: manifest([predecessor]),
    sourceSha256: plan.sourceSha256,
    witnessSha256: plan.witnessSha256,
    lease: initial(plan).lease,
  };
}

export async function harness() {
  const mock = await smallLocal();
  const stage = '/tmp/unit-dec197-owned-prefix';
  mock.fs.put(stage, { directory: true });
  mock.fs.put(join(stage, basename(predecessor.path)), {
    bytes: Buffer.from(predecessor.bytes),
  });
  mock.fs.put(join(mock.plan.target.workdir, 'supabase/migrations'), {
    link: stage,
  });
  const child = new Child();
  const events: string[] = [];
  const launcher = await launcherFixture(
    mock,
    child,
    request(mock.plan).command.args,
  );
  const { binding, trace } = launcher;
  const control: {
    traceError?: Error;
    gate?: ReturnType<typeof deferred<void>>;
    status?: number;
    signal?: string;
    backends?: unknown[];
    afterCreate?: () => void;
    daemonId?: string;
    treeGate?: ReturnType<typeof deferred<void>>;
    daemonGate?: ReturnType<typeof deferred<void>>;
    retainedNative?: boolean;
    daemonRunning?: boolean;
    daemonJobRunning?: boolean;
  } = {};
  const observingDrain = deferred<void>();
  const observingTree = deferred<void>();
  const observingDaemon = deferred<void>();
  const observeBoundary = vi.fn(async () => {
    events.push('boundary');
    return {
      ...structuredClone(binding),
      identity: {
        ...image(0),
        containerId: mock.state.containerId,
        clusterId: mock.state.metadata.clusterId,
      },
      daemon: { ...binding.daemon, id: control.daemonId ?? binding.daemon.id },
      metadata: structuredClone(mock.state.metadata),
      promotedInventory: baselineFiles(),
      stagedInventory: [predecessor],
      appliedInventory:
        mock.state.containerId === image(0).containerId
          ? baselineFiles()
          : [predecessor],
    };
  });
  const readResetTrace = vi.fn(async (observed: unknown) => {
    expect(observed).toBe(child);
    events.push('raw-trace');
    if (control.traceError) throw control.traceError;
    return trace;
  });
  const observeBackends = vi.fn(async (observed: unknown) => {
    expect(observed).toBe(child);
    events.push('backend-observation');
    observingDrain.resolve();
    if (control.gate) await control.gate.promise;
    events.push('backend-observed');
    return control.backends ?? [];
  });
  const observeProcessTree = vi.fn(async (observed: unknown) => {
    expect(observed).toBe(child);
    events.push('descendant-observation');
    observingTree.resolve();
    if (control.treeGate) await control.treeGate.promise;
    events.push('descendants-observed');
    return launcher.live();
  });
  const observeDaemonWork = vi.fn(async (observed: unknown) => {
    expect(observed).toBe(child);
    events.push('daemon-observation');
    observingDaemon.resolve();
    if (control.daemonGate) await control.daemonGate.promise;
    events.push('daemon-observed');
    return structuredClone(launcher.daemonWork);
  });
  const spawn = vi.fn(
    (executable: string, args: string[], options: unknown) => {
      events.push('spawn');
      expect(executable).toBe(request(mock.plan).command.command);
      expect(args).toEqual(request(mock.plan).command.args);
      expect(options).toMatchObject({
        shell: false,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: binding.environment,
      });
      launcher.start();
      queueMicrotask(() => {
        mock.state.containerId = image(1).containerId;
        mock.state.metadata.clusterId = image(1).clusterId;
        launcher.close(control.retainedNative);
        if (control.daemonRunning) {
          launcher.daemonWork.execs[0]!.Running = true;
          launcher.daemonWork.execs[0]!.Pid = 12001;
        }
        if (control.daemonJobRunning)
          launcher.daemonWork.jobs.push({
            Id: 'unit-owned-job',
            Running: true,
            ExitCode: null,
          });
        control.afterCreate?.();
        child.output('Finished supabase db reset.\n');
        events.push('child-close');
        child.close(
          control.signal ? null : (control.status ?? 0),
          control.signal ?? null,
        );
      });
      return child;
    },
  );
  const process = {
    ...mock.process,
    nativeBinding: binding,
    observeBoundary,
    readResetTrace,
    observeBackends,
    observeProcessTree,
    observeDaemonWork,
    spawn,
  };
  return {
    mock,
    child,
    events,
    trace,
    control,
    binding,
    observingDrain,
    observingTree,
    observingDaemon,
    launcher,
    process,
    options: {
      fs: launcher.fs,
      process,
      clock: mock.clock,
      lease: mock.authority.lease,
    },
  };
}
function baselineFiles() {
  return [
    { ...predecessor, bytes: Buffer.from(predecessor.bytes) },
    {
      path: '/unit/dec197-renewal/supabase/migrations/20261016030000_delivery_receiving_contracts.sql',
      bytes: Buffer.from('begin;\nselect 1;\ncommit;\n'),
      sha256: hash('begin;\nselect 1;\ncommit;\n'),
    },
  ];
}

type Host = Awaited<ReturnType<typeof harness>>;
export function drift(h: Host, fault: string) {
  if (fault === 'lease')
    h.mock.fs.put('/proc/locks', { bytes: Buffer.alloc(0) });
  if (fault === 'daemon') h.control.daemonId = 'foreign-daemon';
  if (fault === 'owner') h.mock.state.metadata.owner = 'foreign';
  if (fault === 'OID') h.mock.state.metadata.databaseOid = '6';
  if (fault === 'foreign replacement')
    h.mock.state.containerId = 'f'.repeat(64);
  if (fault === 'source')
    h.mock.fs.put(predecessor.path, { bytes: Buffer.from('select 8;\n') });
}

export async function heldCompletion(
  h: Awaited<ReturnType<typeof harness>>,
  port: OwnedPort,
  channel: 'backend' | 'descendant' | 'daemon',
  checkOverlap = false,
) {
  const gate = deferred<void>();
  if (channel === 'backend') h.control.gate = gate;
  if (channel === 'descendant') h.control.treeGate = gate;
  if (channel === 'daemon') h.control.daemonGate = gate;
  const entered =
    channel === 'backend'
      ? h.observingDrain
      : channel === 'descendant'
        ? h.observingTree
        : h.observingDaemon;
  const handle = port.beginOwnedReset(request(h.mock.plan));
  const pending = port.completeOwnedReset(handle);
  const settled = vi.fn();
  void pending.then(settled, settled);
  try {
    expect(
      await Promise.race([
        entered.promise.then(() => 'observing'),
        pending.then(
          () => 'early success',
          () => 'early failure',
        ),
      ]),
    ).toBe('observing');
    expect(h.events).toContain('child-close');
    expect(settled).not.toHaveBeenCalled();
    if (checkOverlap) {
      const outcomes = ['pending', 'pending'];
      const attempts = [
        port.completeOwnedReset(handle),
        port.proveRecoveryOwnership(handle),
      ];
      for (const [index, attempt] of attempts.entries()) {
        void attempt.then(
          () => {
            outcomes[index] = 'accepted';
          },
          () => {
            outcomes[index] = 'refused';
          },
        );
      }
      // Private handle entry refuses before I/O; this is a microtask checkpoint,
      // not a wall-clock/sleep assertion or a replay after the first call settles.
      await Promise.resolve();
      expect(outcomes).toEqual(['refused', 'refused']);
      expect(h.process.spawn).toHaveBeenCalledTimes(1);
      expect(settled).not.toHaveBeenCalled();
    }
  } finally {
    gate.resolve();
    await pending.catch(() => {});
  }
  await expect(pending).resolves.toMatchObject({ after: image(1), status: 0 });
}
