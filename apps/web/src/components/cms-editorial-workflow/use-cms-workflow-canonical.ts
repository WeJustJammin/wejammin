import * as React from 'react';

import type { CanonicalReadResult } from './cms-workflow-canonical-read';

/**
 * The island's one canonical copy of a workflow or review. It starts as the
 * server-verified resource and is only ever replaced by a later verified read:
 * never optimistically, never from a command's answer. A failed read keeps the
 * last verified resource (`degraded`, with its `lastVerifiedAt`) and the forms
 * disable themselves; a concealed or denied record removes the data (`gone`);
 * an expired session removes it too (`signed-out`).
 */
export type CanonicalStatus =
  'ready' | 'refreshing' | 'degraded' | 'signed-out' | 'gone';

export interface CanonicalResource<T> {
  /** The last verified resource, or null once it is gone or the session ended. */
  readonly data: T | null;
  readonly status: CanonicalStatus;
  readonly lastVerifiedAt: string;
  readonly requestId: string | null;
  /**
   * Set while the last read was a 429 (FE03 :1172): the wait the server stated, null when it
   * stated none. The surface announces it, keeps its input, and reads once more after it.
   */
  readonly rateLimit: { readonly retryAfterSeconds: number | null } | null;
  /** Resolves true when the read verified; never rejects. */
  readonly refetch: () => Promise<boolean>;
}

/** The wait before the next read of a 429 that stated no delay. */
export const RATE_LIMIT_DEFAULT_WAIT_SECONDS = 5;

export const useCanonicalResource = <T>(
  initial: T,
  initialVerifiedAt: string,
  read: () => Promise<CanonicalReadResult<T>>,
  now: () => string = () => new Date().toISOString(),
): CanonicalResource<T> => {
  const [data, setData] = React.useState<T | null>(initial);
  const [status, setStatus] = React.useState<CanonicalStatus>('ready');
  const [lastVerifiedAt, setLastVerifiedAt] = React.useState(initialVerifiedAt);
  const [requestId, setRequestId] = React.useState<string | null>(null);
  const [rateLimit, setRateLimit] =
    React.useState<CanonicalResource<T>['rateLimit']>(null);
  const sequence = React.useRef(0);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const refetchRef = React.useRef<() => Promise<boolean>>(async () => false);
  const readRef = React.useRef(read);
  const nowRef = React.useRef(now);
  React.useEffect(() => {
    readRef.current = read;
    nowRef.current = now;
  });

  const clearWait = React.useCallback((): void => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
  }, []);
  React.useEffect(
    () => () => {
      // A read still in flight must not arm a wait (and a refetch) after the surface is gone.
      sequence.current += 1;
      clearWait();
    },
    [clearWait],
  );

  const refetch = React.useCallback(async (): Promise<boolean> => {
    clearWait();
    sequence.current += 1;
    const mine = sequence.current;
    setStatus('refreshing');
    const result = await readRef.current();
    // A newer read supersedes this one: only the latest answer is applied.
    if (mine !== sequence.current) return result.kind === 'ok';
    switch (result.kind) {
      case 'ok':
        setData(result.resource);
        setStatus('ready');
        setLastVerifiedAt(nowRef.current());
        setRequestId(null);
        setRateLimit(null);
        return true;
      case 'signed-out':
        setData(null);
        setStatus('signed-out');
        setRateLimit(null);
        return false;
      case 'gone':
        setData(null);
        setStatus('gone');
        setRateLimit(null);
        return false;
      case 'degraded':
        setStatus('degraded');
        setRequestId(result.requestId);
        setRateLimit(result.rateLimit ?? null);
        if (result.rateLimit !== undefined)
          // FE03 :1172: wait for Retry-After, then read once; the next answer decides again.
          timer.current = setTimeout(
            () => void refetchRef.current(),
            (result.rateLimit.retryAfterSeconds ??
              RATE_LIMIT_DEFAULT_WAIT_SECONDS) * 1_000,
          );
        return false;
    }
  }, [clearWait]);
  React.useEffect(() => {
    refetchRef.current = refetch;
  }, [refetch]);

  return { data, status, lastVerifiedAt, requestId, rateLimit, refetch };
};
