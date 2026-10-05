import * as React from 'react';

import { ADMIN_RESET_COPY } from './admin-mfa-reset-values';

export interface AdminMfaResetConfirmationProps {
  children?: never;
  pending: boolean;
  headingRef: React.Ref<HTMLHeadingElement>;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Named confirmation step; Escape cancels until the command is committed. */
export function AdminMfaResetConfirmation({
  pending,
  headingRef,
  onConfirm,
  onCancel,
}: AdminMfaResetConfirmationProps): React.ReactElement {
  return (
    <section
      data-confirmation
      aria-labelledby="admin-mfa-reset-confirm-heading"
      className="infra-confirmation"
      onKeyDown={(event) => {
        if (event.key === 'Escape' && !pending) onCancel();
      }}
    >
      <h3 id="admin-mfa-reset-confirm-heading" ref={headingRef} tabIndex={-1}>
        Confirm reset
      </h3>
      <p>{ADMIN_RESET_COPY.confirmation}</p>
      <div className="infra-actions">
        <button
          type="button"
          disabled={pending}
          aria-disabled={pending}
          onClick={() => {
            if (!pending) onConfirm();
          }}
        >
          {pending ? 'Resetting' : 'Reset factors'}
        </button>
        <button type="button" disabled={pending} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </section>
  );
}
