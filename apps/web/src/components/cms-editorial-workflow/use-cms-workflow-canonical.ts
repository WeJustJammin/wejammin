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
  /** Resolves true when the read verified; never rejects. */
  readonly refetch: () => Promise<boolean>;
}

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
  const sequence = React.useRef(0);
  const readRef = React.useRef(read);
  const nowRef = React.useRef(now);
  React.useEffect(() => {
    readRef.current = read;
    nowRef.current = now;
  });

  const refetch = React.useCallback(async (): Promise<boolean> => {
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
        return true;
      case 'signed-out':
        setData(null);
        setStatus('signed-out');
        return false;
      case 'gone':
        setData(null);
        setStatus('gone');
        return false;
      case 'degraded':
        setStatus('degraded');
        setRequestId(result.requestId);
        return false;
    }
  }, []);

  return { data, status, lastVerifiedAt, requestId, refetch };
};
