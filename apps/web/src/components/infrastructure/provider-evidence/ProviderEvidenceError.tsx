import { StepUpRecoveryLink } from '../../identity-authority/step-up-mfa/StepUpRecoveryLink';
import {
  PROVIDER_EVIDENCE_LIST_HREF,
  evidenceRetryDelayForAttempt,
  getProviderEvidenceErrorPresentation,
  normalizeProviderEvidenceErrorCode,
} from './provider-evidence-state';
import type { ProviderEvidenceState } from './provider-evidence-types';
import type { ProviderEvidenceRetryRequest } from './ProviderEvidenceFeedback';

export function ProviderEvidenceError({
  state,
  onRetry,
}: {
  readonly state: Extract<ProviderEvidenceState, { status: 'error' }>;
  readonly onRetry?: (
    request: ProviderEvidenceRetryRequest,
  ) => void | Promise<void>;
}) {
  const errorCode = normalizeProviderEvidenceErrorCode(state.code);
  const presentation = getProviderEvidenceErrorPresentation(errorCode);
  const retryAfter = state.retryAfterSeconds;
  const retryDelay = evidenceRetryDelayForAttempt(state.attempt);
  const canRetry =
    state.retryable &&
    retryDelay !== null &&
    onRetry !== undefined &&
    (retryAfter === undefined || retryAfter <= 0);
  const requestId =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(
      state.requestId,
    )
      ? state.requestId
      : '';
  return (
    <div
      className={`provider-evidence-error provider-evidence-error--${presentation.owner}`}
      role={presentation.owner === 'rate-wait' ? 'status' : 'alert'}
      aria-live="polite"
      aria-atomic="true"
    >
      <strong>{errorCode}</strong>
      <p>{presentation.message}</p>
      {presentation.owner === 'step-up' && (
        <p>
          <StepUpRecoveryLink fallbackPath={PROVIDER_EVIDENCE_LIST_HREF} />
        </p>
      )}
      {requestId !== '' && (
        <p>
          Request ID: <code>{requestId}</code>
        </p>
      )}
      {retryAfter !== undefined && retryAfter >= 0 && (
        <p>Retry available in {retryAfter} seconds.</p>
      )}
      {presentation.owner === 'rate-wait' && (
        <p>Selected evidence filters are preserved.</p>
      )}
      {canRetry && (
        <button
          type="button"
          onClick={() =>
            void onRetry({
              action: 'canonical-refetch',
              attempt: state.attempt,
              delayMs: retryDelay,
            })
          }
        >
          Retry canonical evidence read
        </button>
      )}
    </div>
  );
}

export default ProviderEvidenceError;
