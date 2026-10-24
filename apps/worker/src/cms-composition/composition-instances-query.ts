import {
  CompositionInstancesReadApiRequestSchema,
  type CompositionInstancesReadApiRequest,
} from '@wejammin/contracts';

import {
  failure,
  type CmsPatternInstanceError,
} from './pattern-instance-contracts';

/**
 * cmsCompositionInstancesRead strict path and query admission (BE00 step 6; BE03c validation row `entryId/cursor/limit`).
 * The entry id is a UUID path value; the only query keys are the opaque signed cursor, bounded (1-512 characters) and
 * passed through byte for byte (only the database verifies, binds and expires it), and `limit`, a canonical decimal
 * integer 1-50 (default 25, applied here so the database and the answer check see the same page size). An unknown,
 * duplicated or empty key, a cursor over 512 characters, a limit that is not a canonical integer in 1-50 (whatever its
 * digit count; the error matrix gives this read no 422) and a malformed entry id are a bare 400.
 */
export type CompositionInstancesRequestResult =
  | Readonly<{
      ok: true;
      value: Readonly<{ entryId: string; cursor?: string; limit: number }>;
    }>
  | CmsPatternInstanceError;

/** A canonical decimal integer (no plus sign, no padding, no fraction), of any magnitude. */
const LIMIT_SYNTAX = /^(?:0|-?[1-9][0-9]*)$/u;
const QUERY_KEYS: ReadonlySet<string> = new Set(['cursor', 'limit']);

export const parseCompositionInstancesRequest = (
  entryId: string | undefined,
  search: URLSearchParams,
): CompositionInstancesRequestResult => {
  const found: Record<string, string> = {};
  for (const [key, value] of search) {
    if (!QUERY_KEYS.has(key) || Object.hasOwn(found, key) || value === '')
      return failure(400);
    found[key] = value;
  }
  if (found.limit !== undefined && !LIMIT_SYNTAX.test(found.limit))
    return failure(400);
  const parsed: ReturnType<
    typeof CompositionInstancesReadApiRequestSchema.safeParse
  > = CompositionInstancesReadApiRequestSchema.safeParse({
    entryId,
    query: {
      ...(found.cursor === undefined ? {} : { cursor: found.cursor }),
      ...(found.limit === undefined ? {} : { limit: Number(found.limit) }),
    },
  });
  if (!parsed.success) return failure(400);
  const request: CompositionInstancesReadApiRequest = parsed.data;
  return {
    ok: true,
    value: {
      entryId: request.entryId,
      ...(request.query.cursor == null ? {} : { cursor: request.query.cursor }),
      limit: request.query.limit,
    },
  };
};
