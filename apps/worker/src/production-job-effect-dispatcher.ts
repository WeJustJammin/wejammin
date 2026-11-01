import type {
  CmsLeaseControl,
  JobEffectInput,
  JobEffectResult,
} from '@wejammin/application';
import type { Logger } from '@wejammin/observability/logging';

import {
  deliveryAttemptOf,
  isFinalDelivery,
  type JobEffectDeliveryContext,
} from './async-runtime-job-context';
import { PREPARATION_JOB_ERROR } from './content-schema-registry/claimed-schema-migration-preparation-job-result';
import {
  CANONICAL_JOB_UUID,
  CMS_TAXONOMY_MERGE_CONVERGE_JOB_TYPE,
  TAXONOMY_MERGE_JOB_ERROR,
} from './cms-taxonomy-merge-converge-names';
import {
  logMergeSettled,
  mergeLoggerFor,
} from './cms-taxonomy-merge-converge-telemetry';

const APPROVED_VERIFICATION_TYPES = new Set([
  'object.verify',
  'platform.object.verify',
]);
const ERROR_CODE = /^[A-Z][A-Z0-9_]{0,63}$/u;
const RESULT_REF_TYPE = /^[a-z][a-z0-9_.-]{0,63}$/u;

export type ProductionVerificationDependencies = Readonly<{
  /** Executes only the internal object-verification contract. */
  verifyObject: (input: JobEffectInput) => Promise<JobEffectResult>;
}>;

export type PlatformVerificationDependencies =
  ProductionVerificationDependencies;

export type ProductionJobEffectDependencies = Readonly<{
  verifyObject?: ProductionVerificationDependencies['verifyObject'];
  /**
   * Executes only the private CMS schema preparation contract. It receives the
   * private lease control when, and only when, the consumer supplied one, and
   * the Worker-layer delivery context (environment, invocation signal and
   * delivery number) when, and only when, the Job path supplied one.
   */
  prepareSchemaDryRun?: (
    input: JobEffectInput,
    control?: CmsLeaseControl,
    context?: JobEffectDeliveryContext,
  ) => Promise<JobEffectResult>;
  /**
   * Executes only the fenced taxonomy merge convergence (BE03c 1334). It receives the Worker-layer delivery context
   * (it carries the service bindings) and no lease control, and may answer `succeeded` or `failed` only.
   */
  convergeTaxonomyMerge?: (
    input: JobEffectInput,
    context?: JobEffectDeliveryContext,
  ) => Promise<JobEffectResult>;
  /**
   * The sink of the guard's own `cms_taxonomy_merge_converge.settled` event; by default one logger per Worker
   * environment (the same one the effect uses). A test seam.
   */
  taxonomyMergeLogger?: Logger;
}>;

/** The dispatcher is a `JobEffectPort['execute']` that also accepts the Worker-layer delivery context. */
export type ProductionJobEffect = (
  input: JobEffectInput,
  control?: CmsLeaseControl,
  context?: JobEffectDeliveryContext,
) => Promise<JobEffectResult>;

const manualReview = (errorCode: string): JobEffectResult => ({
  errorCode,
  resultRef: null,
  state: 'pending_manual_review',
});

