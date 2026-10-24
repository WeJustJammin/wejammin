import {
  CMS_BLOCK_RULES_POINTERS,
  CMS_BLOCK_RULES_REASON,
  type CmsBlockRulesOperation,
} from '@wejammin/contracts';

import { violationsFromDetailText } from '../cms-editorial-production-errors';

/**
 * DEC-210 (BE03c "Block composition rules (DEC-210)"): a tree that breaks a pinned block version's `allowedChildren` or
 * `slotRules` is the 422 `COMPOSITION_VALIDATION_FAILED` whose `details.reasonCode` is `block_rules_violated` and whose one
 * violation points at the operation's offending location. The pointer comes from the producer's DETAIL, but only the
 * grammar the operation's own request owns (`CMS_BLOCK_RULES_POINTERS`) is relayed: any other pointer, prose or an absent
 * DETAIL leaves the bare reason. The wire projection of the resulting port refusal is `cmsBlockRulesDetails` (contracts).
 */
export { CMS_BLOCK_RULES_REASON as BLOCK_RULES_REASON };

export const blockRulesDetails = (
  detail: unknown,
  operation: CmsBlockRulesOperation,
): Readonly<Record<string, unknown>> => {
  const violations = violationsFromDetailText(
    detail,
    CMS_BLOCK_RULES_REASON,
  ).filter((violation) =>
    CMS_BLOCK_RULES_POINTERS[operation].test(violation.path),
  );
  return violations.length === 0
    ? { reasonCode: CMS_BLOCK_RULES_REASON }
    : { reasonCode: CMS_BLOCK_RULES_REASON, violations };
};
