import { stepUpHref } from './step-up-mfa/step-up-return';
interface IdentityAuthorityError {
  readonly code: string;
  readonly message: string;
  readonly requestId: string;
  readonly details: Readonly<Record<string, unknown>> | null;
}

export type IdentityAuthorityState =
  | Readonly<{ status: 'idle' }>
  | Readonly<{
      status: 'loading';
      startedAt: string;
      preserveSafePriorContent: boolean;
    }>
  | Readonly<{
      status: 'error';
      error: IdentityAuthorityError;
      retryable: boolean;
    }>
  | Readonly<{
      status: 'empty';
      reason: 'no-records' | 'filter-miss' | 'not-disclosed';
    }>
  | Readonly<{
      status: 'success';
      data: unknown;
      version: string;
      stale: false;
    }>
  | Readonly<{
      status: 'optimistic-pending';
      data: unknown;
      operationId: string;
      version: string;
    }>
  | Readonly<{
      status: 'optimistic-rollback';
      data: unknown;
      error: IdentityAuthorityError;
      version: string;
    }>
  | Readonly<{ status: 'disabled'; reason: string }>
  | Readonly<{
      status: 'degraded';
      data: unknown | null;
      requestId: string;
      lastVerifiedAt: string | null;
    }>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isString = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0;

const isError = (value: unknown): value is IdentityAuthorityError => {
  if (!isRecord(value)) return false;
  return (
    isString(value.code) &&
    isString(value.message) &&
    isString(value.requestId) &&
    (value.details === null || isRecord(value.details))
  );
};

const parseIdentityAuthorityState = (
  value: unknown,
): IdentityAuthorityState => {
  if (!isRecord(value) || typeof value.status !== 'string') {
    throw new TypeError('Identity authority state must have a status');
  }
  switch (value.status) {
    case 'idle':
      return { status: 'idle' };
    case 'loading':
      if (
        !isString(value.startedAt) ||
        typeof value.preserveSafePriorContent !== 'boolean'
      )
        break;
      return {
        status: 'loading',
        startedAt: value.startedAt,
        preserveSafePriorContent: value.preserveSafePriorContent,
      };
    case 'error':
      if (!isError(value.error) || typeof value.retryable !== 'boolean') break;
      return {
        status: 'error',
        error: value.error,
        retryable: value.retryable,
      };
    case 'empty':
      if (
        value.reason === 'no-records' ||
        value.reason === 'filter-miss' ||
        value.reason === 'not-disclosed'
      ) {
        return { status: 'empty', reason: value.reason };
      }
      break;
    case 'success':
      if (isString(value.version) && value.stale === false)
        return {
          status: 'success',
          data: value.data,
          version: value.version,
          stale: false,
        };
      break;
    case 'optimistic-pending':
      if (isString(value.operationId) && isString(value.version))
        return {
          status: 'optimistic-pending',
          data: value.data,
          operationId: value.operationId,
          version: value.version,
        };
      break;
    case 'optimistic-rollback':
      if (isError(value.error) && isString(value.version))
        return {
          status: 'optimistic-rollback',
          data: value.data,
          error: value.error,
          version: value.version,
        };
      break;
    case 'disabled':
      if (isString(value.reason))
        return { status: 'disabled', reason: value.reason };
      break;
    case 'degraded':
      if (
        isString(value.requestId) &&
        (value.lastVerifiedAt === null ||
          typeof value.lastVerifiedAt === 'string')
      )
        return {
          status: 'degraded',
          data: value.data === undefined ? null : value.data,
          requestId: value.requestId,
          lastVerifiedAt: value.lastVerifiedAt,
        };
      break;
  }
  throw new TypeError(`Invalid identity authority state: ${value.status}`);
};

export const IdentityAuthorityStateSchema = {
  parse: parseIdentityAuthorityState,
  safeParse: (
    value: unknown,
  ):
    | Readonly<{ success: true; data: IdentityAuthorityState }>
    | Readonly<{ success: false; error: Error }> => {
    try {
      return { success: true, data: parseIdentityAuthorityState(value) };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error('Invalid state'),
      };
    }
  },
} as const;

