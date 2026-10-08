import {
  TYPED_CONFLICT_REASONS,
  TYPED_VALIDATION_REASONS,
} from './cms-editorial/error-vocabulary';
import type { CmsEditorialProductionError } from './cms-editorial-production-types';

/**
 * The closed RPC-failure token table for the BE03b editorial surface.
 *
 * Every Slice 10 database failure is `RAISE EXCEPTION '<token>' USING ERRCODE
 * = 'P0001'` (or `40001` for a serialization-style CAS refusal): the whole
 * token is the PostgREST `message`. A token is adopted only by exact,
 * case-sensitive whole-string match against this table, never by searching
 * prose, so a caller-influenced DETAIL can neither remap a status nor un-conceal
 * a 404. Each row is the status, the BE00 code, a canonical message, and the
 * closed `details` the mapper itself supplies (a payload can never override
 * them).
 */

export type FailureMapping = Readonly<{
  status: CmsEditorialProductionError['status'];
  code: string;
  message: string;
  /** Mapper-owned details (closed lookup, never payload-derived). */
  details?: Readonly<Record<string, string>>;
}>;

const VALIDATION: Pick<FailureMapping, 'status' | 'code' | 'message'> = {
  status: 422,
  code: 'VALIDATION_FAILED',
  message: 'The CMS editorial request failed validation.',
};

const CONFLICT_MESSAGE =
  'The CMS editorial operation conflicts with current state.';

/** BE00 CONFLICT details: `conflict` is one of three values, with its recovery. */
const stateConflict = (reasonCode?: string): FailureMapping => ({
  status: 409,
  code: 'CONFLICT',
  message: CONFLICT_MESSAGE,
  details: {
    conflict: 'INVALID_TRANSITION',
    recoveryAction: 'refresh',
    ...(reasonCode === undefined ? {} : { reasonCode }),
  },
});

const versionConflict = (): FailureMapping => ({
  status: 409,
  code: 'CONFLICT',
  message: 'The CMS editorial resource changed; reload and try again.',
  details: { conflict: 'VERSION_MISMATCH', recoveryAction: 'reload' },
});

const typedValidation = (reasonCode: string): FailureMapping => ({
  ...VALIDATION,
  details: { reasonCode },
});

const TOKEN_TABLE: ReadonlyMap<string, FailureMapping> = new Map<
  string,
  FailureMapping
>([
  [
    'INVALID_REQUEST',
    {
      status: 400,
      code: 'INVALID_REQUEST',
      message: 'The CMS editorial request is invalid.',
    },
  ],
  [
    'UNSUPPORTED_MEDIA_TYPE',
    {
      status: 415,
      code: 'UNSUPPORTED_MEDIA_TYPE',
      message: 'The CMS editorial request media type is unsupported.',
    },
  ],
  [
    'UNAUTHENTICATED',
    {
      status: 401,
      code: 'UNAUTHENTICATED',
      message: 'The authentication session is invalid.',
    },
  ],
  [
    'FORBIDDEN',
    { status: 403, code: 'FORBIDDEN', message: 'The action is not allowed.' },
  ],
  [
    'NOT_FOUND',
    {
      status: 404,
      code: 'NOT_FOUND',
      message: 'The requested CMS editorial resource was not found.',
    },
  ],
  [
    'IDEMPOTENCY_MISMATCH',
    {
      status: 409,
      code: 'CONFLICT',
      message: 'The idempotency key was used for another request.',
      details: {
        conflict: 'IDEMPOTENCY_MISMATCH',
        recoveryAction: 'use_new_idempotency_key',
      },
    },
  ],
  [
    'IDEMPOTENCY_CONFLICT',
    {
      status: 409,
      code: 'CONFLICT',
      message: 'The idempotency key was used for another request.',
      details: {
        conflict: 'IDEMPOTENCY_MISMATCH',
        recoveryAction: 'use_new_idempotency_key',
      },
    },
  ],
  ['VERSION_MISMATCH', versionConflict()],
  ['STALE_EDIT_PRESENCE', versionConflict()],
  ['CONFLICT', stateConflict()],
  ['INVALID_TRANSITION', stateConflict()],
  ['VALIDATION_FAILED', VALIDATION],
  [
    'RATE_LIMITED',
    {
      status: 429,
      code: 'RATE_LIMITED',
      message: 'Too many CMS editorial requests.',
    },
  ],
  [
    'DEPENDENCY_UNAVAILABLE',
    {
      status: 503,
      code: 'DEPENDENCY_UNAVAILABLE',
      message: 'The CMS editorial dependency is temporarily unavailable.',
    },
  ],
  [
    'INTERNAL_ERROR',
    {
      status: 500,
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred.',
    },
  ],
  ...TYPED_VALIDATION_REASONS.map(
    (reason) => [reason, typedValidation(reason)] as const,
  ),
  ...TYPED_CONFLICT_REASONS.map(
    (reason) => [reason, stateConflict(reason)] as const,
  ),
]);

export const failureForToken = (token: string): FailureMapping | null =>
  TOKEN_TABLE.get(token) ?? null;

/** Tokens trusted from a structured `code` field (uppercase BE00 vocabulary). */
export const STRUCTURED_TOKENS: ReadonlySet<string> = new Set(
  [...TOKEN_TABLE.keys()].filter((token) => token === token.toUpperCase()),
);

/**
 * Tokens a serialization-class (`40001`) failure may carry. A SQLSTATE 40001
 * is a CAS refusal, never an unconditional retry: it is a 409, not a 503.
 */
export const SERIALIZATION_TOKENS: ReadonlySet<string> = new Set([
  'VERSION_MISMATCH',
  'STALE_EDIT_PRESENCE',
]);
