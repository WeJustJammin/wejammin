import { useCallback, useEffect, useRef, useState } from 'react';

import { useCmsTemplateRateWait } from '../cms-composition/cms-template-rate-wait';
import { newCmsEditorialIdempotencyKey } from '../cms-editorial/cms-editorial-request-support';
import { rateLimitMessage } from '../../lib/rate-limit-message';
import type { CommandContext } from './composition-commands';
import {
  reconciliationLine,
  UNKNOWN_OUTCOME_MESSAGE,
} from './composition-copy';
import { readInstanceList } from './composition-instance-list';
import { readEntryFacts } from './composition-reads';
import { keepRetired, mergeRows } from './composition-rows';
import {
  failure,
  IDLE,
  restated,
  type CompositionStatus,
} from './composition-status';
import type { CompositionEntryFacts, InstanceRow } from './composition-types';

interface Unconfirmed {
  readonly sent: string;
  readonly kind: 'place' | 'update';
  /** The checks made so far: a repeated failed check says so, so the sentence differs and is announced. */
  readonly attempt: number;
}

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
  // Commands (and the reads that follow their answer) in progress: every control that starts another command waits.
  const [holds, setHolds] = useState(0);
  // An unknown outcome whose reconciling read could not verify: no retry is offered until a read does (FE03 1050).
  const [unconfirmed, setUnconfirmed] = useState<Unconfirmed | null>(null);
  const entryRef = useRef(entry);
  const rowsRef = useRef(rows);
  const mountedRef = useRef(true);
  const inFlightRef = useRef(false);
  // Counts the rows a command added, so a list read that started before a newer command applied is dropped.
  const generationRef = useRef(0);
  // Orders the list reads themselves: only the latest answer may replace the rows.
  const listSequenceRef = useRef(0);
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
    generationRef.current += 1;
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
   * Refetch the instance list through the protected read (FE03 1047, 1049: a verified success and a 409 refetch the
   * lists shown) and replace the rows with the server's render order. True when the read verified and was applied; a
   * list that cannot be read keeps the rows the island holds. A read a newer command overtook is dropped, and a page
   * that has gone away makes none.
   */
  const refreshList = useCallback(
    async (revisionId?: string): Promise<boolean> => {
      // A page that has gone away asks for nothing: the read is not made, not merely dropped.
      if (!mountedRef.current) return false;
      const started = generationRef.current;
      const mine = ++listSequenceRef.current;
      const listedRevision = revisionId ?? entryRef.current.revisionId;
      const answer = await readInstanceList(
        entryRef.current.entryId,
        listedRevision,
        fetcher === undefined ? {} : { fetcher },
      );
      if (
        answer.kind !== 'rows' ||
        !mountedRef.current ||
        generationRef.current !== started ||
        listSequenceRef.current !== mine
      )
        return false;
      // The read lists only draft, active and pending_diff heads; a retired head stays detachable (DEC-193).
      rowsRef.current = keepRetired(
        answer.rows,
        rowsRef.current,
        listedRevision,
      );
      setRows(rowsRef.current);
      return true;
    },
    [fetcher],
  );

  /**
   * FE03 1050: an unknown outcome reconciles by refetching the entry (and the list) before any retry is offered. The
   * entry read is only shown, never adopted, so the retry sends the byte-identical request under its own key. Resolves
   * with the sentence that says what the read found.
   */
  const reconcileUnknown = useCallback(
    async (
      sent: string,
      kind: 'place' | 'update',
      attempt = 1,
    ): Promise<{ line: string; verified: boolean }> => {
      const facts = await readEntryFacts(
        entryRef.current.entryId,
        fetcher === undefined ? {} : { fetcher },
      );
      if (facts.kind === 'facts') await refreshList(facts.revisionId);
      if (mountedRef.current)
        setUnconfirmed(facts.kind === 'facts' ? null : { sent, kind, attempt });
      return {
        verified: facts.kind === 'facts',
        line: reconciliationLine(
          facts.kind === 'facts' ? facts.version : null,
          sent,
          kind,
          attempt,
        ),
      };
    },
    [fetcher, refreshList],
  );

  /** Holds the whole command, and the reads after its answer, as in flight; always released. */
  const hold = useCallback(async <T>(run: () => Promise<T>): Promise<T> => {
    setHolds((count) => count + 1);
    try {
      return await run();
    } finally {
      if (mountedRef.current) setHolds((count) => count - 1);
    }
  }, []);
  const held = useCallback(
    <A extends unknown[]>(run: (...input: A) => Promise<void>) =>
      (...input: A): Promise<void> =>
        hold(() => run(...input)),
    [hold],
  );

  /** "Check again": reads the entry once more; the retry is offered only when the read verifies. */
  const recheck = useCallback(
    (): Promise<void> =>
      hold(async () => {
        if (unconfirmed === null) return;
        const { line, verified } = await reconcileUnknown(
          unconfirmed.sent,
          unconfirmed.kind,
          unconfirmed.attempt + 1,
        );
        if (!mountedRef.current) return;
        // The control keeps focus while the read is still unverified; a verified read moves it to the result heading.
        setStatus((current) =>
          restated(current, `${UNKNOWN_OUTCOME_MESSAGE} ${line}`, verified),
        );
      }),
    [hold, reconcileUnknown, unconfirmed],
  );

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
    holding: holds > 0,
    unconfirmed: unconfirmed !== null,
    held,
    recheck,
    rateWaiting: rateWait.waiting,
    mutate,
    refreshEntry,
    refreshList,
    reconcileUnknown,
    mountedRef,
    csrfToken,
    fetcher,
  };
};

export type CompositionSession = ReturnType<typeof useCompositionSession>;
