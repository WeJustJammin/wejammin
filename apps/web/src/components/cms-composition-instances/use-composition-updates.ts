import { useCallback, useMemo } from 'react';

import { rateLimitMessage } from '../../lib/rate-limit-message';
import { retainChoices } from './composition-choices';
import {
  newRootsRequest,
  submitPlacement,
  submitUpdate,
  type UpdateAnswer,
} from './composition-commands';
import { refusalMessage, UNKNOWN_OUTCOME_MESSAGE } from './composition-copy';
import { NO_PANEL, type Panel } from './composition-panel';
import { readUpdateDiff } from './composition-reads';
import { failure, IDLE, pending, success } from './composition-status';
import {
  acceptRequest,
  detachRequests,
  type UpdateBody,
} from './composition-update-request';
import type { Choice, ChoiceMap, UpdateDiff } from './composition-types';
import type { CompositionSession } from './use-composition-session';

export interface PanelState {
  readonly panel: Panel;
  readonly setPanel: (next: Panel) => void;
}
export interface SelectionState {
  readonly selected: ReadonlySet<string>;
  readonly setSelected: (next: ReadonlySet<string>) => void;
}

/** The lines that name each instance's outcome (the new pin, a removal or a local copy, DEC-193). */
export const outcomeLines = (
  answer: Extract<UpdateAnswer, { kind: 'updated' }>,
): string[] =>
  answer.rows.map(
    (row, index) => `${row.path}: ${answer.outcomes[index]?.text ?? ''}`,
  );

