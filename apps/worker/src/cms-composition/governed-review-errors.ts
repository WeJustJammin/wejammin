import {
  ApiErrorSchema,
  CanonicalDomainSchema,
  CMS_SLICE_12_OPERATION_REASONS,
  CmsSlice12ReasonCodeSchema,
  cmsSlice12ReasonStatus,
  cmsCompositionCatalogCode,
  cmsCompositionCatalogMessage,
} from '@wejammin/contracts';
import { MFA_METHOD_REGISTRY } from '../authentication/step-up';
import {
  governedTimeDetails,
  isGovernedTimeReason,
} from './governed-activation-time-details';
import { governedHeaders } from './governed-review-http';
import { mediaTypeDetails } from './media-type-details';
import {
  governedResponseLimit,
  serializedBytesWithin,
  type CmsGovernedReviewDependencies,
  type GovernedError,
} from './governed-review-ports';
import { policyOf, type GovernedOperation } from './governed-review-policy';
import { noteRefusal } from './observability-facts';

const STEP_UP = 'STEP_UP_REQUIRED';

/** A body-schema failure may name only the operation's request pointers; the rest is attacker text. */
const safeViolations = (
  operation: GovernedOperation,
  source: unknown,
): readonly Record<string, string>[] => {
  if (!Array.isArray(source)) return [];
  const pointers = policyOf(operation).pointers;
  const seen = new Set<string>();
  const output: Record<string, string>[] = [];
  for (const item of source.slice(0, 50) as unknown[]) {
    const path =
      typeof item === 'object' &&
      item !== null &&
      'path' in item &&
      typeof item.path === 'string' &&
      pointers.has(item.path)
        ? item.path
        : '/';
    if (path !== '/' && seen.has(path)) continue;
    seen.add(path);
    output.push({ path, code: 'invalid', message: 'The value is invalid.' });
  }
  return output;
};

/** The typed 403/409/422 refusal of an operation: one `reasonCode`, status-consistent. */
const reasonDetails = (
  operation: GovernedOperation,
  status: number,
  details: Readonly<Record<string, unknown>>,
): Record<string, unknown> | null => {
  const reason = CmsSlice12ReasonCodeSchema.safeParse(details.reasonCode);
  if (
    !reason.success ||
    cmsSlice12ReasonStatus(reason.data) !== status ||
    !(CMS_SLICE_12_OPERATION_REASONS[operation] as readonly string[]).includes(
      reason.data,
    )
  )
    return null;
  // A 03b time token carries its own typed members and its pointer-bound violations.
  if (isGovernedTimeReason(reason.data))
    return governedTimeDetails(
      reason.data,
      details,
      policyOf(operation).pointers,
    );
  const output: Record<string, unknown> = { reasonCode: reason.data };
  if (reason.data === 'canonical_source_unavailable') {
    const domain = CanonicalDomainSchema.safeParse(details.domain);
    if (domain.success) output.domain = domain.data;
  }
  if (status === 422) {
    // A reason-bearing 422 may point at its member (`expiry_out_of_bounds` at /expiresAt).
    const violations = safeViolations(operation, details.violations).filter(
      (violation) => violation.path !== '/',
    );
    if (violations.length > 0) output.violations = violations;
  }
  return output;
};

const projectedDetails = (
  operation: GovernedOperation,
  error: GovernedError,
): Record<string, unknown> => {
  const { status } = error;
  if (status === 401)
    return error.code === STEP_UP && policyOf(operation).stepUp
      ? { recoveryAction: 'step_up', allowedMethods: [...MFA_METHOD_REGISTRY] }
      : { recoveryAction: 'reauthenticate' };
  if (status === 415) return mediaTypeDetails(error.details);
  if (status >= 502)
    // BE00 172: the DEPENDENCY_UNAVAILABLE member is `retryable: true` on 502, 503 and 504.
    return { dependencyClass: 'cms_composition', retryable: true };
  const details = error.details;
  if (details === undefined || details === null || typeof details !== 'object')
    return {};
  const typed = reasonDetails(operation, status, details);
  if (typed !== null) return typed;
  const output: Record<string, unknown> = {};
  if (status === 429)
    for (const key of ['retryAfterSeconds', 'limit', 'resetAt'] as const) {
      const value = details[key];
      if (
        key === 'resetAt'
          ? typeof value === 'string' && /^\d{1,19}$/u.test(value)
          : typeof value === 'number' &&
            Number.isSafeInteger(value) &&
            value >= 0
      )
        output[key] = value;
    }
  if (status === 400 || status === 422) {
    const violations = safeViolations(operation, details.violations);
    if (violations.length > 0) output.violations = violations;
  }
  return output;
};

/**
 * The catalog answer of an operation. A status the operation does not document (BE03c
 * 1298-1302; `middleware` marks the origin refusal that every row publishes), a step-up code on an operation without step-up, or a response over
 * the budget is the scrubbed 500; the code and message always come from the catalog.
 */
export const governedErrorResponse = (
  request: Request,
  dependencies: CmsGovernedReviewDependencies,
  requestId: string,
  operation: GovernedOperation,
  error: GovernedError,
  middleware = false,
): Response => {
  const policy = policyOf(operation);
  const stepUp =
    error.status === 401 && error.code === STEP_UP && policy.stepUp;
  // The CORS origin refusal is middleware: BE00 publishes its 403 on every row.
  const declared =
    (middleware && error.status === 403) || policy.declared.has(error.status);
  let status: GovernedError['status'] =
    !declared ||
    (error.status === 401 && error.code === STEP_UP && !policy.stepUp)
      ? 500
      : error.status;
  const code = stepUp
    ? STEP_UP
    : (cmsCompositionCatalogCode(operation, status) as string);
  let details = projectedDetails(operation, { ...error, status });
  let payload = ApiErrorSchema.parse({
    code,
    message: cmsCompositionCatalogMessage('governedReview', code),
    requestId,
    details,
  });
  const limit = governedResponseLimit(dependencies.maxResponseBytes);
  if (!serializedBytesWithin(payload, limit)) {
    status = 500;
    details = {};
    payload = ApiErrorSchema.parse({
      code: 'INTERNAL_ERROR',
      message: cmsCompositionCatalogMessage('governedReview', 'INTERNAL_ERROR'),
      requestId,
      details,
    });
  }
  const headers = governedHeaders(request, dependencies, requestId);
  const retry = error.retryAfterSeconds;
  if ([429, 503, 504].includes(status))
    headers.set(
      'retry-after',
      String(
        status === 429 &&
          typeof retry === 'number' &&
          Number.isSafeInteger(retry) &&
          retry > 0
          ? retry
          : status === 429
            ? 60
            : 15,
      ),
    );
  if (status === 429) {
    headers.set('ratelimit-remaining', '0');
    if (typeof details.limit === 'number')
      headers.set('ratelimit-limit', String(details.limit));
    if (typeof details.resetAt === 'string')
      headers.set('ratelimit-reset', details.resetAt);
  }
  headers.set('content-type', 'application/json; charset=UTF-8');
  // BE03c Observability: the published refusal, reduced to its catalog code and closed members.
  noteRefusal(request, status, details, payload.code);
  return new Response(JSON.stringify(payload), { status, headers });
};
