import { useCallback, useEffect, useRef, useState } from 'react';

import {
  RATE_LIMIT_WAIT_MAX_SECONDS,
  rateLimitMessage,
} from '../../lib/safe-read-retry';
import { patternLatestIdentityValid } from './pattern-outcome-reconcile';
import {
  readLatestPatternVersion,
  type PatternLatestDetail,
  type PatternLatestResult,
} from './pattern-latest-read';

export type PatternConflictState =
  | { readonly kind: 'none' }
  | { readonly kind: 'checking' }
  | { readonly kind: 'loaded'; readonly latest: PatternLatestDetail }
  | {
      readonly kind: 'failed';
      readonly message: string;
      /** Present only for a 429 (FE03 :1172): announced politely, not as an alert. */
      readonly rateLimited?: true;
    };

/** The version a form is based on; null for a first version. */
export type PatternBaseIdentity = Pick<
  PatternLatestDetail,
  'id' | 'version' | 'contentHash'
>;

interface PatternReadTarget {
  readonly patternKey: string;
  readonly base: PatternBaseIdentity | null;
}

const FAILED: Readonly<Record<401 | 403 | 404, string>> = {
  401: 'Your session expired. Sign in again.',
  403: 'Template designer access is required for this acting context.',
  404: 'This pattern is unavailable to the current acting context.',
};

export const UNVERIFIED_LATEST_MESSAGE =
  'The latest version could not be verified. Reload.';

export const conflictFailure = (result: PatternLatestResult): string =>
  result.kind === 'rejected'
    ? result.status === 429
      ? rateLimitMessage(result.retryAfterSeconds ?? null)
      : (FAILED[result.status] as string)
    : 'The latest version is unavailable. Wait and try again.';

/** A newer version than the one the form is based on can be compared and adopted. */
export const isNewerThanBase = (
  latest: Pick<PatternLatestDetail, 'version'>,
  base: Pick<PatternLatestDetail, 'version'> | null,
): boolean => base === null || BigInt(latest.version) > BigInt(base.version);

/**
 * The explicit latest-version comparison after a compare-and-set conflict or an unknown
 * outcome (FE03 form contract: show the current server version beside the preserved
 * draft; never overwrite automatically). Reading the latest changes nothing; rebasing
 * and discarding are separate, explicit actions of the designer. A read that is not a
 * comparable version of this lineage (an older or foreign same-numbered one) is refused.
 */
export const usePatternConflict = (
  patternKey: string,
  base: PatternBaseIdentity | null,
  readLatest: typeof readLatestPatternVersion = readLatestPatternVersion,
) => {
  const [state, setState] = useState<PatternConflictState>({ kind: 'none' });
  const mountedRef = useRef(false);
  const sequenceRef = useRef(0);
  const controllerRef = useRef<AbortController | null>(null);
  const retryAtRef = useRef<number | null>(null);
  const [retryAt, setRetryAt] = useState<number | null>(null);
  const [readClock, setReadClock] = useState(Date.now);

  const startReadWait = useCallback((seconds?: number): void => {
    const now = Date.now();
    const until =
      seconds !== undefined &&
      Number.isInteger(seconds) &&
      seconds > 0 &&
      seconds <= RATE_LIMIT_WAIT_MAX_SECONDS
        ? now + seconds * 1_000
        : null;
    retryAtRef.current = until;
    setRetryAt(until);
    setReadClock(now);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      sequenceRef.current += 1;
      controllerRef.current?.abort();
      controllerRef.current = null;
    };
  }, []);

  // Only a verified deadline owns a countdown; expiration clears its stated wait.
  useEffect(() => {
    if (retryAt === null) return;
    const remaining = retryAt - Date.now();
    if (remaining <= 0) return;
    const timer = setTimeout(
      () => {
        if (mountedRef.current) setReadClock(Date.now());
      },
      Math.min(1_000, remaining),
    );
    return () => clearTimeout(timer);
  }, [readClock, retryAt]);

  /** Resolves to what the server answered, `unavailable` when it is not comparable. */
  const check = useCallback(
    async (
      target: PatternReadTarget = { patternKey, base },
    ): Promise<PatternLatestResult> => {
      if (
        !mountedRef.current ||
        (retryAtRef.current !== null && Date.now() < retryAtRef.current)
      )
        return { kind: 'unavailable' };
      const sequence = ++sequenceRef.current;
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;
      startReadWait();
      setState({ kind: 'checking' });
      let result: PatternLatestResult;
      try {
        result = await (readLatest === readLatestPatternVersion
          ? readLatestPatternVersion(target.patternKey, undefined, {
              signal: controller.signal,
            })
          : readLatest(target.patternKey));
      } catch {
        result = { kind: 'unavailable' };
      }
      if (
        !mountedRef.current ||
        sequenceRef.current !== sequence ||
        controller.signal.aborted
      )
        return { kind: 'unavailable' };
      controllerRef.current = null;
      if (result.kind === 'loaded') {
        if (
          result.detail.patternKey !== target.patternKey ||
          (target.base !== null &&
            !patternLatestIdentityValid(target.base, result.detail))
        ) {
          setState({ kind: 'failed', message: UNVERIFIED_LATEST_MESSAGE });
          return { kind: 'unavailable' };
        }
        setState({ kind: 'loaded', latest: result.detail });
        return result;
      }
      if (result.kind === 'rejected' && result.status === 429) {
        startReadWait(result.retryAfterSeconds);
        setState({
          kind: 'failed',
          message: conflictFailure(result),
          rateLimited: true,
        });
        return result;
      }
      setState({ kind: 'failed', message: conflictFailure(result) });
      return result;
    },
    [base, patternKey, readLatest, startReadWait],
  );

  const clear = useCallback((): void => {
    if (!mountedRef.current) return;
    sequenceRef.current += 1;
    controllerRef.current?.abort();
    controllerRef.current = null;
    startReadWait();
    setState({ kind: 'none' });
  }, [startReadWait]);
  const latest = state.kind === 'loaded' ? state.latest : null;
  const remaining =
    retryAt === null
      ? null
      : Math.max(0, Math.ceil((retryAt - Date.now()) / 1_000));
  const projectedState =
    state.kind === 'failed' && state.rateLimited === true
      ? {
          ...state,
          message:
            remaining === null
              ? rateLimitMessage(null)
              : remaining === 0
                ? ''
                : rateLimitMessage(remaining),
        }
      : state;
  return {
    state: projectedState,
    check,
    clear,
    /** True while a 429's stated wait has not elapsed: the check stays off. */
    waiting: retryAt !== null && Date.now() < retryAt,
    newer: latest !== null && isNewerThanBase(latest, base),
  };
};
