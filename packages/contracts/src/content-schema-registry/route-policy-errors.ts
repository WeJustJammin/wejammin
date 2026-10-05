import type {
  ContentSchemaRegistryErrorCode,
  ContentSchemaRegistryErrorStatus,
} from './route-policy-base.ts';

export type ErrorMap<Codes extends ContentSchemaRegistryErrorCode> = Readonly<
  Record<Codes, ContentSchemaRegistryErrorStatus>
>;

export type HumanMutationErrors = ErrorMap<
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
  | 'INTERNAL_ERROR'
>;

/** Mutations whose missing or stale MFA is 401 `STEP_UP_REQUIRED`. */
export type HumanStepUpMutationErrors = ErrorMap<
  keyof HumanMutationErrors | 'STEP_UP_REQUIRED'
>;

export type HumanListErrors = ErrorMap<
  | 'INVALID_REQUEST'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'VALIDATION_FAILED'
  | 'RATE_LIMITED'
  | 'BAD_GATEWAY'
  | 'DEPENDENCY_UNAVAILABLE'
  | 'GATEWAY_TIMEOUT'
  | 'INTERNAL_ERROR'
>;

export type HumanDetailErrors = ErrorMap<
  | 'INVALID_REQUEST'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'RATE_LIMITED'
  | 'BAD_GATEWAY'
  | 'DEPENDENCY_UNAVAILABLE'
  | 'GATEWAY_TIMEOUT'
  | 'INTERNAL_ERROR'
>;

export type ReleaseErrors = ErrorMap<
  | 'INVALID_REQUEST'
  | 'WEBHOOK_REJECTED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'UNSUPPORTED_MEDIA_TYPE'
  | 'VALIDATION_FAILED'
  | 'RATE_LIMITED'
  | 'BAD_GATEWAY'
  | 'DEPENDENCY_UNAVAILABLE'
  | 'GATEWAY_TIMEOUT'
  | 'INTERNAL_ERROR'
>;

/** CMS-03A-05 creates its resource, so it declares no `NOT_FOUND` (DEC-129). */
export type BlockRegistrationErrors = Omit<ReleaseErrors, 'NOT_FOUND'>;
