import {
  ApiErrorSchema,
  CMS_BLOCK_RULES_REASON,
  cmsBlockRulesDetails,
  createRequestId,
  PatternInstanceHeadersSchema,
  PatternInstanceRequestSchema,
  PatternPlacementResourceSchema,
  PatternNodePathSchema,
  QuotedVersionSchema,
} from '@wejammin/contracts';
import type {
  CompositionInstanceResource,
  PatternInstanceRequest,
} from '@wejammin/contracts';

import {
  compositionDependencyDetails,
  isCompositionDependencyStatus,
} from './cms-composition-platform-dependency';
import {
  patternInstanceReason,
  patternInstanceViolations,
} from './cms-composition-platform-pattern-details';
import {
  cmsEditorialBoundedRequestJson,
  cmsEditorialBoundedResponseJson,
  cmsPatternPlacementBoundedResponseJson,
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
import { relayedResetAt } from './rate-limit-reset-at';

const PATH = '/api/v1/cms/compositions/pattern-instances';
/** DEC-186: a placement row path is at most 248 UTF-8 octets. */
const PLACEMENT_ROW_PATH_MAX_OCTETS = 248;
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
  502: 'DEPENDENCY_UNAVAILABLE',
  503: 'DEPENDENCY_UNAVAILABLE',
  504: 'DEPENDENCY_UNAVAILABLE',
} as const;
type Status = keyof typeof ERROR_CODES;
const isStatus = (status: number): status is Status =>
  Object.hasOwn(ERROR_CODES, status);

const localError = (
  request: Request,
  status: Status,
  details: Readonly<Record<string, unknown>> = isCompositionDependencyStatus(
    status,
  )
    ? { ...compositionDependencyDetails() }
    : {},
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
  const reason = patternInstanceReason(status, input);
  // DEC-210: the one reason that keeps its /roots or /patternVersion violation.
  if (reason === CMS_BLOCK_RULES_REASON)
    return { ...cmsBlockRulesDetails(input, 'CMS-03C-02') };
  if (reason !== null) return { reasonCode: reason };
  if (status === 403) return {};
  if (status === 422) {
    const violations = patternInstanceViolations(input);
    return violations.length > 0 ? { violations } : {};
  }
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
    const resetAt = relayedResetAt(input.resetAt, 'epoch-string');
    if (resetAt !== null) output.resetAt = resetAt;
    return output;
  }
  if (isCompositionDependencyStatus(status))
    return { ...compositionDependencyDetails() };
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

const utf8ByteLength = (value: string): number =>
  new TextEncoder().encode(value).byteLength;

/**
 * The response is valid only when it matches the request it answers: every row
 * is pinned to the request revision, pattern, pattern version and link mode,
 * carries the request digest when the request pinned one, has a row path that
 * descends from the request `slotPath` within 248 UTF-8 octets (DEC-186), and
 * has unique ids and paths (DEC-175, DEC-181). The rows stay in the producer's
 * `position` order, constrained to strictly increasing, possibly sparse
 * positions (DEC-193). Selected roots bind the exact full-path set, not order.
 */
const matchesPlacementRequest = (
  items: readonly CompositionInstanceResource[],
  body: PatternInstanceRequest,
): boolean => {
  const ids = new Set<string>();
  const paths = new Set<string>();
  // The root slotPath '/' contributes no prefix; every other slotPath is the
  // literal prefix, so a row path must carry the exact prefix and a non-empty
  // node chain. The suffix must be a normalized node path (DEC-175/DEC-186), so
  // a bare slot path, '/main/../x', a doubled or trailing separator all fail.
  const prefix = body.slotPath === '/' ? '' : body.slotPath;
  const selectedPaths =
    body.roots === undefined
      ? undefined
      : new Set(body.roots.map((root) => prefix + root));
  if (selectedPaths !== undefined && items.length !== selectedPaths.size)
    return false;
  for (const row of items) {
    const suffix = row.path.slice(prefix.length);
    if (
      (selectedPaths !== undefined && !selectedPaths.has(row.path)) ||
      !row.path.startsWith(prefix + '/') ||
      !PatternNodePathSchema.safeParse(suffix).success ||
      row.revisionId !== body.revisionId ||
      row.patternId !== body.patternId ||
      row.patternVersion !== body.patternVersion ||
      row.linkMode !== body.linkMode ||
      (body.blockRegistryDigest !== undefined &&
        row.blockRegistryDigest !== body.blockRegistryDigest) ||
      utf8ByteLength(row.path) > PLACEMENT_ROW_PATH_MAX_OCTETS ||
      ids.has(row.id) ||
      paths.has(row.path)
    )
      return false;
    ids.add(row.id);
    paths.add(row.path);
  }
  return true;
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
  // DEC-188/DEC-189: this operation's decoded success response is the one
  // response ceiling exception at 1 MiB; the request and every other response
  // stay at 256 KiB.
  const responseBody = await cmsPatternPlacementBoundedResponseJson(upstream);
  if (!responseBody.ok) return localError(request, 502);
  const parsed = PatternPlacementResourceSchema.safeParse(responseBody.value);
  // BE00 version grammar: the strong ETag is the entry aggregate version the
  // If-Match named, so it is a valid strong decimal tag, not any row version.
  const etag = upstream.headers.get('etag');
  if (
    !parsed.success ||
    !matchesPlacementRequest(parsed.data.items, body.data) ||
    etag === null ||
    !QuotedVersionSchema.safeParse(etag).success
  )
    return localError(request, 502);
  const responseHeaders = cmsEditorialCopyResponseHeaders(upstream);
  responseHeaders.set('content-type', 'application/json; charset=UTF-8');
  return new Response(JSON.stringify(parsed.data), {
    status: 201,
    headers: responseHeaders,
  });
};