const validResultRef = (value: unknown): boolean => {
  if (value === null) return true;
  if (typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return (
    Object.keys(record).every((key) => key === 'id' || key === 'type') &&
    typeof record.id === 'string' &&
    record.id.length > 0 &&
    record.id.length <= 128 &&
    typeof record.type === 'string' &&
    RESULT_REF_TYPE.test(record.type)
  );
};

/**
 * The CMS preparation never answers `cancelled` or `pending_manual_review` (BE03a "Preparation Job
 * disposition"): a manual-review answer writes no outcome and acknowledges the message, which leaves the Job
 * `running` for good (B-08, #128).
 */
const CMS_DISPOSITIONS: ReadonlySet<string> = new Set([
  'queued',
  'succeeded',
  'failed',
]);

/**
 * The CMS family's own refusal: back to `queued` while a delivery remains, `failed` once the BE00 delivery
 * budget is spent (the queue would dead-letter the message and nothing would ever settle the Job).
 */
const cmsUnavailable = (
  context: JobEffectDeliveryContext | undefined,
): JobEffectResult =>
  isFinalDelivery(deliveryAttemptOf(context?.deliveryAttempt))
    ? {
        state: 'failed',
        errorCode: PREPARATION_JOB_ERROR.exhausted,
        resultRef: null,
      }
    : {
        state: 'queued',
        errorCode: PREPARATION_JOB_ERROR.unavailable,
        resultRef: null,
      };

const settledFailure = (errorCode: string): JobEffectResult => ({
  state: 'failed',
  errorCode,
  resultRef: null,
});

/**
 * The taxonomy merge family settles the job `succeeded` (with the mandatory `{ type, id }` result reference the BE00
 * outcome requires) or `failed` (with a code and no reference). It is never re-queued: the redelivered envelope carries
 * the creation version, which the generic dispatch skips as stale once the claim advanced the job, so a `queued` job
 * would never run again; manual review would leave it `running`. Anything else is the unmapped failure.
 */
const validMergeResult = (value: unknown): value is JobEffectResult => {
  if (typeof value !== 'object' || value === null) return false;
  const result = value as Record<string, unknown>;
  if (result.state === 'failed')
    return (
      typeof result.errorCode === 'string' &&
      ERROR_CODE.test(result.errorCode) &&
      result.resultRef === null
    );
  const ref = result.resultRef;
  return (
    result.state === 'succeeded' &&
    result.errorCode === null &&
    typeof ref === 'object' &&
    ref !== null &&
    Object.keys(ref).length === 2 &&
    typeof (ref as Record<string, unknown>).type === 'string' &&
    RESULT_REF_TYPE.test((ref as Record<string, string>).type!) &&
    typeof (ref as Record<string, unknown>).id === 'string' &&
    CANONICAL_JOB_UUID.test((ref as Record<string, string>).id!)
  );
};

const validResult = (value: unknown): value is JobEffectResult => {
  if (typeof value !== 'object' || value === null) return false;
  const result = value as Record<string, unknown>;
  if (
    result.state !== 'queued' &&
    result.state !== 'succeeded' &&
    result.state !== 'failed' &&
    result.state !== 'cancelled' &&
    result.state !== 'pending_manual_review'
  ) {
    return false;
  }
  if (
    result.errorCode !== null &&
    (typeof result.errorCode !== 'string' || !ERROR_CODE.test(result.errorCode))
  ) {
    return false;
  }
  return validResultRef(result.resultRef);
};

/**
 * Builds the production job effect boundary for exact internal verification
 * and CMS preparation families. Provider and arbitrary job names never select
 * a credential, adapter, or network effect. The private lease control and the
 * delivery context reach only the CMS preparation callback; an absent control
 * or context leaves its arity unchanged and verification callbacks never see
 * either. The CMS family answers `queued`, `succeeded` or `failed` only.
 */
export const createProductionJobEffectDispatcher =
  (dependencies?: ProductionJobEffectDependencies): ProductionJobEffect =>
  async (input, control, context): Promise<JobEffectResult> => {
    if (input.job.type === CMS_TAXONOMY_MERGE_CONVERGE_JOB_TYPE) {
      // The guard settles the job `failed` without the effect's own telemetry (the effect is not wired, threw, or
      // answered outside the closed set), so it emits the same event and `outcome="failed"` metric: the runbook alert
      // must see every failed delivery. A conforming effect never reaches these paths after logging its own event.
      const startedAt = Date.now();
      const guardFailure = (errorCode: string): JobEffectResult => {
        logMergeSettled(
          mergeLoggerFor(context?.env, dependencies?.taxonomyMergeLogger),
          input,
          context?.deliveryAttempt ?? 1,
          Date.now() - startedAt,
          { kind: 'failed', errorCode },
        );
        return settledFailure(errorCode);
      };
      if (typeof dependencies?.convergeTaxonomyMerge !== 'function')
        return guardFailure(TAXONOMY_MERGE_JOB_ERROR.unavailable);
      try {
        // A method call: the injected dependency keeps its container as `this`.
        const result = await dependencies.convergeTaxonomyMerge(input, context);
        return validMergeResult(result)
          ? result
          : guardFailure(TAXONOMY_MERGE_JOB_ERROR.unmapped);
      } catch {
        return guardFailure(TAXONOMY_MERGE_JOB_ERROR.unavailable);
      }
    }
    const isPreparation = input.job.type === 'cms.schema.dry_run';
    if (!isPreparation && !APPROVED_VERIFICATION_TYPES.has(input.job.type)) {
      return manualReview('UNSUPPORTED_JOB_TYPE');
    }
    if (isPreparation) {
      if (typeof dependencies?.prepareSchemaDryRun !== 'function')
        return cmsUnavailable(context);
      try {
        // A method call: the injected dependency keeps its container as `this`.
        const result =
          context !== undefined
            ? await dependencies.prepareSchemaDryRun(input, control, context)
            : control === undefined
              ? await dependencies.prepareSchemaDryRun(input)
              : await dependencies.prepareSchemaDryRun(input, control);
        // A result outside the closed set is the family's refusal. Backstop: the queue dead-letters the message
        // after the last delivery, so a Job left `queued` would never settle (the real callback has already
        // rolled its plan back before it gets here), so `queued` on the final delivery is the same refusal.
        return !validResult(result) ||
          !CMS_DISPOSITIONS.has(result.state) ||
          (result.state === 'queued' &&
            isFinalDelivery(deliveryAttemptOf(context?.deliveryAttempt)))
          ? cmsUnavailable(context)
          : result;
      } catch {
        return cmsUnavailable(context);
      }
    }
    try {
      if (typeof dependencies?.verifyObject !== 'function') {
        return manualReview('DEPENDENCY_UNAVAILABLE');
      }
      const result = await dependencies.verifyObject(input);
      return validResult(result)
        ? result
        : manualReview('DEPENDENCY_UNAVAILABLE');
    } catch {
      return manualReview('DEPENDENCY_UNAVAILABLE');
    }
  };

export const createProductionVerificationDispatcher =
  createProductionJobEffectDispatcher;
