import * as React from 'react';

import { LockoutNotice } from './LockoutNotice';

export interface MfaNameStepProps {
  name: string;
  error: string | null;
  busy: boolean;
  gated: boolean;
  lockedSeconds: number | null;
  inputRef: React.Ref<HTMLInputElement>;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

/** Step 1: one text field, `friendlyName`, 1 to 80 characters. */
export function MfaNameStep({
  name,
  error,
  busy,
  gated,
  lockedSeconds,
  inputRef,
  onChange,
  onSubmit,
  onCancel,
}: MfaNameStepProps): React.ReactElement {
  return (
    <form
      noValidate
      aria-labelledby="mfa-name-heading"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <h3 id="mfa-name-heading">Name your authenticator</h3>
      <div className="infra-field">
        <label htmlFor="mfa-friendly-name">Authenticator name</label>
        <input
          ref={inputRef}
          id="mfa-friendly-name"
          name="friendlyName"
          type="text"
          maxLength={80}
          autoComplete="off"
          value={name}
          onChange={(event) => onChange(event.currentTarget.value)}
          aria-describedby={
            error === null ? 'mfa-name-help' : 'mfa-name-help mfa-name-error'
          }
          {...(error === null ? {} : { 'aria-invalid': true })}
        />
        <p id="mfa-name-help" className="infra-help">
          Pick a name you will recognise, such as the device it lives on.
        </p>
        {error !== null && (
          <p id="mfa-name-error" role="alert" className="infra-error-text">
            {error}
          </p>
        )}
      </div>
      {lockedSeconds !== null && <LockoutNotice remainingSeconds={lockedSeconds} />}
      <button type="submit" disabled={busy || gated || lockedSeconds !== null}>
        Continue
      </button>{' '}
      <button type="button" onClick={onCancel}>
        Cancel
      </button>
    </form>
  );
}
