import { useCallback, useRef, useState } from 'react';

import { placementRequest, submitPlacement } from './composition-commands';
import { refusalMessage, UNKNOWN_OUTCOME_MESSAGE } from './composition-copy';
import {
  fieldOfPointer,
  type InsertField,
  type InsertIssue,
  type PlacementFields,
} from './composition-insert-fields';
import { readEntryFacts, readSelectorPage } from './composition-reads';
import { failure, pending, success } from './composition-status';
import type {
  ReadState,
  SelectorItem,
  SelectorPage,
} from './composition-types';
import type { CompositionSession } from './use-composition-session';

const SERVER_FIELD_MESSAGES: Readonly<Record<InsertField, string>> = {
  pattern: 'The server did not accept this pattern. Choose it again.',
  linkMode: 'The server did not accept this link mode.',
  slotPath: 'The server did not accept this slot path.',
  overrides:
    'The server did not accept these overrides. Check that each key names a node of the pattern.',
};

const EMPTY_FIELDS: PlacementFields = {
  item: null,
  linkMode: null,
  slotPath: '/',
  overridesText: '',
};

/** What the entry read after an unknown placement says: still the version sent, moved on, or unreadable. */
const reconciliationLine = (current: string | null, sent: string): string =>
  current === null
    ? 'The entry could not be read to check, so nothing more is known. Sending again retries the same request and cannot place twice.'
    : current === sent
      ? `The entry is still at version ${current}. Sending again retries the same request and cannot place twice.`
      : `The entry has moved to version ${current} since the request was sent, so the placement may have been applied. Sending again retries the same request and cannot place twice.`;

const placedLine = (item: SelectorItem | null, mode: string, n: number) =>
  `Placed ${n} ${n === 1 ? 'row' : 'rows'} pinned to ${
    item === null
      ? 'the pattern'
      : `${item.patternKey} version ${item.patternVersion}`
  }, ${mode}.`;

