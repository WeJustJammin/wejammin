import type {
  CmsLeaseControl,
  JobEffectInput,
  JobEffectResult,
} from '@wejammin/application';
import { projectServerEnvironment } from '@wejammin/config/environment';
import { createLogger, type Logger } from '@wejammin/observability/logging';

import type { AsyncWorkerBindings } from './async-entrypoint';
import { createSupabaseRpc } from './async-runtime-support';
import { cmsSchemaMigrationWorkerId } from './cms-schema-migration-worker-id';
import type { JobEffectDeliveryContext } from './async-runtime-job-context';
import { createClaimedSchemaMigrationPreparation } from './content-schema-registry/claimed-schema-migration-preparation';
import {
  executeClaimedPreparationJob,
  type ClaimedPreparationPort,
} from './content-schema-registry/claimed-schema-migration-preparation-job-effect';
import type { MigrationWorkerResult } from './content-schema-registry/migration-worker';
import type { SchemaMigrationRpcName } from './content-schema-registry/migration-worker-constants';
import { resultWith } from './content-schema-registry/migration-worker-validation';
import { logSchemaMigrationQueueAttempt } from './content-schema-registry/operational-alert-queue-telemetry';
import {
  productionMigrationTelemetry,
  type ProductionSchemaMigrationWorkerOptions,
} from './production-worker-runtime-cms';

/** One Worker environment's claimed preparation and the logger of its Job-path queue attempts. */
export type ClaimedPreparationComposition = Readonly<{
  preparation: ClaimedPreparationPort;
  logger: Logger;
}>;

export type ClaimedPreparationFactory = (
  env: AsyncWorkerBindings,
  fetchImpl: typeof fetch,
  options: ProductionSchemaMigrationWorkerOptions,
) => ClaimedPreparationComposition;

/**
 * The plan-lease owner is the release-level migration worker id, the one the legacy event-path worker uses
 * (`production-worker-runtime-cms.ts`); binding it to the Job claim would turn a crash redelivery into
 * `LEASE_UNAVAILABLE` until the 30 s plan lease lapses.
 */
const preparationWorkerId = (
  env: Pick<AsyncWorkerBindings, 'APP_ENVIRONMENT' | 'APP_RELEASE'>,
): string => cmsSchemaMigrationWorkerId(env);

/**
 * Composes the claimed preparation for one Worker environment from that environment's validated service
 * credentials and the protected Supabase RPC transport. It throws when the environment is not valid; the
 * caller turns that into a retryable unavailable disposition and does not remember the failure.
 */
export const createProductionClaimedPreparation: ClaimedPreparationFactory = (
  env,
  fetchImpl,
  options,
) => {
  const validated = projectServerEnvironment(env);
  const rpc = createSupabaseRpc(fetchImpl, {
    ...(options.deadlineMs === undefined
      ? {}
      : { deadlineMs: options.deadlineMs }),
    ...(options.maxResponseBytes === undefined
      ? {}
      : { maxResponseBytes: options.maxResponseBytes }),
  });
  const logger =
    options.logger ??
    createLogger({
      environment: validated.APP_ENVIRONMENT,
      release: validated.APP_RELEASE,
      service: 'wejammin-cms-migration-worker',
    });
  const preparation = createClaimedSchemaMigrationPreparation({
    port: {
      call: (operation: SchemaMigrationRpcName, request, signal) =>
        rpc(validated, operation, { p_request: request }, signal),
    },
    workerId: options.workerId ?? preparationWorkerId(validated),
    ...(options.now === undefined ? {} : { now: options.now }),
    ...(options.leaseDurationMs === undefined
      ? {}
      : { leaseDurationMs: options.leaseDurationMs }),
    ...(options.maxBatchRows === undefined
      ? {}
      : { maxBatchRows: options.maxBatchRows }),
    ...(options.maxBatchesPerInvocation === undefined
      ? {}
      : { maxBatchesPerInvocation: options.maxBatchesPerInvocation }),
    telemetry: options.telemetry ?? productionMigrationTelemetry(logger),
  });
  return { preparation, logger };
};

/** The worker outcome whose queue-attempt classification matches a Job disposition. */
const queueOutcomeOf = (
  disposition: JobEffectResult,
): MigrationWorkerResult['outcome'] =>
  disposition.state === 'succeeded'
    ? 'completed'
    : disposition.state === 'queued'
      ? disposition.errorCode === null
        ? 'progress'
        : 'retry'
      : 'failed_terminal';

/**
 * The production `prepareSchemaDryRun` callback. `create` composes one environment (a test seam; production
 * uses the default). One composition is kept per environment object in a `WeakMap`, the pattern of the
 * legacy event-path worker, because Worker bindings arrive per invocation; nothing lives in module state
 * and a failed construction is not cached. The callback never throws and never answers
 * `pending_manual_review`.
 */
export const createProductionClaimedPreparationEffect = (
  fetchImpl: typeof fetch,
  options: ProductionSchemaMigrationWorkerOptions = {},
  create: ClaimedPreparationFactory = createProductionClaimedPreparation,
) => {
  const compositions = new WeakMap<object, ClaimedPreparationComposition>();
  const compositionFor = (
    env: AsyncWorkerBindings,
  ): ClaimedPreparationComposition | null => {
    const known = compositions.get(env);
    if (known !== undefined) return known;
    try {
      const composed = create(env, fetchImpl, options);
      compositions.set(env, composed);
      return composed;
    } catch {
      return null;
    }
  };

  return async (
    input: JobEffectInput,
    control?: CmsLeaseControl,
    context?: JobEffectDeliveryContext,
  ): Promise<JobEffectResult> => {
    if (context === undefined)
      return executeClaimedPreparationJob({
        preparation: null,
        input,
        control,
        deliveryAttempt: 1,
        signal: new AbortController().signal,
      });
    const composition = compositionFor(context.env);
    const disposition = await executeClaimedPreparationJob({
      preparation: composition?.preparation ?? null,
      input,
      control,
      deliveryAttempt: context.deliveryAttempt,
      signal: context.signal,
    });
    if (composition !== null) {
      try {
        // The Job path's own `cms.registry.queue_attempt` event, so the migration retry and dead-letter
        // alerts (BE03a Observability) see Job-path retries and the final-delivery failure.
        logSchemaMigrationQueueAttempt(
          composition.logger,
          resultWith(queueOutcomeOf(disposition)),
          { attempts: context.deliveryAttempt },
        );
      } catch {
        // Telemetry loss never changes the disposition.
      }
    }
    return disposition;
  };
};
