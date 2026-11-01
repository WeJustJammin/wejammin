import {
  CmsUuidSchema,
  PatternSelectorQuerySchema,
  type PatternSelectorQuery,
} from '@wejammin/contracts';

import {
  failure,
  type CmsPatternInstanceError,
} from './pattern-instance-contracts';

/**
 * CMS-03C-13 strict query admission (BE00 step 6; BE03c 175, 398, 1266). The signed cursor is opaque to the Worker: it
 * is bounded (1-512 characters) and passed through byte for byte, only the database verifies, binds and expires it.
 * An unknown, duplicated, missing or empty key, a `contentTypeId` that is not a UUID and an unusable cursor or limit
 * syntax (anything but a canonical decimal integer) are a bare 400. A canonical integer outside 1-50 is one class
 * whatever its digit count: a 422 whose single violation names `/limit`, as the SQL reader answers (VALIDATION_FAILED
 * with `["/limit"]`). The default limit of 25 is applied here so the database binds every page of one listing to the
 * same page size.
 */
export type PatternSelectorQueryResult =
  Readonly<{ ok: true; value: PatternSelectorQuery }> | CmsPatternInstanceError;

const KEYS: ReadonlySet<string> = new Set(['contentTypeId', 'cursor', 'limit']);
const MAX_CURSOR = 512;
const MAX_LIMIT = 50;
/** A canonical decimal integer (no plus sign, no padding, no fraction), of any magnitude. */
const LIMIT_SYNTAX = /^(?:0|-?[1-9][0-9]*)$/u;

export const parsePatternSelectorQuery = (
  search: URLSearchParams,
): PatternSelectorQueryResult => {
  const found: Record<string, string> = {};
  for (const [key, value] of search) {
    if (!KEYS.has(key) || Object.hasOwn(found, key) || value === '')
      return failure(400);
    found[key] = value;
  }
  const { contentTypeId, cursor, limit } = found;
  if (
    contentTypeId === undefined ||
    !CmsUuidSchema.safeParse(contentTypeId).success ||
    (cursor !== undefined && cursor.length > MAX_CURSOR) ||
    (limit !== undefined && !LIMIT_SYNTAX.test(limit))
  )
    return failure(400);
  const requested = limit === undefined ? undefined : Number(limit);
  if (requested !== undefined && (requested < 1 || requested > MAX_LIMIT))
    return failure(422, {
      violations: [
        { path: '/limit', code: 'invalid', message: 'The value is invalid.' },
      ],
    });
  // Every member was checked above, so this parse only applies the default limit and cannot refuse.
  return {
    ok: true,
    value: PatternSelectorQuerySchema.parse({
      contentTypeId,
      ...(cursor === undefined ? {} : { cursor }),
      ...(requested === undefined ? {} : { limit: requested }),
    }),
  };
};