export type IdentityAuthorityStatePresentation = Readonly<{
  status: IdentityAuthorityState['status'];
  busy?: boolean;
  [key: string]: unknown;
}>;

const recoveryActionForError = (code: string, retryable: boolean): string => {
  if (code === 'UNAUTHENTICATED') return 'reauthenticate';
  // DEC-111: a 401 STEP_UP_REQUIRED is step-up navigation, never a 403 gate.
  if (code === 'STEP_UP_REQUIRED') return 'step-up';
  if (code === 'FORBIDDEN') {
    return 'capability-gate';
  }
  if (code === 'NOT_FOUND' || code === 'DISCLOSURE_NOT_FOUND') {
    return 'disclosure-safe-404';
  }
  if (
    code === 'CONFLICT' ||
    code === 'VERSION_MISMATCH' ||
    code === 'IDEMPOTENCY_MISMATCH'
  ) {
    return 'sync-conflict';
  }
  if (code === 'RATE_LIMITED') return 'retry-after';
  if (
    code === 'DEPENDENCY_UNAVAILABLE' ||
    code === 'DEPENDENCY_ERROR' ||
    code === 'TIMEOUT'
  ) {
    return 'degraded';
  }
  return retryable ? 'retry' : 'form-validation';
};

const emptyActionForReason = (
  reason: IdentityAuthorityState & { status: 'empty' },
): string => {
  if (reason.reason === 'filter-miss') return 'reset-filters';
  if (reason.reason === 'not-disclosed') return 'request-access';
  return 'create-record';
};

/**
 * Converts a server-owned async union into render hints without changing its
 * authoritative payload. The function is deliberately pure for SSR and tests.
 */
export function presentIdentityAuthorityState(
  input: Readonly<Record<string, unknown>>,
): IdentityAuthorityStatePresentation {
  const state = IdentityAuthorityStateSchema.parse(input);

  switch (state.status) {
    case 'idle':
      return { status: state.status, busy: false };
    case 'loading':
      return {
        status: state.status,
        busy: true,
        startedAt: state.startedAt,
        preserveSafePriorContent: state.preserveSafePriorContent,
        loadingLabel: 'Loading current records',
        showSkeleton: !state.preserveSafePriorContent,
      };
    case 'error':
      return {
        status: state.status,
        busy: false,
        error: state.error,
        recoveryAction: recoveryActionForError(
          state.error.code,
          state.retryable,
        ),
        ...(state.error.code === 'STEP_UP_REQUIRED'
          ? {
              recoveryHref: stepUpHref(
                typeof input.currentPath === 'string' ? input.currentPath : '',
              ),
            }
          : {}),
        retainsInput: true,
      };
    case 'empty':
      return {
        status: state.status,
        busy: false,
        emptyReason: state.reason,
        action: emptyActionForReason(state),
      };
    case 'success':
      return {
        status: state.status,
        busy: false,
        data: state.data,
        version: state.version,
        stale: state.stale,
      };
    case 'optimistic-pending':
      return {
        status: state.status,
        busy: true,
        data: state.data,
        operationId: state.operationId,
        version: state.version,
        controlsDisabled: true,
        pendingLabel: 'Change pending confirmation',
      };
    case 'optimistic-rollback':
      return {
        status: state.status,
        busy: false,
        data: state.data,
        error: state.error,
        version: state.version,
        restoredPreimage: true,
        retainsInput: true,
        recoveryAction: 'edit-and-retry',
      };
    case 'disabled':
      return {
        status: state.status,
        busy: false,
        reason: state.reason,
        hasHandler: false,
      };
    case 'degraded':
      return {
        status: state.status,
        busy: false,
        data: state.data,
        requestId: state.requestId,
        lastVerifiedAt: state.lastVerifiedAt,
        retryAction: 'canonical-refetch',
        stale: true,
      };
  }
}
