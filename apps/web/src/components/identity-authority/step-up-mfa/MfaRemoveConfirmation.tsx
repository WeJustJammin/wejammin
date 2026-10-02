import * as React from 'react';

import type { RemovalReason } from './mfa-api';

export interface MfaRemoveConfirmationProps {
  name: string;
  lastVerified: boolean;
  reason: RemovalReason;
  busy: boolean;
  onReason: (reason: RemovalReason) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Inline confirmation; Escape cancels before anything is committed. */
export function MfaRemoveConfirmation({
  name,
  lastVerified,
  reason,
  busy,
  onReason,
  onConfirm,
  onCancel,
}: MfaRemoveConfirmationProps): React.ReactElement {
  const headingRef = React.useRef<HTMLHeadingElement | null>(null);
  React.useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, []);
  return (
    <div
      data-mfa-removal
      role="group"
      aria-labelledby="mfa-removal-heading"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          onCancel();
        }
      }}
    >
      <h3 id="mfa-removal-heading" ref={headingRef} tabIndex={-1}>
        Remove {name}?
      </h3>
      <p>
        You will not be able to verify protected actions with it
        {lastVerified ? ' until you add another authenticator.' : '.'}
      </p>
      <fieldset>
        <legend>Why are you removing it?</legend>
        <label>
          <input
            type="radio"
            name="reason"
            value="user_request"
            checked={reason === 'user_request'}
            onChange={() => onReason('user_request')}
          />{' '}
          I no longer need it
        </label>
        <label>
          <input
            type="radio"
            name="reason"
            value="factor_compromise"
            aria-describedby="mfa-compromise-note"
            checked={reason === 'factor_compromise'}
            onChange={() => onReason('factor_compromise')}
          />{' '}
          It may have been compromised
        </label>
        <p id="mfa-compromise-note" className="infra-help">
          Your other signed-in sessions will be signed out.
        </p>
      </fieldset>
      <button type="button" disabled={busy} onClick={onConfirm}>
        Remove authenticator
      </button>{' '}
      <button type="button" onClick={onCancel}>
        Keep it
      </button>
    </div>
  );
}
