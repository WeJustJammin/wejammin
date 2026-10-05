export type ProviderEvidenceErrorOwner =
  'inline' | 'capability' | 'step-up' | 'rate-wait' | 'degraded';

export interface ProviderEvidenceErrorPresentation {
  readonly owner: ProviderEvidenceErrorOwner;
  readonly message: string;
  readonly retryable: boolean;
}

const ERROR_PRESENTATIONS: Readonly<
  Record<string, ProviderEvidenceErrorPresentation>
> = {
  INVALID_REQUEST: {
    owner: 'inline',
    message: 'This evidence request could not be read. Review and try again.',
    retryable: false,
  },
  VALIDATION_FAILED: {
    owner: 'inline',
    message: 'Check the evidence filters and try again.',
    retryable: false,
  },
  UNAUTHENTICATED: {
    owner: 'capability',
    message: 'Sign in again to view this evidence.',
    retryable: false,
  },
  SESSION_EXPIRED: {
    owner: 'capability',
    message: 'Your session expired. Sign in again to view this evidence.',
    retryable: false,
  },
  FORBIDDEN: {
    owner: 'capability',
    message: 'This evidence is not available for the current capability.',
    retryable: false,
  },
  CAPABILITY_REQUIRED: {
    owner: 'capability',
    message: 'An explicit evidence capability is required.',
    retryable: false,
  },
  STEP_UP_REQUIRED: {
    owner: 'step-up',
    message: 'Recent step-up verification is required before this view.',
    retryable: false,
  },
  AUTHORITY_REQUIRED: {
    owner: 'capability',
    message: 'The current acting authority cannot view this evidence.',
    retryable: false,
  },
  FOREIGN_AUTHORITY: {
    owner: 'capability',
    message: 'This evidence belongs to another authorized context.',
    retryable: false,
  },
  AUDIT_REASON_REQUIRED: {
    owner: 'capability',
    message: 'An audited reason is required for this evidence view.',
    retryable: false,
  },
  NOT_FOUND: {
    owner: 'inline',
    message: 'The requested evidence is not available.',
    retryable: false,
  },
  CONFLICT: {
    owner: 'inline',
    message: 'Evidence changed. Reconcile canonical state before retrying.',
    retryable: false,
  },
  VERSION_MISMATCH: {
    owner: 'inline',
    message: 'Evidence changed. Reconcile the current operation version.',
    retryable: false,
  },
  IDEMPOTENCY_MISMATCH: {
    owner: 'inline',
    message: 'The evidence request does not match its canonical operation.',
    retryable: false,
  },
  RATE_LIMITED: {
    owner: 'rate-wait',
    message: 'Evidence requests are temporarily limited. Wait before retrying.',
    retryable: true,
  },
  PAYLOAD_TOO_LARGE: {
    owner: 'inline',
    message: 'The evidence request is too large to read.',
    retryable: false,
  },
  UNSUPPORTED_MEDIA_TYPE: {
    owner: 'inline',
    message: 'The evidence response format is not supported.',
    retryable: false,
  },
  WEBHOOK_REJECTED: {
    owner: 'inline',
    message: 'The webhook was not accepted; provider detail is unavailable.',
    retryable: false,
  },
  OBJECT_VERIFICATION_FAILED: {
    owner: 'inline',
    message: 'Canonical evidence verification failed.',
    retryable: false,
  },
  VERIFY_FAILED: {
    owner: 'inline',
    message: 'Canonical evidence verification failed.',
    retryable: false,
  },
  ORIGIN_CSRF_REQUIRED: {
    owner: 'capability',
    message: 'This browser request cannot be verified for the current context.',
    retryable: false,
  },
  BROWSER_SECURITY_REJECTED: {
    owner: 'capability',
    message: 'Browser security checks prevented this evidence request.',
    retryable: false,
  },
  DEPENDENCY_UNAVAILABLE: {
    owner: 'degraded',
    message: 'Canonical evidence is temporarily unavailable.',
    retryable: true,
  },
  HANDLER_UNAVAILABLE: {
    owner: 'degraded',
    message: 'Canonical evidence is temporarily unavailable.',
    retryable: true,
  },
  INTERNAL_ERROR: {
    owner: 'degraded',
    message: 'Canonical evidence could not be loaded.',
    retryable: true,
  },
};

export const getProviderEvidenceErrorPresentation = (
  code: string,
): ProviderEvidenceErrorPresentation =>
  ERROR_PRESENTATIONS[code] ?? {
    owner: 'degraded',
    message: 'Evidence contract mismatch. Check Status and retry.',
    retryable: true,
  };

const ERROR_CODE_PATTERN = /^[A-Z][A-Z0-9_]{0,63}$/u;

export const normalizeProviderEvidenceErrorCode = (code: string): string =>
  ERROR_CODE_PATTERN.test(code) ? code : 'INTERNAL_ERROR';
