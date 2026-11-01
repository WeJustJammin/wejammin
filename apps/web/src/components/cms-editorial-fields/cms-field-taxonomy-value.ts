import type { JsonValue } from '@wejammin/contracts';
import { isCmsUuid } from '@wejammin/contracts/client';

import { cmsIssue, type CmsFieldIssue } from './cms-field-issue';
import { isJsonRecord } from './cms-field-basics';

/**
 * The taxonomy value, mirroring the database shape predicate for the `taxonomy`
 * kind (`cms_field_kind_value_shape`, migration
 * 20261005010100_cms_field_kind_encodings.sql lines 634..660): exactly
 * `{ termIds: UUID[] <= 128 }`. A strict object, so an extra key, an absent or
 * non-array `termIds`, or any element that is not a UUID the shared predicate
 * accepts is refused. Duplicates are permitted (the predicate never
 * de-duplicates). The server stays the authority for term eligibility.
 */

const TERM_IDS_MAX = 128;

const TAXONOMY_SHAPE_MESSAGE = 'Choose the terms for this field.';

/** Exactly the key `termIds`, present. */
const isStrictTermIdsObject = (
  value: Readonly<Record<string, JsonValue>>,
): boolean => Object.keys(value).length === 1 && value.termIds !== undefined;

/**
 * A taxonomy value is empty only when it is exactly `{ termIds: [] }`. Anything
 * else — a malformed object, an object with an extra key, a non-empty list — is
 * a value, so it reaches validation instead of being mistaken for absence.
 */
export const cmsTaxonomyIsEmpty = (value: JsonValue): boolean =>
  isJsonRecord(value) &&
  isStrictTermIdsObject(value) &&
  Array.isArray(value.termIds) &&
  value.termIds.length === 0;

/** One non-empty taxonomy value against the shape predicate. */
export const validateCmsTaxonomyValue = (value: JsonValue): CmsFieldIssue[] => {
  if (!isJsonRecord(value) || !isStrictTermIdsObject(value))
    return [cmsIssue('invalid_taxonomy', TAXONOMY_SHAPE_MESSAGE)];
  const termIds = value.termIds;
  if (!Array.isArray(termIds))
    return [cmsIssue('invalid_taxonomy', TAXONOMY_SHAPE_MESSAGE)];
  if (termIds.length > TERM_IDS_MAX)
    return [
      cmsIssue('too_many_items', `Choose at most ${TERM_IDS_MAX} terms.`),
    ];
  return termIds.flatMap((termId) =>
    typeof termId === 'string' && isCmsUuid(termId)
      ? []
      : [cmsIssue('invalid_uuid', 'Choose a valid term.')],
  );
};
