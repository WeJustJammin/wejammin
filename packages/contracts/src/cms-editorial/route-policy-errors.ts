import type {
  CmsEditorialErrorCode,
  CmsEditorialErrorStatus,
} from './route-policy-base.ts';

/**
 * BE00 lines 172 and 590 give `DEPENDENCY_UNAVAILABLE` two statuses on a route:
 * 502 when a contacted dependency answers invalid data and 503 when it is
 * unavailable. BE00 defines no separate code for the invalid answer, so the pair
 * is declared under the one code. 504 keeps its own `GATEWAY_TIMEOUT` cell.
 */
export type CmsEditorialDependencyStatuses = readonly [502, 503];

/**
 * The details of a CMS editorial 502 (BE00 line 172): the registered dependency
 * class and `retryable: true`. A 502 never carries a provider name, an upstream
 * payload or `Retry-After`.
 */
export const CMS_EDITORIAL_INVALID_ANSWER_DETAILS = {
  dependencyClass: 'cms_editorial',
  retryable: true,
} as const;

/** A code's declared status: one cell, or the dependency pair. */
export type CmsEditorialErrorMap<Codes extends CmsEditorialErrorCode> =
  Readonly<{
    [Code in Codes]: Code extends 'DEPENDENCY_UNAVAILABLE'
      ? CmsEditorialDependencyStatuses
      : CmsEditorialErrorStatus;
  }>;

/** Any route `errors` map as a consumer reads it: code to one or more statuses. */
export type CmsEditorialErrorDeclaration = Readonly<
  Record<string, number | readonly number[]>
>;

/** Every status a route declares, each once, ascending. */
export const cmsEditorialDeclaredStatuses = (
  errors: CmsEditorialErrorDeclaration,
): readonly number[] =>
  [...new Set(Object.values(errors).flat())].sort(
    (left, right) => left - right,
  );

/** Whether the route declares exactly this `(code, status)` pair. */
export const cmsEditorialDeclaresError = (
  errors: CmsEditorialErrorDeclaration,
  code: string,
  status: number,
): boolean => {
  if (!Object.hasOwn(errors, code)) return false;
  const declared = errors[code];
  if (declared === undefined) return false;
  return typeof declared === 'number'
    ? declared === status
    : declared.includes(status);
};

/**
 * The BE00 codes a 03b command envelope can return: eleven codes covering the
 * twelve statuses 400, 401, 403, 404, 409, 415, 422, 429, 500, 502, 503 and 504.
 * BE03b's per-row error matrix keeps CONFLICT on every -01/-02/-03/-04/-10 row,
 * so those five rows share this exact set.
 */
export type EditorialCommandErrorCodes =
  | 'INVALID_REQUEST'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'UNSUPPORTED_MEDIA_TYPE'
  | 'VALIDATION_FAILED'
  | 'RATE_LIMITED'
  | 'DEPENDENCY_UNAVAILABLE'
  | 'GATEWAY_TIMEOUT'
  | 'INTERNAL_ERROR';

/** CMS-03B-01 revision command envelope. */
export type EditorialRevisionErrors =
  CmsEditorialErrorMap<EditorialCommandErrorCodes>;

/**
 * CMS-03B-02 conflict-resolution envelope.  CONFLICT covers a moved base, an
 * invalid choice, or an idempotency rejection while the open record survives.
 */
export type EditorialConflictResolutionErrors =
  CmsEditorialErrorMap<EditorialCommandErrorCodes>;

/**
 * CMS-03B-03 revision-history envelope.  It is a safe read, but BE03b's matrix
 * cell for 409 reads "cursor/context mismatch", so CONFLICT deliberately stays.
 */
export type EditorialRevisionHistoryErrors =
  CmsEditorialErrorMap<EditorialCommandErrorCodes>;

/**
 * CMS-03B-04 restore envelope.  CONFLICT covers a stale version or a migration
 * mismatch while the source revision stays immutable and readable.
 */
export type EditorialRestoreErrors =
  CmsEditorialErrorMap<EditorialCommandErrorCodes>;

/**
 * CMS-03B-10 create envelope.  A duplicate idempotency key or an off-registry
 * schema identity is a 409 rather than an ordinary validation failure.
 */
