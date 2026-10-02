import { useSyncExternalStore } from 'react';

import { stepUpHref } from './step-up-return';

export interface StepUpRecoveryLinkProps {
  /** Relative path used for `returnTo` until the browser location is known. */
  readonly fallbackPath: string;
  readonly label?: string;
}

const subscribeToNothing = (): (() => void) => () => undefined;

/**
 * Recovery for a 401 `STEP_UP_REQUIRED` (BE00/FE00, DEC-111): navigates to
 * `/step-up?returnTo=<current relative path>`. It is a navigation, never a
 * capability gate, and the server snapshot uses `fallbackPath` so hydration agrees.
 */
export function StepUpRecoveryLink({
  fallbackPath,
  label = 'Continue to verification',
}: StepUpRecoveryLinkProps) {
  const href = useSyncExternalStore(
    subscribeToNothing,
    () => stepUpHref(window.location.pathname, window.location.search),
    () => stepUpHref(fallbackPath),
  );
  return <a href={href}>{label}</a>;
}

export default StepUpRecoveryLink;
