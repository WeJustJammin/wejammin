import * as React from 'react';

import { LockoutNotice } from './LockoutNotice';
import { MfaQrCode } from './MfaQrCode';
import { OneTimeCodeField } from './OneTimeCodeField';
import type { EnrollmentSecret } from './mfa-wizard-state';

export interface MfaScanStepProps {
  secret: EnrollmentSecret;
  code: string;
  error: string | null;
  busy: boolean;
  lockedSeconds: number | null;
  inputRef: React.Ref<HTMLInputElement>;
  onCode: (value: string) => void;
  onSubmit: () => void;
  onCopy: () => void;
  onCancel: () => void;
}

const groupsOfFour = (key: string): string =>
  key.match(/.{1,4}/gu)?.join(' ') ?? key;

/** Step 2: scan locally rendered QR or type the key, then verify one code. */
export function MfaScanStep({
  secret,
  code,
  error,
  busy,
  lockedSeconds,
  inputRef,
  onCode,
  onSubmit,
  onCopy,
  onCancel,
}: MfaScanStepProps): React.ReactElement {
  return (
    <div className="mfa-scan-grid">
      <div>
        <h3 id="mfa-scan-heading">Scan the code</h3>
        <MfaQrCode payload={secret.otpauthUri} />
        <p id="mfa-key-label">Or enter this key in your app:</p>
        <p>
          <code translate="no" aria-labelledby="mfa-key-label">
            {groupsOfFour(secret.manualEntryKey)}
          </code>
        </p>
        <button type="button" onClick={onCopy}>
          Copy key
        </button>
      </div>
      <form
        noValidate
        aria-labelledby="mfa-scan-heading"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <OneTimeCodeField
          name="code"
          label="6-digit code from the app"
          describedBy="mfa-code-help"
          help="After adding the account, enter the code it shows. Spaces and hyphens are fine."
          errorId={error === null ? null : 'mfa-code-error'}
          errorMessage={error}
          readOnly={busy}
          value={code}
          onChange={onCode}
          inputRef={inputRef}
        />
        {lockedSeconds !== null && (
          <LockoutNotice remainingSeconds={lockedSeconds} />
        )}
        <button type="submit" disabled={busy || lockedSeconds !== null}>
          Verify and finish
        </button>{' '}
        <button type="button" onClick={onCancel}>
          Cancel setup
        </button>
      </form>
    </div>
  );
}