/** The insert form (CMS-03C-02) and its pattern selector (CMS-03C-13): all state and commands, no markup. */
export const useCompositionInsert = (
  session: CompositionSession,
  initialPage: SelectorPage,
) => {
  const { entry, mutate, addRows, setEntry, setStatus, refreshEntry } = session;
  const [fields, setFields] = useState<PlacementFields>(EMPTY_FIELDS);
  // The fields as last sent or first shown: input that differs from them is unsent work (FE03 927).
  const [baseline, setBaseline] = useState<PlacementFields>(EMPTY_FIELDS);
  const [reconciling, setReconciling] = useState(false);
  const [issues, setIssues] = useState<readonly InsertIssue[]>([]);
  const [page, setPage] = useState(initialPage);
  const [selectorState, setSelectorState] = useState<ReadState<unknown>>({
    kind: 'idle',
  });
  const loadingRef = useRef(false);
  const mountedRef = session.mountedRef;

  const change = useCallback((patch: Partial<PlacementFields>) => {
    setFields((current) => ({ ...current, ...patch }));
    setIssues((current) =>
      current.filter(
        (issue) =>
          !(
            (patch.item !== undefined && issue.field === 'pattern') ||
            (patch.linkMode !== undefined && issue.field === 'linkMode') ||
            (patch.slotPath !== undefined && issue.field === 'slotPath') ||
            (patch.overridesText !== undefined && issue.field === 'overrides')
          ),
      ),
    );
  }, []);

  const loadMore = useCallback(async (): Promise<void> => {
    if (loadingRef.current || page.nextCursor === null) return;
    loadingRef.current = true;
    setSelectorState({ kind: 'loading' });
    const options =
      session.fetcher === undefined ? {} : { fetcher: session.fetcher };
    let answer = await readSelectorPage(
      entry.contentTypeId,
      page.nextCursor,
      options,
    );
    // FE03 1048 and BE03c 1414 (CMS-03C-13, cursor/context mismatch): a 409 cursor conflict drops the cursor and
    // restarts from the first page, once. The cursor lives in component state only, so nothing else is reset.
    const restarted = answer.kind === 'failed' && answer.status === 409;
    if (restarted)
      answer = await readSelectorPage(entry.contentTypeId, null, options);
    loadingRef.current = false;
    if (!mountedRef.current) return;
    if (answer.kind !== 'page') {
      setSelectorState(answer);
      return;
    }
    if (restarted) {
      const first = answer.page;
      const stale =
        fields.item !== null &&
        !first.items.some(
          (item) => item.patternVersionId === fields.item?.patternVersionId,
        );
      setPage(first);
      // A pin the first page no longer lists is never sent: the choice is cleared and the author is told.
      if (stale) setFields((current) => ({ ...current, item: null }));
      setSelectorState({ kind: 'restarted', choiceCleared: stale });
      return;
    }
    const next = answer.page;
    setPage((current) => ({
      ...next,
      items: [
        ...current.items,
        ...next.items.filter(
          (item) =>
            !current.items.some(
              (known) => known.patternVersionId === item.patternVersionId,
            ),
        ),
      ],
    }));
    setSelectorState({ kind: 'idle' });
  }, [
    entry.contentTypeId,
    fields.item,
    mountedRef,
    page.nextCursor,
    session.fetcher,
  ]);

  const submit = useCallback(async (): Promise<void> => {
    const built = placementRequest(fields, entry);
    if (!built.ok) {
      setIssues(built.issues);
      return;
    }
    setIssues([]);
    setStatus(pending('Placing the pattern…'));
    const answer = await mutate(JSON.stringify(built.request), (context) =>
      submitPlacement(built.request, context),
    );
    if (answer === null) return;
    if (answer.kind === 'placed') {
      addRows(answer.rows);
      setEntry({ ...session.entryRef.current, version: answer.version });
      const cleared = { ...fields, item: null, overridesText: '' };
      setFields(cleared);
      setBaseline(cleared);
      setStatus(
        success('Pattern placed', [
          placedLine(fields.item, built.request.linkMode, answer.rows.length),
        ]),
      );
      return;
    }
    if (answer.kind === 'rate_limited') return;
    if (answer.kind === 'uncertain') {
      // FE03 1048: an unknown outcome reconciles by refetching the entry before any retry. The read is only shown: the
      // request, and so its Idempotency-Key, stays exactly as it was sent, so the retry can never place twice.
      setReconciling(true);
      setStatus(pending('Checking the entry before any retry…'));
      const facts = await readEntryFacts(
        entry.entryId,
        session.fetcher === undefined ? {} : { fetcher: session.fetcher },
      );
      if (!mountedRef.current) return;
      setReconciling(false);
      setStatus(
        failure(
          'Result not known',
          `${UNKNOWN_OUTCOME_MESSAGE} ${reconciliationLine(
            facts.kind === 'facts' ? facts.version : null,
            built.request.expectedVersion,
          )}`,
        ),
      );
      return;
    }
    if (answer.status === 409) await refreshEntry();
    const mapped = answer.paths.flatMap((path) => {
      const field = fieldOfPointer(path);
      return field === null
        ? []
        : [{ field, message: SERVER_FIELD_MESSAGES[field] }];
    });
    const unique = mapped.filter(
      (issue, index) =>
        mapped.findIndex((other) => other.field === issue.field) === index,
    );
    if (unique.length > 0) setIssues(unique);
    setStatus(
      failure(
        'Pattern not placed',
        refusalMessage('place', answer.status, answer.reason),
      ),
    );
  }, [
    addRows,
    entry,
    fields,
    mountedRef,
    mutate,
    session.fetcher,
    refreshEntry,
    session.entryRef,
    setEntry,
    setStatus,
  ]);

  const dirty =
    fields.item !== null ||
    fields.linkMode !== baseline.linkMode ||
    fields.slotPath !== baseline.slotPath ||
    fields.overridesText !== baseline.overridesText;
  return {
    dirty,
    reconciling,
    fields,
    issues,
    page,
    selectorState,
    change,
    loadMore,
    submit,
  };
};
