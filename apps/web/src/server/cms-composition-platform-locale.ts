import {
  ApiErrorSchema,
  CmsVersionSchema,
  createRequestId,
  LocaleFallbackChainMismatchDetailsSchema,
  LocaleVariantHeadersSchema,
  LocaleVariantPathSchema,
  LocaleVariantRequestSchema,
  LocaleVariantResourceSchema,
} from '@wejammin/contracts';

import {
  cmsEditorialBoundedRequestJson,
  cmsEditorialBoundedResponseJson,
} from './cms-editorial-platform-bounded';
import {
  CMS_EDITORIAL_PLATFORM_API_ORIGIN,
  cmsEditorialCsrfCookie,
  cmsEditorialForwardHeaders,
  cmsEditorialPrintableToken,
  cmsEditorialSameOriginRequest,
  isCmsEditorialPlatformBinding,
} from './cms-editorial-platform-shared';

const LOCALE_CODES = {
  400: 'INVALID_REQUEST',
  401: 'UNAUTHENTICATED',
  403: 'LOCALE_FORBIDDEN',
  404: 'LOCALE_SOURCE_NOT_FOUND',
  409: 'LOCALE_VERSION_CONFLICT',
  415: 'UNSUPPORTED_MEDIA_TYPE',
  422: 'LOCALE_VALIDATION_FAILED',
  429: 'RATE_LIMITED',
  500: 'INTERNAL_ERROR',
  502: 'DEPENDENCY_INVALID_RESPONSE',
  503: 'DEPENDENCY_UNAVAILABLE',
  504: 'DEPENDENCY_DEADLINE_EXCEEDED',
} as const;
type LocaleStatus = keyof typeof LOCALE_CODES;
const isLocaleStatus = (status: number): status is LocaleStatus =>
  Object.hasOwn(LOCALE_CODES, status);

const localeError = (
  request: Request,
  status: LocaleStatus,
  details: Record<string, unknown> = {},
  requestId = createRequestId(request.headers.get('x-request-id') ?? undefined),
  retryAfterSeconds?: number,
): Response => {
  const code = LOCALE_CODES[status];
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
        message: `${code}: locale operation rejected or unavailable.`,
        requestId,
        details,
      }),
    ),
    { status, headers },
  );
};

const safeErrorDetails = (
  status: LocaleStatus,
  value: Record<string, unknown>,
): Record<string, unknown> => {
  if (status === 401) return { recoveryAction: 'reauthenticate' };
  if (status === 403)
    return value.reasonCode === 'CAPABILITY_REQUIRED'
      ? { reasonCode: 'CAPABILITY_REQUIRED' }
      : {};
  if (status === 409) {
    const details: Record<string, unknown> = {};
    for (const key of ['expectedVersion', 'currentVersion'] as const)
      if (CmsVersionSchema.safeParse(value[key]).success)
        details[key] = value[key];
    // OD-4: the active chain accompanies only the exact mismatch reason.
    const mismatch = LocaleFallbackChainMismatchDetailsSchema.safeParse({
      reasonCode: value.reasonCode,
      activeFallbackChain: value.activeFallbackChain,
    });
    if (mismatch.success) {
      details.reasonCode = mismatch.data.reasonCode;
      details.activeFallbackChain = [...mismatch.data.activeFallbackChain];
    }
    return details;
  }
  if (status === 429) {
    const details: Record<string, unknown> = {};
    for (const key of ['retryAfterSeconds', 'limit', 'resetAt'] as const)
      if (
        typeof value[key] === 'number' &&
        Number.isSafeInteger(value[key]) &&
        value[key] >= 0
      )
        details[key] = value[key];
    return details;
  }
  if (status === 502 || status === 503 || status === 504)
    return { dependencyClass: 'cms_composition', retryable: status !== 502 };
  return {};
};

const forwardedLocaleError = async (
  request: Request,
  upstream: Response,
): Promise<Response> => {
  if (!isLocaleStatus(upstream.status)) return localeError(request, 502);
  const parsedBody = await cmsEditorialBoundedResponseJson(upstream);
  if (!parsedBody.ok) return localeError(request, 502);
  const parsed = ApiErrorSchema.safeParse(parsedBody.value);
  if (!parsed.success || parsed.data.code !== LOCALE_CODES[upstream.status])
    return localeError(request, 502);
  const details = safeErrorDetails(upstream.status, parsed.data.details);
  const retry = Number(upstream.headers.get('retry-after'));
  return localeError(
    request,
    upstream.status,
    details,
    parsed.data.requestId,
    Number.isSafeInteger(retry) && retry > 0 && retry <= 3600
      ? retry
      : undefined,
  );
};

