import {
  ApiErrorSchema,
  CMS_BLOCK_RULES_REASON,
  CMS_SLICE_12_OPERATION_REASONS,
  CmsSlice12ReasonCodeSchema,
  CmsVersionSchema,
  cmsBlockRulesDetails,
  cmsCompositionCatalogMessage,
  cmsSlice12ReasonStatus,
  createRequestId,
} from '@wejammin/contracts';

import {
  compositionDependencyDetails,
  isCompositionDependencyStatus,
} from './cms-composition-platform-dependency';
import { forbiddenDetails } from './cms-composition-platform-capability';
import { patternInstanceViolations } from './cms-composition-platform-pattern-details';
import { cmsEditorialBoundedResponseJson } from './cms-editorial-platform-bounded';
import { relayedResetAt } from './rate-limit-reset-at';

/*
 * The shared error edge of the CMS-03C-13, -14, -15, cmsCompositionInstancesRead and cmsPatternNestableRead first-party proxies (BE03c composition catalog, FE03 1599-1616).
 * An upstream refusal is relayed only when its code is the catalog code of its status; its details are rebuilt from an
 * allowlist (one typed reason of the operation's own list on the status that list gives it, bounded violations, the
 * version pair of a plain 409, quota members) and everything else is dropped, never repaired.
 */
export type CompositionInstancesOperation =
  | 'CMS-03C-13'
  | 'CMS-03C-14'
  | 'CMS-03C-15'
  | 'cmsCompositionInstancesRead'
  | 'cmsPatternNestableRead';

const CODES = {
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
export type CompositionInstancesStatus = keyof typeof CODES;
export const isCompositionInstancesStatus = (
  status: number,
): status is CompositionInstancesStatus => Object.hasOwn(CODES, status);

export const compositionInstancesError = (
  request: Request,
  status: CompositionInstancesStatus,
  details: Readonly<Record<string, unknown>> = isCompositionDependencyStatus(
    status,
  )
    ? { ...compositionDependencyDetails() }
    : {},
  requestId = createRequestId(request.headers.get('x-request-id') ?? undefined),
  retryAfterSeconds?: number,
): Response => {
  const code = CODES[status];
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
        message: cmsCompositionCatalogMessage('composition', code),
        requestId,
        details,
      }),
    ),
    { status, headers },
  );
};

const typedReason = (
  operation: CompositionInstancesOperation,
  status: number,
  source: Readonly<Record<string, unknown>>,
): string | null => {
  if (status !== 409 && status !== 422) return null;
  const parsed = CmsSlice12ReasonCodeSchema.safeParse(source.reasonCode);
  return parsed.success &&
    cmsSlice12ReasonStatus(parsed.data) === status &&
    (CMS_SLICE_12_OPERATION_REASONS[operation] as readonly string[]).includes(
      parsed.data,
    )
    ? parsed.data
    : null;
};

const quotaDetails = (
  source: Readonly<Record<string, unknown>>,
): Record<string, unknown> => {
  const output: Record<string, unknown> = {};
  for (const key of ['retryAfterSeconds', 'limit'] as const)
    if (
      typeof source[key] === 'number' &&
      Number.isSafeInteger(source[key]) &&
      source[key] >= 0
    )
      output[key] = source[key];
  const resetAt = relayedResetAt(source.resetAt, 'epoch-string');
  if (resetAt !== null) output.resetAt = resetAt;
  return output;
};

const safeDetails = (
  operation: CompositionInstancesOperation,
  status: CompositionInstancesStatus,
  source: Readonly<Record<string, unknown>>,
): Record<string, unknown> => {
  if (status === 401) return { recoveryAction: 'reauthenticate' };
  if (status === 403) return forbiddenDetails(operation, source);
  const reason = typedReason(operation, status, source);
  // DEC-210: the one reason that keeps its /instances/{i}[/choices] violation (CMS-03C-15 only).
  if (reason === CMS_BLOCK_RULES_REASON)
    return { ...cmsBlockRulesDetails(source, 'CMS-03C-15') };
  if (reason !== null) return { reasonCode: reason };
  if (status === 422) {
    const violations = patternInstanceViolations(source);
    return violations.length > 0 ? { violations } : {};
  }
  if (status === 409) {
    const output: Record<string, unknown> = {};
    for (const key of ['expectedVersion', 'currentVersion'] as const)
      if (CmsVersionSchema.safeParse(source[key]).success)
        output[key] = source[key];
    return output;
  }
  if (status === 429) return quotaDetails(source);
  if (isCompositionDependencyStatus(status))
    return { ...compositionDependencyDetails() };
  return {};
};

/** The upstream refusal as the first-party refusal, or a local 502 when it is not a catalog answer. */
export const forwardedCompositionInstancesError = async (
  request: Request,
  upstream: Response,
  operation: CompositionInstancesOperation,
): Promise<Response> => {
  if (!isCompositionInstancesStatus(upstream.status))
    return compositionInstancesError(request, 502);
  const read = await cmsEditorialBoundedResponseJson(upstream);
  if (!read.ok) return compositionInstancesError(request, 502);
  const parsed = ApiErrorSchema.safeParse(read.value);
  if (
    !parsed.success ||
    parsed.data.code !== CODES[upstream.status] ||
    parsed.data.message !==
      cmsCompositionCatalogMessage('composition', CODES[upstream.status])
  )
    return compositionInstancesError(request, 502);
  const retry = Number(upstream.headers.get('retry-after'));
  return compositionInstancesError(
    request,
    upstream.status,
    safeDetails(operation, upstream.status, parsed.data.details),
    parsed.data.requestId,
    Number.isSafeInteger(retry) && retry > 0 && retry <= 3600
      ? retry
      : undefined,
  );
};
