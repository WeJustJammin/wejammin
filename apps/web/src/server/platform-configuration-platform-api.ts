import {
  ApiErrorSchema,
  ConfigurationCapabilitySchema,
  createRequestId,
} from '@wejammin/contracts';
import {
  deferredAdminWorkspacePaths,
  isSafePlatformConfigurationPath,
  isSupportedPlatformConfigurationMethod,
  matchingPlatformConfigurationRoute,
  type PlatformConfigurationMethod,
} from './platform-configuration-route-registry';
import {
  appendAdminInboxQuery,
  appendEffectiveConfigurationQuery,
} from './platform-configuration-query';
import { isSameOriginPlatformConfigurationRequest } from './platform-configuration-request';
import { untouchedBodyInit } from './proxy-request-body';
import { appendAllowedServiceBindingCookies } from './service-binding-cookies';

export {
  PLATFORM_CONFIGURATION_BROWSER_ROUTES,
  PLATFORM_CONFIGURATION_ROUTE_CONTRACTS,
} from './platform-configuration-route-registry';

/**
 * The browser-facing platform configuration boundary.  The Worker remains
 * authoritative for session, capability, scope, and version checks; this
 * module only forwards a bounded request through the private service binding.
 */
export type PlatformConfigurationPlatformApiBinding = Readonly<{
  fetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  /**
   * Optional server-only authority bridge.  A Cloudflare service binding does
   * not expose this member; when present it must be supplied by the trusted
   * server adapter and never by browser request data.
   */
  resolveCapabilities?: (
    input: PlatformConfigurationCapabilityResolutionInput,
  ) =>
    | PlatformConfigurationCapabilityResolution
    | Promise<PlatformConfigurationCapabilityResolution>;
}>;

export type PlatformConfigurationCapabilityResolutionInput = Readonly<{
  readonly request: Request;
  readonly actorId: string;
  readonly actingPartyId: string;
  readonly key: string | null;
  readonly surface: 'index' | 'detail';
}>;

export type PlatformConfigurationCapabilityResolution =
  readonly string[] | Readonly<{ capabilities: readonly string[] }>;

export type PlatformConfigurationForwardOptions = Readonly<{
  readonly credentials?: 'include' | 'omit';
}>;

/** Authentication cookies which are safe to cross the private boundary. */
export const PLATFORM_CONFIGURATION_COOKIE_NAMES = [
  'wj_access',
  'wj_refresh',
  'wj_session_ref',
  'wj_csrf',
  'wj_auth_flow',
] as const;

