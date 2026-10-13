import type {
  CmsLeaseControl,
  JobEffectInput,
  JobEffectResult,
} from '@wejammin/application';

import {
  deliveryAttemptOf,
  isFinalDelivery,
  type JobEffectDeliveryContext,
} from './async-runtime-job-context';
import { PREPARATION_JOB_ERROR } from './content-schema-registry/claimed-schema-migration-preparation-job-result';

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
        if (!validResult(result) || !CMS_DISPOSITIONS.has(result.state))
          return cmsUnavailable(context);
        // Backstop: the queue dead-letters the message after the last delivery, so a Job left `queued`
        // would never settle. The real callback has already rolled its plan back before it gets here.
        return result.state === 'queued' &&
          isFinalDelivery(deliveryAttemptOf(context?.deliveryAttempt))
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
