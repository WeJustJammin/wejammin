import {
  CMS_PATTERN_NESTABLE_TYPES_MAX,
  CmsUuidSchema,
  PatternNestableQuerySchema,
  type PatternNestableQuery,
} from '@wejammin/contracts';

import {
  failure,
  type CmsPatternInstanceError,
} from './pattern-instance-contracts';

/**
 * cmsPatternNestableRead strict query admission (BE00 step 6; BE03c 413, `PatternNestableQuery`, error row 1427).
 * `contentTypeId` is REPEATED 1-64 times, each a UUID, none twice (compared case-insensitively); the signed cursor is
 * opaque to the Worker (1-512 characters, passed through byte for byte; only the database verifies, binds and expires
 * it); `limit` defaults to 25 here so the database binds every page of one listing to the same page size. An unknown,
 * missing or empty key, a repeated `cursor` or `limit`, a member that is not a UUID, a duplicate and an unusable cursor
 * or limit syntax are a bare 400. A canonical integer `limit` outside 1-50, and a well-formed set of more than 64
 * types, are the 422 whose single violation names the member (`/limit`, `/contentTypeId`), as the SQL reader answers.
 */
export type PatternNestableQueryResult =
  Readonly<{ ok: true; value: PatternNestableQuery }> | CmsPatternInstanceError;

const KEYS: ReadonlySet<string> = new Set(['contentTypeId', 'cursor', 'limit']);
const MAX_CURSOR = 512;
const MAX_LIMIT = 50;
/** A canonical decimal integer (no plus sign, no padding, no fraction), of any magnitude. */
const LIMIT_SYNTAX = /^(?:0|-?[1-9][0-9]*)$/u;

const outOfBounds = (path: '/limit' | '/contentTypeId') =>
  failure(422, {
    violations: [{ path, code: 'invalid', message: 'The value is invalid.' }],
  });

export const parsePatternNestableQuery = (
  search: URLSearchParams,
): PatternNestableQueryResult => {
  const types: string[] = [];
  const found: Record<string, string> = {};
  for (const [key, value] of search) {
    if (!KEYS.has(key) || value === '') return failure(400);
    if (key === 'contentTypeId') {
      types.push(value);
      continue;
    }
    if (Object.hasOwn(found, key)) return failure(400);
    found[key] = value;
  }
  const { cursor, limit } = found;
  if (
    types.length === 0 ||
    types.some((type) => !CmsUuidSchema.safeParse(type).success) ||
    new Set(types.map((type) => type.toLowerCase())).size !== types.length ||
    (cursor !== undefined && cursor.length > MAX_CURSOR) ||
    (limit !== undefined && !LIMIT_SYNTAX.test(limit))
  )
    return failure(400);
  if (types.length > CMS_PATTERN_NESTABLE_TYPES_MAX)
    return outOfBounds('/contentTypeId');
  const requested = limit === undefined ? undefined : Number(limit);
  if (requested !== undefined && (requested < 1 || requested > MAX_LIMIT))
    return outOfBounds('/limit');
  // Every member was checked above, so this parse only applies the default limit and cannot refuse.
  return {
    ok: true,
    value: PatternNestableQuerySchema.parse({
      contentTypeId: types,
      ...(cursor === undefined ? {} : { cursor }),
      ...(requested === undefined ? {} : { limit: requested }),
    }),
  };
};
