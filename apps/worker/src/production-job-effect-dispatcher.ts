import type {
  JobEffectInput,
  JobEffectPort,
  JobEffectResult,
} from '@wejammin/application';

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
  /** Executes only the private CMS schema preparation contract. */
  prepareSchemaDryRun?: (input: JobEffectInput) => Promise<JobEffectResult>;
}>;

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
 * a credential, adapter, or network effect.
 */
export const createProductionJobEffectDispatcher =
  (dependencies?: ProductionJobEffectDependencies): JobEffectPort['execute'] =>
  async (input): Promise<JobEffectResult> => {
    const isPreparation = input.job.type === 'cms.schema.dry_run';
    if (!isPreparation && !APPROVED_VERIFICATION_TYPES.has(input.job.type)) {
      return manualReview('UNSUPPORTED_JOB_TYPE');
    }
    try {
      let result: JobEffectResult;
      if (isPreparation) {
        if (typeof dependencies?.prepareSchemaDryRun !== 'function') {
          return manualReview('DEPENDENCY_UNAVAILABLE');
        }
        result = await dependencies.prepareSchemaDryRun(input);
      } else {
        if (typeof dependencies?.verifyObject !== 'function') {
          return manualReview('DEPENDENCY_UNAVAILABLE');
        }
        result = await dependencies.verifyObject(input);
      }
      return validResult(result)
        ? result
        : manualReview('DEPENDENCY_UNAVAILABLE');
    } catch {
      return manualReview('DEPENDENCY_UNAVAILABLE');
    }
  };

export const createProductionVerificationDispatcher =
  createProductionJobEffectDispatcher;
