import * as React from 'react';

import type { CanonicalResource } from '../cms-editorial-workflow/use-cms-workflow-canonical';
import type { WorkflowAnnouncer } from '../cms-editorial-workflow/use-cms-workflow-status';

const REREAD_DONE = 'The review was read again.';

/**
 * The degraded detail's re-read (FE03 1050): a review that could not be verified is re-required, so it stays unverified
 * from the failed read until a later read VERIFIES, which includes the time that read is in flight (derived during
 * render, so no frame shows the stale review). The re-read control belongs to a degrade that stated no wait (a 429
 * re-reads by itself); it stays mounted while that read runs so keyboard focus survives, and a read the person started
 * moves focus to the restored review's heading and announces it (V17 N7).
 */
export const useGovernedReread = (
  canonical: Pick<
    CanonicalResource<unknown>,
    'status' | 'rateLimit' | 'refetch'
  >,
  announcer: WorkflowAnnouncer,
  summaryHeadingId: string,
) => {
  const { status, rateLimit, refetch } = canonical;
  const [unverified, setUnverified] = React.useState(false);
  const [offered, setOffered] = React.useState(false);
  const askedRef = React.useRef(false);
  if (status === 'degraded' && !unverified) setUnverified(true);
  if (status === 'ready' && unverified) setUnverified(false);
  if (status === 'degraded' && offered !== (rateLimit === null))
    setOffered(rateLimit === null);
  if (status === 'ready' && offered) setOffered(false);
  React.useEffect(() => {
    if (status !== 'ready' || !askedRef.current) return;
    askedRef.current = false;
    document.getElementById(summaryHeadingId)?.focus();
    announcer.announce('reread', REREAD_DONE);
  }, [announcer, status, summaryHeadingId]);
  return {
    degraded: status === 'degraded' || unverified,
    rereading: status === 'refreshing',
    onReread: offered
      ? () => {
          askedRef.current = true;
          void refetch();
        }
      : undefined,
  };
};
