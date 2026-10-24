import type { ClassifiedRefusal } from '../cms-editorial-workflow/cms-workflow-refusal';
import { classifyGovernedActivationRefusal } from './governed-activation-refusal';
import type { GovernedRefusal } from './governed-review-command-transport';
import type { GovernedCommandOperation } from './governed-review-reasons';

/**
 * The fixed copy of the governed refusals the shared Slice 11 table cannot speak
 * (FE03 Slice 12 states, `commandState` error column). The decision and
 * assignment tokens are the 03b tokens (DEC-137) and keep the shared table's
 * copy; only a submission has two refusals of its own. The copy is written here,
 * never taken from the response; only the registered reason and the closed
 * canonical domain select it. A null answer defers to the shared table.
 */
const withDefaults = (
  kind: ClassifiedRefusal['kind'],
  message: string,
  refusal: GovernedRefusal,
  refetch: boolean,
): ClassifiedRefusal => ({
  kind,
  message,
  rotateKey: true,
  refetch,
  fields: [],
  preflight: null,
  alternatives: null,
  foldAlternatives: null,
  window: null,
  requestId: refusal.requestId,
});

export const classifyGovernedRefusal = (
  operation: GovernedCommandOperation,
  refusal: GovernedRefusal,
): ClassifiedRefusal | null => {
  if (operation === 'CMS-03C-09')
    return classifyGovernedActivationRefusal(refusal);
  if (operation !== 'CMS-03C-06') return null;
  if (refusal.governed.reason === 'subject_not_submittable')
    return withDefaults(
      'refetch',
      'This version can no longer be submitted. It may already be under review.',
      refusal,
      true,
    );
  if (refusal.governed.reason === 'canonical_source_unavailable')
    return withDefaults(
      'field',
      refusal.governed.domain === null
        ? 'A reference list this vocabulary declares is not available yet, so it cannot be submitted.'
        : `The ${refusal.governed.domain} reference list is not available yet, so this vocabulary cannot be submitted.`,
      refusal,
      false,
    );
  return null;
};
