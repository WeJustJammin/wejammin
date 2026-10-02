import * as React from 'react';

import {
  formatStepUpExpiry,
  useStepUpFreshness,
} from './use-step-up-freshness';

export interface ContentSchemaRegistryStepUpDisclosureProps {
  /** Server-derived absolute expiry of the verified step-up window. */
  readonly freshUntil?: string | undefined;
  /**
   * Invoked after commit when a previously-fresh window becomes invalid (timer
   * or focus/visibility re-evaluation). Lets the parent reset acknowledgement
   * without a second timer or any serialized authority.
   */
  readonly onExpired?: (() => void) | undefined;
}

/**
 * Presentation-only step-up disclosure. The state is derived from the
 * server-issued absolute expiry, re-evaluated on a bounded timer and whenever
 * the tab regains focus or visibility, so a stale window can never render as
 * an indefinite "Verified". Commit authority remains the server POST.
 */
export function ContentSchemaRegistryStepUpDisclosure({
  freshUntil,
  onExpired,
}: ContentSchemaRegistryStepUpDisclosureProps): React.ReactElement {
  const { fresh, expiresAt } = useStepUpFreshness(freshUntil);
  const previousFreshRef = React.useRef(fresh);
  React.useEffect(() => {
    if (previousFreshRef.current && !fresh) onExpired?.();
    previousFreshRef.current = fresh;
  }, [fresh, onExpired]);
  if (!fresh || expiresAt === null)
    return <span>Step-up required before commit</span>;
  return <span>{`Verified until ${formatStepUpExpiry(expiresAt)}`}</span>;
}

export default ContentSchemaRegistryStepUpDisclosure;
