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
