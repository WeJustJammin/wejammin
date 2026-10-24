import { useCallback, useEffect, useRef, useState } from 'react';

import { useCmsTemplateRateWait } from '../cms-composition/cms-template-rate-wait';
import { readRelatedConflict } from './related-conflict-read';
import type {
  RelatedConflictReviewState,
  RelatedConflictSnapshot,
} from './related-content-types';

/** Owns review admission and cancellation; the 409's advisory token is never an input. */
export const useRelatedConflictReview = (entryId: string) => {
  const [required, setRequired] = useState(false);
  const [state, setState] = useState<RelatedConflictReviewState>({
    kind: 'idle',
  });
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const requiredRef = useRef(false);
  const snapshotRef = useRef<RelatedConflictSnapshot | null>(null);
  const mounted = useRef(true);
  const sequence = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const rateWait = useCmsTemplateRateWait();

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      sequence.current += 1;
      controller.current?.abort();
      controller.current = null;
    };
  }, []);

  // The shared wait owns admission; this owned timer projects its stated delay into current copy.
  useEffect(() => {
    if (
      state.kind !== 'rate_limited' ||
      state.retryAfterSeconds === null ||
      !rateWait.waiting
    )
      return;
    const started = sequence.current;
    const until = Date.now() + state.retryAfterSeconds * 1_000;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = (): void => {
      if (!mounted.current || sequence.current !== started) return;
      const remaining = Math.max(0, Math.ceil((until - Date.now()) / 1_000));
      setRemainingSeconds(remaining);
      if (remaining > 0)
        timer = setTimeout(
          tick,
          Math.min(1_000, Math.max(0, until - Date.now())),
        );
    };
    tick();
    return () => clearTimeout(timer);
  }, [rateWait.waiting, state]);

  const reset = useCallback((needsReview: boolean): void => {
    sequence.current += 1;
    controller.current?.abort();
    controller.current = null;
    snapshotRef.current = null;
    requiredRef.current = needsReview;
    if (!mounted.current) return;
    setRequired(needsReview);
    setState({ kind: 'idle' });
  }, []);

  const review = useCallback(async (): Promise<void> => {
    if (
      !mounted.current ||
      !requiredRef.current ||
      controller.current !== null ||
      rateWait.waiting
    )
      return;
    const started = ++sequence.current;
    const owned = new AbortController();
    controller.current = owned;
    snapshotRef.current = null;
    setRemainingSeconds(null);
    setState({ kind: 'reading' });
    const isCurrent = (): boolean =>
      mounted.current && sequence.current === started;
    const result = await readRelatedConflict({
      entryId,
      signal: owned.signal,
      isCurrent,
    });
    if (!isCurrent() || owned.signal.aborted) return;
    controller.current = null;
    if (result.kind === 'rate_limited') {
      setRemainingSeconds(result.retryAfterSeconds);
      if (result.retryAfterSeconds !== null)
        rateWait.start(result.retryAfterSeconds);
    }
    if (result.kind === 'reviewed') snapshotRef.current = result.snapshot;
    setState(result);
  }, [entryId, rateWait]);

  const displayedState: RelatedConflictReviewState =
    state.kind === 'rate_limited' && state.retryAfterSeconds !== null
      ? {
          ...state,
          retryAfterSeconds: rateWait.waiting
            ? (remainingSeconds ?? state.retryAfterSeconds)
            : 0,
        }
      : state;

  return {
    required,
    state: displayedState,
    waiting: rateWait.waiting,
    review,
    requireReview: useCallback(() => reset(true), [reset]),
    clear: useCallback(() => reset(false), [reset]),
    isRequired: useCallback(() => requiredRef.current, []),
    reviewed: useCallback(() => snapshotRef.current, []),
  };
};
