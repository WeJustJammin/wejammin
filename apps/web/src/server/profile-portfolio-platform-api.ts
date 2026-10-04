import { ApiErrorSchema, createRequestId } from '@wejammin/contracts';

import { PROFILE_PORTFOLIO_ROUTE_CONTRACTS } from './profile-portfolio-route-contracts';
import { createProfilePortfolioHttpBinding } from './profile-portfolio-local-binding.ts';
import { untouchedBodyInit } from './proxy-request-body';
import { appendAllowedServiceBindingCookies } from './service-binding-cookies';

export { PROFILE_PORTFOLIO_ROUTE_CONTRACTS } from './profile-portfolio-route-contracts';
export { createProfilePortfolioHttpBinding } from './profile-portfolio-local-binding.ts';

/** Private service binding used by the same-origin profile façade. */
export type ProfilePortfolioPlatformApiBinding = Readonly<{
  fetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
}>;

/** Prefer the explicit local API only when configured; deployments retain the service binding. */
export const resolveProfilePortfolioBinding = (
  binding: unknown,
  localApiOrigin?: string,
): unknown =>
  typeof localApiOrigin === 'string' && localApiOrigin.length > 0
    ? createProfilePortfolioHttpBinding(localApiOrigin)
    : binding;

export const PROFILE_PORTFOLIO_COOKIE_NAMES = [
  'wj_access',
  'wj_refresh',
  'wj_session_ref',
  'wj_csrf',
  'wj_auth_flow',
] as const;

export const PROFILE_PORTFOLIO_REQUEST_HEADERS = [
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

export const PROFILE_PORTFOLIO_RESPONSE_HEADERS = new Set([
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

type ProfilePortfolioMethod = 'DELETE' | 'GET' | 'PATCH' | 'POST' | 'PUT';

export type ProfilePortfolioForwardOptions = Readonly<{
  readonly credentials?: 'include' | 'omit';
}>;

const allowedCookies = new Set<string>(PROFILE_PORTFOLIO_COOKIE_NAMES);
const supportedMethods = new Set<string>([
  'DELETE',
  'GET',
  'PATCH',
  'POST',
  'PUT',
]);

const isBinding = (
  value: unknown,
): value is ProfilePortfolioPlatformApiBinding =>
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
  !/[?#]/u.test(path) &&
  path.split('/').every((segment) => segment !== '.' && segment !== '..');

const routePattern = (path: string): RegExp =>
  new RegExp(
    `^${path
      .split('/')
      .map((segment) =>
        segment.startsWith(':')
          ? '[^/]+'
          : segment.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'),
      )
      .join('/')}$`,
    'u',
  );

const activeBrowserRoutes = PROFILE_PORTFOLIO_ROUTE_CONTRACTS.filter(
  (route) => route.deferred === false && route.path.startsWith('/api/v1/'),
).map((route) => ({ method: route.method, pattern: routePattern(route.path) }));

const isActiveBrowserRoute = (path: string, method: string): boolean =>
  activeBrowserRoutes.some(
    (route) => route.method === method && route.pattern.test(path),
  );

/** Retain only named authentication cookies at the private boundary. */
export const filterProfilePortfolioCookies = (
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

/** Return whether a request carries a server-managed authentication session. */
export const hasProfilePortfolioSession = (request: Request): boolean => {
  const cookies = filterProfilePortfolioCookies(request.headers.get('cookie'));
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
      message: 'Profile portfolio is temporarily unavailable.',
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
    if (PROFILE_PORTFOLIO_RESPONSE_HEADERS.has(name.toLowerCase())) {
      returned.append(name, value);
    }
  });
  return returned;
};

const appendAllowedSetCookies = (source: Response, target: Headers): void => {
  appendAllowedServiceBindingCookies(source, target, allowedCookies);
};

/** Forward an active browser request through the private profile service binding. */
export const forwardProfilePortfolioRequest = async (
  request: Request,
  binding: unknown,
  path: string,
  method: ProfilePortfolioMethod,
  options: ProfilePortfolioForwardOptions = {},
): Promise<Response> => {
  if (
    !isBinding(binding) ||
    !supportedMethods.has(method) ||
    request.method !== method ||
    !isSafeApiPath(path) ||
    !isActiveBrowserRoute(path, method)
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
  for (const name of PROFILE_PORTFOLIO_REQUEST_HEADERS) {
    const value = request.headers.get(name);
    if (value !== null) headers.set(name, value);
  }
  if (credentials === 'include') {
    const cookies = filterProfilePortfolioCookies(
      request.headers.get('cookie'),
    );
    if (cookies !== null) headers.set('cookie', cookies);
  } else {
    headers.delete('cookie');
    headers.delete('x-csrf-token');
    headers.delete('if-match');
    headers.delete('idempotency-key');
  }

  headers.set('origin', 'https://profile-portfolio.internal');
  const init: RequestInit = {
    method,
    headers,
    ...untouchedBodyInit(request, method),
  };

  let upstream: Response;
  try {
    const target = new URL(path, 'https://profile-portfolio.internal');
    target.search = new URL(request.url).search;
    upstream = await binding.fetch(new Request(target, init));
  } catch {
    return unavailable(request);
  }

  if (!(upstream instanceof Response)) return unavailable(request);
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
