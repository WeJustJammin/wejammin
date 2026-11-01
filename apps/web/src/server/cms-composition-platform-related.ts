import {
  ApiErrorSchema,
  CMS_SLICE_12_OPERATION_REASONS,
  CmsSlice12ReasonCodeSchema,
  CmsVersionSchema,
  createRequestId,
  RelatedContentHeadersSchema,
  RelatedContentPathSchema,
  RelatedContentResourceSchema,
  RelatedContentRuleRequestSchema,
  cmsSlice12ReasonStatus,
} from '@wejammin/contracts';

import { forbiddenDetails } from './cms-composition-platform-capability';
import { patternInstanceViolations } from './cms-composition-platform-pattern-details';
import {
  compositionDependencyDetails,
  isCompositionDependencyStatus,
} from './cms-composition-platform-dependency';
import {
  cmsEditorialBoundedRequestJson,
  cmsEditorialBoundedResponseJson,
} from './cms-editorial-platform-bounded';
import {
  CMS_EDITORIAL_PLATFORM_API_ORIGIN,
  cmsEditorialCsrfCookie,
  cmsEditorialForwardHeaders,
  cmsEditorialOutcomeUnknown,
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
  502: 'DEPENDENCY_UNAVAILABLE',
  503: 'DEPENDENCY_UNAVAILABLE',
  504: 'DEPENDENCY_UNAVAILABLE',
} as const;
type RelatedContentStatus = keyof typeof RELATED_CONTENT_CODES;
const isRelatedContentStatus = (
  status: number,
): status is RelatedContentStatus =>
  Object.hasOwn(RELATED_CONTENT_CODES, status);

export const relatedContentError = (
  request: Request,
  status: RelatedContentStatus,
  details: Record<string, unknown> = isCompositionDependencyStatus(status)
    ? { ...compositionDependencyDetails() }
    : {},
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

/** BE03c 1323: at most 16 row pointers cross back, as the Worker relay sends them. */
const MAX_RELATED_VIOLATIONS = 16;

/**
 * The typed 422 of CMS-03C-05 (BE03c 385-387, 1417): exactly one lowercase `reasonCode` of this operation's
 * list that carries status 422 (`related_target_ineligible`, `derived_rule_unknown`) and its bounded RFC 6901
 * pointers (`/pins/{n}`, `/exclusions/{n}`, `/derivedRule/...`) with the fixed message. A token of another
 * operation or status, any other member and any private text is dropped, never repaired.
 */
const validationDetails = (
  value: Record<string, unknown>,
): Record<string, unknown> => {
  const parsed = CmsSlice12ReasonCodeSchema.safeParse(value.reasonCode);
  const reasonCode =
    parsed.success &&
    cmsSlice12ReasonStatus(parsed.data) === 422 &&
    (
      CMS_SLICE_12_OPERATION_REASONS['CMS-03C-05'] as readonly string[]
    ).includes(parsed.data)
      ? parsed.data
      : null;
  const violations = patternInstanceViolations(value).slice(
    0,
    MAX_RELATED_VIOLATIONS,
  );
  return {
    ...(reasonCode === null ? {} : { reasonCode }),
    ...(reasonCode === null || violations.length === 0 ? {} : { violations }),
  };
};

const safeErrorDetails = (
  status: RelatedContentStatus,
  value: Record<string, unknown>,
): Record<string, unknown> => {
  if (status === 401) return { recoveryAction: 'reauthenticate' };
  if (status === 403) return forbiddenDetails('CMS-03C-05', value);
  if (status === 422) return validationDetails(value);
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
  if (isCompositionDependencyStatus(status))
    return { ...compositionDependencyDetails() };
  return {};
};

export const forwardedRelatedContentError = async (
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
  // A success the proxy cannot verify may still have committed (BE03c 1502): the marker keeps the browser's
  // Idempotency-Key and its identical replay (BE03b 1427; the taxonomy and pattern writes do the same).
  const unverified = (): Response =>
    cmsEditorialOutcomeUnknown(relatedContentError(request, 502));
  if (!upstream.ok) return forwardedRelatedContentError(request, upstream);
  if (upstream.status !== 201) return unverified();
  const responseBody = await cmsEditorialBoundedResponseJson(upstream);
  if (!responseBody.ok) return unverified();
  const validated = RelatedContentResourceSchema.safeParse(responseBody.value);
  const nextVersion = String(BigInt(parsed.data.expectedVersion) + 1n);
  if (!CmsVersionSchema.safeParse(nextVersion).success) return unverified();
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
    return unverified();
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
