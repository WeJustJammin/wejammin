import * as React from 'react';

import {
  takeCmsEditorialResult,
  type CmsEditorialResultSummary,
} from './cms-editorial-result-handoff';

const sessionStorageOrNull = (): Storage | null => {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
};

/**
 * The result of the command that navigated here, read once after hydration (the
 * server render has no tab storage). The record is consumed on first read; the
 * ref keeps a development double-invoked effect from consuming it twice.
 */
export const useCmsEditorialResult = (
  entryId: string,
): CmsEditorialResultSummary | null => {
  const [summary, setSummary] =
    React.useState<CmsEditorialResultSummary | null>(null);
  const taken = React.useRef(false);
  React.useEffect(() => {
    if (taken.current) return;
    taken.current = true;
    setSummary(takeCmsEditorialResult(sessionStorageOrNull(), entryId));
  }, [entryId]);
  return summary;
};
