import {
  CMS_BLOCK_RULES_REASON,
  CMS_SLICE_12_OPERATION_REASONS,
  cmsBlockRulesDetails,
  CmsSlice12ReasonCodeSchema,
  cmsSlice12ReasonStatus,
} from '@wejammin/contracts';

import { forbiddenDetails } from './capability-details';
import type { Status } from './pattern-instance-contracts';
import type { PatternUpdateOperation } from './pattern-update-operations';
import { safeDetails as sharedDetails } from './taxonomy-safe-details';

/**
 * BE03c 1304: a CMS-03C-13/14/15 refusal carries exactly one lowercase reason token of its own operation's list on the
 * one status that list gives the token, and no other member. A token on another status, or one this operation does not
 * publish, is dropped, never repaired. Everything else takes the shared BE00 allowlist (version pair of a plain 409,
 * pointer-shaped violations of a plain 400/422, quota and dependency members).
 */
const typedReason = (
  operation: PatternUpdateOperation,
  status: Status,
  source: unknown,
): string | null => {
  if (status !== 409 && status !== 422) return null;
  if (typeof source !== 'object' || source === null || Array.isArray(source))
    return null;
  const parsed = CmsSlice12ReasonCodeSchema.safeParse(
    (source as Readonly<Record<string, unknown>>).reasonCode,
  );
  return parsed.success &&
    cmsSlice12ReasonStatus(parsed.data) === status &&
    (CMS_SLICE_12_OPERATION_REASONS[operation] as readonly string[]).includes(
      parsed.data,
    )
    ? parsed.data
    : null;
};

export const patternUpdateDetails = (
  operation: PatternUpdateOperation,
  status: Status,
  source: unknown,
): Readonly<Record<string, unknown>> => {
  // The 403 token is the shared, single-source `capability_missing` filter (never the pre-contract upper-case token).
  if (status === 403) return forbiddenDetails(operation, source);
  const reason = typedReason(operation, status, source);
  // DEC-210: the one reason that keeps its /instances/{i}[/choices] violation.
  if (reason === CMS_BLOCK_RULES_REASON)
    return cmsBlockRulesDetails(source, 'CMS-03C-15');
  return reason === null
    ? sharedDetails(status, source)
    : { reasonCode: reason };
};
