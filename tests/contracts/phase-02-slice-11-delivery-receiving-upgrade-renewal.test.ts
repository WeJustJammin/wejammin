import { describe, expect, it } from 'vitest';

import { world } from './phase-02-slice-11-delivery-receiving-upgrade-fixtures';
import {
  before,
  afterPositive,
} from './phase-02-slice-11-delivery-receiving-upgrade-snapshot-fixtures';
import {
  api,
  baseline,
  exact,
  image,
  initial,
  input,
  manifest,
  predecessor,
  realModule,
  resetImage,
  restoredImage,
  transition,
} from './phase-02-slice-11-delivery-receiving-upgrade-renewal-fixtures';
import type {
  Api,
  Mode,
  Plan,
} from './phase-02-slice-11-delivery-receiving-upgrade-types';

function renewed(implementation: Api, mode: Mode = 'negative') {
  const plan = implementation.buildUpgradePlan(input(mode));
  const mock = world(plan, {
    before: before(mode),
    after: mode === 'negative' ? before('negative', 202) : afterPositive(),
  });
  mock.outputs.prefix = initial(plan);
  mock.outputs.reset = resetImage(plan);
  mock.outputs.restored = restoredImage(plan);
  const { target, containerId, clusterId, databaseOid, resetEpoch } =
    resetImage(plan);
  const binding = { target, containerId, clusterId, databaseOid, resetEpoch };
  for (const output of [
    mock.outputs.setup,
    mock.outputs.beforeEnvelope,
    mock.outputs.afterEnvelope,
    mock.outputs.execution,
  ])
    Object.assign(output, binding);
  return { plan, mock };
}
async function successful(implementation: Api) {
  const { plan, mock } = renewed(implementation);
  await implementation.runReceivingUpgrade({ io: mock.io, plan });
}

describe('DEC-197 approved reset-only renewal: pure closed contracts', () => {
  it('DR-RN-P01 ordinary identity comparison remains strict without a reset exception', async () => {
    const module = await realModule(
      'infra/database-upgrades/delivery-receiving-upgrade-target.mjs',
      ['assertIdentity'],
    );
    const compare = module.assertIdentity as (
      value: unknown,
      target: unknown,
      previous: unknown,
    ) => void;
    expect(() => compare(image(0), image(0).target, image(0))).not.toThrow();
    expect(() => compare(image(1), image(0).target, image(0))).toThrow(
      /changed (containerId|clusterId)/,
    );
  });

  it('DR-RN-P02 accepts only the explicit closed reset transition, not global drift', async () => {
    const implementation = await api();
    const plan = implementation.buildUpgradePlan(input());
    const module = await realModule(
      'infra/database-upgrades/delivery-receiving-upgrade-target.mjs',
      ['assertResetTransition'],
    );
    const validate = module.assertResetTransition as (
      value: unknown,
      context: unknown,
    ) => void;
    const result = resetImage(plan);
    const authority = initial(plan);
    const saved = JSON.stringify(authority);
    expect(() =>
      validate(result, {
        plan,
        initial: authority,
        previous: image(0),
        purpose: 'prefix',
        sequence: 1,
        inventorySha256: manifest([predecessor]),
      }),
    ).not.toThrow();
    expect(JSON.stringify(authority)).toBe(saved);
    expect(result.transition).toEqual({
      kind: 'DEC197_OWNED_RESET_V1',
      purpose: 'prefix',
      sequence: 1,
      from: image(0),
      to: image(1),
      fromEpoch: null,
      toEpoch: 'renewal-prefix-1',
      inventorySha256: manifest([predecessor]),
      sourceSha256: plan.sourceSha256,
      witnessSha256: plan.witnessSha256,
    });
  });

  for (const mutation of [
    'missing',
    'extra key',
    'kind',
    'purpose',
    'sequence',
    'from',
    'to',
    'owner',
    'OID',
    'epoch',
    'from epoch',
    'inventory',
    'source',
    'witness',
  ])
    it(`DR-RN-P03 refuses transition ${mutation}`, async () => {
      const implementation = await api();
      const plan = implementation.buildUpgradePlan(input());
      const module = await realModule(
        'infra/database-upgrades/delivery-receiving-upgrade-target.mjs',
        ['assertResetTransition'],
      );
      const validate = module.assertResetTransition as (
        value: unknown,
        context: unknown,
      ) => void;
      const context = {
        plan,
        initial: initial(plan),
        previous: image(0),
        purpose: 'prefix',
        sequence: 1,
        inventorySha256: manifest([predecessor]),
      };
      const result = resetImage(plan);
      expect(() => validate(result, context)).not.toThrow();
      const candidate = structuredClone(result) as unknown as Record<
        string,
        unknown
      >;
      const t = candidate.transition as Record<string, unknown>;
      if (mutation === 'missing') delete candidate.transition;
      if (mutation === 'extra key') t.owned = true;
      if (mutation === 'kind') t.kind = 'TRUST_ME';
      if (mutation === 'purpose') t.purpose = 'baseline';
      if (mutation === 'sequence') t.sequence = 2;
      if (mutation === 'from') t.from = image(1);
      if (mutation === 'to') t.to = image(2);
      if (mutation === 'owner')
        (t.to as Record<string, unknown>).owner = 'foreign';
      if (mutation === 'OID')
        (t.to as Record<string, unknown>).databaseOid = '6';
      if (mutation === 'epoch') t.toEpoch = '';
      if (mutation === 'from epoch') t.fromEpoch = 'old-case';
      if (mutation === 'inventory') t.inventorySha256 = manifest(baseline);
      if (mutation === 'source') t.sourceSha256 = '0'.repeat(64);
      if (mutation === 'witness') t.witnessSha256 = '0'.repeat(64);
      expect(() => validate(candidate, context)).toThrow();
    });
});

