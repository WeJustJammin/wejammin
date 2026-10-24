import { basename, join } from 'node:path';

import { expect, vi } from 'vitest';

import { Child } from './phase-02-slice-11-delivery-receiving-upgrade-local-boundary-fixtures';
import { launcherFixture } from './phase-02-slice-11-delivery-receiving-upgrade-host-launcher-fixtures';
import {
  request,
  type OwnedPort,
} from './phase-02-slice-11-delivery-receiving-upgrade-host-renewal-fixtures';
import {
  copy,
  operation,
  type Operation,
} from './phase-02-slice-11-delivery-receiving-upgrade-host-lifecycle-operation-fixtures';
import {
  baseline,
  deferred,
  hash,
  realModule,
  repository,
  smallLocal,
  type RenewalReset,
  type Request,
  type restoredImage,
  type initial,
} from './phase-02-slice-11-delivery-receiving-upgrade-renewal-fixtures';
import type { Plan } from './phase-02-slice-11-delivery-receiving-upgrade-types';

type Authority = ReturnType<typeof initial>;
type Restored = ReturnType<typeof restoredImage> & {
  recoveryAttempt?: {
    purpose: 'prefix';
    sequence: 1;
    acceptedEpoch: null;
    from: Request['priorIdentity'];
    to: Request['priorIdentity'];
  };
};
type PrefixAdapter = {
  preparePrefix(plan: Plan): Promise<Authority>;
  resetBefore(plan: Plan, authority: Authority): Promise<RenewalReset>;
  restoreBaseline(plan: Plan, authority: Authority): Promise<Restored>;
};
type Record = Operation & {
  staged?: typeof baseline;
  appliedBefore?: typeof baseline;
  appliedAfter?: typeof baseline;
};

// External in-memory facts only. Actual host/local-prefix validators stay real.
export async function lifecycle() {
  const mock = await smallLocal();
  const installed = await launcherFixture(
    mock,
    new Child(),
    request(mock.plan).command.args,
  );
  const events: string[] = [];
  const records: Record[] = [];
  const fixtureErrors: unknown[] = [];
  const control: { recoveryGate?: ReturnType<typeof deferred<void>> } = {};
  const recoveryEntered = deferred<void>();
  let gated = false;
  let launched = 0;
  let tick = 1000;
  let applied = copy(baseline);
  const directory = join(repository, 'supabase/migrations');
  const link = join(mock.plan.target.workdir, 'supabase/migrations');

  async function files(path: string) {
    const names = (await mock.fs.readdir(path)).sort();
    return Promise.all(
      names.map(async (name) => {
        const bytes = await mock.fs.readFile(join(path, name));
        return { path: join(directory, name), bytes, sha256: hash(bytes) };
      }),
    );
  }
  function record(child: unknown) {
    const found = records.find((item) => item.child === child);
    if (!found) throw new Error('UNIT_UNKNOWN_OPERATION_CHILD');
    return found;
  }
  const process = {
    ...mock.process,
    nativeBinding: installed.binding,
    observeBoundary: vi.fn(async () => {
      if (control.recoveryGate && !gated) {
        gated = true;
        events.push('recovery-entered');
        recoveryEntered.resolve();
        await control.recoveryGate.promise;
        events.push('recovery-released');
      }
      events.push(`boundary:${launched}`);
      return {
        ...copy(installed.binding),
        identity: {
          target: copy(mock.plan.target),
          containerId: mock.state.containerId,
          clusterId: mock.state.metadata.clusterId,
          databaseOid: mock.state.metadata.databaseOid,
          owner: mock.state.metadata.owner,
        },
        metadata: copy(mock.state.metadata),
        promotedInventory: await files(directory),
        stagedInventory: await files(await mock.fs.realpath(link)),
        appliedInventory: copy(applied),
      };
    }),
    readResetTrace: vi.fn(async (child: unknown) => {
      const item = record(child);
      events.push(`trace:${item.child.pid}`);
      return copy(item.trace);
    }),
    observeProcessTree: vi.fn(async (child: unknown) => record(child).live()),
    observeDaemonWork: vi.fn(async (child: unknown) =>
      copy(record(child).daemon),
    ),
    observeBackends: vi.fn(async (child: unknown) => {
      record(child);
      return [];
    }),
    spawn: vi.fn((command: string, args: string[], options: unknown) => {
      const item = records[launched++];
      if (!item) throw new Error('UNIT_UNPLANNED_RESET_SPAWN');
      expect(command).toBe(request(mock.plan).command.command);
      expect(args).toEqual(request(mock.plan).command.args);
      expect(options).toMatchObject({
        shell: false,
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: mock.plan.target.workdir,
        env: installed.binding.environment,
      });
      expect([mock.state.containerId, mock.state.metadata.clusterId]).toEqual([
        item.before.containerId,
        item.before.clusterId,
      ]);
      events.push(`spawn:${launched}`);
      item.start();
      void (async () => {
        item.appliedBefore = copy(applied);
        item.staged = await files(await mock.fs.realpath(link));
        applied = copy(item.staged);
        item.appliedAfter = copy(applied);
        mock.state.appliedHistory = applied.map(({ path }) => ({
          version: basename(path).slice(0, 14),
          name: basename(path).slice(15, -4),
        }));
        mock.state.containerId = item.after.containerId;
        mock.state.metadata.clusterId = item.after.clusterId;
        item.retire();
        item.child.output('Finished supabase db reset.\n');
        events.push(`closed:${launched}`);
        item.child.close(item.signal ? null : item.status, item.signal);
      })().catch((error: unknown) => {
        fixtureErrors.push(error);
        item.retire();
        item.child.emit('error', error);
        item.child.close(1);
      });
      return item.child;
    }),
  };
  const clock = { ...mock.clock, now: vi.fn(() => ++tick) };
  const options = {
    fs: installed.fs,
    process,
    clock,
    lease: mock.authority.lease,
  };
  const host = await realModule(
    'infra/database-upgrades/delivery-receiving-upgrade-host-reset.mjs',
    ['createOwnedResetPort'],
  );
  const createHost = host.createOwnedResetPort as (value: unknown) => OwnedPort;
  const actual = createHost(options);
  const port = {
    beginOwnedReset: vi.fn(actual.beginOwnedReset),
    completeOwnedReset: vi.fn(actual.completeOwnedReset),
    proveRecoveryOwnership: vi.fn(actual.proveRecoveryOwnership),
  };
  Object.assign(process, port);
  const local = await realModule(
    'infra/database-upgrades/delivery-receiving-upgrade-local-prefix.mjs',
    ['createLocalPrefixAdapter'],
  );
  const createLocal = local.createLocalPrefixAdapter as (
    value: unknown,
  ) => PrefixAdapter;
  const adapter = createLocal(options);
  return {
    mock,
    process,
    port,
    adapter,
    clock,
    events,
    records,
    fixtureErrors,
    control,
    recoveryEntered,
    binding: installed.binding,
    link,
    queue(status = 0, signal: string | null = null) {
      const item = operation(
        installed.trace,
        mock.fs,
        records.length + 1,
        process.pid,
        status,
        signal,
      ) as Record;
      records.push(item);
      return item;
    },
    staged: async () => files(await mock.fs.realpath(link)),
    applied: () => copy(applied),
  };
}
