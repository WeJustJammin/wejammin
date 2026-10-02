import { ClientBindingIdSchema } from '@wejammin/contracts';
import { ContentSchemaRegistryPlatformError } from './content-schema-registry-platform-errors';
import type { ContentSchemaRegistryPlatformErrorKind } from './content-schema-registry-platform-errors';
import { parseContentSchemaRegistryErrorMetadata } from './content-schema-registry-platform-error-details';
import {
  parseContentSchemaRegistryContextHeaders,
  forwardedQuery,
  isSafeUuid,
  SESSION_COOKIE_NAMES,
} from './content-schema-registry-platform-context';
import type { ContentSchemaRegistryPresentationVariant } from './content-schema-registry-platform-context';

export {
  ContentSchemaRegistryPlatformError,
  isContentSchemaRegistryPlatformError,
} from './content-schema-registry-platform-errors';
export type { ContentSchemaRegistryPlatformErrorKind } from './content-schema-registry-platform-errors';
export {
  CONTENT_SCHEMA_REGISTRY_MUTATION_OPERATIONS,
  type ContentSchemaRegistryMutationOperationId,
  type ContentSchemaRegistryMutationTarget,
} from './content-schema-registry-platform-operations';
export {
  forwardedQuery,
  hasSessionCookie,
  isSafeUuid,
  parseContentSchemaRegistryCapabilities,
  parseContentSchemaRegistryContextHeaders,
  parseContentSchemaRegistryContextId,
  parseContentSchemaRegistryPresentationVariant,
  QUERY_KEYS,
  SESSION_COOKIE_NAMES,
  type ContentSchemaRegistryPresentationVariant,
  type ContentSchemaRegistryRefetchReason,
} from './content-schema-registry-platform-context';

/** The private service binding exposed to the web worker by wrangler. */
export type ContentSchemaRegistryPlatformApiBinding = Readonly<{
  fetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
}>;

export const PLATFORM_API_ORIGIN = 'https://platform-api.internal';
export const LIST_PATH = '/api/v1/cms/content-types';
export const DETAIL_PATH =
  /^\/api\/v1\/cms\/content-types\/([^/]+)\/versions\/([^/]+)$/u;
export const CMS_PATH =
  /^\/app\/cms-content-modeling(?:\/([^/]+)\/versions\/([^/]+))?\/?$/u;
export const SESSION_TTL_MS = 10 * 60 * 1000;

export const isBinding = (
  value: unknown,
): value is ContentSchemaRegistryPlatformApiBinding =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as { fetch?: unknown }).fetch === 'function';

export const apiPathForRequest = (request: Request): string => {
  const url = new URL(request.url);
  const match = CMS_PATH.exec(url.pathname);
  if (match?.[1] !== undefined && match[2] !== undefined) {
    if (!isSafeUuid(match[1]) || !isSafeUuid(match[2])) {
      throw new ContentSchemaRegistryPlatformError('not_found', 404);
    }
    return `/api/v1/cms/content-types/${encodeURIComponent(match[1])}/versions/${encodeURIComponent(match[2])}`;
  }
  return `${LIST_PATH}${forwardedQuery(url)}`;
};

export const apiPathForDetail = (
  contentTypeId: string,
  versionId: string,
): string => {
  if (!isSafeUuid(contentTypeId) || !isSafeUuid(versionId)) {
    throw new ContentSchemaRegistryPlatformError('not_found', 404);
  }
  return `${LIST_PATH}/${encodeURIComponent(contentTypeId)}/versions/${encodeURIComponent(versionId)}`;
};

/** CMS-03A-13 read path; the id is validated before any upstream call. */
export const apiPathForReview = (reviewId: string): string => {
  if (!isSafeUuid(reviewId)) {
    throw new ContentSchemaRegistryPlatformError('not_found', 404);
  }
  return `/api/v1/cms/schema-reviews/${encodeURIComponent(reviewId)}`;
};

