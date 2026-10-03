import { LOCALE_CONFIG_MESSAGES } from '@wejammin/contracts';

import type {
  ContentSchemaRegistryError,
  ContentSchemaRegistryResult,
} from './types';

export const MAX_BODY_BYTES = 256 * 1024;
export const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
export const IDEMPOTENCY_PATTERN = /^[\x20-\x7e]{8,128}$/u;

// Signed release admission verifies raw bytes and the signature before JSON parsing.
export const releaseHeaderNames = new Set([
  'x-wejammin-release-key-id',
  'x-wejammin-release-issued-at',
  'x-wejammin-release-nonce',
  'x-wejammin-release-signature',
]);

export const RELEASE_HTTP_HEADER_NAMES = {
  keyId: 'X-WeJammin-Release-Key-Id',
  issuedAt: 'X-WeJammin-Release-Issued-At',
  nonce: 'X-WeJammin-Release-Nonce',
  signature: 'X-WeJammin-Release-Signature',
} as const;

export type UnknownSchema = Readonly<{
  safeParse: (value: unknown) => unknown;
}>;

type ParsedSuccess<T> = Readonly<{ success: true; data: T }>;
type ParsedFailure = Readonly<{
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

export const invalid = (
  message: string,
  details: Readonly<Record<string, unknown>> = {},
  status: 400 | 413 | 415 | 422 = 400,
): ContentSchemaRegistryError => ({
  ok: false,
  status,
  code:
    status === 415
      ? 'UNSUPPORTED_MEDIA_TYPE'
      : status === 413
        ? 'PAYLOAD_TOO_LARGE'
        : status === 422
          ? 'VALIDATION_FAILED'
          : 'INVALID_REQUEST',
  message,
  details,
});

const LOCALE_CONFIG_MESSAGE_SET: ReadonlySet<string> = new Set(
  Object.values(LOCALE_CONFIG_MESSAGES),
);

const jsonPointer = (path: readonly PropertyKey[]): string =>
  `/${path
    .map((segment) =>
      String(segment).replaceAll('~', '~0').replaceAll('/', '~1'),
    )
    .join('/')}`;

type ZodIssueLike = Readonly<{
  path: readonly PropertyKey[];
  message: string;
  code?: string;
  keys?: readonly string[];
}>;

const CONSTRAINT_CODE = /^[a-z][a-z0-9_]{0,63}$/u;
const GENERIC_MESSAGE = 'The value is invalid.';

/**
 * One zod issue becomes one or more BE00 violations, each addressed by a
 * `path` that holds a JSON Pointer (BE00 `FieldViolation`). Only server-owned
 * text reaches the client:
 * - the fixed BE03a OD-4 locale messages travel verbatim as `{ path, message }`;
 * - a `custom` issue (a `.refine` or `.superRefine` literal such as
 *   'not a real calendar date') travels verbatim as `{ path, message }`;
 * - a lowercase constraint code authored in the contract (`etag_invalid`) is
 *   the violation `code`, with the generic message;
 * - every other built-in zod issue reports its closed zod code with the
 *   generic message. Zod's own message text is never sent, because it can
 *   echo caller input.
 * An unrecognized key is reported once per key, at that key's path.
 */
const violationsFor = (
  issue: ZodIssueLike,
): readonly Record<string, unknown>[] => {
  if (issue.code === 'unrecognized_keys' && Array.isArray(issue.keys))
    return issue.keys.map((key) => ({
      path: jsonPointer([...issue.path, key]),
      code: 'unrecognized_keys',
      message: GENERIC_MESSAGE,
    }));
  const path = jsonPointer(issue.path);
  if (LOCALE_CONFIG_MESSAGE_SET.has(issue.message))
    return [{ path, message: issue.message }];
  if (CONSTRAINT_CODE.test(issue.message))
    return [{ path, code: issue.message, message: GENERIC_MESSAGE }];
  if (issue.code === 'custom') return [{ path, message: issue.message }];
  return [
    {
      path,
      ...(typeof issue.code === 'string' && CONSTRAINT_CODE.test(issue.code)
        ? { code: issue.code }
        : {}),
      message: GENERIC_MESSAGE,
    },
  ];
};

export const issues = (error: {
  issues: readonly ZodIssueLike[];
}): Record<string, unknown> => ({
  violations: error.issues.flatMap(violationsFor).slice(0, 50),
});

export type Result<T> = ContentSchemaRegistryResult<T>;
