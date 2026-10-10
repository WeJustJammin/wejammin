import { QueueEnvelopeSchema } from '@wejammin/contracts';
import {
  executeJobDispatch,
  type JobConsumerDecision,
  type JobEffectPort,
} from '@wejammin/application';

import type {
  AsyncEntrypointDependencies,
  AsyncWorkerBindings,
  PlatformJobsMessage,
} from './async-entrypoint';
import {
  AsyncRpcTransportError,
  createJobPersistence,
  createSupabaseRpc,
  parseOutboxClaim,
  type AsyncJobRuntimeDependencies,
  type AsyncRpcClient,
} from './async-runtime-support';

export {
  createSupabaseRpc,
  PLATFORM_API_PROFILE,
} from './async-runtime-support';
export type {
  AsyncJobRuntimeDependencies,
  AsyncRpcClient,
  AsyncRpcOperation,
  ClaimedOutbox,
} from './async-runtime-support';

const queueOutcome = (decision: JobConsumerDecision): 'ack' | 'retry' => {
  if (decision.kind === 'completed') {
    return decision.processed?.kind === 'recorded' ||
      decision.processed?.kind === 'duplicate'
      ? 'ack'
      : 'retry';
  }
  if (
    decision.kind === 'skip' ||
    decision.kind === 'dead_letter' ||
    decision.kind === 'manual_review'
  ) {
    return 'ack';
  }
  return 'retry';
};

export { queueOutcome };

const nowOf = (dependencies: AsyncJobRuntimeDependencies): (() => number) =>
  dependencies.now ?? Date.now;

const validLeaseSeconds = (value: number): boolean =>
  Number.isInteger(value) && value >= 1 && value <= 840;

/**
 * A typed manual-review transport failure is non-replayable.  Its response
 * may have been applied by the RPC server before the transport rejected it,
 * so retrying the surrounding orchestration could execute an effect twice.
 */
const isManualReviewTransportError = (error: unknown): boolean =>
  error instanceof AsyncRpcTransportError &&
  error.disposition === 'manual_review' &&
  error.retryable === false;

export const createAsyncJobDependencies = (
  dependencies: AsyncJobRuntimeDependencies = {},
): AsyncEntrypointDependencies => {
  const rpc: AsyncRpcClient =
    dependencies.rpc ?? createSupabaseRpc(dependencies.fetch);
  const leaseSeconds = dependencies.leaseSeconds ?? 300;
  const maxOutboxClaims = dependencies.maxOutboxClaims ?? 25;
  const now = nowOf(dependencies);
  const tokenFor = dependencies.leaseToken ?? (() => crypto.randomUUID());
  const outboxLeaseToken =
    dependencies.outboxLeaseToken ?? (() => crypto.randomUUID());

  const orchestrateQueueMessage = async ({
    env,
    message,
  }: {
    env: AsyncWorkerBindings;
    executionContext: { waitUntil(promise: Promise<unknown>): void };
    message: PlatformJobsMessage;
  }): Promise<'ack' | 'retry'> => {
    const parsed = QueueEnvelopeSchema.safeParse(message.body);
    if (
      !parsed.success ||
      parsed.data.eventType !== 'job.requested' ||
      parsed.data.schemaVersion !== 1 ||
      parsed.data.aggregateType !== 'job'
    ) {
      return 'retry';
    }
    if (dependencies.effect === undefined || !validLeaseSeconds(leaseSeconds)) {
      return 'retry';
    }
    try {
      const persistence = createJobPersistence(env, rpc);
      const canonical = await persistence.readCanonicalJob(
        parsed.data.aggregateId,
      );
      if (canonical === null) return 'retry';
      let verifiedImmutableJobOrigin = false;
      if (
        canonical.type === 'cms.schema.dry_run' &&
        (canonical.state === 'queued' || canonical.state === 'running')
      ) {
        if (dependencies.verifyCmsSchemaDryRunOrigin === undefined)
          return 'retry';
        const controller = new AbortController();
        try {
          if (controller.signal.aborted) return 'retry';
          const verified = await dependencies.verifyCmsSchemaDryRunOrigin(
            Object.freeze({
              env,
              envelope: parsed.data,
              signal: controller.signal,
            }),
          );
          if (controller.signal.aborted) return 'retry';
          if (verified !== true) return 'ack';
          verifiedImmutableJobOrigin = true;
        } catch {
          return 'retry';
        }
      }
      const leaseToken = tokenFor(message);
      const decision = await executeJobDispatch({
        persistence,
        effect: { execute: dependencies.effect } as JobEffectPort,
        envelope: parsed.data,
        leaseToken,
        leaseSeconds,
        nowMs: now(),
        processedEventIds: [],
        ...(verifiedImmutableJobOrigin
          ? {
              verifiedImmutableJobOrigin: true,
              eventJobType: 'cms.schema.dry_run',
            }
          : {}),
      });
      return queueOutcome(decision);
    } catch (error) {
      if (isManualReviewTransportError(error)) return 'ack';
      return 'retry';
    }
  };

  const sweepOutbox = async ({
    env,
  }: {
    controller: { cron: string; scheduledTime: number };
    env: AsyncWorkerBindings;
    executionContext: { waitUntil(promise: Promise<unknown>): void };
  }): Promise<'completed' | 'retry'> => {
    try {
      if (
        !validLeaseSeconds(leaseSeconds) ||
        !Number.isInteger(maxOutboxClaims) ||
        maxOutboxClaims < 1
      ) {
        return 'retry';
      }
      const batchSize = Math.min(maxOutboxClaims, 100);
      const leaseToken = outboxLeaseToken();
      const rows = await rpc<unknown>(env, 'claim_outbox_batch', {
        p_lease_token: leaseToken,
        p_lease_seconds: leaseSeconds,
        p_batch_size: batchSize,
      });
      if (!Array.isArray(rows) || rows.length > batchSize) return 'retry';
      for (const row of rows) {
        const claim = parseOutboxClaim(row);
        if (claim === null || claim.leaseToken !== leaseToken) return 'retry';
        await env.PLATFORM_JOBS.send(claim.envelope);
        const completed = await rpc<unknown>(env, 'complete_outbox_event', {
          p_event_id: claim.outboxId,
          p_lease_token: claim.leaseToken,
        });
        if (completed !== true) return 'retry';
      }
      return 'completed';
    } catch (error) {
      if (isManualReviewTransportError(error)) return 'completed';
      return 'retry';
    }
  };

  return { orchestrateQueueMessage, sweepOutbox };
};
