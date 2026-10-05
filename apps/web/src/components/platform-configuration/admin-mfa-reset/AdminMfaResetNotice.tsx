import * as React from 'react';

import { LockoutNotice } from '../../identity-authority/step-up-mfa/LockoutNotice';
import type { ResetNotice, ResetResult } from './admin-mfa-reset-state';
import { ADMIN_RESET_COPY } from './admin-mfa-reset-values';

export interface AdminMfaResetNoticeProps {
  children?: never;
  notice: ResetNotice;
  remainingSeconds: number | null;
  signInHref: string;
  noticeRef: React.Ref<HTMLDivElement>;
  onRetry: () => void;
  onStartOver: () => void;
}

/** One failure message with at most one recovery action. */
export function AdminMfaResetNotice({
  notice,
  remainingSeconds,
  signInHref,
  noticeRef,
  onRetry,
  onStartOver,
}: AdminMfaResetNoticeProps): React.ReactElement | null {
  if (notice.kind === 'invalid' && Object.keys(notice.fieldErrors).length > 0)
    return null;
  return (
    <div ref={noticeRef} tabIndex={-1} role="alert" className="infra-error">
      {notice.kind === 'locked' && remainingSeconds !== null ? (
        <LockoutNotice remainingSeconds={remainingSeconds} />
      ) : (
        <p>{notice.message}</p>
      )}
      {notice.showRequestId && notice.requestId !== null && (
        <p className="infra-request-id">
          Request ID: <code>{notice.requestId}</code>
        </p>
      )}
      {notice.kind === 'sign-in' && <a href={signInHref}>Sign in again</a>}
      {(notice.kind === 'unknown' || notice.kind === 'degraded') && (
        <button type="button" onClick={onRetry}>
          Retry
        </button>
      )}
      {notice.kind === 'refresh' && (
        <button type="button" onClick={onStartOver}>
          Start over
        </button>
      )}
    </div>
  );
}

export function AdminMfaResetResult({
  result,
  headingRef,
}: Readonly<{
  result: ResetResult;
  headingRef: React.Ref<HTMLHeadingElement>;
}>): React.ReactElement {
  const completed = result.state === 'completed';
  return (
    <section
      aria-labelledby="admin-mfa-reset-result-heading"
      className="infra-result"
    >
      <h3
        id="admin-mfa-reset-result-heading"
        data-result-heading
        ref={headingRef}
        tabIndex={-1}
      >
        {completed ? 'Reset complete' : 'Reset recorded'}
      </h3>
      <p>
        {completed ? ADMIN_RESET_COPY.completed : ADMIN_RESET_COPY.reconciling}
      </p>
      {completed && (
        <p>{`Authenticators removed: ${result.removedFactorCount}.`}</p>
      )}
    </section>
  );
}
