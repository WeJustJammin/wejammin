/** BE03b registry row CMS-03B-01 error envelope. */
export const editorialRevisionErrors = {
  INVALID_REQUEST: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNSUPPORTED_MEDIA_TYPE: 415,
  VALIDATION_FAILED: 422,
  RATE_LIMITED: 429,
  BAD_GATEWAY: 502,
  DEPENDENCY_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504,
  INTERNAL_ERROR: 500,
} as const;

/** BE03b registry row CMS-03B-02 error envelope (409 keeps base-moved/CAS). */
export const editorialConflictResolutionErrors = {
  INVALID_REQUEST: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNSUPPORTED_MEDIA_TYPE: 415,
  VALIDATION_FAILED: 422,
  RATE_LIMITED: 429,
  BAD_GATEWAY: 502,
  DEPENDENCY_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504,
  INTERNAL_ERROR: 500,
} as const;

/**
 * BE03b registry row CMS-03B-03 error envelope.  The 03b-03 matrix cell for 409
 * reads "cursor/context mismatch", so a bounded read still returns CONFLICT,
 * and the 415 row keeps the deliberate "unsupported media if sent" divergence.
 */
export const editorialRevisionHistoryErrors = {
  INVALID_REQUEST: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNSUPPORTED_MEDIA_TYPE: 415,
  VALIDATION_FAILED: 422,
  RATE_LIMITED: 429,
  BAD_GATEWAY: 502,
  DEPENDENCY_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504,
  INTERNAL_ERROR: 500,
} as const;

/** BE03b registry row CMS-03B-04 error envelope (stale version/migration). */
export const editorialRestoreErrors = {
  INVALID_REQUEST: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNSUPPORTED_MEDIA_TYPE: 415,
  VALIDATION_FAILED: 422,
  RATE_LIMITED: 429,
  BAD_GATEWAY: 502,
  DEPENDENCY_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504,
  INTERNAL_ERROR: 500,
} as const;

/** CMS-03B-10 error envelope: the 03b-10 matrix row keeps CONFLICT (409). */
export const editorialEntryCreateErrors = {
  INVALID_REQUEST: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNSUPPORTED_MEDIA_TYPE: 415,
  VALIDATION_FAILED: 422,
  RATE_LIMITED: 429,
  BAD_GATEWAY: 502,
  DEPENDENCY_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504,
  INTERNAL_ERROR: 500,
} as const;

/**
 * CMS-03B-11 error envelope: the 03b-11 matrix row reads "not applicable to
 * bounded read" for 409, so CONFLICT is absent while 415 stays.
 */
export const editorialDraftDetailErrors = {
  INVALID_REQUEST: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  UNSUPPORTED_MEDIA_TYPE: 415,
  VALIDATION_FAILED: 422,
  RATE_LIMITED: 429,
  BAD_GATEWAY: 502,
  DEPENDENCY_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504,
  INTERNAL_ERROR: 500,
} as const;

/**
 * CMS-03B-12 conflict-detail envelope: a hidden entry or conflict is 404, so
 * the bounded read keeps the same safe shape as 03b-11 with no CONFLICT.
 */
export const editorialConflictDetailErrors = {
  INVALID_REQUEST: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  UNSUPPORTED_MEDIA_TYPE: 415,
  VALIDATION_FAILED: 422,
  RATE_LIMITED: 429,
  BAD_GATEWAY: 502,
  DEPENDENCY_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504,
  INTERNAL_ERROR: 500,
} as const;

/**
 * CMS-03B-13 entry-list envelope: bounded read, 415 kept.  DEC-140: a
 * well-formed signed cursor that is expired, tampered, signed by an unknown or
 * stale key, or bound to another actor, context or filter is 409 CONFLICT (the
 * BE03b error-matrix row "cursor/context mismatch"), while a structurally
 * malformed cursor stays 400 INVALID_REQUEST.
 */
export const editorialEntryListErrors = {
  INVALID_REQUEST: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNSUPPORTED_MEDIA_TYPE: 415,
  VALIDATION_FAILED: 422,
  RATE_LIMITED: 429,
  BAD_GATEWAY: 502,
  DEPENDENCY_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504,
  INTERNAL_ERROR: 500,
} as const;

/** CMS-03B-14 authoring-context envelope: bounded read, no CONFLICT, 415 kept. */
export const editorialAuthoringContextErrors = {
  INVALID_REQUEST: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  UNSUPPORTED_MEDIA_TYPE: 415,
  VALIDATION_FAILED: 422,
  RATE_LIMITED: 429,
  BAD_GATEWAY: 502,
  DEPENDENCY_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504,
  INTERNAL_ERROR: 500,
} as const;
