import { describe, expect, it } from 'vitest';

import {
  MIGRATION_STATE_TRANSITIONS,
  MIGRATION_STATES,
} from './migration-worker-constants';
import {
  SCHEMA_MIGRATION_RPC,
  SchemaMigrationQueueEnvelopeSchema,
  createSchemaMigrationWorker,
} from './migration-worker';
import {
  basePlan,
  event,
  EVENT_ID,
  job,
  makePort,
  NOW,
  PLAN_ID,
} from './migration-worker-test-support';

const accepts = (value: unknown): boolean =>
  SchemaMigrationQueueEnvelopeSchema.safeParse(value).success;

describe('migration state machine and event consumer for A04 activation', () => {
  it('[P2-S09-AC-187] follows draft, dry_running, ready or blocked, running, verifying, then completed, failed_retryable or failed_terminal and reaches completed only through verification', () => {
    expect([...MIGRATION_STATES]).toEqual([
      'draft',
      'dry_running',
      'ready',
      'blocked',
      'running',
      'verifying',
      'completed',
      'failed_retryable',
      'failed_terminal',
    ]);
    expect(MIGRATION_STATE_TRANSITIONS).toEqual({
      draft: ['dry_running'],
      dry_running: ['ready', 'blocked'],
      ready: ['running', 'blocked'],
      blocked: ['draft'],
      running: ['verifying', 'failed_retryable', 'failed_terminal'],
      verifying: ['completed', 'failed_retryable', 'failed_terminal'],
      completed: [],
      failed_retryable: ['running'],
      failed_terminal: [],
    });
    const reach = (
      from: string,
      seen = new Set<string>([from]),
      via: string[] = [],
    ): Map<string, string[]> => {
      const paths = new Map<string, string[]>();
      const queue: [string, string[]][] = [[from, via]];
      while (queue.length > 0) {
        const [state, path] = queue.shift() as [string, string[]];
        paths.set(state, path);
        for (const next of MIGRATION_STATE_TRANSITIONS[
          state as keyof typeof MIGRATION_STATE_TRANSITIONS
        ])
          if (!seen.has(next)) {
            seen.add(next);
            queue.push([next, [...path, next]]);
          }
      }
      return paths;
    };
    expect(reach('ready').get('completed')).toEqual([
      'running',
      'verifying',
      'completed',
    ]);
    expect(reach('draft').get('completed')).toEqual([
      'dry_running',
      'ready',
      'running',
      'verifying',
      'completed',
    ]);
    expect(reach('completed').size).toBe(1);
    expect(reach('failed_terminal').size).toBe(1);
  });

  it('[P2-S09-AC-187] persists the cursor, counters and transform, compiler, source and target hashes with every batch the worker sends', async () => {
    const port = makePort({
      [SCHEMA_MIGRATION_RPC.readPlan]: () => basePlan(),
      [SCHEMA_MIGRATION_RPC.claimLease]: () => ({
        acquired: true,
        leaseToken: 'lease-1',
        plan: basePlan({ state: 'running', version: '8' }),
      }),
      [SCHEMA_MIGRATION_RPC.heartbeatLease]: () => ({ renewed: true }),
      [SCHEMA_MIGRATION_RPC.processBatch]: () => ({
        plan: basePlan({
          state: 'running',
          version: '9',
          cursor: '128',
          progress: 0.5,
        }),
      }),
    });
    const worker = createSchemaMigrationWorker({
      port,
      workerId: 'worker-187',
      now: () => NOW,
    });
    await worker.process(job);
    const batch = port.calls.find(
      (call) => call.rpc === SCHEMA_MIGRATION_RPC.processBatch,
    )?.request as Record<string, unknown>;
    expect(batch).toMatchObject({
      migrationPlanId: PLAN_ID,
      cursor: '0',
      transformKey: 'identity.revalidate',
      transformVersion: '1',
    });
    for (const member of [
      'compilerHash',
      'sourceHash',
      'targetHash',
      'leaseToken',
      'expectedVersion',
    ])
      expect(batch, member).toHaveProperty(member);
    expect(String(batch.compilerHash)).toMatch(/^[a-f0-9]{64}$/u);
  });

  it('[P2-S09-AC-190] validates the BE00 identifier-only event envelope with exactly the eleven members, a decimal aggregate version and an identifier-only payload', () => {
    expect(accepts(event)).toBe(true);
    for (const member of Object.keys(event)) {
      const rest: Record<string, unknown> = { ...event };
      delete rest[member];
      expect(accepts(rest), `missing ${member}`).toBe(false);
    }
    expect(accepts({ ...event, extra: 'x' })).toBe(false);
    for (const aggregateVersion of [
      '0',
      '01',
      '1.5',
      '-1',
      'v1',
      '',
      7,
      '9223372036854775808',
    ])
      expect(
        accepts({ ...event, aggregateVersion }),
        String(aggregateVersion),
      ).toBe(false);
    expect(accepts({ ...event, aggregateVersion: '9223372036854775807' })).toBe(
      true,
    );
    for (const [member, bad] of [
      ['eventId', 'not-a-uuid'],
      ['occurredAt', 'yesterday'],
      ['correlationId', 'x'],
      ['causationId', 7],
      ['eventType', 'cms.schema.activated.v2'],
      ['schemaVersion', 2],
      ['aggregateId', '1'],
    ] as const)
      expect(accepts({ ...event, [member]: bad }), member).toBe(false);
    expect(accepts({ ...event, causationId: null })).toBe(true);
    for (const member of Object.keys(event.payload)) {
      const rest: Record<string, unknown> = { ...event.payload };
      delete rest[member];
      expect(accepts({ ...event, payload: rest }), `payload ${member}`).toBe(
        false,
      );
    }
    for (const extra of [
      'label',
      'values',
      'ownerId',
      'capability',
      'rendererRef',
    ])
      expect(
        accepts({ ...event, payload: { ...event.payload, [extra]: 'x' } }),
        extra,
      ).toBe(false);
    expect(
      accepts({
        ...event,
        payload: { ...event.payload, contentTypeId: 'Article' },
      }),
    ).toBe(false);
    expect(
      accepts({
        ...event,
        payload: { ...event.payload, localeConfigHash: 'not-hash' },
      }),
    ).toBe(false);
  });

  it('[P2-S09-AC-192] consumes at least once: dedupes by event identity, honours a monotonic aggregate version and sends unknown versions to the DLQ', async () => {
    const duplicate = makePort({
      [SCHEMA_MIGRATION_RPC.claimEvent]: () => ({ status: 'duplicate' }),
    });
    const worker = createSchemaMigrationWorker({
      port: duplicate,
      workerId: 'worker-192',
      now: () => NOW,
    });
    await expect(worker.process(event)).resolves.toMatchObject({
      outcome: 'duplicate',
    });
    await expect(worker.process(event)).resolves.toMatchObject({
      outcome: 'duplicate',
    });
    expect(duplicate.calls.map(({ rpc }) => rpc)).toEqual([
      SCHEMA_MIGRATION_RPC.claimEvent,
      SCHEMA_MIGRATION_RPC.claimEvent,
    ]);
    expect(duplicate.calls[0]?.request).toMatchObject({
      eventId: EVENT_ID,
      aggregateId: PLAN_ID,
      aggregateVersion: '7',
    });
    const outOfOrder = makePort({
      [SCHEMA_MIGRATION_RPC.claimEvent]: () => ({ status: 'stale' }),
    });
    const stale = createSchemaMigrationWorker({
      port: outOfOrder,
      workerId: 'worker-192b',
      now: () => NOW,
    });
    await expect(stale.process(event)).resolves.toMatchObject({
      outcome: 'stale',
      reasonCode: 'EVENT_OUT_OF_ORDER',
    });
    expect(outOfOrder.calls.map(({ rpc }) => rpc)).toEqual([
      SCHEMA_MIGRATION_RPC.claimEvent,
    ]);
    const unknown = makePort({
      [SCHEMA_MIGRATION_RPC.deadLetter]: () => ({ accepted: true }),
    });
    const dlq = createSchemaMigrationWorker({
      port: unknown,
      workerId: 'worker-192c',
      now: () => NOW,
    });
    await expect(
      dlq.process({ ...event, schemaVersion: 99 }),
    ).resolves.toMatchObject({ outcome: 'dead_letter' });
    expect(unknown.calls.at(-1)?.request).toMatchObject({
      eventId: EVENT_ID,
      reasonCode: 'UNKNOWN_EVENT_VERSION',
    });
    await expect(
      dlq.process({ ...event, eventType: 'cms.schema.activated.v2' }),
    ).resolves.toMatchObject({ outcome: 'dead_letter' });
  });
});