/** Request headers accepted from the same-origin browser façade. */
export const PLATFORM_CONFIGURATION_REQUEST_HEADERS = [
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

/** Response headers which do not expose provider or private implementation data. */
export const PLATFORM_CONFIGURATION_RESPONSE_HEADERS = new Set([
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

const cookieNames = new Set<string>(PLATFORM_CONFIGURATION_COOKIE_NAMES);

const isBinding = (
  value: unknown,
): value is PlatformConfigurationPlatformApiBinding =>
  typeof value === 'object' &&
  value !== null &&
  'fetch' in value &&
  typeof value.fetch === 'function';

const parseCapabilityValues = (
  values: readonly unknown[],
): readonly string[] => {
  const capabilities: string[] = [];
  for (const value of values) {
    if (typeof value !== 'string') continue;
    for (const candidate of value.split(',')) {
      const parsed = ConfigurationCapabilitySchema.safeParse(candidate.trim());
      if (!parsed.success || capabilities.includes(parsed.data)) continue;
      capabilities.push(parsed.data);
      if (capabilities.length === 32) return capabilities;
    }
  }
  return capabilities;
};

/**
 * Normalize capability names produced by a trusted server-only authority.
 * Capability authority is never read from a response header: the Worker
 * projects it through CFG-05B-07 (`readWorkerCapabilitySnapshot`).
 */
export const parsePlatformConfigurationCapabilities = (
  value: string | readonly unknown[] | null | undefined,
): readonly string[] =>
  parseCapabilityValues(
    value === null || value === undefined
      ? []
      : typeof value === 'string'
        ? [value]
        : value,
  );

/** Keep only named authentication cookies while preserving their values. */
export const filterPlatformConfigurationCookies = (
  value: string | null,
): string | null => {
  if (value === null) return null;
  const retained = value
    .split(';')
    .map((part) => part.trim())
    .filter((part) => {
      const separator = part.indexOf('=');
      return separator > 0 && cookieNames.has(part.slice(0, separator));
    });
  return retained.length > 0 ? retained.join('; ') : null;
};

/** A caller-provided role or context label never establishes a session. */
export const hasPlatformConfigurationSession = (request: Request): boolean => {
  const cookies = filterPlatformConfigurationCookies(
    request.headers.get('cookie'),
  );
  if (cookies === null) return false;
  return cookies.split('; ').some((part) => {
    const separator = part.indexOf('=');
    const name = separator > 0 ? part.slice(0, separator) : '';
    return (
      name === 'wj_access' || name === 'wj_refresh' || name === 'wj_session_ref'
    );
  });
};

const errorResponse = (
  request: Request,
  status: 403 | 503,
  code: 'FORBIDDEN' | 'DEPENDENCY_UNAVAILABLE',
  message: string,
): Response => {
  const requestId = createRequestId(
    request.headers.get('x-request-id') ?? undefined,
  );
  return Response.json(
    ApiErrorSchema.parse({ code, details: {}, message, requestId }),
    {
      status,
      headers: {
        'cache-control': 'no-store',
        ...(status === 503 ? { 'retry-after': '5' } : {}),
        'x-request-id': requestId,
      },
    },
  );
};

const unavailable = (request: Request): Response =>
  errorResponse(
    request,
    503,
    'DEPENDENCY_UNAVAILABLE',
    'Platform configuration is temporarily unavailable.',
  );

const notFound = (request: Request): Response =>
  Response.json(
    ApiErrorSchema.parse({
      code: 'NOT_FOUND',
      details: {},
      message: 'The requested resource was not found.',
      requestId: createRequestId(
        request.headers.get('x-request-id') ?? undefined,
      ),
    }),
    {
      status: 404,
      headers: {
        'cache-control': 'no-store',
      },
    },
  );

const forbidden = (request: Request): Response =>
  errorResponse(
    request,
    403,
    'FORBIDDEN',
    'The request origin is not allowed.',
  );

const copyAllowedResponseHeaders = (source: Response): Headers => {
  const returned = new Headers();
  source.headers.forEach((value, name) => {
    if (PLATFORM_CONFIGURATION_RESPONSE_HEADERS.has(name.toLowerCase())) {
      returned.append(name, value);
    }
  });
  return returned;
};

const appendAllowedSetCookies = (source: Response, target: Headers): void => {
  appendAllowedServiceBindingCookies(source, target, cookieNames);
};

const createLocalBinding = (
  origin: string,
): PlatformConfigurationPlatformApiBinding => ({
  fetch: (input, init) => {
    const base = new URL(origin);
    if (
      !/^https?:$/u.test(base.protocol) ||
      base.username !== '' ||
      base.password !== ''
    ) {
      throw new TypeError(
        'Local platform configuration API origin must not contain credentials.',
      );
    }
    const sourceRequest =
      input instanceof Request ? input : new Request(input, init);
    const source = new URL(sourceRequest.url);
    const target = new URL(source.pathname + source.search, base);
    return globalThis.fetch(new Request(target, sourceRequest));
  },
});

/** Prefer an explicitly configured local API only in development. */
export const resolvePlatformConfigurationBinding = (
  binding: unknown,
  localApiOrigin?: string,
): unknown => {
  if (
    typeof localApiOrigin !== 'string' ||
    localApiOrigin.trim().length === 0
  ) {
    return binding;
  }
  try {
    const parsed = new URL(localApiOrigin);
    if (
      !/^https?:$/u.test(parsed.protocol) ||
      parsed.username !== '' ||
      parsed.password !== ''
    ) {
      return null;
    }
    return createLocalBinding(localApiOrigin);
  } catch {
    return null;
  }
};

/**
 * Forward a registered browser route.  Unknown routes, credentials, origins,
 * response media types, and provider headers fail closed.
 */
export const forwardPlatformConfigurationRequest = async (
  request: Request,
  binding: unknown,
  path: string,
  method: PlatformConfigurationMethod,
  options: PlatformConfigurationForwardOptions = {},
): Promise<Response> => {
  if (deferredAdminWorkspacePaths.has(`${method} ${path}`))
    return notFound(request);
  const route = matchingPlatformConfigurationRoute(path, method);
  if (
    !isBinding(binding) ||
    !isSupportedPlatformConfigurationMethod(method) ||
    request.method !== method ||
    !isSafePlatformConfigurationPath(path) ||
    route === undefined
  ) {
    return unavailable(request);
  }
  if (!isSameOriginPlatformConfigurationRequest(request))
    return forbidden(request);

  const credentials = options.credentials ?? 'include';
  const headers = new Headers();
  for (const name of PLATFORM_CONFIGURATION_REQUEST_HEADERS) {
    const value = request.headers.get(name);
    if (value !== null) headers.set(name, value);
  }
  if (credentials === 'include') {
    const cookies = filterPlatformConfigurationCookies(
      request.headers.get('cookie'),
    );
    if (cookies !== null) headers.set('cookie', cookies);
  } else {
    headers.delete('cookie');
    headers.delete('x-csrf-token');
    headers.delete('if-match');
    headers.delete('idempotency-key');
  }

  headers.set('origin', 'https://platform-configuration.internal');
  const init: RequestInit = {
    method,
    headers,
    ...untouchedBodyInit(request, method),
  };

  let upstream: Response;
  try {
    const target = new URL(path, 'https://platform-configuration.internal');
    if (route.operationId === 'CFG-05A-02') {
      appendEffectiveConfigurationQuery(new URL(request.url), target);
    }
    if (route.operationId === 'CFG-05B-01') {
      appendAdminInboxQuery(new URL(request.url), target);
    }
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

export default forwardPlatformConfigurationRequest;
