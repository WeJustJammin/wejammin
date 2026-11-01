import type { JobEffectResult } from '@wejammin/application';

import type { ClaimedSchemaMigrationPreparationResult } from './claimed-schema-migration-preparation';
import type { MigrationWorkerResult } from './migration-worker-types';

/**
 * DEC-183 / BE03a "Preparation Job disposition": the total, fail-closed map from the claimed
 * preparation result to exactly one BE00 Job disposition (`queued`, `succeeded` or `failed`).
 * The map never answers `cancelled` or `pending_manual_review`: a manual-review answer writes no
 * outcome and acknowledges the message, which would leave the Job `running` for good.
 */

/** The `resultRef.type` of a succeeded preparation: the report that `dryRunRef.id` shows. */
export const PREPARATION_RESULT_REF_TYPE = 'cms_schema_dry_run_report' as const;

/** Job error codes this map and the delivery budget may write; all fit the BE00 error-code grammar. */
export const PREPARATION_JOB_ERROR = {
  claimInvalid: 'PREPARATION_CLAIM_INVALID',
  outcomeUnmapped: 'PREPARATION_OUTCOME_UNMAPPED',
  unavailable: 'DEPENDENCY_UNAVAILABLE',
  invalidResponse: 'DEPENDENCY_INVALID_RESPONSE',
  blocked: 'MIGRATION_BLOCKED',
  failed: 'MIGRATION_FAILED',
  exhausted: 'MIGRATION_RETRIES_EXHAUSTED',
} as const;

const ERROR_GRAMMAR = /^[A-Z][A-Z0-9_]{0,63}$/u;

/** Every worker outcome, in declaration order; adding an outcome without a map row fails compilation. */
export const MIGRATION_WORKER_OUTCOMES = [
  'completed',
  'progress',
  'retry',
  'duplicate',
  'stale',
  'blocked',
  'failed_retryable',
  'failed_terminal',
  'dead_letter',
] as const satisfies readonly MigrationWorkerResult['outcome'][];

type UnlistedOutcome = Exclude<
  MigrationWorkerResult['outcome'],
  (typeof MIGRATION_WORKER_OUTCOMES)[number]
>;
// Compile-time equality with the worker union: an unlisted outcome makes the type `false`, so the `true` fails.
const everyOutcomeListed: UnlistedOutcome extends never ? true : false = true;
void everyOutcomeListed;

/** The worker reason when it is a safe token, otherwise the named fallback. */
const reasonOf = (value: string | null, fallback: string): string =>
  value !== null && ERROR_GRAMMAR.test(value) ? value : fallback;

const queued = (errorCode: string | null): JobEffectResult => ({
  state: 'queued',
  errorCode,
  resultRef: null,
});

const failed = (errorCode: string): JobEffectResult => ({
  state: 'failed',
  errorCode,
  resultRef: null,
});

const processedResult = (
  reportId: string,
  result: MigrationWorkerResult,
): JobEffectResult => {
  const outcome: MigrationWorkerResult['outcome'] = result.outcome;
  switch (outcome) {
    case 'completed':
      return {
        state: 'succeeded',
        errorCode: null,
        resultRef: { type: PREPARATION_RESULT_REF_TYPE, id: reportId },
      };
    case 'progress':
      return queued(null);
    case 'retry':
      return queued(
        reasonOf(result.reasonCode, PREPARATION_JOB_ERROR.unavailable),
      );
    case 'failed_retryable':
      return queued(reasonOf(result.reasonCode, PREPARATION_JOB_ERROR.failed));
    case 'blocked':
      return failed(PREPARATION_JOB_ERROR.blocked);
    case 'failed_terminal':
      return failed(reasonOf(result.reasonCode, PREPARATION_JOB_ERROR.failed));
    case 'duplicate':
    case 'stale':
    case 'dead_letter':
      return failed(PREPARATION_JOB_ERROR.outcomeUnmapped);
    default: {
      // Compile time: a new worker outcome without a case above fails here. Run time: an outcome the map
      // does not know fails closed instead of guessing a state.
      const unmapped: never = outcome;
      void unmapped;
      return failed(PREPARATION_JOB_ERROR.outcomeUnmapped);
    }
  }
};

export const preparationJobResult = (
  result: ClaimedSchemaMigrationPreparationResult,
): JobEffectResult => {
  switch (result.kind) {
    case 'invalid_claim':
      return failed(PREPARATION_JOB_ERROR.claimInvalid);
    case 'resolution_failed': {
      const code = reasonOf(
        result.failure.code,
        PREPARATION_JOB_ERROR.unavailable,
      );
      return result.failure.retryable ? queued(code) : failed(code);
    }
    case 'invalid_resolution':
      return failed(PREPARATION_JOB_ERROR.invalidResponse);
    case 'processed':
      return processedResult(result.reportId, result.result);
  }
};
