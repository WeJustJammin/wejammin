import { useCallback, useRef, useState } from 'react';

import {
  summaryOf,
  type TaxonomyVersionSummary,
} from './CmsTaxonomyVersionList';
import type {
  readTaxonomyVersions,
  TaxonomyVersionsResult,
} from './taxonomy-versions-read';

/**
 * The version table of the designer and its refetch (FE03 1048 `commandState` success: "the form clears its draft
 * and the review, subject and lists are refetched"). A verified save reads the versions again so the table lists the
 * new draft; a read that fails keeps the table it had (FE03 `degraded`: last verified page kept) and says so.
 */
export const useTaxonomyVersionRows = (
  initial: readonly TaxonomyVersionSummary[],
  readVersions: typeof readTaxonomyVersions,
) => {
  const [rows, setRows] = useState(initial);
  const [stale, setStale] = useState(false);
  const sequence = useRef(0);
  const refresh = useCallback(
    async (taxonomyId: string): Promise<void> => {
      const mine = ++sequence.current;
      const result = await readVersions(taxonomyId);
      if (sequence.current !== mine) return;
      if (result.kind === 'loaded') {
        setRows(result.page.items.map(summaryOf));
        setStale(false);
      } else setStale(true);
    },
    [readVersions],
  );
  /** A read the designer already made (the unknown-outcome check) is the refetch: no second read. */
  const adopt = useCallback((result: TaxonomyVersionsResult): void => {
    if (result.kind !== 'loaded') return;
    sequence.current += 1;
    setRows(result.page.items.map(summaryOf));
    setStale(false);
  }, []);
  return { rows, stale, refresh, adopt };
};
