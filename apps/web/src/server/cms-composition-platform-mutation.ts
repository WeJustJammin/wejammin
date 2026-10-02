import {
  ApiErrorSchema,
  createRequestId,
  TemplateVersionHeadersSchema,
  TemplateVersionRequestSchema,
  TemplateVersionResourceSchema,
} from '@wejammin/contracts';
import type {
  TemplateVersionRequest,
  TemplateVersionResource,
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

export const CMS_TEMPLATE_DEFINE_PATH = '/api/v1/cms/templates/versions';

const ERROR_CODES = {
  400: 'INVALID_REQUEST',
  401: 'UNAUTHENTICATED',
  403: 'TEMPLATE_FORBIDDEN',
  404: 'TEMPLATE_NOT_FOUND',
  409: 'TEMPLATE_VERSION_CONFLICT',
  415: 'UNSUPPORTED_MEDIA_TYPE',
  422: 'TEMPLATE_VALIDATION_FAILED',
  429: 'RATE_LIMITED',
  500: 'INTERNAL_ERROR',
  502: 'DEPENDENCY_INVALID_RESPONSE',
  503: 'DEPENDENCY_UNAVAILABLE',
  504: 'DEPENDENCY_DEADLINE_EXCEEDED',
} as const;
type Status = keyof typeof ERROR_CODES;
const SAFE_VIOLATION_CODES = new Set([
  'template_key_invalid',
  'slot_key_invalid',
  'block_reference_duplicate',
  'protected_region_position_invalid',
  'reserved_region_duplicate',
  'audience_invalid',
  'compatible_type_duplicate',
  'template_slot_duplicate',
]);

export const localError = (request: Request, status: Status): Response => {
  const code = ERROR_CODES[status];
  const requestId = createRequestId(
    request.headers.get('x-request-id') ?? undefined,
  );
  const headers = new Headers({
    'cache-control': 'no-store',
    'x-request-id': requestId,
  });
  if (status === 429 || status === 503 || status === 504)
    headers.set('retry-after', '5');
  return Response.json(
    ApiErrorSchema.parse({
      code,
      message: `${code}: template operation rejected or unavailable.`,
      requestId,
      details: {},
    }),
    { status, headers },
  );
};

const safeDetails = (
  status: Status,
  details: Readonly<Record<string, unknown>>,
): Record<string, unknown> => {
  if (status === 401) return { recoveryAction: 'reauthenticate' };
  if (status === 400 || status === 422) {
    if (!Array.isArray(details.violations)) return {};
    return {
      violations: details.violations.slice(0, 50).flatMap((candidate) => {
        if (
          typeof candidate !== 'object' ||
          candidate === null ||
          Array.isArray(candidate)
        )
          return [];
        const value = candidate as Readonly<Record<string, unknown>>;
        return [
          {
            path:
              typeof value.path === 'string' ? value.path.slice(0, 256) : '/',
            code:
              typeof value.code === 'string' &&
              SAFE_VIOLATION_CODES.has(value.code)
                ? value.code
                : 'invalid',
            message: 'The value is invalid.',
          },
        ];
      }),
    };
  }
  if (status === 403)
    return details.reasonCode === 'CAPABILITY_REQUIRED'
      ? { reasonCode: 'CAPABILITY_REQUIRED' }
      : {};
  if (status === 409) {
    const output: Record<string, unknown> = {};
    for (const key of ['expectedVersion', 'currentVersion'] as const)
      if (
        typeof details[key] === 'string' &&
        /^[1-9]\d{0,18}$/u.test(details[key])
      )
        output[key] = details[key];
    return output;
  }
  if (status === 429) {
    const output: Record<string, unknown> = {};
    for (const key of ['retryAfterSeconds', 'limit', 'resetAt'] as const)
      if (
        typeof details[key] === 'number' &&
        Number.isSafeInteger(details[key]) &&
        details[key] >= 0
      )
        output[key] = details[key];
    return output;
  }
  if (status === 502 || status === 503 || status === 504)
    return { dependencyClass: 'cms_composition', retryable: status !== 502 };
  return {};
};

export const forwardedError = async (
  request: Request,
  upstream: Response,
): Promise<Response> => {
  const status = upstream.status;
  if (!Object.hasOwn(ERROR_CODES, status)) return localError(request, 502);
  const checkedStatus = status as Status;
  const body = await cmsEditorialBoundedResponseJson(upstream);
  if (!body.ok) return localError(request, 502);
  const parsed = ApiErrorSchema.safeParse(body.value);
  if (
    !parsed.success ||
    parsed.data.code !== ERROR_CODES[checkedStatus] ||
    parsed.data.message !==
      `${ERROR_CODES[checkedStatus]}: template operation rejected or unavailable.`
  )
    return localError(request, 502);
  const headers = cmsEditorialCopyResponseHeaders(upstream);
  headers.set('x-request-id', parsed.data.requestId);
  const retryAfter = headers.get('retry-after');
  if (
    retryAfter !== null &&
    (!/^[1-9]\d{0,4}$/u.test(retryAfter) || ![429, 503, 504].includes(status))
  )
    headers.delete('retry-after');
  return new Response(
    JSON.stringify(
      ApiErrorSchema.parse({
        ...parsed.data,
        details: safeDetails(checkedStatus, parsed.data.details),
      }),
    ),
    { status, headers },
  );
};

const matchesRequest = (
  resource: TemplateVersionResource,
  body: TemplateVersionRequest,
): boolean =>
  resource.state === 'draft' &&
  resource.templateKey === body.templateKey &&
  resource.version === String(resource.templateVersion) &&
  BigInt(resource.version) === BigInt(body.expectedVersion ?? '0') + 1n &&
  resource.compatibleTypeIds.join('\u0000') ===
    body.compatibleTypeIds.join('\u0000') &&
  resource.reservedRegions.join('\u0000') ===
    body.reservedRegions.join('\u0000') &&
  (body.blockRegistryDigest === undefined ||
    resource.blockRegistryDigest === body.blockRegistryDigest);

/** First-party transport hygiene only; the Worker owns designer authorization. */
export const forwardCmsTemplateDefineMutation = async (
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
  const headers = TemplateVersionHeadersSchema.safeParse({
    contentType: media,
    idempotencyKey: request.headers.get('idempotency-key') ?? undefined,
    ifMatch: request.headers.get('if-match') ?? undefined,
  });
  if (!headers.success) return localError(request, 400);
  const read = await cmsEditorialBoundedRequestJson(request);
  if (!read.ok) return localError(request, 400);
  const body = TemplateVersionRequestSchema.safeParse(read.value);
  if (!body.success) return localError(request, 422);
  const ifMatch =
    headers.data.ifMatch === undefined
      ? null
      : headers.data.ifMatch.slice(1, -1);
  if (
    (body.data.expectedVersion === null) !== (ifMatch === null) ||
    (ifMatch !== null && body.data.expectedVersion !== ifMatch)
  )
    return localError(request, 400);
  const forwardHeaders = cmsEditorialForwardHeaders(request);
  forwardHeaders.set('content-type', 'application/json');
  forwardHeaders.set('x-csrf-token', csrfToken as string);
  forwardHeaders.set('idempotency-key', headers.data.idempotencyKey);
  if (headers.data.ifMatch !== undefined)
    forwardHeaders.set('if-match', headers.data.ifMatch);
  let upstream: Response;
  try {
    upstream = await binding.fetch(
      new Request(
        `${CMS_EDITORIAL_PLATFORM_API_ORIGIN}${CMS_TEMPLATE_DEFINE_PATH}`,
        {
          method: 'POST',
          headers: forwardHeaders,
          body: JSON.stringify(body.data),
        },
      ),
    );
  } catch {
    return localError(request, 503);
  }
  if (!(upstream instanceof Response)) return localError(request, 503);
  if (!upstream.ok) return forwardedError(request, upstream);
  if (upstream.status !== 201) return localError(request, 502);
  const resource = await cmsEditorialBoundedResponseJson(upstream);
  if (!resource.ok) return localError(request, 502);
  const parsed = TemplateVersionResourceSchema.safeParse(resource.value);
  if (
    !parsed.success ||
    !matchesRequest(parsed.data, body.data) ||
    upstream.headers.get('etag') !== `"${parsed.data.version}"`
  )
    return localError(request, 502);
  const responseHeaders = cmsEditorialCopyResponseHeaders(upstream);
  responseHeaders.set('content-type', 'application/json; charset=utf-8');
  return new Response(JSON.stringify(parsed.data), {
    status: 201,
    headers: responseHeaders,
  });
};
