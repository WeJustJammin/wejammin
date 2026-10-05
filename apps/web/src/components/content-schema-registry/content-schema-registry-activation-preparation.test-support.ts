import {
  SchemaActivationPreparationSchema,
  type SchemaActivationPreparation,
} from '@wejammin/contracts';

/**
 * Real, schema-valid `activationPreparation` data for CMS-03A-07 detail
 * fixtures (FE03 "activationPreparation data mapping"). Every value is parsed
 * through the generated strict contract, so a fixture can never drift into a
 * shape the contract rejects and no schema is loosened to make a fixture fit.
 */

export const PREPARATION_DRY_RUN_ID = '7d2a96c1-3e58-7b04-8f61-d09a4e25c7b3';
export const PREPARATION_JOB_ID = '2f8e41b7-d6a3-7c92-9e50-b1c74a08d3f6';
export const PREPARATION_REVIEW_ID = '3c7a51e8-9f24-7b60-8d13-a5e4c2f09b78';

type PreparationInput = {
  readonly dryRunRef?: SchemaActivationPreparation['dryRunRef'];
  readonly jobRef?: SchemaActivationPreparation['jobRef'];
  readonly reviewRef?: SchemaActivationPreparation['reviewRef'];
  readonly templateCompatibility?: SchemaActivationPreparation['templateCompatibility'];
  readonly permittedNextActions?: SchemaActivationPreparation['permittedNextActions'];
};

/** Build a parsed preparation; throws if the contract would reject it. */
export const activationPreparation = (
  input: PreparationInput = {},
): SchemaActivationPreparation =>
  SchemaActivationPreparationSchema.parse({
    dryRunRef: input.dryRunRef ?? null,
    jobRef: input.jobRef ?? null,
    reviewRef: input.reviewRef ?? null,
    ...(input.templateCompatibility === undefined
      ? {}
      : { templateCompatibility: input.templateCompatibility }),
    permittedNextActions: input.permittedNextActions ?? [],
  });

/** A candidate that has never been dry-run and offers no next action. */
export const emptyActivationPreparation: SchemaActivationPreparation =
  activationPreparation();

/** A draft that has no dry run yet and may start one. */
export const startDryRunPreparation: SchemaActivationPreparation =
  activationPreparation({ permittedNextActions: ['start_dry_run'] });

/** A queued dry run observed through its BE00 job. */
export const queuedDryRunPreparation: SchemaActivationPreparation =
  activationPreparation({
    dryRunRef: {
      id: PREPARATION_DRY_RUN_ID,
      state: 'queued',
      result: null,
      jobId: PREPARATION_JOB_ID,
    },
    jobRef: { id: PREPARATION_JOB_ID, state: 'queued' },
  });

/** A sealed passed dry run that may be submitted for review. */
export const passedDryRunPreparation: SchemaActivationPreparation =
  activationPreparation({
    dryRunRef: {
      id: PREPARATION_DRY_RUN_ID,
      state: 'completed',
      result: 'passed',
      jobId: PREPARATION_JOB_ID,
    },
    jobRef: { id: PREPARATION_JOB_ID, state: 'succeeded' },
    permittedNextActions: ['submit_review'],
  });

/** An approved review that unlocks activation. */
export const approvedReviewPreparation: SchemaActivationPreparation =
  activationPreparation({
    dryRunRef: {
      id: PREPARATION_DRY_RUN_ID,
      state: 'completed',
      result: 'passed',
      jobId: PREPARATION_JOB_ID,
    },
    jobRef: { id: PREPARATION_JOB_ID, state: 'succeeded' },
    reviewRef: { id: PREPARATION_REVIEW_ID, state: 'approved' },
    permittedNextActions: ['activate'],
  });

export const SEALED_SOURCE_HASH = 'a'.repeat(64);
export const SEALED_TARGET_HASH = 'b'.repeat(64);
export const SEALED_REPORT_HASH = 'c'.repeat(64);

/** A sealed dry run whose report evidence is served by the projection. */
export const sealedDryRunPreparation = (
  result: 'passed' | 'failed',
  counts: { source: number; target: number; errors: number } = {
    source: 12,
    target: 12,
    errors: result === 'passed' ? 0 : 3,
  },
): SchemaActivationPreparation =>
  activationPreparation({
    dryRunRef: {
      id: PREPARATION_DRY_RUN_ID,
      state: 'completed',
      result,
      jobId: PREPARATION_JOB_ID,
      sourceCount: counts.source,
      targetCount: counts.target,
      rowErrorCount: counts.errors,
      sourceHash: SEALED_SOURCE_HASH,
      targetHash: SEALED_TARGET_HASH,
      reportHash: SEALED_REPORT_HASH,
    },
    jobRef: { id: PREPARATION_JOB_ID, state: 'succeeded' },
    permittedNextActions: result === 'passed' ? ['submit_review'] : [],
  });
