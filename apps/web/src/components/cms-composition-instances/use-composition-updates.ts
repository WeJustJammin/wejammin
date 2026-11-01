import {
  useCallback,
  useMemo,
  type Dispatch,
  type SetStateAction,
} from 'react';

import { rateLimitMessage } from '../../lib/rate-limit-message';
import { retainChoices } from './composition-choices';
import { submitUpdate, type UpdateAnswer } from './composition-commands';
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
import { useCompositionNewRoots } from './use-composition-new-roots';
import { usePanelNow } from './use-composition-panel-now';
import type { CompositionSession } from './use-composition-session';

export interface PanelState {
  readonly panel: Panel;
  readonly setPanel: (next: Panel) => void;
}
export interface SelectionState {
  readonly selected: ReadonlySet<string>;
  readonly setSelected: Dispatch<SetStateAction<ReadonlySet<string>>>;
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
  { setSelected }: SelectionState,
) => {
  const {
    fetcher,
    mutate,
    addRows,
    setEntry,
    setStatus,
    refreshEntry,
    refreshList,
    reconcileUnknown,
    held,
  } = session;
  const { panelRef, choicesNow } = usePanelNow(panel);
  const readOptions = useMemo(
    () => (fetcher === undefined ? {} : { fetcher }),
    [fetcher],
  );

  // V17 N1: only the processed ids leave the selection; a row ticked while the command ran stays ticked.
  const prune = useCallback(
    (ids: readonly string[]) =>
      setSelected((current) => {
        const next = new Set(current);
        for (const id of ids) next.delete(id);
        return next;
      }),
    [setSelected],
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

  /**
   * A command's non-success answer: what happened, and (for a 409) a fresh version, list and diff with choices kept
   * (FE03 1049). An unknown outcome reconciles by refetching the entry and the list before any retry (FE03 1050).
   */
  const afterRefusal = useCallback(
    async (
      answer: Exclude<UpdateAnswer, { kind: 'updated' }>,
      heading: string,
      keep: { diff: UpdateDiff; choices: ChoiceMap } | null,
      sentVersion: string,
    ): Promise<void> => {
      if (answer.kind === 'rate_limited') return;
      if (answer.kind === 'uncertain') {
        setStatus(pending('Checking the entry before any retry…'));
        const { line } = await reconcileUnknown(sentVersion, 'update');
        if (session.mountedRef.current)
          setStatus(
            failure('Result not known', `${UNKNOWN_OUTCOME_MESSAGE} ${line}`),
          );
        return;
      }
      if (answer.status === 409) {
        const facts = await refreshEntry();
        await refreshList(facts?.revisionId);
        if (keep !== null) await reloadDiff(keep.diff, choicesNow(keep));
      }
      setStatus(
        failure(
          heading,
          refusalMessage('update', answer.status, answer.reason),
          [],
          answer.status === 403,
        ),
      );
    },
    [
      choicesNow,
      reconcileUnknown,
      refreshEntry,
      refreshList,
      reloadDiff,
      session.mountedRef,
      setStatus,
    ],
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
      const open = panelRef.current;
      if (open.kind === 'diff' && ids.includes(open.diff.instance.id))
        setPanel(NO_PANEL);
      prune(ids);
      setStatus(success(heading, outcomeLines(answer)));
    },
    [addRows, prune, session.entryRef, setEntry, setPanel, setStatus],
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
    if (answer.kind === 'updated') {
      applied(answer, 'Update applied', [panel.diff.instance.id]);
      await refreshList();
    } else
      await afterRefusal(
        answer,
        'Update not applied',
        panel,
        body.expectedVersion,
      );
  }, [
    afterRefusal,
    applied,
    panel,
    refreshList,
    send,
    session.entryRef,
    setStatus,
  ]);

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
      if (answer.kind === 'updated') {
        applied(answer, 'Detached', [instanceId]);
        await refreshList();
      } else
        await afterRefusal(
          answer,
          'Not detached',
          panel.kind === 'diff' ? panel : null,
          body.expectedVersion,
        );
    },
    [
      afterRefusal,
      applied,
      panel,
      refreshList,
      send,
      session.entryRef,
      session.rowsRef,
      setStatus,
    ],
  );

  const placeNewRoots = useCompositionNewRoots(
    session,
    panel,
    reloadDiff,
    choicesNow,
  );

  return {
    review,
    choose,
    accept: held(accept),
    detach: held(detach),
    placeNewRoots: held(placeNewRoots),
    reloadDiff,
    send,
    applied,
    afterRefusal,
  };
};
