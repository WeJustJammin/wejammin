import * as React from 'react';

import { takeCmsEditorialResult } from './cms-editorial-result-take';
import type { CmsEditorialResultSummary } from './cms-editorial-result-types';

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
 *
 * The reader is part of the island, not a lazy chunk: the page that follows create, resolve and
 * restore shows the result without the person doing anything, so the bundle gate charges the
 * route for the reader either way (V11 M4), and a chunk of its own only added a request, a
 * failure path and a seam. The editor route has the headroom (`bundle:check`).
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
    const storage = sessionStorageOrNull();
    setSummary(takeCmsEditorialResult(storage, entryId));
  }, [entryId]);
  return summary;
};
