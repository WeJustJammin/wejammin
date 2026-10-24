import { useCallback, useRef, useState } from 'react';

import { placementRequest, submitPlacement } from './composition-commands';
import { refusalMessage, UNKNOWN_OUTCOME_MESSAGE } from './composition-copy';
import {
  fieldOfPointer,
  type InsertField,
  type InsertIssue,
  type PlacementFields,
} from './composition-insert-fields';
import { readSelectorPage } from './composition-reads';
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
    const answer = await readSelectorPage(
      entry.contentTypeId,
      page.nextCursor,
      session.fetcher === undefined ? {} : { fetcher: session.fetcher },
    );
    loadingRef.current = false;
    if (!mountedRef.current) return;
    if (answer.kind === 'page') {
      setPage((current) => ({
        ...answer.page,
        items: [
          ...current.items,
          ...answer.page.items.filter(
            (item) =>
              !current.items.some(
                (known) => known.patternVersionId === item.patternVersionId,
              ),
          ),
        ],
      }));
      setSelectorState({ kind: 'idle' });
    } else setSelectorState(answer);
  }, [entry.contentTypeId, mountedRef, page.nextCursor, session.fetcher]);

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
      setFields((current) => ({ ...current, item: null, overridesText: '' }));
      setStatus(
        success('Pattern placed', [
          placedLine(fields.item, built.request.linkMode, answer.rows.length),
        ]),
      );
      return;
    }
    if (answer.kind === 'rate_limited') return;
    if (answer.kind === 'uncertain') {
      setStatus(failure('Result not known', UNKNOWN_OUTCOME_MESSAGE));
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
    mutate,
    refreshEntry,
    session.entryRef,
    setEntry,
    setStatus,
  ]);

  return {
    fields,
    issues,
    page,
    selectorState,
    change,
    loadMore,
    submit,
  };
};
