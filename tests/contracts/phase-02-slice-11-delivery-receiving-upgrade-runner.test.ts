import { Buffer } from 'node:buffer';

import { describe, expect, it } from 'vitest';

import {
  apiCase,
  availabilityError,
  change,
  committed,
  input,
  labels,
  loadApi,
  world as injectedWorld,
  type Plan,
} from './phase-02-slice-11-delivery-receiving-upgrade-fixtures';
import {
  afterPositive,
  before,
} from './phase-02-slice-11-delivery-receiving-upgrade-snapshot-fixtures';
import {
  marker,
  session,
} from './phase-02-slice-11-delivery-receiving-upgrade-target-fixtures';

// These injected boundaries NEVER invoke DB, Docker, a CLI or actual SQL.
// A green unit suite is NOT committed fixture visibility/isolation/DDL proof.
function world(plan: Plan) {
  return injectedWorld(
    plan,
    {
      before: before(plan.mode),
      after:
        plan.mode === 'negative' ? before('negative', 202) : afterPositive(),
    },
    (plan.mode === 'negative' ? 'a' : 'b').repeat(64),
  );
}

describe('DEC-197 injected upgrade runner', () => {
  it('DR-UR-A01 implementation availability only (not DDL proof)', async () => {
    const api = await loadApi();
    expect(
      api,
      availabilityError || 'seven required exports unavailable',
    ).toBeDefined();
  });
  for (const mode of ['negative', 'positive'] as const) {
    apiCase(
      `DR-UR-X01 ${mode} serializes committed setup, replay, observer, cleanup`,
      async (api) => {
        const plan = api.buildUpgradePlan(input(mode));
        const mock = world(plan);
        const receipt = await api.runReceivingUpgrade({ io: mock.io, plan });
        expect(mock.events).toEqual([
          'preparePrefix',
          'resetBefore',
          'setupWorld',
          'observe:before',
          'executeMigration',
          'observe:after',
          'restoreBaseline',
          'writeReceipt',
        ]);
        expect(receipt).toMatchObject({
          status: 'passed',
          mode,
          target: plan.target,
          containerId: mock.outputs.prefix.containerId,
          clusterId: mock.outputs.prefix.clusterId,
          databaseOid: mock.outputs.prefix.databaseOid,
          resetEpoch: mock.outputs.reset.resetEpoch,
          restoredResetEpoch: mock.outputs.restored.resetEpoch,
          sourceSha256: plan.sourceSha256,
          witnessSha256: plan.witnessSha256,
          prefixSha256: plan.prefixSha256,
          baselineSha256: mock.outputs.prefix.baselineSha256,
          setupBackendPid: 101,
          beforeBackendPid: 201,
          migrationBackendPid: 301,
          afterBackendPid: 202,
          cleanup: { baselineRestored: true },
        });
        expect(receipt.cleanup).not.toHaveProperty('databaseDropped');
        expect(mock.outputs.restored.resetEpoch).not.toBe(
          mock.outputs.reset.resetEpoch,
        );
        expect(mock.outputs.prefix.baselineSha256).not.toBe(plan.prefixSha256);
        expect(receipt.beforeSnapshotSha256).toMatch(/^[a-f0-9]{64}$/);
        expect(receipt.afterSnapshotSha256).toMatch(/^[a-f0-9]{64}$/);
        if (mode === 'negative')
          expect(receipt.beforeSnapshotSha256).toBe(
            receipt.afterSnapshotSha256,
          );
        else
          expect(receipt.beforeSnapshotSha256).not.toBe(
            receipt.afterSnapshotSha256,
          );
        expect(mock.receipts).toEqual([receipt]);
      },
    );
  }
  apiCase(
    'DR-UR-X02 forged source/copy/prefix/target/mode/app plans refuse before any IO',
    async (api) => {
      for (const field of [
        'source',
        'witness',
        'prefixManifest',
        'target',
        'mode',
        'applicationName',
      ] as const) {
        const plan = api.buildUpgradePlan(input());
        const forged = { ...plan };
        if (field === 'source')
          forged.source = { ...plan.source, sha256: '0'.repeat(64) };
        if (field === 'witness')
          forged.witness = Buffer.concat([plan.witness, Buffer.from('\n')]);
        if (field === 'prefixManifest')
          forged.prefixManifest = { ...plan.prefixManifest, entries: [] };
        if (field === 'target')
          forged.target = { ...plan.target, database: 'foreign' };
        if (field === 'mode') forged.mode = 'positive';
        if (field === 'applicationName') forged.applicationName = 'foreign_app';
        const mock = world(plan);
        await expect(
          api.runReceivingUpgrade({ io: mock.io, plan: forged }),
        ).rejects.toThrow();
        expect(mock.events).toEqual([]);
      }
    },
  );
  for (const phase of [
    'preparePrefix',
    'resetBefore',
    'setupWorld',
    'observe:before',
    'executeMigration',
    'observe:after',
  ]) {
    apiCase(
      `DR-UR-X03 ${phase} failure restores iff validated reset was attempted`,
      async (api) => {
        const plan = api.buildUpgradePlan(input());
        const mock = world(plan);
        const error = new Error(`unit failure ${phase}`);
        mock.errors.set(phase, error);
        await expect(
          api.runReceivingUpgrade({ io: mock.io, plan }),
        ).rejects.toBe(error);
        expect(mock.events.filter((p) => p === 'restoreBaseline')).toHaveLength(
          phase === 'preparePrefix' ? 0 : 1,
        );
        expect(mock.receipts).toEqual([]);
      },
    );
  }
  for (const phase of ['restoreBaseline', 'writeReceipt']) {
    apiCase(
      `DR-UR-X04 ${phase} failure cannot publish success`,
      async (api) => {
        const plan = api.buildUpgradePlan(input());
        const mock = world(plan);
        const error = new Error(`unit cleanup failure ${phase}`);
        mock.errors.set(phase, error);
        await expect(
          api.runReceivingUpgrade({ io: mock.io, plan }),
        ).rejects.toBe(error);
        expect(mock.events).toContain('restoreBaseline');
        expect(mock.receipts).toEqual([]);
      },
    );
  }
  apiCase(
    'DR-UR-X05 primary error survives simultaneous cleanup failure',
    async (api) => {
      const plan = api.buildUpgradePlan(input());
      const mock = world(plan);
      const primary = new Error('primary replay failure');
      mock.errors.set('executeMigration', primary);
      mock.errors.set(
        'restoreBaseline',
        new Error('secondary cleanup failure'),
      );
      await expect(api.runReceivingUpgrade({ io: mock.io, plan })).rejects.toBe(
        primary,
      );
      expect(mock.events).toContain('restoreBaseline');
      expect(mock.receipts).toEqual([]);
    },
  );
  for (const code of ['ETIMEDOUT', 'SIGTERM']) {
    apiCase(
      `DR-UR-X06 injected ${code} uses cleanup, not a controlled refusal`,
      async (api) => {
        const plan = api.buildUpgradePlan(input());
        const mock = world(plan);
        const error = Object.assign(new Error(code), { code });
        mock.errors.set('executeMigration', error);
        await expect(
          api.runReceivingUpgrade({ io: mock.io, plan }),
        ).rejects.toBe(error);
        expect(mock.events.at(-1)).toBe('restoreBaseline');
        expect(mock.receipts).toEqual([]);
      },
    );
  }
  for (const name of [
    'missing lease',
    'missing container ID',
    'wrong prefix digest',
    'foreign attested target',
    'other owner',
    'wrong reset prefix',
    'wrong reset container ID',
  ]) {
    apiCase(`DR-UR-X07 ${name} stops before fixture/replay`, async (api) => {
      const plan = api.buildUpgradePlan(input());
      const mock = world(plan);
      if (name === 'missing lease') mock.outputs.prefix.lease.locks = [];
      if (name === 'missing container ID') mock.outputs.prefix.containerId = '';
      if (name === 'wrong prefix digest')
        mock.outputs.prefix.prefixSha256 = '0'.repeat(64);
      if (name === 'foreign attested target')
        mock.outputs.prefix.target = { ...plan.target, database: 'foreign' };
      if (name === 'other owner') mock.outputs.prefix.owner = 'not-postgres';
      if (name === 'wrong reset prefix')
        mock.outputs.reset.prefixSha256 = '0'.repeat(64);
      if (name === 'wrong reset container ID')
        mock.outputs.reset.containerId = 'b'.repeat(64);
      await expect(
        api.runReceivingUpgrade({ io: mock.io, plan }),
      ).rejects.toThrow();
      expect(mock.events).not.toContain('setupWorld');
      expect(mock.events).not.toContain('executeMigration');
      expect(mock.events.includes('resetBefore')).toBe(
        name.startsWith('wrong reset'),
      );
      expect(mock.events.includes('restoreBaseline')).toBe(
        name.startsWith('wrong reset'),
      );
    });
  }
  const badSetup: Array<[string, unknown]> = [
    ['committed', false],
    ['tapPassed', false],
    ['consumerCount', '0'],
    ['publications', []],
    ['publications', [labels[0], labels[0]]],
    ['database', 'foreign'],
    ['containerId', 'b'.repeat(64)],
    ['backendPid', 201],
  ];
  for (const [index, [key, value]] of badSetup.entries()) {
    apiCase(
      `DR-UR-X08 bad setup ${index + 1}:${key} stops before migration`,
      async (api) => {
        const plan = api.buildUpgradePlan(input());
        const mock = world(plan);
        mock.outputs.setup[key] = value;
        await expect(
          api.runReceivingUpgrade({ io: mock.io, plan }),
        ).rejects.toThrow();
        expect(mock.events).not.toContain('executeMigration');
        expect(mock.events.at(-1)).toBe('restoreBaseline');
      },
    );
  }
  for (const name of [
    'same migration session',
    'setup reused by migration',
    'same after session',
    'wrong observer DB',
    'before container replacement',
    'migration container replacement',
    'after container replacement',
    'labelled consumer missing',
    'partial DDL survived',
    'old security changed',
    'wrong negative outcome',
  ]) {
    apiCase(
      `DR-UR-X09 ${name} cannot become a passing negative receipt`,
      async (api) => {
        const plan = api.buildUpgradePlan(input());
        const mock = world(plan);
        if (name === 'same migration session')
          mock.outputs.execution.stdout = mock.outputs.execution.stdout.replace(
            marker(session(plan.applicationName)),
            marker(session(plan.applicationName, 201)),
          );
        if (name === 'setup reused by migration')
          mock.outputs.execution.stdout = mock.outputs.execution.stdout.replace(
            marker(session(plan.applicationName)),
            marker(session(plan.applicationName, 101)),
          );
        if (name === 'same after session')
          mock.outputs.after.observer.backendPid = 301;
        if (name === 'wrong observer DB')
          mock.outputs.after.observer.database = 'foreign';
        if (name === 'before container replacement')
          mock.outputs.beforeEnvelope.containerId = 'b'.repeat(64);
        if (name === 'migration container replacement')
          mock.outputs.execution.containerId = 'b'.repeat(64);
        if (name === 'after container replacement')
          mock.outputs.afterEnvelope.containerId = 'b'.repeat(64);
        if (name === 'labelled consumer missing')
          mock.outputs.before.snapshot.consumerRows.pop();
        if (name === 'partial DDL survived')
          mock.outputs.after.snapshot.receivingObjects.manifestTable = 'leaked';
        if (name === 'old security changed')
          change(mock.outputs.after, 'policies', 'using', 'true');
        if (name === 'wrong negative outcome')
          Object.assign(
            mock.outputs.execution,
            committed(plan.applicationName),
          );
        await expect(
          api.runReceivingUpgrade({ io: mock.io, plan }),
        ).rejects.toThrow();
        if (
          [
            'labelled consumer missing',
            'before container replacement',
          ].includes(name)
        )
          expect(mock.events).not.toContain('executeMigration');
        if (name === 'migration container replacement')
          expect(mock.events).not.toContain('observe:after');
        expect(mock.events.at(-1)).toBe('restoreBaseline');
        expect(mock.receipts).toEqual([]);
      },
    );
  }
  for (const name of [
    'nonempty old consumers',
    'missing COMMIT visibility',
    'unvalidated FK',
    'failed process',
    'unchanged old row violated',
  ]) {
    apiCase(`DR-UR-X10 positive ${name} cannot pass`, async (api) => {
      const plan = api.buildUpgradePlan(input('positive'));
      const mock = world(plan);
      if (name === 'nonempty old consumers')
        mock.outputs.before.snapshot.consumerRows =
          before().snapshot.consumerRows;
      if (name === 'missing COMMIT visibility')
        mock.outputs.after.snapshot = before('positive').snapshot;
      if (name === 'unvalidated FK') {
        const fk = mock.outputs.after.snapshot.catalog.constraints?.find(
          (r) =>
            r.type === 'f' &&
            r.relation === 10 &&
            r.name !== 'projection_consumer_state_publication_fk',
        );
        if (!fk) throw new Error('missing new unit FK');
        fk.validated = false;
      }
      if (name === 'failed process') mock.outputs.execution.status = 3;
      if (name === 'unchanged old row violated')
        mock.outputs.after.snapshot.publicationVersionRows.push('altered');
      await expect(
        api.runReceivingUpgrade({ io: mock.io, plan }),
      ).rejects.toThrow();
      expect(mock.receipts).toEqual([]);
      expect(mock.events.at(-1)).toBe('restoreBaseline');
    });
  }
  apiCase(
    'DR-UR-X11 failed restore verification or receipt write cannot return success',
    async (api) => {
      for (const name of [
        'restore verification',
        'restore container replacement',
        'receipt write',
      ]) {
        const plan = api.buildUpgradePlan(input());
        const mock = world(plan);
        if (name === 'restore verification')
          mock.outputs.restored.baselineSha256 = '0'.repeat(64);
        else if (name === 'restore container replacement')
          mock.outputs.restored.containerId = 'b'.repeat(64);
        else mock.errors.set('writeReceipt', new Error('receipt write failed'));
        await expect(
          api.runReceivingUpgrade({ io: mock.io, plan }),
        ).rejects.toThrow();
        expect(mock.events).toContain('restoreBaseline');
      }
    },
  );
});
