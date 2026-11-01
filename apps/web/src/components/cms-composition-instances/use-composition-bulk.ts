import { useCallback, useMemo } from 'react';

import { rateLimitMessage } from '../../lib/rate-limit-message';
import type { UpdateAnswer } from './composition-commands';
import { refusalMessage, UNKNOWN_OUTCOME_MESSAGE } from './composition-copy';
import { NO_PANEL } from './composition-panel';
import { readUpdateDiff } from './composition-reads';
import {
  canDetach,
  canReviewUpdate,
  chunk,
  MAX_INSTANCES_PER_REQUEST,
} from './composition-rows';
import { failure, IDLE, pending, success } from './composition-status';
import {
  bulkAcceptBody,
  detachRequests,
  planBulkAccept,
  type UpdateBody,
} from './composition-update-request';
import type { UpdateDiff } from './composition-types';
import type { CompositionSession } from './use-composition-session';
import {
  outcomeLines,
  type PanelState,
  type SelectionState,
} from './use-composition-updates';

/**
 * Commands on a selection (DEC-181): review the selected updates, accept them in bulk when none collides, or detach
 * them. More than 32 instances are sent as successive requests of at most 32, and the entry `version` is read again
 * between requests. A request that fails stops the sequence and leaves the unapplied instances selected.
 */
