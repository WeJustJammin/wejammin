import { useCallback, useEffect, useRef, useState } from 'react';

import { useCmsTemplateRateWait } from '../cms-composition/cms-template-rate-wait';
import { newCmsEditorialIdempotencyKey } from '../cms-editorial/cms-editorial-request-support';
import { rateLimitMessage } from '../../lib/rate-limit-message';
import type { CommandContext } from './composition-commands';
import { readEntryFacts } from './composition-reads';
import { mergeRows } from './composition-rows';
import { failure, IDLE, type CompositionStatus } from './composition-status';
import type { CompositionEntryFacts, InstanceRow } from './composition-types';

export interface SessionOptions {
  readonly entry: CompositionEntryFacts;
  readonly instances: readonly InstanceRow[];
  readonly csrfToken: string;
  readonly fetcher?: typeof fetch | undefined;
}

/**
 * The state every composition command shares: the entry facts (its `version` is the `If-Match`), the listed rows, the
 * one result region, the single in-flight command and the `Idempotency-Key` policy. A key is reused only while the
 * identical request's outcome is unknown (BE03c 1502); a 429 blocks commands until its stated wait is over.
 */
export const useCompositionSession = (options: SessionOptions) => {
  const { csrfToken, fetcher } = options;
  const [entry, setEntryState] = useState(options.entry);
  // The rows arrive in the render order the instance list read answered (DEC-206); they are not re-sorted.
  const [rows, setRows] = useState<readonly InstanceRow[]>(
    () => options.instances,
  );
  const [status, setStatus] = useState<CompositionStatus>(IDLE);
  const [busy, setBusy] = useState(false);
  const entryRef = useRef(entry);
  const rowsRef = useRef(rows);
  const mountedRef = useRef(true);
  const inFlightRef = useRef(false);
  const attemptRef = useRef<{ fingerprint: string; key: string } | null>(null);
  const rateWait = useCmsTemplateRateWait();

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const setEntry = useCallback((next: CompositionEntryFacts) => {
    entryRef.current = next;
    setEntryState(next);
  }, []);
  const addRows = useCallback((incoming: readonly InstanceRow[]) => {
    rowsRef.current = mergeRows(rowsRef.current, incoming);
    setRows(rowsRef.current);
  }, []);

  /** Refetch the entry's version and draft revision; null when the read failed. */
  const refreshEntry =
    useCallback(async (): Promise<CompositionEntryFacts | null> => {
      const facts = await readEntryFacts(entryRef.current.entryId, {
        ...(fetcher === undefined ? {} : { fetcher }),
      });
      if (facts.kind !== 'facts' || !mountedRef.current) return null;
      const next = {
        ...entryRef.current,
        version: facts.version,
        revisionId: facts.revisionId,
        editable: facts.editable,
      };
      setEntry(next);
      return next;
    }, [fetcher, setEntry]);

  /**
   * Run one mutation under the key policy. Resolves null when nothing was sent (a command is already running, a wait
   * is in force, or the browser cannot make a key) or the page has gone away; otherwise the transport answer.
   */
  const mutate = useCallback(
    async <T extends { readonly kind: string }>(
      fingerprint: string,
      send: (context: CommandContext) => Promise<T>,
    ): Promise<T | null> => {
      if (inFlightRef.current || rateWait.waiting) return null;
      const key =
        attemptRef.current?.fingerprint === fingerprint
          ? attemptRef.current.key
          : newCmsEditorialIdempotencyKey();
      if (key === null) {
        setStatus(
          failure(
            'Nothing was sent',
            'This browser cannot create a request key, so no change can be sent safely.',
          ),
        );
        return null;
      }
      attemptRef.current = { fingerprint, key };
      inFlightRef.current = true;
      setBusy(true);
      let answer: T;
      try {
        answer = await send({
          csrfToken,
          idempotencyKey: key,
          ...(fetcher === undefined ? {} : { fetcher }),
        });
      } finally {
        inFlightRef.current = false;
        if (mountedRef.current) setBusy(false);
      }
      if (!mountedRef.current) return null;
      if (answer.kind !== 'uncertain') attemptRef.current = null;
      const waited = answer as unknown as {
        kind: string;
        retryAfterSeconds?: number | null;
      };
      if (waited.kind === 'rate_limited') {
        if (typeof waited.retryAfterSeconds === 'number')
          rateWait.start(waited.retryAfterSeconds);
        setStatus(
          failure(
            'Too many requests',
            rateLimitMessage(waited.retryAfterSeconds ?? null),
          ),
        );
      }
      return answer;
    },
    [csrfToken, fetcher, rateWait],
  );

  return {
    entry,
    entryRef,
    setEntry,
    rows,
    rowsRef,
    addRows,
    status,
    setStatus,
    busy,
    rateWaiting: rateWait.waiting,
    mutate,
    refreshEntry,
    mountedRef,
    csrfToken,
    fetcher,
  };
};

export type CompositionSession = ReturnType<typeof useCompositionSession>;
