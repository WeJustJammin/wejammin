import {
  CmsFieldKeySchema,
  CmsLocaleSchema,
  CmsTypeKeySchema,
  TaxonomySelectorQuerySchema,
  TaxonomyTermListApiRequestSchema,
  type TaxonomySelectorQuery,
  type TaxonomyTermListQuery,
} from '@wejammin/contracts';

import {
  failure,
  type CmsTaxonomyDefinitionError,
} from './taxonomy-definition-shared';

/**
 * Strict query admission of the two taxonomy reads (BE00 step 6; BE03c 371 and 373). The signed cursor is opaque to the
 * Worker: it is bounded (1-512 characters) and passed through byte-for-byte, only the database verifies, binds and
 * expires it. An unknown, duplicated, missing or empty key and an unusable cursor or limit syntax (anything but a
 * canonical decimal integer) are a bare 400; a canonical integer outside the range is one class whatever its digit count.
 * `cmsTaxonomyTermsRead` has no 422 row: a lifecycle outside its enum and a limit outside 1-50 are 400 too (BE03c 407
 * answers 400/policy-safe 404/502). CMS-03C-17 (BE03c 403, 400/422) answers a key or locale outside its grammar and a
 * limit outside 1-100 as a 422 whose violations name the member, exactly as its SQL reader does.
 */
export type TaxonomyQueryResult<T> =
  Readonly<{ ok: true; value: T }> | CmsTaxonomyDefinitionError;

const MAX_CURSOR = 512;
/** A canonical decimal integer (no sign but a leading minus, no padding, no fraction), of any magnitude. */
const LIMIT_SYNTAX = /^(?:0|-?[1-9][0-9]*)$/u;

/** The query members by name; null when a key is unknown or repeated, or a value is empty. */
const members = (
  search: URLSearchParams,
  allowed: ReadonlySet<string>,
): Readonly<Record<string, string>> | null => {
  const found: Record<string, string> = {};
  for (const [key, value] of search) {
    if (!allowed.has(key) || Object.hasOwn(found, key) || value === '')
      return null;
    found[key] = value;
  }
  return found;
};

/** The shared cursor and limit syntax; null when either is unusable. */
const cursorAndLimit = (
  found: Readonly<Record<string, string>>,
): Readonly<{ cursor?: string; limit?: number }> | null => {
  const { cursor, limit } = found;
  if (cursor !== undefined && cursor.length > MAX_CURSOR) return null;
  if (limit !== undefined && !LIMIT_SYNTAX.test(limit)) return null;
  return {
    ...(cursor === undefined ? {} : { cursor }),
    ...(limit === undefined ? {} : { limit: Number(limit) }),
  };
};

const TERMS_KEYS: ReadonlySet<string> = new Set([
  'lifecycle',
  'cursor',
  'limit',
]);

export const parseTermsQuery = (
  taxonomyId: string,
  search: URLSearchParams,
): TaxonomyQueryResult<TaxonomyTermListQuery> => {
  const found = members(search, TERMS_KEYS);
  const paging = found === null ? null : cursorAndLimit(found);
  if (found === null || paging === null) return failure(400);
  const parsed = TaxonomyTermListApiRequestSchema.safeParse({
    taxonomyId,
    query: {
      ...(found.lifecycle === undefined ? {} : { lifecycle: found.lifecycle }),
      ...paging,
    },
  });
  return parsed.success ? { ok: true, value: parsed.data.query } : failure(400);
};

const SELECTOR_KEYS: ReadonlySet<string> = new Set([
  'typeKey',
  'fieldKey',
  'locale',
  'cursor',
  'limit',
]);
const SELECTOR_MEMBERS = [
  ['typeKey', CmsTypeKeySchema],
  ['fieldKey', CmsFieldKeySchema],
  ['locale', CmsLocaleSchema],
] as const;
const SELECTOR_MAX_LIMIT = 100;

export const parseSelectorQuery = (
  search: URLSearchParams,
): TaxonomyQueryResult<TaxonomySelectorQuery> => {
  const found = members(search, SELECTOR_KEYS);
  const paging = found === null ? null : cursorAndLimit(found);
  if (
    found === null ||
    paging === null ||
    SELECTOR_MEMBERS.some(([name]) => found[name] === undefined)
  )
    return failure(400);
  const invalid: string[] = SELECTOR_MEMBERS.filter(
    ([name, schema]) => !schema.safeParse(found[name]).success,
  ).map(([name]) => name);
  if (
    paging.limit !== undefined &&
    (paging.limit < 1 || paging.limit > SELECTOR_MAX_LIMIT)
  )
    invalid.push('limit');
  if (invalid.length > 0)
    return failure(422, {
      violations: invalid.map((name) => ({
        path: `/${name}`,
        code: 'invalid',
        message: 'The value is invalid.',
      })),
    });
  // Every member was checked above, so this parse only applies the limit default and cannot refuse.
  return {
    ok: true,
    value: TaxonomySelectorQuerySchema.parse({
      typeKey: found.typeKey,
      fieldKey: found.fieldKey,
      locale: found.locale,
      ...paging,
    }),
  };
};
