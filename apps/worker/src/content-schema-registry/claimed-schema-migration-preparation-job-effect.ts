import type {
  CmsLeaseControl,
  JobEffectInput,
  JobEffectResult,
} from '@wejammin/application';

import { isFinalDelivery } from '../async-runtime-job-context';
import { runWithDeadline } from '../event-consumers/deadline';
import type { createClaimedSchemaMigrationPreparation } from './claimed-schema-migration-preparation';
import {
  PREPARATION_JOB_ERROR,
  preparationJobResult,
} from './claimed-schema-migration-preparation-job-result';

/** The claimed entry as the Job effect uses it. */
export type ClaimedPreparationPort = Pick<
  ReturnType<typeof createClaimedSchemaMigrationPreparation>,
  'process' | 'exhaust'
>;

/**
 * The last-delivery rollback runs under its own deadline: the invocation signal may be the very thing that
 * expired, and the Job lease must keep room for the settlement, the outcome CAS and the processed write
 * (the invocation budget reserves 60 s; the rollback may take half of it).
 */
export const PREPARATION_EXHAUSTION_BUDGET_MS = 30_000;

const unavailable: JobEffectResult = Object.freeze({
  state: 'queued',
  errorCode: PREPARATION_JOB_ERROR.unavailable,
  resultRef: null,
});

const exhausted: JobEffectResult = Object.freeze({
  state: 'failed',
  errorCode: PREPARATION_JOB_ERROR.exhausted,
  resultRef: null,
});

/**
 * One delivery of the claimed `cms.schema.dry_run` preparation as one BE00 Job disposition (DEC-183), never
 * throwing. A `preparation` of `null` is an environment that could not be composed (invalid service
 * credentials): nothing started, so the delivery is `queued` and the plan has nothing to roll back. On the
 * last delivery (DEC-184) a would-be `queued` disposition instead rolls an in-flight plan back to its
 * terminal failure, so a new CMS-03A-10 attempt is admitted, and fails the Job `MIGRATION_RETRIES_EXHAUSTED`.
 * The rollback's own failure changes nothing about the disposition: the Job is failed either way and the
 * plan left behind is the operator signal.
 */
export const executeClaimedPreparationJob = async (
  args: Readonly<{
    preparation: ClaimedPreparationPort | null;
    input: JobEffectInput;
    control: CmsLeaseControl | undefined;
    deliveryAttempt: number;
    signal: AbortSignal;
  }>,
): Promise<JobEffectResult> => {
  const { preparation, input, control, deliveryAttempt, signal } = args;
  let disposition: JobEffectResult = unavailable;
  if (preparation !== null) {
    try {
      disposition = preparationJobResult(
        await preparation.process(input, {
          signal,
          attempt: deliveryAttempt,
          ...(control === undefined ? {} : { control }),
        }),
      );
    } catch {
      disposition = unavailable;
    }
  }
  if (disposition.state !== 'queued' || !isFinalDelivery(deliveryAttempt))
    return disposition;
  if (preparation !== null) {
    try {
      await runWithDeadline(
        (exhaustionSignal) =>
          preparation.exhaust(input, {
            signal: exhaustionSignal,
            attempt: deliveryAttempt,
            ...(control === undefined ? {} : { control }),
          }),
        PREPARATION_EXHAUSTION_BUDGET_MS,
      );
    } catch {
      // The Job is failed whatever the rollback did.
    }
  }
  return exhausted;
};
