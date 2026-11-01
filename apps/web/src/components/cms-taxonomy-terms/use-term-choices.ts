import { useCallback, useEffect, useRef, useState } from 'react';

import { readTaxonomyTerms, type TermFacts } from './taxonomy-terms-read';

/** Terms per read: the most `cmsTaxonomyTermsRead` serves (BE03c 407: limit 1-50). */
export const TERM_CHOICES_PAGE_SIZE = 50;

export type TermChoicesStatus = 'ready' | 'loading' | 'failed' | 'restarted';

export interface TermChoices {
  /** Every term read so far, in the order the read serves them. */
  readonly terms: readonly TermFacts[];
  /** True while further pages remain to be read. */
  readonly more: boolean;
  /** True from a failed read until a read succeeds: the next press repeats that read. */
  readonly retry: boolean;
  readonly status: TermChoicesStatus;
  /** Reads the next page, or retries the read that failed. */
  readonly load: () => void;
}

export interface TermChoicesOptions {
  readonly taxonomyId: string;
  /** Whether a parent or survivor field is showing. Nothing is read until it is. */
  readonly enabled: boolean;
  /** The list as the page shows it. */
  readonly pageTerms: readonly TermFacts[];
  /** True when that list is the whole vocabulary: no filter, no cursor, no next page. */
  readonly pageComplete: boolean;
  /**
   * Terms already chosen. A restart from the first page keeps those of them that were read
   * earlier, so a choice never vanishes because the list was reread.
   */
  readonly chosenIds?: readonly string[] | undefined;
  readonly readTerms?: typeof readTaxonomyTerms | undefined;
}

interface Loaded {
  readonly items: readonly TermFacts[];
  readonly next: string | null;
}

const NO_IDS: readonly string[] = [];

const appended = (
  known: readonly TermFacts[],
  more: readonly TermFacts[],
): TermFacts[] => {
  const ids = new Set(known.map((term) => term.termId));
  return [...known, ...more.filter((term) => !ids.has(term.termId))];
};

/**
 * The terms a parent or merge survivor may be chosen from (FE03 :887). The list on the page can
 * be one page of a long vocabulary, or filtered, so the picker reads the vocabulary itself:
 * the unfiltered first page when the page is not the whole vocabulary, then each next page by
 * its signed cursor on request. A stale cursor (409) restarts from the first page, keeping any
 * term already chosen. A failed read keeps what was loaded and offers a retry; the page's own terms stay available throughout.
 */
export const useTermChoices = ({
  taxonomyId,
  enabled,
  pageTerms,
  pageComplete,
  chosenIds = NO_IDS,
  readTerms = readTaxonomyTerms,
}: TermChoicesOptions): TermChoices => {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [status, setStatus] = useState<TermChoicesStatus>('ready');
  const [retry, setRetry] = useState(false);
  const busy = useRef(false);
  const started = useRef(false);
  const alive = useRef(true);
  const chosen = useRef(chosenIds);
  useEffect(() => {
    chosen.current = chosenIds;
  }, [chosenIds]);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const fetchPage = useCallback(
    async (cursor: string | null, restart: boolean): Promise<void> => {
      if (busy.current) return;
      busy.current = true;
      setStatus('loading');
      const result = await readTerms(taxonomyId, {
        limit: TERM_CHOICES_PAGE_SIZE,
        ...(cursor === null ? {} : { cursor }),
      });
      busy.current = false;
      if (!alive.current) return;
      if (result.kind === 'loaded') {
        setLoaded((previous) => ({
          items:
            previous === null
              ? result.page.items
              : cursor === null
                ? appended(
                    result.page.items,
                    previous.items.filter((term) =>
                      chosen.current.includes(term.termId),
                    ),
                  )
                : appended(previous.items, result.page.items),
          next: result.page.nextCursor,
        }));
        setRetry(false);
        setStatus(restart ? 'restarted' : 'ready');
      } else if (
        result.kind === 'rejected' &&
        result.status === 409 &&
        cursor !== null
      ) {
        await fetchPage(null, true);
      } else {
        setRetry(true);
        setStatus('failed');
      }
    },
    [readTerms, taxonomyId],
  );

  useEffect(() => {
    if (!enabled || pageComplete || started.current) return;
    started.current = true;
    void fetchPage(null, false);
  }, [enabled, fetchPage, pageComplete]);

  const load = useCallback((): void => {
    void fetchPage(loaded === null ? null : loaded.next, false);
  }, [fetchPage, loaded]);

  const source = loaded === null ? pageTerms : loaded.items;
  return {
    terms: source,
    more: loaded !== null && loaded.next !== null,
    retry,
    status,
    load,
  };
};

/**
 * The terms a parent or survivor may be: not merged, not the term acted on. A term already
 * chosen from the page's own list stays offered even if the read replaced the list.
 */
export const eligibleTerms = (
  loaded: readonly TermFacts[],
  pageTerms: readonly TermFacts[],
  targetId: string | null,
  chosenIds: readonly string[],
): TermFacts[] => {
  const kept = pageTerms.filter((term) => chosenIds.includes(term.termId));
  // `merged` is terminal (BE03c 1396): a term either source reports as merged is never offered,
  // whichever read is older.
  const mergedIds = new Set(
    [...loaded, ...pageTerms]
      .filter((term) => term.lifecycle === 'merged')
      .map((term) => term.termId),
  );
  return appended(loaded, kept).filter(
    (term) => !mergedIds.has(term.termId) && term.termId !== targetId,
  );
};