export const filteredCookieHeader = (request: Request): string | null => {
  const raw = request.headers.get('cookie');
  if (raw === null) return null;
  const cookies = raw
    .split(';')
    .map((part) => part.trim())
    .filter((part) => {
      const separator = part.indexOf('=');
      return (
        separator > 0 && SESSION_COOKIE_NAMES.has(part.slice(0, separator))
      );
    });
  return cookies.length > 0 ? cookies.join('; ') : null;
};

export const requestHeaders = (request: Request): Headers => {
  const headers = new Headers({
    accept: 'application/json',
    'cache-control': 'no-store',
  });
  const cookie = filteredCookieHeader(request);
  if (cookie !== null) headers.set('cookie', cookie);
  for (const key of ['x-request-id', 'x-correlation-id'] as const) {
    const value = request.headers.get(key);
    if (value !== null && value.length > 0 && value.length <= 128) {
      headers.set(key, value);
    }
  }
  const clientBindingId = request.headers.get('x-client-binding-id');
  if (
    clientBindingId !== null &&
    ClientBindingIdSchema.safeParse(clientBindingId).success
  )
    headers.set('x-client-binding-id', clientBindingId);
  return headers;
};

export const errorForStatus = (
  status: number,
): ContentSchemaRegistryPlatformErrorKind => {
  if (status === 401) return 'unauthenticated';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'not_found';
  if (status === 422) return 'validation_failed';
  if (status === 429) return 'rate_limited';
  if (status === 502) return 'dependency_invalid_response';
  if (status === 503) return 'dependency_unavailable';
  if (status === 504) return 'dependency_deadline_exceeded';
  if (status >= 500) return 'internal_error';
  return 'invalid_request';
};

export type UpstreamResult =
  | {
      readonly kind: 'ok';
      readonly data: unknown;
      readonly capabilities: readonly string[];
      readonly presentationVariant: ContentSchemaRegistryPresentationVariant | null;
      readonly actorId: string | null;
      readonly actingPartyId: string | null;
      readonly stepUpFreshUntil: string | null;
    }
  | {
      readonly kind: Exclude<ContentSchemaRegistryPlatformErrorKind, 'ok'>;
      readonly error: ContentSchemaRegistryPlatformError;
    };

export const requestUpstream = async (
  binding: ContentSchemaRegistryPlatformApiBinding,
  request: Request,
  path: string,
): Promise<UpstreamResult> => {
  const clientBindingId = request.headers.get('x-client-binding-id');
  if (
    clientBindingId !== null &&
    !ClientBindingIdSchema.safeParse(clientBindingId).success
  ) {
    const error = new ContentSchemaRegistryPlatformError(
      'invalid_request',
      400,
    );
    return { kind: 'invalid_request', error };
  }
  let response: Response;
  try {
    response = await binding.fetch(
      new Request(`${PLATFORM_API_ORIGIN}${path}`, {
        method: 'GET',
        headers: requestHeaders(request),
      }),
    );
  } catch {
    const error = new ContentSchemaRegistryPlatformError(
      'dependency_unavailable',
      null,
    );
    return { kind: 'unavailable', error };
  }
  if (!response.ok) {
    const kind = errorForStatus(response.status);
    const metadata = await parseContentSchemaRegistryErrorMetadata(response);
    const error = new ContentSchemaRegistryPlatformError(
      kind,
      response.status,
      {
        apiError: metadata.apiError,
        retryable: metadata.retryable,
        retryAfterSeconds: metadata.retryAfterSeconds,
        etag: metadata.etag,
      },
    );
    return { kind, error };
  }
  try {
    return {
      kind: 'ok',
      data: await response.json(),
      ...parseContentSchemaRegistryContextHeaders(response.headers),
    };
  } catch {
    const error = new ContentSchemaRegistryPlatformError(
      'dependency_invalid_response',
      response.status,
    );
    return { kind: 'dependency_invalid_response', error };
  }
};
