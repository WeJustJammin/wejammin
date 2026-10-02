import {
  ApiErrorSchema,
  CompositionInstanceResourceSchema,
  createRequestId,
  PatternInstanceHeadersSchema,
  PatternInstanceRequestSchema,
} from '@wejammin/contracts';

import {
  cmsEditorialBoundedRequestJson,
  cmsEditorialBoundedResponseJson,
} from './cms-editorial-platform-bounded';
import {
  CMS_EDITORIAL_PLATFORM_API_ORIGIN,
  cmsEditorialCopyResponseHeaders,
  cmsEditorialCsrfCookie,
  cmsEditorialForwardHeaders,
  cmsEditorialPrintableToken,
  cmsEditorialSameOriginRequest,
  isCmsEditorialPlatformBinding,
} from './cms-editorial-platform-shared';

const PATH = '/api/v1/cms/compositions/pattern-instances';
const ERROR_CODES = {
  400: 'INVALID_REQUEST',
  401: 'UNAUTHENTICATED',
  403: 'COMPOSITION_FORBIDDEN',
  404: 'COMPOSITION_NOT_FOUND',
  409: 'COMPOSITION_VERSION_CONFLICT',
  415: 'UNSUPPORTED_MEDIA_TYPE',
  422: 'COMPOSITION_VALIDATION_FAILED',
  429: 'RATE_LIMITED',
  500: 'INTERNAL_ERROR',
  502: 'DEPENDENCY_INVALID_RESPONSE',
  503: 'DEPENDENCY_UNAVAILABLE',
  504: 'DEPENDENCY_DEADLINE_EXCEEDED',
} as const;
type Status = keyof typeof ERROR_CODES;
const isStatus = (status: number): status is Status =>
  Object.hasOwn(ERROR_CODES, status);

const localError = (
  request: Request,
  status: Status,
  details: Readonly<Record<string, unknown>> = {},
  requestId = createRequestId(request.headers.get('x-request-id') ?? undefined),
  retryAfterSeconds?: number,
): Response => {
  const code = ERROR_CODES[status];
  const headers = new Headers({
    'cache-control': 'no-store',
    'content-type': 'application/json; charset=UTF-8',
    'x-request-id': requestId,
  });
  if (
    (status === 429 || status === 503 || status === 504) &&
    retryAfterSeconds !== undefined
  )
    headers.set('retry-after', String(retryAfterSeconds));
  return new Response(
    JSON.stringify(
      ApiErrorSchema.parse({
        code,
        message: `${code}: composition operation rejected or unavailable.`,
        requestId,
        details,
      }),
    ),
    { status, headers },
  );
};

const safeDetails = (
  status: Status,
  input: Readonly<Record<string, unknown>>,
): Record<string, unknown> => {
  if (status === 401) return { recoveryAction: 'reauthenticate' };
  if (status === 403)
    return input.reasonCode === 'CAPABILITY_REQUIRED'
      ? { reasonCode: 'CAPABILITY_REQUIRED' }
      : {};
  if (status === 409) {
    const output: Record<string, unknown> = {};
    for (const key of ['expectedVersion', 'currentVersion'] as const)
      if (typeof input[key] === 'string' && /^[1-9]\d{0,18}$/u.test(input[key]))
        output[key] = input[key];
    return output;
  }
  if (status === 429) {
    const output: Record<string, unknown> = {};
    for (const key of ['retryAfterSeconds', 'limit'] as const)
      if (
        typeof input[key] === 'number' &&
        Number.isSafeInteger(input[key]) &&
        input[key] >= 0
      )
        output[key] = input[key];
    if (typeof input.resetAt === 'string' && /^\d{1,13}$/u.test(input.resetAt))
      output.resetAt = input.resetAt;
    return output;
  }
  if (status === 502 || status === 503 || status === 504)
    return { dependencyClass: 'cms_composition', retryable: status !== 502 };
  return {};
};

