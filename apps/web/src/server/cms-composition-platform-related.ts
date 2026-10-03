import {
  ApiErrorSchema,
  CmsVersionSchema,
  createRequestId,
  RelatedContentHeadersSchema,
  RelatedContentPathSchema,
  RelatedContentResourceSchema,
  RelatedContentRuleRequestSchema,
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
import { relayedResetAt } from './rate-limit-reset-at';

const RELATED_CONTENT_CODES = {
  400: 'INVALID_REQUEST',
  401: 'UNAUTHENTICATED',
  403: 'RELATED_CONTENT_FORBIDDEN',
  404: 'RELATED_CONTENT_NOT_FOUND',
  409: 'RELATED_CONTENT_VERSION_CONFLICT',
  415: 'UNSUPPORTED_MEDIA_TYPE',
  422: 'RELATED_CONTENT_VALIDATION_FAILED',
  429: 'RATE_LIMITED',
  500: 'INTERNAL_ERROR',
  502: 'DEPENDENCY_INVALID_RESPONSE',
  503: 'DEPENDENCY_UNAVAILABLE',
  504: 'DEPENDENCY_DEADLINE_EXCEEDED',
} as const;
type RelatedContentStatus = keyof typeof RELATED_CONTENT_CODES;
const isRelatedContentStatus = (
  status: number,
): status is RelatedContentStatus =>
  Object.hasOwn(RELATED_CONTENT_CODES, status);

const relatedContentError = (
  request: Request,
  status: RelatedContentStatus,
  details: Record<string, unknown> = {},
  requestId = createRequestId(request.headers.get('x-request-id') ?? undefined),
  retryAfterSeconds?: number,
): Response => {
  const code = RELATED_CONTENT_CODES[status];
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
        message: `${code}: related-content operation rejected or unavailable.`,
        requestId,
        details,
      }),
    ),
    { status, headers },
  );
};

const safeErrorDetails = (
  status: RelatedContentStatus,
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
    return details;
  }
  if (status === 429) {
    const details: Record<string, unknown> = {};
    for (const key of ['retryAfterSeconds', 'limit'] as const)
      if (
        typeof value[key] === 'number' &&
        Number.isSafeInteger(value[key]) &&
        value[key] >= 0
      )
        details[key] = value[key];
    const resetAt = relayedResetAt(value.resetAt, 'epoch-number');
    if (resetAt !== null) details.resetAt = resetAt;
    return details;
  }
  if (status === 502 || status === 503 || status === 504)
    return { dependencyClass: 'cms_composition', retryable: status !== 502 };
  return {};
};

const forwardedRelatedContentError = async (
  request: Request,
  upstream: Response,
): Promise<Response> => {
  if (!isRelatedContentStatus(upstream.status))
    return relatedContentError(request, 502);
  const parsedBody = await cmsEditorialBoundedResponseJson(upstream);
  if (!parsedBody.ok) return relatedContentError(request, 502);
  const parsed = ApiErrorSchema.safeParse(parsedBody.value);
  if (
    !parsed.success ||
    parsed.data.code !== RELATED_CONTENT_CODES[upstream.status]
  )
    return relatedContentError(request, 502);
  const details = safeErrorDetails(upstream.status, parsed.data.details);
  const retry = Number(upstream.headers.get('retry-after'));
  return relatedContentError(
    request,
    upstream.status,
    details,
    parsed.data.requestId,
    Number.isSafeInteger(retry) && retry > 0 && retry <= 3600
      ? retry
      : undefined,
  );
};

/** First-party CMS-03C-05 transport. The protected Worker derives all authority. */
export const forwardCmsRelatedContentMutation = async (
  request: Request,
  entryId: string | undefined,
  binding: unknown,
): Promise<Response> => {
  if (!isCmsEditorialPlatformBinding(binding) || request.method !== 'POST')
    return relatedContentError(request, 503);
  if (!cmsEditorialSameOriginRequest(request))
    return relatedContentError(request, 403);
  const path = RelatedContentPathSchema.safeParse({ entryId });
  if (!path.success || new URL(request.url).search !== '')
    return relatedContentError(request, 400);

  const csrfToken = request.headers.get('x-csrf-token');
  if (
    !cmsEditorialPrintableToken(csrfToken, 512) ||
    cmsEditorialCsrfCookie(request) !== csrfToken
  )
    return relatedContentError(request, 403);
  const media = request.headers.get('content-type')?.split(';')[0]?.trim();
  if (media !== 'application/json') return relatedContentError(request, 415);
  const headers = RelatedContentHeadersSchema.safeParse({
    contentType: media,
    idempotencyKey: request.headers.get('idempotency-key') ?? undefined,
    ifMatch: request.headers.get('if-match') ?? undefined,
  });
  if (!headers.success) return relatedContentError(request, 400);
  const read = await cmsEditorialBoundedRequestJson(request);
  if (!read.ok) return relatedContentError(request, 400);
  const parsed = RelatedContentRuleRequestSchema.safeParse(read.value);
  if (!parsed.success) return relatedContentError(request, 422);
  if (
    parsed.data.entryId !== path.data.entryId ||
    headers.data.ifMatch !== `"${parsed.data.expectedVersion}"`
  )
    return relatedContentError(request, 400);

  const route = `/api/v1/cms/entries/${path.data.entryId}/related-content`;
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
    return relatedContentError(request, 503);
  }
  if (!(upstream instanceof Response)) return relatedContentError(request, 503);
  if (!upstream.ok) return forwardedRelatedContentError(request, upstream);
  if (upstream.status !== 201) return relatedContentError(request, 502);
  const responseBody = await cmsEditorialBoundedResponseJson(upstream);
  if (!responseBody.ok) return relatedContentError(request, 502);
  const validated = RelatedContentResourceSchema.safeParse(responseBody.value);
  const nextVersion = String(BigInt(parsed.data.expectedVersion) + 1n);
  if (!CmsVersionSchema.safeParse(nextVersion).success)
    return relatedContentError(request, 502);
  const expectedEtag = `"${nextVersion}"`;
  if (
    !validated.success ||
    validated.data.state !== 'active' ||
    validated.data.sourceEntryId !== path.data.entryId ||
    validated.data.pins.join('\u0000') !== parsed.data.pins.join('\u0000') ||
    validated.data.exclusions.join('\u0000') !==
      parsed.data.exclusions.join('\u0000') ||
    (validated.data.derivedRule === null) !==
      (parsed.data.derivedRule === null) ||
    upstream.headers.get('etag') !== expectedEtag
  )
    return relatedContentError(request, 502);
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
