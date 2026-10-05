import { ApiErrorSchema, createRequestId } from '@wejammin/contracts';

import { untouchedBodyInit } from './proxy-request-body';
import { appendAllowedServiceBindingCookies } from './service-binding-cookies';

/** Private service binding used by the same-origin profile ownership façade. */
export type ProfileOwnershipPlatformApiBinding = Readonly<{
  fetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
}>;

export const PROFILE_OWNERSHIP_COOKIE_NAMES = [
  'wj_access',
  'wj_refresh',
  'wj_session_ref',
  'wj_csrf',
  'wj_auth_flow',
] as const;

export const PROFILE_OWNERSHIP_REQUEST_HEADERS = [
  'accept',
  'content-type',
  'if-match',
  'if-none-match',
  'idempotency-key',
  'origin',
  'x-correlation-id',
  'x-csrf-token',
  'x-request-id',
] as const;

export const PROFILE_OWNERSHIP_RESPONSE_HEADERS = new Set([
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

export const PROFILE_OWNERSHIP_ROUTE_CONTRACTS = [
  {
    operationId: 'PRF-API-01',
    method: 'POST',
    path: '/api/v1/shadow-party-matches',
    deferred: false,
  },
  {
    operationId: 'PRF-API-02',
    method: 'POST',
    path: '/api/v1/shadow-parties/:shadowId/invitations',
    deferred: false,
  },
  {
    operationId: 'PRF-API-03',
    method: 'POST',
    path: '/api/v1/shadow-remedies',
    deferred: false,
  },
  {
    operationId: 'PRF-API-04',
    method: 'POST',
    path: '/api/v1/party-claims',
    deferred: false,
  },
  {
    operationId: 'PRF-API-05',
    method: 'GET',
    path: '/api/v1/party-claims/:claimId',
    deferred: false,
  },
  {
    operationId: 'PRF-API-06',
    method: 'POST',
    path: '/api/v1/party-claims/:claimId/challenges',
    deferred: false,
  },
  {
    operationId: 'PRF-API-07',
    method: 'POST',
    path: '/api/v1/party-claims/:claimId/proofs',
    deferred: false,
  },
  {
    operationId: 'PRF-API-08',
    method: 'POST',
    path: '/api/v1/party-claims/:claimId/convert',
    deferred: false,
  },
] as const;

type ProfileOwnershipMethod = 'DELETE' | 'GET' | 'PATCH' | 'POST' | 'PUT';

export type ProfileOwnershipForwardOptions = Readonly<{
  readonly credentials?: 'include' | 'omit';
}>;

const allowedCookies = new Set<string>(PROFILE_OWNERSHIP_COOKIE_NAMES);
const supportedMethods = new Set<string>([
  'DELETE',
  'GET',
  'PATCH',
  'POST',
  'PUT',
]);

const isBinding = (
  value: unknown,
): value is ProfileOwnershipPlatformApiBinding =>
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

/** Retain only the named authentication cookies at the private boundary. */
export const filterProfileOwnershipCookies = (
  value: string | null,
): string | null => {
  if (value === null) return null;
  const retained = value
    .split(';')
    .map((part) => part.trim())
    .filter((part) => {
      const separator = part.indexOf('=');
      return separator > 0 && allowedCookies.has(part.slice(0, separator));
    });
  return retained.length > 0 ? retained.join('; ') : null;
};

export const hasProfileOwnershipSession = (request: Request): boolean => {
  const cookies = filterProfileOwnershipCookies(request.headers.get('cookie'));
  if (cookies === null) return false;
  return cookies.split('; ').some((part) => {
    const separator = part.indexOf('=');
    if (separator <= 0) return false;
    const name = part.slice(0, separator);
    return (
      name === 'wj_access' || name === 'wj_refresh' || name === 'wj_session_ref'
    );
  });
};

const unavailable = (request: Request): Response => {
  const requestId = createRequestId(
    request.headers.get('x-request-id') ?? undefined,
  );
  return Response.json(
    ApiErrorSchema.parse({
      code: 'DEPENDENCY_UNAVAILABLE',
      details: {},
      message: 'Profile ownership is temporarily unavailable.',
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

const forbidden = (request: Request): Response =>
  Response.json(
    ApiErrorSchema.parse({
      code: 'FORBIDDEN',
      details: {},
      message: 'The request origin is not allowed.',
      requestId: createRequestId(
        request.headers.get('x-request-id') ?? undefined,
      ),
    }),
    { status: 403, headers: { 'cache-control': 'no-store' } },
  );

const copyAllowedResponseHeaders = (source: Response): Headers => {
  const returned = new Headers();
  source.headers.forEach((value, name) => {
    if (PROFILE_OWNERSHIP_RESPONSE_HEADERS.has(name.toLowerCase())) {
      returned.append(name, value);
    }
  });
  return returned;
};

const appendAllowedSetCookies = (source: Response, target: Headers): void => {
  appendAllowedServiceBindingCookies(source, target, allowedCookies);
};

/** Forward a browser request through the private service binding safely. */
export const forwardProfileOwnershipRequest = async (
  request: Request,
  binding: unknown,
  path: string,
  method: ProfileOwnershipMethod,
  options: ProfileOwnershipForwardOptions = {},
): Promise<Response> => {
  if (
    !isBinding(binding) ||
    !supportedMethods.has(method) ||
    request.method !== method ||
    !isSafeApiPath(path)
  ) {
    return unavailable(request);
  }

  const requestOrigin = new URL(request.url).origin;
  const browserOrigin = request.headers.get('origin');
  if (browserOrigin !== null && browserOrigin !== requestOrigin)
    return forbidden(request);
  const referer = request.headers.get('referer');
  if (
    browserOrigin === null &&
    referer !== null &&
    (() => {
      try {
        return new URL(referer).origin !== requestOrigin;
      } catch {
        return true;
      }
    })()
  )
    return forbidden(request);

  const credentials = options.credentials ?? 'include';
  const headers = new Headers();
  for (const name of PROFILE_OWNERSHIP_REQUEST_HEADERS) {
    const value = request.headers.get(name);
    if (value !== null) headers.set(name, value);
  }
  if (credentials === 'include') {
    const cookies = filterProfileOwnershipCookies(
      request.headers.get('cookie'),
    );
    if (cookies !== null) headers.set('cookie', cookies);
  } else {
    headers.delete('cookie');
    headers.delete('x-csrf-token');
    headers.delete('if-match');
  }

  headers.set('origin', 'https://profile-ownership.internal');

  const init: RequestInit = {
    method,
    headers,
    ...untouchedBodyInit(request, method),
  };

  let upstream: Response;
  try {
    upstream = await binding.fetch(
      new Request(new URL(path, 'https://profile-ownership.internal'), init),
    );
  } catch {
    return unavailable(request);
  }

  const contentType = upstream.headers.get('content-type') ?? '';
  if (!/^application\/json(?:\s*;|$)/iu.test(contentType)) {
    return unavailable(request);
  }

  const responseHeaders = copyAllowedResponseHeaders(upstream);
  appendAllowedSetCookies(upstream, responseHeaders);
  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
};
