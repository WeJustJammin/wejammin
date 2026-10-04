import { ApiErrorSchema, createRequestId } from '@wejammin/contracts';

import { untouchedBodyInit } from './proxy-request-body';
import { appendAllowedServiceBindingCookies } from './service-binding-cookies';

/** The service binding surface used by the Astro identity-authority façade. */
export type IdentityAuthorityPlatformApiBinding = Readonly<{
  fetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
}>;

/**
 * Cookies which can carry authentication state across the private service
 * binding. Browser preference, analytics, and arbitrary application cookies
 * never cross this boundary.
 */
export const IDENTITY_AUTHORITY_COOKIE_NAMES = [
  'wj_access',
  'wj_refresh',
  'wj_session_ref',
  'wj_csrf',
  'wj_auth_flow',
] as const;

const allowedCookies = new Set<string>(IDENTITY_AUTHORITY_COOKIE_NAMES);

/** Request headers accepted from the same-origin browser façade. */
export const IDENTITY_AUTHORITY_REQUEST_HEADERS = [
  'accept',
  'content-type',
  'if-match',
  'if-none-match',
  'idempotency-key',
  'origin',
  'x-correlation-id',
  'x-csrf-token',
  'x-client-binding-id',
  'x-request-id',
] as const;

/** Response headers safe to expose through the same-origin façade. */
export const IDENTITY_AUTHORITY_RESPONSE_HEADERS = new Set([
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

const supportedMethods = new Set(['DELETE', 'GET', 'PATCH', 'POST', 'PUT']);
type IdentityAuthorityMethod = 'DELETE' | 'GET' | 'PATCH' | 'POST' | 'PUT';

export type IdentityAuthorityForwardOptions = Readonly<{
  /** Omit all browser cookies for the anonymous public projection route. */
  readonly credentials?: 'include' | 'omit';
}>;

const isBinding = (
  value: unknown,
): value is IdentityAuthorityPlatformApiBinding =>
  typeof value === 'object' &&
  value !== null &&
  'fetch' in value &&
  typeof value.fetch === 'function';

const isSafeApiPath = (path: string): boolean =>
  path.startsWith('/api/v1/') &&
  ![...path].some((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint <= 0x1f || codePoint === 0x7f;
  }) &&
  !/[?#]/u.test(path);

/** Keep only named authentication cookies while preserving their values. */
export const filterIdentityAuthorityCookies = (
  value: string | null,
): string | null => {
  if (value === null) return null;
  const retained = value
    .split(';')
    .map((part) => part.trim())
    .filter((part) => {
      const separator = part.indexOf('=');
      if (separator <= 0) return false;
      return allowedCookies.has(part.slice(0, separator));
    });
  return retained.length > 0 ? retained.join('; ') : null;
};

const unavailable = (request: Request): Response => {
  const requestId = createRequestId(
    request.headers.get('x-request-id') ?? undefined,
  );
  return Response.json(
    ApiErrorSchema.parse({
      code: 'DEPENDENCY_UNAVAILABLE',
      details: {},
      message: 'Identity authority is temporarily unavailable.',
      requestId,
    }),
    {
      status: 503,
      headers: {
        'cache-control': 'no-store',
        'retry-after': '5',
        'x-request-id': requestId,
      },
    },
  );
};

const copyAllowedResponseHeaders = (source: Response): Headers => {
  const returned = new Headers();
  source.headers.forEach((value, name) => {
    if (IDENTITY_AUTHORITY_RESPONSE_HEADERS.has(name.toLowerCase())) {
      returned.append(name, value);
    }
  });
  return returned;
};

const appendAllowedSetCookies = (source: Response, target: Headers): void => {
  appendAllowedServiceBindingCookies(source, target, allowedCookies);
};

/**
 * Copies only approved authentication cookies from a Worker response. The
 * browser never receives arbitrary upstream Set-Cookie values.
 */
export const copyIdentityAuthorityCookies = (
  source: Response,
  target: Headers,
): void => {
  appendAllowedSetCookies(source, target);
};

/** Return whether the request carries one of the server-managed auth cookies. */
export const hasIdentityAuthoritySession = (request: Request): boolean => {
  const cookie = filterIdentityAuthorityCookies(request.headers.get('cookie'));
  if (cookie === null) return false;
  return cookie.split('; ').some((part) => {
    const separator = part.indexOf('=');
    if (separator <= 0) return false;
    const name = part.slice(0, separator);
    return (
      name === 'wj_access' || name === 'wj_refresh' || name === 'wj_session_ref'
    );
  });
};

/** Clone a request for a canonical API read without leaking UI query state. */
export const createIdentityAuthorityReadRequest = (
  request: Request,
  path: string,
): Request => {
  const target = new URL(request.url);
  target.pathname = path;
  target.search = '';
  return new Request(target, { method: 'GET', headers: request.headers });
};

/**
 * Forward a same-origin identity-authority request to the private Worker.
 * Authorization, acting-party, capability, and step-up headers are
 * intentionally absent: the Worker derives all authority from its session.
 */
export const forwardIdentityAuthorityRequest = async (
  request: Request,
  binding: unknown,
  path: string,
  method: IdentityAuthorityMethod,
  options: IdentityAuthorityForwardOptions = {},
): Promise<Response> => {
  if (
    !isBinding(binding) ||
    !supportedMethods.has(method) ||
    request.method !== method ||
    !isSafeApiPath(path)
  ) {
    return unavailable(request);
  }

  const target = new URL(request.url);
  target.pathname = path;
  const headers = new Headers();
  for (const name of IDENTITY_AUTHORITY_REQUEST_HEADERS) {
    const value = request.headers.get(name);
    if (value !== null) headers.set(name, value);
  }
  if (options.credentials !== 'omit') {
    const cookie = filterIdentityAuthorityCookies(
      request.headers.get('cookie'),
    );
    if (cookie !== null) headers.set('cookie', cookie);
  } else {
    // Public projections are anonymous reads. Do not let a browser-supplied
    // mutation or CSRF hint turn that read into a credentialed request.
    headers.delete('cookie');
    headers.delete('x-csrf-token');
    headers.delete('if-match');
    headers.delete('idempotency-key');
    headers.delete('x-client-binding-id');
  }

  let response: Response;
  try {
    response = await binding.fetch(
      new Request(target, {
        method,
        headers,
        ...untouchedBodyInit(request, method),
      }),
    );
  } catch {
    return unavailable(request);
  }

  if (!(response instanceof Response)) return unavailable(request);

  const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
  if (!contentType.includes('application/json')) return unavailable(request);

  const returned = copyAllowedResponseHeaders(response);
  appendAllowedSetCookies(response, returned);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: returned,
  });
};

/** Compatibility alias for callers that name the boundary as a platform API. */
export const forwardIdentityRequest = forwardIdentityAuthorityRequest;