export type EditorialEntryCreateErrors =
  CmsEditorialErrorMap<EditorialCommandErrorCodes>;

/**
 * CMS-03B-11 draft-detail envelope.  BE03b's 03b-11 matrix row reads
 * "not applicable to bounded read" for 409, so CONFLICT is deliberately
 * absent; 415 stays because an unsupported media type is still rejected.
 */
export type EditorialDraftDetailErrors = CmsEditorialErrorMap<
  | 'INVALID_REQUEST'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'UNSUPPORTED_MEDIA_TYPE'
  | 'VALIDATION_FAILED'
  | 'RATE_LIMITED'
  | 'DEPENDENCY_UNAVAILABLE'
  | 'GATEWAY_TIMEOUT'
  | 'INTERNAL_ERROR'
>;

/** The eleven bounded safe read codes: no CONFLICT and 415 retained. */
type EditorialBoundedReadErrorCodes =
  | 'INVALID_REQUEST'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'UNSUPPORTED_MEDIA_TYPE'
  | 'VALIDATION_FAILED'
  | 'RATE_LIMITED'
  | 'DEPENDENCY_UNAVAILABLE'
  | 'GATEWAY_TIMEOUT'
  | 'INTERNAL_ERROR';

/**
 * CMS-03B-12 conflict-detail envelope.  A hidden entry or conflict is 404 and
 * a bounded read has no divergent-state 409, so CONFLICT is absent.
 */
export type EditorialConflictDetailErrors =
  CmsEditorialErrorMap<EditorialBoundedReadErrorCodes>;

/**
 * CMS-03B-13 entry-list envelope.  The read mutates nothing, but DEC-140 makes
 * a well-formed signed cursor that is expired, tampered, foreign-bound or
 * signed by an unknown or stale key a 409 CONFLICT (cursor/context mismatch),
 * so CONFLICT is present beside the bounded read codes; 415 stays.
 */
export type EditorialEntryListErrors = CmsEditorialErrorMap<
  EditorialBoundedReadErrorCodes | 'CONFLICT'
>;

/**
 * CMS-03B-14 authoring-context envelope.  The read never grants a registry
 * write and cannot conflict, so CONFLICT is absent while 415 stays.
 */
export type EditorialAuthoringContextErrors =
  CmsEditorialErrorMap<EditorialBoundedReadErrorCodes>;

/**
 * CMS-03B-05 and CMS-03B-08 command envelope: the twelve BE00 codes. A stale
 * entry version is `CONFLICT` (`VERSION_MISMATCH`), an unavailable preflight
 * provider is 503 `DEPENDENCY_UNAVAILABLE`, and neither requires step-up.
 */
export type EditorialReviewCommandErrors =
  CmsEditorialErrorMap<EditorialCommandErrorCodes>;

/**
 * CMS-03B-06, -07, -09 and -18 envelope (E6): the twelve command codes plus the
 * 401 `STEP_UP_REQUIRED` of a missing or stale MFA proof, which reserves no
 * idempotency record and changes no state.
 */
export type EditorialStepUpCommandErrors = CmsEditorialErrorMap<
  EditorialCommandErrorCodes | 'STEP_UP_REQUIRED'
>;

/**
 * CMS-03B-15 and CMS-03B-16 envelope: the bounded read codes. A read mutates
 * nothing and a hidden target is 404, so there is no CONFLICT; 415 stays.
 */
export type EditorialWorkflowReadErrors =
  CmsEditorialErrorMap<EditorialBoundedReadErrorCodes>;

/**
 * CMS-03B-17 envelope: the caller's own scoped list. BE03b marks 403 and 404
 * "not applicable to a scoped list", and a well-formed expired, tampered or
 * foreign-bound cursor is 409 `CONFLICT` (DEC-140).
 */
export type EditorialReviewQueueErrors = CmsEditorialErrorMap<
  | 'INVALID_REQUEST'
  | 'UNAUTHENTICATED'
  | 'CONFLICT'
  | 'UNSUPPORTED_MEDIA_TYPE'
  | 'VALIDATION_FAILED'
  | 'RATE_LIMITED'
  | 'DEPENDENCY_UNAVAILABLE'
  | 'GATEWAY_TIMEOUT'
  | 'INTERNAL_ERROR'
>;
