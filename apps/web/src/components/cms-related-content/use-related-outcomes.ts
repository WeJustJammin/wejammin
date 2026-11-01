import type { RelatedContentRuleRequest } from '@wejammin/contracts';
import { isCmsVersion } from '@wejammin/contracts/client';
import { useCallback, useEffect, useMemo, useRef } from 'react';

import { readRelatedConflict } from './related-conflict-read';
import { reconcileSave } from './related-reconcile';
import type { SavedRelatedContent } from './related-content-submit';
import type { RelatedStatus } from './related-content-types';

interface OutcomeOptions {
  readonly entryId: string;
  readonly setStatus: (status: RelatedStatus) => void;
  /** The entry version the next save carries (the saved rule's entry token). */
  readonly setVersion: (version: string) => void;
  /** A 429 on a reconciling read blocks both Save and Check again until its stated wait is over. */
  readonly startWait: (seconds: number) => void;
  /** True while this attempt is still the latest one (a newer save supersedes it). */
  readonly isLatest: (sequence: number) => boolean;
  readonly nextSequence: () => number;
  /** The recorded save settles the attempt. */
  readonly settle: () => void;
}

/**
 * The two reads that follow a command of the related-content form (FE03 1047, 1050): reconciling an unknown outcome
 * before any retry is offered, and refetching the saved rule after a verified success. Each owns one cancelable read.
 */
export const useRelatedOutcomes = (options: OutcomeOptions) => {
  const latest = useRef(options);
  const controller = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    latest.current = options;
  });
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      controller.current?.abort();
    };
  }, []);

  const begin = useCallback(() => {
    controller.current?.abort();
    const owned = new AbortController();
    controller.current = owned;
    const sequence = latest.current.nextSequence();
    return {
      signal: owned.signal,
      isCurrent: () =>
        mounted.current &&
        !owned.signal.aborted &&
        latest.current.isLatest(sequence),
    };
  }, []);

  /** Reads the rule for `request` and says what the unknown outcome turned out to be. */
  const reconcile = useCallback(
    async (
      request: RelatedContentRuleRequest,
      again = false,
    ): Promise<void> => {
      const { setStatus, setVersion, startWait, settle } = latest.current;
      const read = begin();
      setStatus({ kind: 'reconciling', again });
      const outcome = await reconcileSave(request, read);
      if (!read.isCurrent()) return;
      if (outcome.kind === 'recorded') {
        settle();
        setVersion(outcome.saved.version);
        setStatus({ kind: 'saved', saved: outcome.saved });
        return;
      }
      if (outcome.kind === 'not_recorded') {
        setStatus({ kind: 'not_recorded' });
        return;
      }
      if (outcome.retryAfterSeconds !== null)
        startWait(outcome.retryAfterSeconds);
      setStatus({ kind: 'result', result: { kind: 'uncertain' } });
    },
    [begin],
  );

  /** FE03 1047: after a verified save the saved rule is read again and its entry token becomes the next version. */
  const refreshAfterSave = useCallback(
    async (saved: SavedRelatedContent): Promise<void> => {
      const read = begin();
      const result = await readRelatedConflict({
        entryId: latest.current.entryId,
        ...read,
      });
      if (!read.isCurrent() || result.kind !== 'reviewed') return;
      const token = result.snapshot.expectedVersion;
      if (isCmsVersion(token) && BigInt(token) >= BigInt(saved.version))
        latest.current.setVersion(token);
    },
    [begin],
  );

  return useMemo(
    () => ({ reconcile, refreshAfterSave }),
    [reconcile, refreshAfterSave],
  );
};
