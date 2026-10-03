import { describe, expect, it } from 'vitest';

import {
  createContentSchemaRegistryDomain,
  type ContentSchemaRegistryPortInput,
  type ContentSchemaRegistryResult,
} from './index';
import { SCHEMA_MIGRATION_RPC } from './migration-worker-constants';
import { createMigrationWorkerRuntime } from './migration-worker-runtime';
import { runVerificationStage } from './migration-worker-verification';
import { basePlan, job, makePort, NOW } from './migration-worker-test-support';
import {
  makeHarness,
  readRequest,
} from './phase-02-slice-09-adversarial-test-support';
import {
  REQUEST_ID,
  resource,
  session,
  validDraft,
} from './phase-02-slice-09-test-values';

const signal = new AbortController().signal;

const verificationInput = (
  runtime: ReturnType<typeof createMigrationWorkerRuntime>,
  state: 'ready' | 'verifying',
) => ({
  runtime,
  plan: basePlan({ state }),
  event: null,
  job,
  leaseToken: 'lease-token',
  signal,
  attempt: 0,
});

describe('migration worker owned coverage', () => {
  it('does not acknowledge an absent event after activation reconciliation', async () => {
    const port = makePort({
      [SCHEMA_MIGRATION_RPC.verify]: () => ({ valid: true }),
      [SCHEMA_MIGRATION_RPC.complete]: () => ({
        plan: basePlan({ state: 'completed', progress: 1 }),
      }),
      [SCHEMA_MIGRATION_RPC.activate]: () => {
        throw Object.assign(new Error('activation response was lost'), {
          code: 'ACTIVATE_FAILURE',
          retryable: true,
        });
      },
      [SCHEMA_MIGRATION_RPC.reconcileActivation]: () => ({ activated: true }),
    });
    const runtime = createMigrationWorkerRuntime({
      port,
      workerId: 'owned-coverage-worker',
      now: () => NOW,
    });

    await expect(
      runVerificationStage(verificationInput(runtime, 'verifying')),
    ).resolves.toMatchObject({
      outcome: 'completed',
      activationSwitched: true,
    });
    expect(
      port.calls.some(
        ({ rpc }) => rpc === SCHEMA_MIGRATION_RPC.acknowledgeEvent,
      ),
    ).toBe(false);
  });

  it('returns a retry for a non-verifying plan without an event identity', async () => {
    const port = makePort();
    const runtime = createMigrationWorkerRuntime({
      port,
      workerId: 'owned-coverage-fallback',
      now: () => NOW,
    });

    await expect(
      runVerificationStage(verificationInput(runtime, 'ready')),
    ).resolves.toMatchObject({
      outcome: 'retry',
      reasonCode: 'UNEXPECTED_MIGRATION_STATE',
      eventId: null,
    });
  });

  it('hands an in-flight idempotency key with a different request to the database instead of answering from a Worker cache', async () => {
    const harness = makeHarness();
    const createTypeDraft = harness.ports.createTypeDraft;
    if (createTypeDraft === undefined)
      throw new Error('createTypeDraft fixture is missing');
    createTypeDraft.mockImplementation(
      () => new Promise<ContentSchemaRegistryResult<unknown>>(() => undefined),
    );
    const domain = createContentSchemaRegistryDomain(harness.dependencies);
    const input: ContentSchemaRegistryPortInput = {
      operationId: 'CMS-03A-01',
      requestId: REQUEST_ID,
      request: readRequest(),
      session,
      body: { ...validDraft },
      idempotencyKey: 'owned-coverage-key',
    };

    void domain.execute(input);
    void domain.execute({
      ...input,
      body: { ...validDraft, label: 'Different article' },
    });
    await Promise.resolve();
    // BE00: the (actor, operation, key) binding is the database's; both
    // requests reach the RPC and the Worker never invents a conflict.
    expect(createTypeDraft).toHaveBeenCalledTimes(2);
  });
});
