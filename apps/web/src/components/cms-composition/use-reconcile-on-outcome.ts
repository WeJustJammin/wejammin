import { useEffect, useRef } from 'react';

/**
 * Runs an island's own canonical read once each time the island ENTERS an outcome that must be reconciled by a
 * read (FE03 1048 `commandState` error: a 409 "refetches"; degraded: an unknown outcome "reconciles by
 * refetching ... before any retry"). `active` is true while that outcome is on screen; the read starts on its
 * rising edge, so a person never has to press a control for the refetch, and a later command that ends in the
 * same outcome again starts it again. The latest `run` is used, so the closure is never stale.
 */
export const useReconcileOnOutcome = (
  active: boolean,
  run: () => void,
): void => {
  const latest = useRef(run);
  const was = useRef(false);
  useEffect(() => {
    latest.current = run;
  });
  useEffect(() => {
    if (active && !was.current) latest.current();
    was.current = active;
  }, [active]);
};
