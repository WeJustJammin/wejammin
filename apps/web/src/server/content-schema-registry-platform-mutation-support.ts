import { ApiErrorSchema, createRequestId } from '@wejammin/contracts';
import {
  CONTENT_SCHEMA_REGISTRY_MUTATION_OPERATIONS,
  isSafeUuid,
} from './content-schema-registry-platform-shared';
import { parseContentSchemaRegistryErrorMetadata } from './content-schema-registry-platform-error-details';
import type {
  ContentSchemaRegistryMutationOperationId,
  ContentSchemaRegistryMutationTarget,
} from './content-schema-registry-platform-shared';
import { filteredCookieHeader } from './content-schema-registry-platform-shared';

const MUTATION_RESPONSE_HEADERS = new Set([
  'allow',
  'cache-control',
  'content-language',
  'content-type',
  'etag',
  'location',
  'ratelimit-limit',
  'ratelimit-remaining',
  'ratelimit-reset',
  'retry-after',
  'vary',
  'x-correlation-id',
  'x-request-id',
]);

const pathIdentifiers = (
  target: ContentSchemaRegistryMutationTarget,
  scope: 'none' | 'version' | 'review',
): Readonly<Record<string, string>> | null => {
  if (scope === 'none') return {};
  if (scope === 'review')
    return target.reviewId !== undefined && isSafeUuid(target.reviewId)
      ? { reviewId: target.reviewId }
      : null;
  return target.contentTypeId !== undefined &&
    target.versionId !== undefined &&
    isSafeUuid(target.contentTypeId) &&
    isSafeUuid(target.versionId)
    ? { contentTypeId: target.contentTypeId, versionId: target.versionId }
    : null;
};

export const mutationPath = (
  target: ContentSchemaRegistryMutationTarget,
): string | null => {
  const operation =
    CONTENT_SCHEMA_REGISTRY_MUTATION_OPERATIONS[target.operationId];
  if (operation === undefined) return null;
  const identifiers = pathIdentifiers(target, operation.scope);
  if (identifiers === null) return null;
  return Object.entries(identifiers).reduce(
    (path, [name, value]) =>
      path.replace(`{${name}}`, encodeURIComponent(value)),
    operation.path as string,
  );
};

interface SchemaParser {
  readonly safeParse: (value: unknown) =>
    | { readonly success: true; readonly data: unknown }
    | {
        readonly success: false;
      };
}

/** Strictly validate a browser payload against the generated request schema. */
export const schemaParseMutation = (
  operationId: ContentSchemaRegistryMutationOperationId,
  value: unknown,
) =>
  (
    CONTENT_SCHEMA_REGISTRY_MUTATION_OPERATIONS[operationId]
      .requestSchema as SchemaParser
  ).safeParse(value);

/** Strictly validate the private service success body for the operation. */
export const schemaParseSuccess = (
  operationId: ContentSchemaRegistryMutationOperationId,
  value: unknown,
) =>
  (
    CONTENT_SCHEMA_REGISTRY_MUTATION_OPERATIONS[operationId]
      .successSchema as SchemaParser
  ).safeParse(value);

export const sameOriginMutationRequest = (request: Request): boolean => {
  let requestOrigin: string;
  try {
    requestOrigin = new URL(request.url).origin;
  } catch {
    return false;
  }
  const origin = request.headers.get('origin');
  if (origin !== null && origin !== requestOrigin) return false;
  const referer = request.headers.get('referer');
  if (origin === null && referer !== null) {
    try {
      if (new URL(referer).origin !== requestOrigin) return false;
    } catch {
      return false;
    }
  }
  return true;
};

export const csrfCookie = (request: Request): string | null => {
  const cookie = request.headers.get('cookie');
  if (cookie === null) return null;
  for (const part of cookie.split(';')) {
    const separator = part.indexOf('=');
    if (separator <= 0 || part.slice(0, separator).trim() !== 'wj_csrf')
      continue;
    return part.slice(separator + 1).trim();
  }
  return null;
};

