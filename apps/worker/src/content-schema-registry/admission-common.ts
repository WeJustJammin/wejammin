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

/**
 * Zod issues become BE00 `violations`. Generic issues expose no client text.
 * The fixed locale-configuration messages of BE03a OD-4 are server-owned
 * constants (never echoed input), so they travel verbatim with their pointer.
 */
export const issues = (error: {
  issues: readonly { path: readonly PropertyKey[]; message: string }[];
}): Record<string, unknown> => ({
  violations: error.issues.slice(0, 50).map((issue) =>
    LOCALE_CONFIG_MESSAGE_SET.has(issue.message)
      ? { pointer: jsonPointer(issue.path), message: issue.message }
      : {
          path: `/${issue.path.map(String).join('/')}`,
          code: issue.message,
          message: 'The value is invalid.',
        },
  ),
});

export type Result<T> = ContentSchemaRegistryResult<T>;
