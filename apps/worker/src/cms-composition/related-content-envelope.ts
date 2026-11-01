import {
  RelatedContentResourceSchema,
  RelatedContentRuleReadSchema,
  relatedRuleReadAnswersEntry,
  type RelatedContentResource,
  type RelatedContentRuleRead,
  type RelatedContentRuleRequest,
} from '@wejammin/contracts';

import type {
  CmsRelatedContentRateDecision,
  CmsRelatedContentResult,
} from './related-content-types';

export const validEnvelope = <T>(
  value: unknown,
): value is CmsRelatedContentResult<T> =>
  typeof value === 'object' &&
  value !== null &&
  !Array.isArray(value) &&
  'ok' in value &&
  typeof value.ok === 'boolean' &&
  (value.ok
    ? 'value' in value
    : 'status' in value && typeof value.status === 'number');

export const validRate = (
  value: unknown,
  limit: 60 | 120 | 300 | 600,
): value is CmsRelatedContentRateDecision =>
  typeof value === 'object' &&
  value !== null &&
  !Array.isArray(value) &&
  'allowed' in value &&
  typeof value.allowed === 'boolean' &&
  'limit' in value &&
  value.limit === limit &&
  'remaining' in value &&
  typeof value.remaining === 'number' &&
  Number.isSafeInteger(value.remaining) &&
  value.remaining >= 0 &&
  value.remaining <= limit &&
  'resetAt' in value &&
  typeof value.resetAt === 'number' &&
  Number.isSafeInteger(value.resetAt) &&
  value.resetAt >= 0;

export const validResource = (
  value: unknown,
  body: RelatedContentRuleRequest,
): value is RelatedContentResource => {
  const parsed = RelatedContentResourceSchema.safeParse(value);
  if (!parsed.success) return false;
  const resource = parsed.data;
  return (
    resource.sourceEntryId === body.entryId &&
    resource.pins.join('\u0000') === body.pins.join('\u0000') &&
    resource.exclusions.join('\u0000') === body.exclusions.join('\u0000')
  );
};

/**
 * `cmsRelatedContentRead` answers the strict `{ rule }` for the requested entry (DEC-195): the rule, when present,
 * is this entry's own and `active` (a revoked rule reads as `null`), with no pin that is also an exclusion.
 */
export const validRuleRead = (
  value: unknown,
  entryId: string,
): value is RelatedContentRuleRead => {
  const parsed = RelatedContentRuleReadSchema.safeParse(value);
  return parsed.success && relatedRuleReadAnswersEntry(parsed.data, entryId);
};
