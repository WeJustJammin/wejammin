import { useCallback } from 'react';

import { newRootsRequest, submitPlacement } from './composition-commands';
import { refusalMessage, UNKNOWN_OUTCOME_MESSAGE } from './composition-copy';
import { failure, pending, success } from './composition-status';
import type { ChoiceMap, UpdateDiff } from './composition-types';
import type { Panel } from './composition-panel';
import type { CompositionSession } from './use-composition-session';

/**
 * DEC-193 _Place_ (CMS-03C-02 `roots`): the blocks a newer pattern version adds are placed only by this command. A
 * verified placement reloads the diff and refetches the instance list; a 409 refetches the entry, the list and the diff;
 * an unknown outcome is reconciled by reading the entry and the list before any retry (FE03 1049, 1050).
 */
export const useCompositionNewRoots = (
  session: CompositionSession,
  panel: Panel,
  reloadDiff: (previous: UpdateDiff, choices: ChoiceMap) => Promise<void>,
  choicesNow: (keep: { diff: UpdateDiff; choices: ChoiceMap }) => ChoiceMap,
) => {
  const {
    mutate,
    addRows,
    setEntry,
    setStatus,
    refreshEntry,
    refreshList,
    reconcileUnknown,
  } = session;
  return useCallback(
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
        await reloadDiff(panel.diff, choicesNow(panel));
        await refreshList();
        return;
      }
      if (answer.kind === 'rate_limited') return;
      if (answer.kind === 'uncertain') {
        setStatus(pending('Checking the entry before any retry…'));
        const { line } = await reconcileUnknown(
          request.expectedVersion,
          'place',
        );
        if (session.mountedRef.current)
          setStatus(
            failure('Result not known', `${UNKNOWN_OUTCOME_MESSAGE} ${line}`),
          );
        return;
      }
      if (answer.status === 409) {
        const facts = await refreshEntry();
        await refreshList(facts?.revisionId);
        await reloadDiff(panel.diff, choicesNow(panel));
      }
      setStatus(
        failure(
          'Blocks not placed',
          refusalMessage('place', answer.status, answer.reason),
          [],
          answer.status === 403,
        ),
      );
    },
    [
      addRows,
      choicesNow,
      mutate,
      panel,
      reconcileUnknown,
      refreshEntry,
      refreshList,
      reloadDiff,
      session.entryRef,
      session.mountedRef,
      session.rowsRef,
      setEntry,
      setStatus,
    ],
  );
};
