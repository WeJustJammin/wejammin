import * as React from 'react';

import { formatClock } from './use-lockout';

/**
 * The visual lockout countdown. It updates every second and is deliberately
 * outside any live region; announcements come from `useLockout`.
 */
export function LockoutNotice({
  remainingSeconds,
}: Readonly<{ remainingSeconds: number }>): React.ReactElement {
  return (
    <p className="infra-help">
      Too many attempts. Try again in{' '}
      <span data-lockout-countdown>{formatClock(remainingSeconds)}</span>.
    </p>
  );
}