/** First-party CMS-15 transport. The protected Worker derives all authority. */
export const forwardCmsLocaleVariantMutation = async (
  request: Request,
  entryId: string | undefined,
  locale: string | undefined,
  binding: unknown,
): Promise<Response> => {
  if (!isCmsEditorialPlatformBinding(binding) || request.method !== 'POST')
    return localeError(request, 503);
  if (!cmsEditorialSameOriginRequest(request)) return localeError(request, 403);
  const path = LocaleVariantPathSchema.safeParse({ entryId, locale });
  if (!path.success || new URL(request.url).search !== '')
    return localeError(request, 400);

  const csrfToken = request.headers.get('x-csrf-token');
  if (
    !cmsEditorialPrintableToken(csrfToken, 512) ||
    cmsEditorialCsrfCookie(request) !== csrfToken
  )
    return localeError(request, 403);
  const media = request.headers.get('content-type')?.split(';')[0]?.trim();
  if (media !== 'application/json') return localeError(request, 415);
  const headers = LocaleVariantHeadersSchema.safeParse({
    contentType: media,
    idempotencyKey: request.headers.get('idempotency-key') ?? undefined,
    ifMatch: request.headers.get('if-match') ?? undefined,
  });
  if (!headers.success) return localeError(request, 400);
  const read = await cmsEditorialBoundedRequestJson(request);
  if (!read.ok) return localeError(request, 400);
  const parsed = LocaleVariantRequestSchema.safeParse(read.value);
  if (!parsed.success) return localeError(request, 422);
  if (
    parsed.data.entryId !== path.data.entryId ||
    parsed.data.locale !== path.data.locale ||
    headers.data.ifMatch !== `"${parsed.data.expectedVersion}"`
  )
    return localeError(request, 400);

  const route = `/api/v1/cms/entries/${path.data.entryId}/locales/${encodeURIComponent(path.data.locale)}/variants`;
  const forwardedHeaders = cmsEditorialForwardHeaders(request);
  forwardedHeaders.set('content-type', 'application/json');
  forwardedHeaders.set('x-csrf-token', csrfToken as string);
  forwardedHeaders.set('idempotency-key', headers.data.idempotencyKey);
  forwardedHeaders.set('if-match', headers.data.ifMatch);
  let upstream: Response;
  try {
    upstream = await binding.fetch(
      new Request(`${CMS_EDITORIAL_PLATFORM_API_ORIGIN}${route}`, {
        method: 'POST',
        headers: forwardedHeaders,
        body: JSON.stringify(parsed.data),
      }),
    );
  } catch {
    return localeError(request, 503);
  }
  if (!(upstream instanceof Response)) return localeError(request, 503);
  if (!upstream.ok) return forwardedLocaleError(request, upstream);
  if (upstream.status !== 201) return localeError(request, 502);
  const responseBody = await cmsEditorialBoundedResponseJson(upstream);
  if (!responseBody.ok) return localeError(request, 502);
  const validated = LocaleVariantResourceSchema.safeParse(responseBody.value);
  const nextVersion = String(BigInt(parsed.data.expectedVersion) + 1n);
  if (!CmsVersionSchema.safeParse(nextVersion).success)
    return localeError(request, 502);
  const expectedEtag = `"${nextVersion}"`;
  if (
    !validated.success ||
    validated.data.state !== 'draft' ||
    validated.data.entryId !== path.data.entryId ||
    validated.data.locale !== path.data.locale ||
    validated.data.sourceRevisionId !== parsed.data.sourceRevisionId ||
    validated.data.fallbackChain.join('\u0000') !==
      parsed.data.fallbackChain.join('\u0000') ||
    validated.data.noFallbackFieldIds.join('\u0000') !==
      parsed.data.noFallbackFieldIds.join('\u0000') ||
    upstream.headers.get('etag') !== expectedEtag
  )
    return localeError(request, 502);
  return new Response(JSON.stringify(validated.data), {
    status: 201,
    headers: {
      'cache-control': 'no-store',
      'content-type': 'application/json; charset=UTF-8',
      etag: expectedEtag,
      'x-request-id': createRequestId(
        upstream.headers.get('x-request-id') ?? undefined,
      ),
    },
  });
};
