import {
  CMS_BLOCK_RULES_REASON,
  CMS_SLICE_12_OPERATION_REASONS,
  cmsBlockRulesDetails,
  CmsSlice12ReasonCodeSchema,
  cmsSlice12ReasonStatus,
} from '@wejammin/contracts';

import type { Status } from './pattern-instance-contracts';
import { safeDetails as sharedDetails } from './taxonomy-responses';

/**
 * BE03c 1304: a CMS-03C-02 refusal carries exactly one lowercase reason token of its own list on the one
 * status that list gives the token, and no other member (DEC-186 for the digest token; DEC-210 `block_rules_violated`
 * also keeps its one `/roots` or `/patternVersion` violation). A token on another
 * status, or one this operation does not publish, is dropped, never repaired.
 */
const typedReason = (status: Status, source: unknown): string | null => {
  if (status !== 403 && status !== 409 && status !== 422) return null;
  if (typeof source !== 'object' || source === null || Array.isArray(source))
    return null;
  const parsed = CmsSlice12ReasonCodeSchema.safeParse(
    (source as Readonly<Record<string, unknown>>).reasonCode,
  );
  return parsed.success &&
    cmsSlice12ReasonStatus(parsed.data) === status &&
    (
      CMS_SLICE_12_OPERATION_REASONS['CMS-03C-02'] as readonly string[]
    ).includes(parsed.data)
    ? parsed.data
    : null;
};

export const patternInstanceDetails = (
  status: Status,
  source: unknown,
): Readonly<Record<string, unknown>> => {
  const reason = typedReason(status, source);
  // DEC-210: the one reason that keeps its /roots or /patternVersion violation.
  if (reason === CMS_BLOCK_RULES_REASON)
    return cmsBlockRulesDetails(source, 'CMS-03C-02');
  if (reason !== null) return { reasonCode: reason };
  // An untyped or foreign 403 relays nothing (review-hardening-3 finding 2), whatever the shared allowlist says.
  return status === 403 ? {} : sharedDetails(status, source);
};
