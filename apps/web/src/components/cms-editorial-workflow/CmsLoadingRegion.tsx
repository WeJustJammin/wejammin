import * as React from 'react';

import './cms-loading-region.css';

/**
 * FE03 46 and 912, and the Slice 12 definition governance states (P2-S12-AC-271): a read that is still running after
 * 250 ms exposes the loading state (a status line over a layout-stable skeleton bar, drawn by the stylesheet); a faster
 * read never flashes one. This module is the one place of the rule.
 */
export const CMS_LOADING_DELAY_MS = 250;

/** True once `active` has been continuously true for 250 ms; false the moment it ends. */
export const useLoadingDelay = (active: boolean): boolean => {
  const [elapsed, setElapsed] = React.useState(false);
  React.useEffect(() => {
    if (!active) return undefined;
    const timer = setTimeout(() => setElapsed(true), CMS_LOADING_DELAY_MS);
    return () => {
      clearTimeout(timer);
      setElapsed(false);
    };
  }, [active]);
  return active && elapsed;
};

/**
 * The loading state of a known layout: nothing until `active` has lasted 250 ms, then a polite status line with the
 * skeleton bar. Prior content is the caller's to keep. A caller that already holds the delayed flag
 * (`useCanonicalResource().loading`) renders the same `<p role="status" className="cms-loading-region">` itself.
 */
export default function CmsLoadingRegion({
  active,
  label,
}: {
  readonly active: boolean;
  readonly label: string;
}): React.ReactElement | null {
  return useLoadingDelay(active) ? (
    <p role="status" className="cms-loading-region">
      {label}
    </p>
  ) : null;
}
