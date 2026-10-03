import { contentSchemaRegistryRoutePolicies } from '@wejammin/contracts';

import {
  CmsCapabilityGrantListQuerySchema,
  CmsStrongEtagSchema,
  ContentSchemaRegistryListQuerySchema,
  type CmsCapabilityGrantListQuery,
  type ContentSchemaRegistryListQuery,
} from './contracts';
import type {
  ContentSchemaRegistryError,
  ContentSchemaRegistryOperationId,
  ContentSchemaRegistryResult,
} from './types';
import { IDEMPOTENCY_PATTERN, invalid, issues } from './admission-common';

export const parseMutationHeaders = (
  request: Request,
  operationId: ContentSchemaRegistryOperationId,
): ContentSchemaRegistryResult<
  Readonly<{ idempotencyKey: string; ifMatch?: string }>
> => {
  const idempotencyKey = request.headers.get('idempotency-key');
  if (idempotencyKey === null || !IDEMPOTENCY_PATTERN.test(idempotencyKey))
    return invalid('A valid Idempotency-Key is required.');
  const rawIfMatch = request.headers.get('if-match');
  // The route policy is the single source of which commands carry If-Match.
  const needsIfMatch = contentSchemaRegistryRoutePolicies.some(
    (policy) =>
      policy.operationId === operationId && policy.ifMatch === 'required',
  );
  if (
    needsIfMatch &&
    (rawIfMatch === null || !CmsStrongEtagSchema.safeParse(rawIfMatch).success)
  )
    return invalid('A valid strong If-Match version is required.');
  if (!needsIfMatch && rawIfMatch !== null)
    return invalid('If-Match is not accepted for this operation.');
  return {
    ok: true,
    value: {
      idempotencyKey,
      ...(rawIfMatch === null ? {} : { ifMatch: rawIfMatch.slice(1, -1) }),
    },
  };
};

type QuerySchema<T> = Readonly<{
  safeParse: (value: unknown) =>
    | Readonly<{ success: true; data: T }>
    | Readonly<{
        success: false;
        error: Readonly<{
          issues: readonly Readonly<{
            path: readonly PropertyKey[];
            message: string;
          }>[];
        }>;
      }>;
}>;

/**
 * Strict single-valued query. BE03a error matrix for the protected lists:
 * an unknown or repeated key, or a malformed cursor, is a malformed request
 * (400 INVALID_REQUEST); a filter, sort or page value that fails its schema
 * (limit range, sort, direction, state, capability, subject, resource kind) is
 * a validation failure (422 VALIDATION_FAILED). Both carry only `path`
 * violations.
 */
const parseStrictQuery = <T>(
  request: Request,
  schema: QuerySchema<T>,
  allowedKeys: readonly string[],
): ContentSchemaRegistryResult<T> => {
  const params = new URL(request.url).searchParams;
  const allowed = new Set(allowedKeys);
  const value: Record<string, unknown> = {};
  for (const key of new Set(params.keys())) {
    if (!allowed.has(key) || params.getAll(key).length !== 1)
      return invalid('The query parameters are invalid.');
    const raw = params.get(key);
    if (raw === null) return invalid('The query parameters are invalid.');
    value[key] = raw;
  }
  const parsed = schema.safeParse(value);
  if (parsed.success) return { ok: true, value: parsed.data };
  const malformedCursor = parsed.error.issues.some(
    (issue) => issue.path[0] === 'cursor',
  );
  return invalid(
    'The query parameters are invalid.',
    issues(parsed.error),
    malformedCursor ? 400 : 422,
  );
};

export const parseQuery = (
  request: Request,
): ContentSchemaRegistryResult<ContentSchemaRegistryListQuery> =>
  parseStrictQuery(request, ContentSchemaRegistryListQuerySchema, [
    'resourceKind',
    'keyPrefix',
    'lifecycle',
    'state',
    'limit',
    'cursor',
    'sort',
    'direction',
  ]);

/** CMS-03A-18 strict grant list query (BE03a). */
export const parseGrantListQuery = (
  request: Request,
): ContentSchemaRegistryResult<CmsCapabilityGrantListQuery> =>
  parseStrictQuery(request, CmsCapabilityGrantListQuerySchema, [
    'subjectPersonId',
    'capability',
    'state',
    'limit',
    'cursor',
    'sort',
    'direction',
  ]);

export const rejectReadMutationHeadersOrBody = async (
  request: Request,
): Promise<ContentSchemaRegistryError | null> => {
  if (request.headers.has('idempotency-key') || request.headers.has('if-match'))
    return invalid('Mutation headers are not accepted on protected reads.');
  const declaredLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > 0)
    return invalid('Protected reads do not accept a request body.');
  try {
    const bytes = new Uint8Array(await request.clone().arrayBuffer());
    return bytes.byteLength === 0
      ? null
      : invalid('Protected reads do not accept a request body.');
  } catch {
    return invalid('Protected reads do not accept a request body.');
  }
};

export const rejectDetailQuery = (
  request: Request,
): ContentSchemaRegistryError | null =>
  new URL(request.url).searchParams.size === 0
    ? null
    : invalid('The detail route does not accept query parameters.');

export const checkOrigin = (
  request: Request,
  allowedOrigins: readonly string[],
): ContentSchemaRegistryError | null => {
  const origin = request.headers.get('origin');
  return origin === null || allowedOrigins.includes(origin)
    ? null
    : {
        ok: false,
        status: 403,
        code: 'FORBIDDEN',
        message: 'The request origin is not allowed.',
        details: { reasonCode: 'POLICY_NOT_MET' },
      };
};

export const csrfErrorIfCookie = (
  request: Request,
): ContentSchemaRegistryError | null => {
  const cookie = request.headers.get('cookie');
  if (cookie === null) return null;
  const parts = cookie.split(';').map((part) => part.trim());
  if (!parts.some((part) => part.startsWith('wj_session_ref='))) return null;
  const token = parts
    .find((part) => part.startsWith('wj_csrf='))
    ?.slice('wj_csrf='.length);
  return token !== undefined &&
    token !== '' &&
    token === request.headers.get('x-csrf-token')
    ? null
    : {
        ok: false,
        status: 403,
        code: 'FORBIDDEN',
        message: 'A valid CSRF token is required.',
        details: { reasonCode: 'POLICY_NOT_MET' },
      };
};