export const printableToken = (
  value: string | null,
  maximum: number,
): boolean =>
  value !== null &&
  value.length > 0 &&
  value.length <= maximum &&
  /^[\x20-\x7e]+$/u.test(value);

export const mutationErrorMessage = (code: string): string => {
  switch (code) {
    case 'INVALID_REQUEST':
      return 'The schema registry request is invalid.';
    case 'UNAUTHENTICATED':
      return 'Sign in to change the content schema registry.';
    case 'FORBIDDEN':
      return 'You do not have permission to change this schema.';
    case 'NOT_FOUND':
      return 'The requested schema resource was not found.';
    case 'CONFLICT':
      return 'The schema changed. Review the current version before retrying.';
    case 'UNSUPPORTED_MEDIA_TYPE':
      return 'Use a JSON or native form schema request.';
    case 'VALIDATION_FAILED':
      return 'Check the highlighted schema fields.';
    case 'RATE_LIMITED':
      return 'Too many schema changes. Try again shortly.';
    case 'BAD_GATEWAY':
      return 'The schema service returned invalid data.';
    case 'DEPENDENCY_UNAVAILABLE':
      return 'The schema service is temporarily unavailable.';
    case 'GATEWAY_TIMEOUT':
      return 'The schema service did not respond in time.';
    default:
      return 'The schema change could not be completed.';
  }
};

export const mutationErrorCode = (status: number): string => {
  if (status === 401) return 'UNAUTHENTICATED';
  if (status === 403) return 'FORBIDDEN';
  if (status === 404) return 'NOT_FOUND';
  if (status === 409) return 'CONFLICT';
  if (status === 415) return 'UNSUPPORTED_MEDIA_TYPE';
  if (status === 422) return 'VALIDATION_FAILED';
  if (status === 429) return 'RATE_LIMITED';
  if (status === 502) return 'BAD_GATEWAY';
  if (status === 503) return 'DEPENDENCY_UNAVAILABLE';
  if (status === 504) return 'GATEWAY_TIMEOUT';
  if (status >= 500) return 'INTERNAL_ERROR';
  return 'INVALID_REQUEST';
};

export const localMutationError = (
  request: Request,
  status: number,
  code = mutationErrorCode(status),
): Response => {
  const requestId = createRequestId(
    request.headers.get('x-request-id') ?? undefined,
  );
  const headers = new Headers({
    'cache-control': 'no-store',
    'x-request-id': requestId,
  });
  if (status === 429 || status === 503 || status === 504)
    headers.set('retry-after', '5');
  return Response.json(
    ApiErrorSchema.parse({
      code,
      details: {},
      message: mutationErrorMessage(code),
      requestId,
    }),
    { status, headers },
  );
};

/**
 * Preserve the platform's bounded ApiError at the first-party boundary. A
 * malformed or non-JSON upstream error is still collapsed to a local safe
 * error; a valid error retains its status, allowlisted details, and recovery
 * headers so the browser can render the exact contract.
 */
export const forwardedMutationError = async (
  request: Request,
  upstream: Response,
): Promise<Response> => {
  if (upstream.status < 400 || upstream.status > 599)
    return localMutationError(request, 502);
  const metadata = await parseContentSchemaRegistryErrorMetadata(upstream);
  if (metadata.apiError === null)
    return localMutationError(request, upstream.status);
  const headers = copyMutationResponseHeaders(upstream);
  headers.set('x-request-id', metadata.apiError.requestId);
  return new Response(JSON.stringify(metadata.apiError), {
    status: upstream.status,
    statusText: upstream.statusText,
    headers,
  });
};

export const forwardedMutationCookies = (request: Request): string | null =>
  filteredCookieHeader(request);

export const copyMutationResponseHeaders = (source: Response): Headers => {
  const headers = new Headers();
  source.headers.forEach((value, name) => {
    if (MUTATION_RESPONSE_HEADERS.has(name.toLowerCase()))
      headers.append(name, value);
  });
  headers.set('cache-control', 'no-store');
  return headers;
};
