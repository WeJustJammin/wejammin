export const humanMutationErrors = {
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

export const humanStepUpMutationErrors = {
  ...humanMutationErrors,
  STEP_UP_REQUIRED: 401,
} as const;

export const humanListErrors = {
  INVALID_REQUEST: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  VALIDATION_FAILED: 422,
  RATE_LIMITED: 429,
  BAD_GATEWAY: 502,
  DEPENDENCY_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504,
  INTERNAL_ERROR: 500,
} as const;

/**
 * CMS-03A-07: a path-only read (a query string or body is a 400), so no 422 is
 * emitted (BE03a error matrix). The declared set equals `HumanDetailErrors`.
 */
export const humanDetailErrors = {
  INVALID_REQUEST: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  RATE_LIMITED: 429,
  BAD_GATEWAY: 502,
  DEPENDENCY_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504,
  INTERNAL_ERROR: 500,
} as const;

/** CMS-03A-13: path-only read, so no 422 is emitted (BE03a error matrix). */
export const reviewDetailErrors = {
  INVALID_REQUEST: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  RATE_LIMITED: 429,
  BAD_GATEWAY: 502,
  DEPENDENCY_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504,
  INTERNAL_ERROR: 500,
} as const;

export const releaseErrors = {
  ...humanMutationErrors,
  WEBHOOK_REJECTED: 401,
} as const;

/**
 * CMS-03A-05 creates the (blockKey, blockVersion) pair it registers and names no
 * existing resource, so it declares no 404 (DEC-129). CMS-03A-08 names an existing
 * block version and keeps `releaseErrors`.
 */
export const blockRegistrationErrors = {
  INVALID_REQUEST: 400,
  WEBHOOK_REJECTED: 401,
  FORBIDDEN: 403,
  CONFLICT: 409,
  UNSUPPORTED_MEDIA_TYPE: 415,
  VALIDATION_FAILED: 422,
  RATE_LIMITED: 429,
  BAD_GATEWAY: 502,
  DEPENDENCY_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504,
  INTERNAL_ERROR: 500,
} as const;

export const tier2Slo = {
  tier: 2,
  commandP95Ms: 1_200,
  protectedRpcP95Ms: 300,
  acceptanceP99Ms: 1_000,
} as const;
