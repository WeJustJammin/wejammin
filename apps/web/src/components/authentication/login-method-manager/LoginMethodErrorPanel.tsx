import { StepUpRecoveryLink } from '../../identity-authority/step-up-mfa/StepUpRecoveryLink';
import { errorCopy, type UiError } from './types';
import { isStepUpRequiredCode } from '../../step-up-required';

export const SECURITY_SETTINGS_PATH = '/settings/security';

export interface LoginMethodErrorPanelProps {
  readonly error: UiError;
  readonly refreshDisabled: boolean;
  readonly onRefresh: () => void;
}

export function LoginMethodErrorPanel({
  error,
  refreshDisabled,
  onRefresh,
}: LoginMethodErrorPanelProps) {
  return (
    <section
      role="alert"
      className="infra-error"
      aria-labelledby="security-error-heading"
    >
      <h3 id="security-error-heading">Security action could not complete</h3>
      <p>{errorCopy(error)}</p>
      {isStepUpRequiredCode(error.code) && (
        <p>
          <StepUpRecoveryLink fallbackPath={SECURITY_SETTINGS_PATH} />
        </p>
      )}
      {error.retryAfterSeconds !== null && (
        <p>Try again in {error.retryAfterSeconds} seconds.</p>
      )}
      <p>
        Request ID: <code>{error.requestId}</code>
      </p>
      <button type="button" onClick={onRefresh} disabled={refreshDisabled}>
        Refresh current security state
      </button>
    </section>
  );
}

export default LoginMethodErrorPanel;
