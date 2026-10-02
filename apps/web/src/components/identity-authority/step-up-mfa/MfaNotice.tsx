import * as React from 'react';

import { MFA_SETTINGS_ROUTE } from './step-up-return';
import type { MfaNotice as MfaNoticeState } from './mfa-wizard-state';

export interface MfaNoticeProps {
  notice: MfaNoticeState;
  onRetry: () => void;
  onReload: () => void;
  onStartAgain: () => void;
}

const SIGN_IN_HREF = `/auth/sign-in?returnTo=${encodeURIComponent(MFA_SETTINGS_ROUTE)}`;

/**
 * Failure copy and its one recovery action. Status-only notices (sign-in
 * again, last factor) are spoken through the polite live region by the
 * wizard, so only their action is rendered here.
 */
export function MfaNotice({
  notice,
  onRetry,
  onReload,
  onStartAgain,
}: MfaNoticeProps): React.ReactElement | null {
  const ref = React.useRef<HTMLDivElement | null>(null);
  switch (notice.kind) {
    case 'sign-in':
      return (
        <p>
          <a href={SIGN_IN_HREF}>Sign in again</a>
        </p>
      );
    case 'last-factor':
    case 'locked':
    case 'step-up':
    case 'name':
    case 'code':
      return null;
    default:
      break;
  }
  return (
    <div ref={ref} role="alert" className="infra-error">
      <p>{notice.message}</p>
      {notice.showRequestId && notice.requestId !== null && (
        <p className="infra-request-id">
          Request ID: <code>{notice.requestId}</code>
        </p>
      )}
      {notice.kind === 'limit' && <a href="#mfa-factor-list-heading">Go to your authenticators</a>}
      {notice.kind === 'expired' && (
        <button type="button" onClick={onStartAgain}>
          Start again
        </button>
      )}
      {notice.kind === 'reload' && (
        <button type="button" onClick={onReload}>
          Reload
        </button>
      )}
      {notice.kind === 'degraded' && (
        <button type="button" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}
