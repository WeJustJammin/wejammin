import * as React from 'react';

import CmsLoadingRegion from './CmsLoadingRegion';
import { retryableLazy } from './cms-retryable-lazy';

type Loader<P> = () => Promise<{ readonly default: React.ComponentType<P> }>;

/**
 * A view whose chunk loads on the person's own action (open a form, press Link, try to leave an edited page), not with
 * the island. It is client state: nothing of it is in the served page, so there is no markup to keep in place.
 *
 * - One lazy component for the life of the island, so a view opened again renders at once.
 * - A load slower than 250 ms shows the loading state; a faster one shows none (P2-S12-AC-271, FE03 46 and 912).
 * - A chunk that cannot be fetched keeps the page, says so in an alert and offers the load again, which imports again
 *   (`retryableLazy`). `load` should be a `retryable()` import so the retry reaches the network in a real browser.
 */
export const createOnDemandView = <P extends object>(
  load: Loader<P>,
  loadingLabel: string,
): ((props: P) => React.ReactElement) => {
  const View = retryableLazy<P>(load);
  return function OnDemandView(props: P): React.ReactElement {
    return (
      <React.Suspense
        fallback={<CmsLoadingRegion active label={loadingLabel} />}
      >
        <View {...props} />
      </React.Suspense>
    );
  };
};