export const useCompositionBulk = (
  session: CompositionSession,
  { panel, setPanel }: PanelState,
  { selected, setSelected }: SelectionState,
  send: (body: UpdateBody) => Promise<UpdateAnswer | null>,
) => {
  const {
    fetcher,
    addRows,
    setEntry,
    setStatus,
    refreshEntry,
    refreshList,
    reconcileUnknown,
    held,
  } = session;
  const readOptions = useMemo(
    () => (fetcher === undefined ? {} : { fetcher }),
    [fetcher],
  );

  const selectedRows = useCallback(
    () => session.rowsRef.current.filter((row) => selected.has(row.id)),
    [selected, session.rowsRef],
  );

  const review = useCallback(async (): Promise<void> => {
    const rows = selectedRows().filter(canReviewUpdate);
    if (rows.length === 0) return;
    setStatus(IDLE);
    setPanel({ kind: 'loading' });
    const diffs: UpdateDiff[] = [];
    for (const row of rows) {
      const answer = await readUpdateDiff(row.id, readOptions);
      if (!session.mountedRef.current) return;
      if (answer.kind !== 'diff') {
        setPanel({
          kind: 'failed',
          message:
            answer.kind === 'rate_limited'
              ? rateLimitMessage(answer.retryAfterSeconds)
              : refusalMessage('diff', answer.status ?? 0, answer.reason),
        });
        return;
      }
      diffs.push(answer.diff);
    }
    setPanel({ kind: 'bulk', diffs });
  }, [readOptions, selectedRows, session.mountedRef, setPanel, setStatus]);

  /** The diffs of the instances still unapplied, read again after a 409 (a diff is never kept across a changed entry). */
  const rereadDiffs = useCallback(
    async (diffs: readonly UpdateDiff[]): Promise<void> => {
      setPanel({ kind: 'loading' });
      const fresh: UpdateDiff[] = [];
      for (const diff of diffs) {
        const answer = await readUpdateDiff(diff.instance.id, readOptions);
        if (!session.mountedRef.current) return;
        if (answer.kind !== 'diff') {
          setPanel({
            kind: 'failed',
            message:
              answer.kind === 'rate_limited'
                ? rateLimitMessage(answer.retryAfterSeconds)
                : refusalMessage('diff', answer.status ?? 0, answer.reason),
          });
          return;
        }
        fresh.push(answer.diff);
      }
      setPanel({ kind: 'bulk', diffs: fresh });
    },
    [readOptions, session.mountedRef, setPanel],
  );

  /** Run the requests in order; the entry version is refetched between them. */
  const runSequence = useCallback(
    async (
      heading: string,
      stopHeading: string,
      builders: ReadonlyArray<{
        readonly ids: readonly string[];
        readonly body: (version: string) => UpdateBody;
      }>,
    ): Promise<void> => {
      const lines: string[] = [];
      const done = new Set<string>();
      let version = session.entryRef.current.version;
      let stopped: 'conflict' | 'other' | null = null;
      for (const [index, step] of builders.entries()) {
        if (index > 0) {
          const facts = await refreshEntry();
          if (facts === null) {
            setStatus(
              failure(
                stopHeading,
                'The entry version could not be read again. The remaining instances were not changed.',
                [`${index} of ${builders.length} requests applied.`],
              ),
            );
            stopped = 'other';
            break;
          }
          version = facts.version;
        }
        setStatus(
          pending(`${heading}: request ${index + 1} of ${builders.length}…`),
        );
        const body = step.body(version);
        const answer = await send(body);
        if (answer === null) break;
        if (answer.kind === 'updated') {
          addRows(answer.rows);
          setEntry({ ...session.entryRef.current, version: answer.version });
          lines.push(...outcomeLines(answer));
          for (const id of step.ids) done.add(id);
          continue;
        }
        if (answer.kind !== 'rate_limited') {
          const progress = [`${index} of ${builders.length} requests applied.`];
          stopped = 'other';
          if (answer.kind === 'uncertain') {
            // FE03 1050: reconcile (entry and list) before any retry is offered.
            setStatus(pending('Checking the entry before any retry…'));
            const { line } = await reconcileUnknown(
              body.expectedVersion,
              'update',
            );
            if (session.mountedRef.current)
              setStatus(
                failure(
                  stopHeading,
                  `${UNKNOWN_OUTCOME_MESSAGE} ${line}`,
                  progress,
                ),
              );
          } else {
            if (answer.status === 409) {
              // FE03 1049: a 409 refetches the entry and the list; the selection and the unapplied diffs are re-read.
              stopped = 'conflict';
              const facts = await refreshEntry();
              await refreshList(facts?.revisionId);
            }
            setStatus(
              failure(
                stopHeading,
                refusalMessage('update', answer.status, answer.reason),
                progress,
                answer.status === 403,
              ),
            );
          }
        }
        break;
      }
      if (done.size > 0 && stopped !== 'conflict') await refreshList();
      if (done.size === 0 && stopped !== 'conflict') return;
      // V17 N1: only the applied ids leave the selection; a row ticked while the requests ran stays ticked.
      if (done.size > 0)
        setSelected((current) => {
          const next = new Set(current);
          for (const id of done) next.delete(id);
          return next;
        });
      const remaining =
        panel.kind === 'bulk'
          ? panel.diffs.filter((diff) => !done.has(diff.instance.id))
          : [];
      if (done.size === builders.flatMap((step) => step.ids).length) {
        setPanel(NO_PANEL);
        setStatus(success(heading, lines));
      } else if (panel.kind === 'bulk') {
        if (stopped === 'conflict') await rereadDiffs(remaining);
        else setPanel({ kind: 'bulk', diffs: remaining });
      }
    },
    [
      addRows,
      panel,
      reconcileUnknown,
      refreshEntry,
      refreshList,
      rereadDiffs,
      send,
      session.entryRef,
      session.mountedRef,
      setEntry,
      setPanel,
      setSelected,
      setStatus,
    ],
  );

  const accept = useCallback(async (): Promise<void> => {
    if (panel.kind !== 'bulk') return;
    const plan = planBulkAccept(panel.diffs);
    if (!plan.ok) return;
    await runSequence(
      'Updates applied',
      'Updates stopped',
      plan.requests.map((request) => ({
        ids: request.instances.map((target) => target.instanceId),
        body: (version: string) => bulkAcceptBody(request, version),
      })),
    );
  }, [panel, runSequence]);

  const detach = useCallback(async (): Promise<void> => {
    const rows = selectedRows().filter(canDetach);
    if (rows.length === 0) return;
    const targets = rows.map((row) => ({
      instanceId: row.id,
      expectedVersion: row.version,
    }));
    await runSequence(
      'Blocks detached',
      'Detach stopped',
      chunk(targets, MAX_INSTANCES_PER_REQUEST).map((part) => ({
        ids: part.map((target) => target.instanceId),
        body: (version: string) =>
          detachRequests(part, version)[0] as UpdateBody,
      })),
    );
  }, [runSequence, selectedRows]);

  return { review, accept: held(accept), detach: held(detach) };
};