const forwardedError = async (
  request: Request,
  upstream: Response,
): Promise<Response> => {
  if (!isStatus(upstream.status)) return localError(request, 502);
  const read = await cmsEditorialBoundedResponseJson(upstream);
  if (!read.ok) return localError(request, 502);
  const parsed = ApiErrorSchema.safeParse(read.value);
  if (
    !parsed.success ||
    parsed.data.code !== ERROR_CODES[upstream.status] ||
    parsed.data.message !==
      `${ERROR_CODES[upstream.status]}: composition operation rejected or unavailable.`
  )
    return localError(request, 502);
  const retry = Number(upstream.headers.get('retry-after'));
  return localError(
    request,
    upstream.status,
    safeDetails(upstream.status, parsed.data.details),
    parsed.data.requestId,
    Number.isSafeInteger(retry) && retry > 0 && retry <= 3600
      ? retry
      : undefined,
  );
};

/** First-party transport hygiene; assignment and pattern authority stay in the Worker. */
export const forwardCmsPatternInstanceMutation = async (
  request: Request,
  binding: unknown,
): Promise<Response> => {
  if (!isCmsEditorialPlatformBinding(binding)) return localError(request, 503);
  if (request.method !== 'POST' || new URL(request.url).search !== '')
    return localError(request, 400);
  if (!cmsEditorialSameOriginRequest(request)) return localError(request, 403);
  const csrfToken = request.headers.get('x-csrf-token');
  if (
    !cmsEditorialPrintableToken(csrfToken, 512) ||
    cmsEditorialCsrfCookie(request) !== csrfToken
  )
    return localError(request, 403);
  const media = request.headers.get('content-type')?.split(';')[0]?.trim();
  if (media !== 'application/json') return localError(request, 415);
  const headers = PatternInstanceHeadersSchema.safeParse({
    contentType: media,
    idempotencyKey: request.headers.get('idempotency-key') ?? undefined,
    ifMatch: request.headers.get('if-match') ?? undefined,
  });
  if (!headers.success) return localError(request, 400);
  const read = await cmsEditorialBoundedRequestJson(request);
  if (!read.ok) return localError(request, 400);
  const body = PatternInstanceRequestSchema.safeParse(read.value);
  if (!body.success) return localError(request, 422);
  if (headers.data.ifMatch !== `"${body.data.expectedVersion}"`)
    return localError(request, 400);

  const forwardHeaders = cmsEditorialForwardHeaders(request);
  forwardHeaders.set('content-type', 'application/json');
  forwardHeaders.set('x-csrf-token', csrfToken as string);
  forwardHeaders.set('idempotency-key', headers.data.idempotencyKey);
  forwardHeaders.set('if-match', headers.data.ifMatch);
  let upstream: Response;
  try {
    upstream = await binding.fetch(
      new Request(`${CMS_EDITORIAL_PLATFORM_API_ORIGIN}${PATH}`, {
        method: 'POST',
        headers: forwardHeaders,
        body: JSON.stringify(body.data),
      }),
    );
  } catch {
    return localError(request, 503);
  }
  if (!(upstream instanceof Response)) return localError(request, 503);
  if (!upstream.ok) return forwardedError(request, upstream);
  if (upstream.status !== 201) return localError(request, 502);
  const responseBody = await cmsEditorialBoundedResponseJson(upstream);
  if (!responseBody.ok) return localError(request, 502);
  const parsed = CompositionInstanceResourceSchema.safeParse(
    responseBody.value,
  );
  if (
    !parsed.success ||
    parsed.data.revisionId !== body.data.revisionId ||
    parsed.data.path !== body.data.slotPath ||
    parsed.data.patternId !== body.data.patternId ||
    parsed.data.patternVersion !== body.data.patternVersion ||
    parsed.data.linkMode !== body.data.linkMode ||
    (body.data.blockRegistryDigest !== undefined &&
      parsed.data.blockRegistryDigest !== body.data.blockRegistryDigest) ||
    upstream.headers.get('etag') !== `"${parsed.data.version}"`
  )
    return localError(request, 502);
  const responseHeaders = cmsEditorialCopyResponseHeaders(upstream);
  responseHeaders.set('content-type', 'application/json; charset=UTF-8');
  return new Response(JSON.stringify(parsed.data), {
    status: 201,
    headers: responseHeaders,
  });
};