describe('DEC-197 runner retains initial authority and binds renewed case identity', () => {
  for (const mode of ['negative', 'positive'] as const)
    it(`DR-RN-R01 ${mode} accepts A0→A1→A2 and records all identities`, async () => {
      const implementation = await api();
      const { plan, mock } = renewed(implementation, mode);
      const receipt = await implementation.runReceivingUpgrade({
        io: mock.io,
        plan,
      });
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
        initialIdentity: image(0),
        caseIdentity: image(1),
        restoredIdentity: image(2),
        resetTransitions: [
          transition(plan, 'prefix'),
          transition(plan, 'baseline'),
        ],
        prefixSha256: manifest([predecessor]),
        baselineSha256: manifest(baseline),
        cleanup: { baselineRestored: true },
      });
      expect(mock.receipts).toEqual([receipt]);
      exact(plan.source.bytes, input(mode).source.bytes, 'source untouched');
      exact(plan.witness, input(mode).witness, '080 untouched');
      expect(mock.outputs.prefix).toEqual(initial(plan));
    });

  for (const phase of ['setup', 'before', 'migration', 'after'] as const)
    it(`DR-RN-R02 rejects unexpected ${phase} drift after accepted renewal`, async () => {
      const implementation = await api();
      await successful(implementation);
      const { plan, mock } = renewed(implementation);
      const output = {
        setup: mock.outputs.setup,
        before: mock.outputs.beforeEnvelope,
        migration: mock.outputs.execution,
        after: mock.outputs.afterEnvelope,
      }[phase];
      output.containerId = image(2).containerId;
      await expect(
        implementation.runReceivingUpgrade({ io: mock.io, plan }),
      ).rejects.toThrow();
      expect(mock.events.at(-1)).toBe('restoreBaseline');
      expect(mock.receipts).toEqual([]);
    });

  it('DR-RN-R03 restoration gets immutable A0, never a caller-mutated initial DTO or A1', async () => {
    const implementation = await api();
    const { plan, mock } = renewed(implementation);
    const expected = initial(plan);
    const received: unknown[] = [];
    mock.io.resetBefore = (_plan: Plan, authority: unknown) => {
      mock.events.push('resetBefore');
      received.push(authority);
      expect(Object.isFrozen(authority)).toBe(true);
      expect(authority).toEqual(expected);
      const value = authority as ReturnType<typeof initial>;
      expect(Object.isFrozen(value.target)).toBe(true);
      expect(Object.isFrozen(value.lease.locks)).toBe(true);
      expect(Object.isFrozen(value.lease.locks[0])).toBe(true);
      mock.outputs.prefix.containerId = 'f'.repeat(64);
      mock.outputs.prefix.lease.locks[0]!.inode = 9999;
      return Promise.resolve(resetImage(plan));
    };
    mock.io.restoreBaseline = (_plan: Plan, authority: unknown) => {
      mock.events.push('restoreBaseline');
      received.push(authority);
      expect(authority).toEqual(expected);
      return Promise.resolve(restoredImage(plan));
    };
    await implementation.runReceivingUpgrade({ io: mock.io, plan });
    expect(received).toHaveLength(2);
    for (const authority of received)
      expect(Object.isFrozen(authority)).toBe(true);
    expect(expected.containerId).toBe('a'.repeat(64));
  });

  for (const field of ['purpose', 'from', 'inventory', 'epoch'] as const)
    it(`DR-RN-R04 refuses invalid baseline transition ${field} and writes no receipt`, async () => {
      const implementation = await api();
      await successful(implementation);
      const { plan, mock } = renewed(implementation);
      const restored = restoredImage(plan);
      if (field === 'purpose') restored.transition.purpose = 'prefix';
      if (field === 'from') restored.transition.from = image(0);
      if (field === 'inventory')
        restored.transition.inventorySha256 = plan.prefixSha256;
      if (field === 'epoch') restored.transition.toEpoch = 'renewal-prefix-1';
      mock.outputs.restored = restored;
      await expect(
        implementation.runReceivingUpgrade({ io: mock.io, plan }),
      ).rejects.toThrow();
      expect(mock.events.at(-1)).toBe('restoreBaseline');
      expect(mock.receipts).toEqual([]);
    });

  it('DR-RN-R05 ambiguous reset preserves original error despite failed restoration; no success DTO', async () => {
    const implementation = await api();
    const { plan, mock } = renewed(implementation);
    const failure = new Error('OWNED_RESET_AMBIGUOUS');
    mock.errors.set('resetBefore', failure);
    mock.errors.set(
      'restoreBaseline',
      new Error('RECOVERY_OWNERSHIP_UNPROVEN'),
    );
    await expect(
      implementation.runReceivingUpgrade({ io: mock.io, plan }),
    ).rejects.toBe(failure);
    expect(mock.events).toEqual([
      'preparePrefix',
      'resetBefore',
      'restoreBaseline',
    ]);
    expect(mock.receipts).toEqual([]);
  });
});
