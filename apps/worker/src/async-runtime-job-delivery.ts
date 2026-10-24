import type {
  JobConsumerDecision,
  JobEffectResult,
} from '@wejammin/application';

import type { AsyncWorkerBindings } from './async-entrypoint';
import type { JobQueueMessageOutcome } from './async-entrypoint-job-outcome';
import {
  invocationBudgetMs,
  type JobEffectDeliveryContext,
} from './async-runtime-job-context';
import type { AsyncJobRuntimeDependencies } from './async-runtime-rpc-types';
import { CMS_TAXONOMY_MERGE_CONVERGE_JOB_TYPE } from './cms-taxonomy-merge-converge-names';
import { retryAfterAttempt } from './event-consumers/retry-schedule';

/** The CMS preparation Job type: its effect also receives the private lease control and gets paced retries. */
export const CMS_SCHEMA_DRY_RUN_TYPE = 'cms.schema.dry_run';
/**
 * The only Job types whose effect receives the Worker-layer delivery context (it carries the service bindings): the
 * CMS preparation and the taxonomy merge convergence (which receives no lease control and is never re-queued).
 */
const CONTEXT_JOB_TYPES: ReadonlySet<string> = new Set([
  CMS_SCHEMA_DRY_RUN_TYPE,
  CMS_TAXONOMY_MERGE_CONVERGE_JOB_TYPE,
]);

/**
 * The per-message effect closure of one delivery (DEC-184). Only the CMS preparation and taxonomy merge effects
 * receive the Worker-layer context `{ env, signal, deliveryAttempt }`, a third argument the application consumer
 * never sees; every other effect keeps the arity the consumer gave it. The signal aborts when the invocation budget
 * `min(240000, lease remaining - 60000)` ms is spent, and its timer never outlives the effect. The closure
 * remembers the CMS effect's last answer so the orchestration can tell a progress continuation from a retry.
 */
export const createDeliveryEffect = (
  input: Readonly<{
    effect: NonNullable<AsyncJobRuntimeDependencies['effect']>;
    env: AsyncWorkerBindings;
    deliveryAttempt: number;
    now: () => number;
  }>,
) => {
  const { effect, env, deliveryAttempt, now } = input;
  let last: JobEffectResult | null = null;
  const execute = async (
    request: Parameters<typeof effect>[0],
    control?: Parameters<typeof effect>[1],
  ): Promise<JobEffectResult> => {
    // The consumer supplies a lease control only to a verified CMS dry-run delivery; no effect outside
    // CONTEXT_JOB_TYPES (the dry run and the taxonomy merge convergence) ever receives the context.
    if (!CONTEXT_JOB_TYPES.has(request.job.type)) return effect(request);
    const controller = new AbortController();
    const budgetMs = invocationBudgetMs(
      request.claimedLease?.leaseUntilMs,
      now(),
    );
    const timer =
      budgetMs > 0 ? setTimeout(() => controller.abort(), budgetMs) : null;
    if (timer === null) controller.abort();
    const context: JobEffectDeliveryContext = Object.freeze({
      env,
      signal: controller.signal,
      deliveryAttempt,
    });
    try {
      const result = await effect(request, control, context);
      last = result;
      return result;
    } finally {
      if (timer !== null) clearTimeout(timer);
    }
  };
  return { execute, lastResult: (): JobEffectResult | null => last };
};

/**
 * The CMS preparation Job path redelivers a retry-type disposition after 15, 60 and 300 seconds for
 * deliveries 1, 2 and 3 (BE00 `platform.job.execute`). A `queued` continuation that carries no error code is
 * a healthy progress step and retries at once. Everything else keeps the bare retry.
 */
export const pacedRetry = (
  decision: JobConsumerDecision,
  effectResult: JobEffectResult | null,
  deliveryAttempt: number,
): JobQueueMessageOutcome => {
  const progressContinuation =
    decision.kind === 'completed' &&
    decision.outcome.kind === 'applied' &&
    decision.outcome.nextState === 'queued' &&
    effectResult?.state === 'queued' &&
    effectResult.errorCode === null;
  if (progressContinuation) return 'retry';
  const paced = retryAfterAttempt(deliveryAttempt);
  return paced.delaySeconds === undefined
    ? 'retry'
    : { outcome: 'retry', delaySeconds: paced.delaySeconds };
};
