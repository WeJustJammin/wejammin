import type {
  CmsEditorialErrorCode,
  CmsEditorialErrorStatus,
} from './route-policy-base.ts';

export type CmsEditorialErrorMap<Codes extends CmsEditorialErrorCode> =
  Readonly<Record<Codes, CmsEditorialErrorStatus>>;

/**
 * The twelve BE00 codes a 03b command envelope can return.  BE03b's per-row
 * error matrix keeps CONFLICT on every -01/-02/-03/-04/-10 row, so those five
 * rows share this exact set.
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
  | 'BAD_GATEWAY'
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
  | 'BAD_GATEWAY'
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
  | 'BAD_GATEWAY'
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
  | 'BAD_GATEWAY'
  | 'DEPENDENCY_UNAVAILABLE'
  | 'GATEWAY_TIMEOUT'
  | 'INTERNAL_ERROR'
>;
