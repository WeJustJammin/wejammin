import {
  JobIdPathSchema,
  JobStatusTransportSchema,
  QuotedVersionSchema,
  RequestIdSchema,
} from '@wejammin/contracts';

import {
  createJobStatusBoundaryPorts,
  JobStatusBoundaryError,
  type JobStatusBoundaryPorts,
} from './job-status-boundary.ts';

/** The only browser-to-service credential accepted by this adapter. */
const MAX_BEARER_BYTES = 4 * 1024;
const MAX_RESPONSE_BYTES = 64 * 1024;

export type PlatformApiFetcher = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export type PlatformApiBinding = Readonly<{
  fetch: PlatformApiFetcher;
}>;

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isControlFree = (value: string): boolean =>
  ![...value].some((character) => {
    const codePoint = character.charCodeAt(0);
    return (
      codePoint <= 0x1f ||
      codePoint === 0x7f ||
      (codePoint >= 0x80 && codePoint <= 0x9f)
    );
  });

const ACCESS_COOKIE = 'wj_access';
const TOKEN_PATTERN = /^[A-Za-z0-9._~+/=-]+$/u;

/** The HttpOnly access-token cookie value, when the request carries one. */
const accessCookieToken = (request: Request): string | null => {
  const cookie = request.headers.get('cookie');
  if (cookie === null || cookie.length > MAX_BEARER_BYTES) return null;
  for (const part of cookie.split(';')) {
    const separator = part.indexOf('=');
    if (separator <= 0 || part.slice(0, separator).trim() !== ACCESS_COOKIE)
      continue;
    const value = part.slice(separator + 1).trim();
    return value.length > 0 && TOKEN_PATTERN.test(value) ? value : null;
  }
  return null;
};

/**
 * Extracts an opaque bearer credential. It is deliberately not decoded,
 * inspected, or treated as an authority claim; the bound API verifies it.
 * The browser's job reader sends only same-origin cookies, so without an
 * explicit `Authorization` header the HttpOnly `wj_access` cookie supplies
 * the same token; it is forwarded as the bearer and never as a cookie.
 */
export const parsePlatformApiBearer = (request: Request): string | null => {
  const value = request.headers.get('authorization');
  if (value === null) return accessCookieToken(request);
  if (
    value.length > MAX_BEARER_BYTES ||
    !isControlFree(value) ||
    !/^Bearer [^\s]+$/u.test(value)
  ) {
    return null;
  }
  return value.slice('Bearer '.length);
};

const readRequestId = (request: Request): string | null => {
  const value = request.headers.get('x-request-id');
  return RequestIdSchema.safeParse(value).success ? value : null;
};

const readIfNoneMatch = (value: string | null): string | null =>
  value !== null && QuotedVersionSchema.safeParse(value).success ? value : null;

const readResponseBody = async (
  response: Response,
): Promise<unknown | null> => {
  const contentLength = response.headers.get('content-length');
  if (contentLength !== null) {
    const parsedLength = Number(contentLength);
    if (
      !Number.isSafeInteger(parsedLength) ||
      parsedLength < 0 ||
      parsedLength > MAX_RESPONSE_BYTES
    ) {
      return null;
    }
  }

  let body: string;
  try {
    body = await response.text();
  } catch {
    return null;
  }
  if (new TextEncoder().encode(body).byteLength > MAX_RESPONSE_BYTES) {
    return null;
  }
  try {
    return JSON.parse(body) as unknown;
  } catch {
    return null;
  }
};

const serviceRequestFor = (
  request: Request,
  jobId: string,
  token: string,
  ifNoneMatch: string | null,
): Request => {
  const url = new URL(request.url);
  url.pathname = `/api/v1/jobs/${encodeURIComponent(jobId)}`;
  url.search = '';
  const headers = new Headers({
    accept: 'application/json',
    authorization: `Bearer ${token}`,
  });
  const requestId = readRequestId(request);
  if (requestId !== null) headers.set('x-request-id', requestId);
  const validator = readIfNoneMatch(ifNoneMatch);
  if (validator !== null) headers.set('if-none-match', validator);
  return new Request(url, { headers, method: 'GET' });
};

/**
 * Creates a trusted web boundary backed by the private API service binding.
 * Authentication is delegated atomically to that API: this layer only passes
 * the opaque bearer, while the API verifies Supabase Auth and authorization.
 */
export const createPlatformApiJobStatusBoundaryPorts = (
  fetcher: PlatformApiFetcher,
): JobStatusBoundaryPorts => {
  if (typeof fetcher !== 'function') {
    throw new TypeError('PLATFORM_API must provide fetch');
  }

  const tokenBySession = new WeakMap<object, string>();
  const authenticate: JobStatusBoundaryPorts['authenticate'] = (request) => {
    const token = parsePlatformApiBearer(request);
    if (token === null) return { kind: 'unauthenticated' };

    // Keep the credential in a private closure. The session is intentionally
    // empty and therefore cannot serialize a token into HTML or diagnostics.
    const session = Object.freeze(Object.create(null)) as object;
    tokenBySession.set(session, token);
    return { kind: 'authenticated', session };
  };

  const read: JobStatusBoundaryPorts['read'] = async ({
    request,
    jobId,
    session,
    ifNoneMatch,
  }) => {
    if (!isObject(session)) return { kind: 'dependency_error' };
    const token = tokenBySession.get(session);
    if (token === undefined) return { kind: 'dependency_error' };
    if (!JobIdPathSchema.safeParse({ jobId }).success) {
      return { kind: 'dependency_error' };
    }

    let response: Response;
    try {
      response = await fetcher(
        serviceRequestFor(request, jobId, token, ifNoneMatch),
      );
    } catch {
      return { kind: 'dependency_error' };
    }

    const etag = response.headers.get('etag');
    const parsedEtag =
      etag !== null && QuotedVersionSchema.safeParse(etag).success
        ? etag
        : null;

    if (response.status === 304) {
      return parsedEtag === null
        ? { kind: 'dependency_error' }
        : { etag: parsedEtag, kind: 'not_modified' };
    }
    if (response.status === 401) {
      throw new JobStatusBoundaryError('UNAUTHENTICATED');
    }
    if (response.status === 404) return { kind: 'not_found' };
    if (response.status === 429) {
      const retryAfter = Number(response.headers.get('retry-after'));
      return Number.isSafeInteger(retryAfter) && retryAfter >= 0
        ? { kind: 'rate_limited', retryAfterSeconds: retryAfter }
        : { kind: 'dependency_error' };
    }
    if (response.status >= 500 && response.status <= 599) {
      return { kind: 'dependency_error' };
    }
    if (response.status !== 200 || parsedEtag === null) {
      return { kind: 'dependency_error' };
    }

    const body = await readResponseBody(response);
    const resource = JobStatusTransportSchema.safeParse({
      data: body,
      etag: parsedEtag,
    });
    return resource.success
      ? { kind: 'resource', resource: resource.data }
      : { kind: 'dependency_error' };
  };

  return createJobStatusBoundaryPorts({ authenticate, read });
};

/**
 * Reads the platform-provided service binding. Astro locals are never treated
 * as a binding; test-only ports are resolved separately by the route.
 */
export const readPlatformApiJobStatusBoundaryPorts = (
  binding: unknown,
): JobStatusBoundaryPorts | null => {
  if (!isObject(binding) || typeof binding.fetch !== 'function') return null;
  return createPlatformApiJobStatusBoundaryPorts(
    binding.fetch.bind(binding) as PlatformApiFetcher,
  );
};
