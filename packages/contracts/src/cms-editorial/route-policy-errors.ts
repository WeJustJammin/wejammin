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
