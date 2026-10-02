import type { CmsEditorialError, CmsEditorialResult } from './types';

/** BE03b `maxBodyBytes` for the revision command. */
export const MAX_BODY_BYTES = 262_144;

export const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export const HASH_PATTERN = /^[a-f0-9]{64}$/u;

/** The canonical error code grammar; anything else collapses to INTERNAL_ERROR. */
export const ERROR_CODE_PATTERN = /^[A-Z][A-Z0-9_]{0,63}$/u;

export type UnknownSchema = Readonly<{
  safeParse: (value: unknown) => unknown;
}>;

export type ParsedSuccess<T> = Readonly<{ success: true; data: T }>;
export type ParsedFailure = Readonly<{
  success: false;
  error: Readonly<{
    issues: readonly Readonly<{
      path: readonly PropertyKey[];
      message: string;
    }>[];
  }>;
}>;

export const isParsedSuccess = <T>(value: unknown): value is ParsedSuccess<T> =>
  typeof value === 'object' &&
  value !== null &&
  'success' in value &&
  value.success === true;

export const isParsedFailure = (value: unknown): value is ParsedFailure =>
  typeof value === 'object' &&
  value !== null &&
  'success' in value &&
  value.success === false &&
  'error' in value;

/** BE03b violation projection: bounded, pointer-shaped, message-redacted. */
export const issues = (error: {
  issues: readonly {
    path: readonly PropertyKey[];
    message: string;
    code?: string;
    keys?: readonly string[];
  }[];
}): Record<string, unknown> => ({
  violations: error.issues
    .flatMap((issue) =>
      issue.code === 'unrecognized_keys' && Array.isArray(issue.keys)
        ? issue.keys.map((key) => ({
            path: [...issue.path, key],
            code: 'unknown_field',
          }))
        : [
            {
              path: [...issue.path],
              code: /^[a-z][a-z0-9_]{0,63}$/u.test(issue.message)
                ? issue.message
                : 'invalid_value',
            },
          ],
    )
    .slice(0, 50)
    .map((issue) => ({
      path: `/${issue.path.map((part) => String(part).replaceAll('~', '~0').replaceAll('/', '~1')).join('/')}`,
      code: issue.code,
      message: 'The value is invalid.',
    })),
});

/**
 * BE03b registers no 413 row for the editorial command family, so an oversize
 * body is rejected as `INVALID_REQUEST` (400) with a distinct message rather
 * than emitting a status outside the locked error registry.
 */
export const invalid = (
  message: string,
  details: Readonly<Record<string, unknown>> = {},
  status: 400 | 415 | 422 = 400,
): CmsEditorialError => ({
  ok: false,
  status,
  code:
    status === 415
      ? 'UNSUPPORTED_MEDIA_TYPE'
      : status === 422
        ? 'VALIDATION_FAILED'
        : 'INVALID_REQUEST',
  message,
  details,
});

/** Distinct from the read-side messages so a misrouted command is diagnostic. */
export const COMMAND_QUERY_REFUSED_MESSAGE =
  'The command route does not accept query parameters.';

/**
 * BE03b binds `querySchema` only to the two safe reads: every command row
 * carries a request schema and a headers schema instead. A query string on a
 * command is therefore unparsed caller input, so it is refused as
 * `INVALID_REQUEST` before session, rate, or persistence side effects. The
 * route must call this after the origin/CSRF-independent boundaries so the
 * refusal stays attributable to the query itself.
 */
export const rejectCommandQuery = (
  request: Request,
): CmsEditorialError | null =>
  new URL(request.url).searchParams.size === 0
    ? null
    : invalid(COMMAND_QUERY_REFUSED_MESSAGE);

export type Result<T> = CmsEditorialResult<T>;
