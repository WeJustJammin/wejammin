import { useCallback, useRef, useState } from 'react';

import { useCmsTemplateRateWait } from '../cms-composition/cms-template-rate-wait';
import {
  fetchCandidatePage,
  mergeCandidates,
  type CandidatePage,
  type RelatedCandidate,
} from './related-candidates';

export type CandidateNote =
  'none' | 'loading' | 'restarted' | 'rate_limited' | 'failed' | 'signin';

export interface RelatedCandidatesOptions {
  readonly entryId: string;
  readonly initial: CandidatePage;
  readonly loadPage: typeof fetchCandidatePage;
}

/**
 * The picker's candidate list: the server-verified first page plus "Load more" (FE03 :890). A cursor
 * conflict restarts from the first page; a 429 waits for its `Retry-After` and keeps the person's choices
 * (FE03 :1172); a retryable dependency answer is retried inside the read (`fetchCandidatePage`).
 */
export const useRelatedCandidates = ({
  entryId,
  initial,
  loadPage,
}: RelatedCandidatesOptions) => {
  const [items, setItems] = useState<readonly RelatedCandidate[]>(
    initial.items,
  );
  const [nextCursor, setNextCursor] = useState(initial.nextCursor);
  const [note, setNote] = useState<CandidateNote>('none');
  const [waitSeconds, setWaitSeconds] = useState<number | null>(null);
  const wait = useCmsTemplateRateWait();
  const known = useRef(new Map<string, RelatedCandidate>());
  for (const candidate of items)
    known.current.set(candidate.entryId, candidate);

  const loadMore = useCallback(async (): Promise<void> => {
    if (note === 'loading' || wait.waiting) return;
    const restart = note === 'restarted' || nextCursor === null;
    setNote('loading');
    const result = await loadPage(restart ? null : nextCursor, entryId);
    if (result.kind === 'page') {
      setItems((current) =>
        restart
          ? result.page.items
          : mergeCandidates(current, result.page.items),
      );
      setNextCursor(result.page.nextCursor);
      setNote('none');
    } else if (result.kind === 'restart') {
      setItems([]);
      setNextCursor(null);
      setNote('restarted');
    } else if (result.kind === 'rate_limited') {
      setWaitSeconds(result.retryAfterSeconds);
      if (result.retryAfterSeconds !== null)
        wait.start(result.retryAfterSeconds);
      setNote('rate_limited');
    } else setNote(result.kind);
  }, [entryId, loadPage, nextCursor, note, wait]);

  /** The facts of an entry seen in any loaded page, so a chosen entry keeps its facts after a restart. */
  const factsOf = useCallback(
    (id: string) => known.current.get(id) ?? null,
    [],
  );

  return {
    items,
    nextCursor,
    note,
    waitSeconds,
    waiting: wait.waiting,
    loadMore,
    factsOf,
  };
};
