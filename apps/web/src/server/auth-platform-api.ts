import { ApiErrorSchema, createRequestId } from '@wejammin/contracts';

import { copyIdentityAuthorityCookies } from './identity-authority-platform-api';
import { untouchedBodyInit } from './proxy-request-body';

export type AuthPlatformApiBinding = Readonly<{
  fetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
}>;

const requestHeaders = [
  'accept',
  'content-type',
  'cookie',
  'if-match',
  'idempotency-key',
  'origin',
  'x-correlation-id',
  'x-csrf-token',
  'x-client-binding-id',
  'x-request-id',
] as const;

const responseHeaders = new Set([
  'cache-control',
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

const isBinding = (value: unknown): value is AuthPlatformApiBinding =>
  typeof value === 'object' &&
  value !== null &&
  'fetch' in value &&
  typeof value.fetch === 'function';

const unavailable = (request: Request): Response => {
  const requestId = createRequestId(
    request.headers.get('x-request-id') ?? undefined,
  );
  return Response.json(
    ApiErrorSchema.parse({
      code: 'DEPENDENCY_UNAVAILABLE',
      details: {},
      message: 'Authentication is temporarily unavailable.',
      requestId,
    }),
    {
      status: 503,
      headers: { 'cache-control': 'no-store', 'retry-after': '5' },
    },
  );
};

export const forwardAuthRequest = async (
  request: Request,
  binding: unknown,
  path: string,
  method: 'DELETE' | 'GET' | 'POST',
): Promise<Response> => {
  if (!isBinding(binding) || request.method !== method)
    return unavailable(request);
  const target = new URL(request.url);
  target.pathname = path;
  target.search = new URL(request.url).search;
  const headers = new Headers();
  for (const name of requestHeaders) {
    const value = request.headers.get(name);
    if (value !== null) headers.set(name, value);
  }
  let response: Response;
  try {
    response = await binding.fetch(
      new Request(target, {
        method,
        headers,
        redirect: 'manual',
        ...untouchedBodyInit(request, method),
      }),
    );
  } catch {
    return unavailable(request);
  }
  if (
    response.status >= 400 &&
    !response.headers.get('content-type')?.includes('application/json')
  ) {
    return unavailable(request);
  }
  const returnedHeaders = new Headers();
  response.headers.forEach((value, name) => {
    if (responseHeaders.has(name.toLowerCase()))
      returnedHeaders.append(name, value);
  });
  copyIdentityAuthorityCookies(response, returnedHeaders);
  return new Response(response.body, {
    status: response.status,
    headers: returnedHeaders,
  });
};

export const copyAuthCookies = copyIdentityAuthorityCookies;
