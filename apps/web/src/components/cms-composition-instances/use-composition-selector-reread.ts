import { useCallback, type Dispatch, type SetStateAction } from 'react';

import type { PlacementFields } from './composition-insert-fields';
import { rereadSelector } from './composition-selector-reread';
import type {
  ReadState,
  SelectorItem,
  SelectorPage,
} from './composition-types';

export type RereadOutcome = 'read' | 'cleared' | 'unread';

/**
 * The placement's answer to a changed block registry (review V20 m9, DEC-246 ruling 5): read the selector's first page
 * again, show it, and carry the chosen pattern over with its current digest. A pattern the page no longer lists is
 * cleared; a read that fails leaves the list stale, so the placement stays off until a read verifies. Resolves null when
 * the page has gone away.
 */
export const useSelectorReread = (input: {
  readonly contentTypeId: string;
  readonly fetcher: typeof fetch | undefined;
  readonly mounted: { readonly current: boolean };
  readonly setPage: Dispatch<SetStateAction<SelectorPage>>;
  readonly setFields: Dispatch<SetStateAction<PlacementFields>>;
  readonly setSelectorState: Dispatch<SetStateAction<ReadState<unknown>>>;
}) => {
  const { contentTypeId, fetcher, mounted } = input;
  const { setPage, setFields, setSelectorState } = input;
  return useCallback(
    async (chosen: SelectorItem | null): Promise<RereadOutcome | null> => {
      const read = await rereadSelector(
        contentTypeId,
        chosen,
        fetcher === undefined ? {} : { fetcher },
      );
      if (!mounted.current) return null;
      if (read.kind === 'unread') {
        setSelectorState({ kind: 'stale', cause: read.cause });
        return 'unread';
      }
      setPage(read.page);
      setFields((current) => ({ ...current, item: read.chosen }));
      setSelectorState({ kind: 'idle' });
      return read.chosen === null && chosen !== null ? 'cleared' : 'read';
    },
    [contentTypeId, fetcher, mounted, setFields, setPage, setSelectorState],
  );
};