/** Review one pattern update, accept it with the author's choices, detach it, or place the blocks it adds. */
export const useCompositionUpdates = (
  session: CompositionSession,
  { panel, setPanel }: PanelState,
  { selected, setSelected }: SelectionState,
) => {
  const { fetcher, mutate, addRows, setEntry, setStatus, refreshEntry } =
    session;
  const readOptions = useMemo(
    () => (fetcher === undefined ? {} : { fetcher }),
    [fetcher],
  );

  const prune = useCallback(
    (ids: readonly string[]) => {
      const next = new Set(selected);
      for (const id of ids) next.delete(id);
      setSelected(next);
    },
    [selected, setSelected],
  );

  /** Read the diff again; the answers survive only for paths whose three values did not change. */
  const reloadDiff = useCallback(
    async (previous: UpdateDiff, choices: ChoiceMap): Promise<void> => {
      const answer = await readUpdateDiff(previous.instance.id, readOptions);
      if (!session.mountedRef.current) return;
      if (answer.kind === 'diff')
        setPanel({
          kind: 'diff',
          diff: answer.diff,
          choices: retainChoices(previous, answer.diff, choices),
        });
      else
        setPanel({
          kind: 'failed',
          message:
            answer.kind === 'rate_limited'
              ? rateLimitMessage(answer.retryAfterSeconds)
              : refusalMessage('diff', answer.status ?? 0, answer.reason),
        });
    },
    [readOptions, session.mountedRef, setPanel],
  );

  const review = useCallback(
    async (instanceId: string): Promise<void> => {
      setStatus(IDLE);
      setPanel({ kind: 'loading' });
      const answer = await readUpdateDiff(instanceId, readOptions);
      if (!session.mountedRef.current) return;
      if (answer.kind === 'diff')
        setPanel({ kind: 'diff', diff: answer.diff, choices: {} });
      else
        setPanel({
          kind: 'failed',
          message:
            answer.kind === 'rate_limited'
              ? rateLimitMessage(answer.retryAfterSeconds)
              : refusalMessage('diff', answer.status ?? 0, answer.reason),
        });
    },
    [readOptions, session.mountedRef, setPanel, setStatus],
  );

  const choose = useCallback(
    (path: string, choice: Choice) => {
      if (panel.kind === 'diff')
        setPanel({
          ...panel,
          choices: { ...panel.choices, [path]: choice },
        });
    },
    [panel, setPanel],
  );

  /** A command's non-success answer: what happened, and (for a 409) a fresh version and diff with choices kept. */
  const afterRefusal = useCallback(
    async (
      answer: Exclude<UpdateAnswer, { kind: 'updated' }>,
      heading: string,
      keep: { diff: UpdateDiff; choices: ChoiceMap } | null,
    ): Promise<void> => {
      if (answer.kind === 'rate_limited') return;
      if (answer.kind === 'uncertain') {
        setStatus(failure('Result not known', UNKNOWN_OUTCOME_MESSAGE));
        return;
      }
      if (answer.status === 409) {
        await refreshEntry();
        if (keep !== null) await reloadDiff(keep.diff, keep.choices);
      }
      setStatus(
        failure(
          heading,
          refusalMessage('update', answer.status, answer.reason),
        ),
      );
    },
    [refreshEntry, reloadDiff, setStatus],
  );

  const send = useCallback(
    async (body: UpdateBody): Promise<UpdateAnswer | null> =>
      mutate(JSON.stringify(body), (context) => submitUpdate(body, context)),
    [mutate],
  );

  const applied = useCallback(
    (
      answer: Extract<UpdateAnswer, { kind: 'updated' }>,
      heading: string,
      ids: readonly string[],
    ) => {
      addRows(answer.rows);
      setEntry({ ...session.entryRef.current, version: answer.version });
      // A diff of another instance stays open with its choices: only an affected instance's panel closes.
      if (panel.kind === 'diff' && ids.includes(panel.diff.instance.id))
        setPanel(NO_PANEL);
      prune(ids);
      setStatus(success(heading, outcomeLines(answer)));
    },
    [addRows, panel, prune, session.entryRef, setEntry, setPanel, setStatus],
  );

  const accept = useCallback(async (): Promise<void> => {
    if (panel.kind !== 'diff') return;
    const body = acceptRequest(
      panel.diff,
      panel.choices,
      session.entryRef.current.version,
    );
    if (body === null) return;
    setStatus(pending('Accepting the update…'));
    const answer = await send(body);
    if (answer === null) return;
    if (answer.kind === 'updated')
      applied(answer, 'Update applied', [panel.diff.instance.id]);
    else await afterRefusal(answer, 'Update not applied', panel);
  }, [afterRefusal, applied, panel, send, session.entryRef, setStatus]);

  const detach = useCallback(
    async (instanceId: string): Promise<void> => {
      const row = session.rowsRef.current.find(
        (entry) => entry.id === instanceId,
      );
      const known =
        panel.kind === 'diff' && panel.diff.instance.id === instanceId
          ? panel.diff
          : null;
      const expectedVersion = known?.instance.version ?? row?.version;
      if (expectedVersion === undefined) return;
      const [body] = detachRequests(
        [{ instanceId, expectedVersion }],
        session.entryRef.current.version,
      );
      if (body === undefined) return;
      setStatus(pending('Detaching the block…'));
      const answer = await send(body);
      if (answer === null) return;
      if (answer.kind === 'updated') applied(answer, 'Detached', [instanceId]);
      else
        await afterRefusal(
          answer,
          'Not detached',
          panel.kind === 'diff' ? panel : null,
        );
    },
    [
      afterRefusal,
      applied,
      panel,
      send,
      session.entryRef,
      session.rowsRef,
      setStatus,
    ],
  );

  /** DEC-193 _Place_: the blocks a newer version adds are placed only through CMS-03C-02 `roots`. */
  const placeNewRoots = useCallback(
    async (roots: readonly string[]): Promise<void> => {
      if (panel.kind !== 'diff') return;
      const instance = session.rowsRef.current.find(
        (row) => row.id === panel.diff.instance.id,
      );
      if (instance === undefined) return;
      const request = newRootsRequest(
        panel.diff,
        instance,
        roots,
        session.entryRef.current,
      );
      if (request === null) return;
      setStatus(pending('Placing the new blocks…'));
      const answer = await mutate(JSON.stringify(request), (context) =>
        submitPlacement(request, context),
      );
      if (answer === null) return;
      if (answer.kind === 'placed') {
        addRows(answer.rows);
        setEntry({ ...session.entryRef.current, version: answer.version });
        setStatus(
          success('New blocks placed', [
            `Placed ${answer.rows.length} ${answer.rows.length === 1 ? 'block' : 'blocks'} from pattern version ${request.patternVersion}.`,
          ]),
        );
        await reloadDiff(panel.diff, panel.choices);
        return;
      }
      if (answer.kind === 'rate_limited') return;
      if (answer.kind === 'uncertain') {
        setStatus(failure('Result not known', UNKNOWN_OUTCOME_MESSAGE));
        return;
      }
      if (answer.status === 409) {
        await refreshEntry();
        await reloadDiff(panel.diff, panel.choices);
      }
      setStatus(
        failure(
          'Blocks not placed',
          refusalMessage('place', answer.status, answer.reason),
        ),
      );
    },
    [
      addRows,
      mutate,
      panel,
      refreshEntry,
      reloadDiff,
      session.entryRef,
      session.rowsRef,
      setEntry,
      setStatus,
    ],
  );

  return {
    review,
    choose,
    accept,
    detach,
    placeNewRoots,
    reloadDiff,
    send,
    applied,
    afterRefusal,
  };
};
