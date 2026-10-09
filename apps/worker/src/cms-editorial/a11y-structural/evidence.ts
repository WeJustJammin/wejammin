import {
  CMS_A11Y_CHECKER_KEY,
  CMS_A11Y_CHECKER_VERSION,
  PreflightEvidenceSchema,
  type PreflightEvidence,
} from '@wejammin/contracts';

import type { AccessibilityGateCompleted, AccessibilityGateRun } from './gate';
import { accessibilityBindingHash } from './hashes';

/*
 * What the gate hands to the BE03b command.
 *
 * `PreflightEvidence` is the Worker's proof for the `accessibility` category;
 * it is never a browser or PostgREST input. A `failed` gate run (timeout,
 * dependency failure or unreadable target) has no binding to prove, so it
 * yields no evidence: the database maps the absent evidence to an
 * `unavailable` result with reasonCode `checker_failed` (DEC-150), which
 * refuses the command with 503 `DEPENDENCY_UNAVAILABLE` (or `failed_retryable`
 * at schedule execution).
 */

/** The `PreflightEvidence.blockingCount` contract bound; the run keeps the true total. */
const EVIDENCE_BLOCKING_COUNT_MAX = 1_000;

const boundedBlockingCount = (blockingCount: number): number =>
  Math.min(blockingCount, EVIDENCE_BLOCKING_COUNT_MAX);

export const toPreflightEvidence = async (
  run: AccessibilityGateRun,
): Promise<PreflightEvidence | null> => {
  if (run.state === 'failed') return null;
  return PreflightEvidenceSchema.parse({
    category: 'accessibility',
    providerKey: CMS_A11Y_CHECKER_KEY,
    providerVersion: CMS_A11Y_CHECKER_VERSION,
    outcome: run.state,
    blockingCount: boundedBlockingCount(run.result.blockingCount),
    inputHash: run.result.inputHash,
    bindingHash: await accessibilityBindingHash({
      revisionId: run.input.revisionId,
      revisionContentHash: run.input.revisionContentHash,
      dependencyHash: run.input.dependencyHash,
    }),
    evaluatedAt: run.evaluatedAt,
  });
};

/** The only thing the command audit stores about a gate call (BE05c, DEC-134). */
export type AccessibilityAuditRecord = Readonly<{
  checkerKey: typeof CMS_A11Y_CHECKER_KEY;
  checkerVersion: typeof CMS_A11Y_CHECKER_VERSION;
  outcome: 'healthy' | 'blocked';
  blockingCount: number;
  inputHash: string;
}>;

export const auditRecordOf = (
  run: AccessibilityGateCompleted,
): AccessibilityAuditRecord => ({
  checkerKey: CMS_A11Y_CHECKER_KEY,
  checkerVersion: CMS_A11Y_CHECKER_VERSION,
  outcome: run.state,
  blockingCount: boundedBlockingCount(run.result.blockingCount),
  inputHash: run.result.inputHash,
});
