import { useCallback, useEffect, useRef, useState } from 'react';

import { useCmsTemplateRateWait } from '../cms-composition/cms-template-rate-wait';
import { fetchCandidatePage, type CandidatePage } from './related-candidates';
import { LIST_REFUSAL_COPY } from './related-content-copy';
import {
  addExclusion,
  addPin,
  movePin,
  removeExclusion,
  removePin,
  type RelatedLists,
} from './related-content-lists';
import {
  buildRelatedContentRequest,
  type RelatedContentFields,
  type RequestIssue,
} from './related-content-request';
import {
  submitRelatedContent,
  type RefusedRow,
  type RelatedSubmitResult,
  type SavedRelatedContent,
} from './related-content-submit';
import type {
  RelatedEntryFacts,
  RelatedRuleSnapshot,
} from './related-content-types';
import { ruleByKey, type RelatedRuleKey } from './related-rules';
import { useRelatedCandidates } from './use-related-candidates';
import { useRelatedConflictReview } from './use-related-conflict-review';

export const RELATED_RESULT_HEADING_ID = 'cms-related-result-heading';

export type RelatedStatus =
  | { readonly kind: 'idle' }
  | { readonly kind: 'invalid'; readonly issues: readonly RequestIssue[] }
  | { readonly kind: 'pending' }
  | { readonly kind: 'saved'; readonly saved: SavedRelatedContent }
  | {
      readonly kind: 'result';
      readonly result: Exclude<RelatedSubmitResult, { kind: 'saved' }>;
    };

export interface RelatedFormOptions {
  readonly entry: RelatedEntryFacts;
  /** The stored rule the form starts from (an empty rule when none is active). */
  readonly rule: RelatedRuleSnapshot;
  readonly candidates: CandidatePage;
  readonly csrfToken: string;
  readonly submit?: typeof submitRelatedContent | undefined;
  readonly loadPage?: typeof fetchCandidatePage | undefined;
}

const initialKey = (rule: RelatedRuleSnapshot): RelatedRuleKey | '' =>
  rule.derivedRule !== null && ruleByKey(rule.derivedRule.key) !== null
    ? (rule.derivedRule.key as RelatedRuleKey)
    : '';

/** All state and commands of the related-content form; the components only render. */
export const useRelatedContentForm = ({
  entry,
  rule,
  candidates,
  csrfToken,
  submit = submitRelatedContent,
  loadPage = fetchCandidatePage,
}: RelatedFormOptions) => {
  const [lists, setLists] = useState<RelatedLists>({
    pins: rule.pins,
    exclusions: rule.exclusions,
  });
  const startKey = initialKey(rule);
  const [ruleKey, setRuleKey] = useState<RelatedRuleKey | ''>(startKey);
  const [maxCandidates, setMaxCandidates] = useState(
    rule.derivedRule?.maxCandidates == null
      ? ''
      : String(rule.derivedRule.maxCandidates),
  );
  // The read names the derived rule without its bound, so a stored rule starts with the bound unknown.
  const boundUnknown =
    startKey !== '' &&
    ruleKey === startKey &&
    rule.derivedRule?.maxCandidates == null &&
    maxCandidates.trim() === '';
  const [version, setVersion] = useState(entry.version);
  const [status, setStatus] = useState<RelatedStatus>({ kind: 'idle' });
  const [rows, setRows] = useState<readonly RefusedRow[]>([]);
  const [note, setNote] = useState('');
  const attemptRef = useRef<{ body: string; key: string } | null>(null);
  const inFlightRef = useRef(false);
  const mountedRef = useRef(true);
  const submitSequenceRef = useRef(0);
  const rateWait = useCmsTemplateRateWait();
  const conflict = useRelatedConflictReview(entry.entryId);
  const picker = useRelatedCandidates({
    entryId: entry.entryId,
    initial: candidates,
    loadPage,
  });
  // An id is "unavailable" only when the whole list of entries the person can open has been seen without it.
  const listComplete = picker.nextCursor === null && picker.note === 'none';

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      submitSequenceRef.current += 1;
    };
  }, []);

  useEffect(() => {
    if (status.kind !== 'idle' && status.kind !== 'pending')
      document.getElementById(RELATED_RESULT_HEADING_ID)?.focus();
  }, [status]);

  const edited = useCallback((next: RelatedLists, message: string) => {
    setLists(next);
    setRows([]);
    setNote(message);
    // FE03 1048: an edit never lifts the stable pending label, nor a conflict the person still has to review.
    setStatus((current) =>
      current.kind === 'pending' ||
      (current.kind === 'result' && current.result.kind === 'conflict')
        ? current
        : { kind: 'idle' },
    );
  }, []);

  const pin = useCallback(
    (id: string) => {
      const change = addPin(lists, id);
      if (change.ok)
        edited(change.lists, `Pinned at position ${change.lists.pins.length}.`);
      else setNote(LIST_REFUSAL_COPY[change.reason]);
    },
    [edited, lists],
  );
  const exclude = useCallback(
    (id: string) => {
      const change = addExclusion(lists, id);
      if (!change.ok) setNote(LIST_REFUSAL_COPY[change.reason]);
      else
        edited(
          change.lists,
          change.displacedPin
            ? 'Excluded. Its pin was removed because exclusions win.'
            : 'Excluded.',
        );
    },
    [edited, lists],
  );
  const unpin = useCallback(
    (id: string) => edited(removePin(lists, id), 'Pin removed.'),
    [edited, lists],
  );
  const unexclude = useCallback(
    (id: string) => edited(removeExclusion(lists, id), 'Exclusion removed.'),
    [edited, lists],
  );
  const move = useCallback(
    (index: number, delta: -1 | 1) => {
      const next = movePin(lists, index, delta);
      if (next !== lists)
        edited(
          next,
          `Moved to position ${index + delta + 1} of ${next.pins.length}.`,
        );
    },
    [edited, lists],
  );
  const chooseRule = useCallback((key: RelatedRuleKey | '') => {
    setRuleKey(key);
    setRows([]);
    // Like `edited`: a rule chosen while the save is pending keeps the stable pending label.
    setStatus((current) =>
      current.kind === 'pending' ||
      (current.kind === 'result' && current.result.kind === 'conflict')
        ? current
        : { kind: 'idle' },
    );
  }, []);

  const blocked = csrfToken.length === 0 || rateWait.waiting;

  const sendOnVersion = useCallback(
    async (entryVersion: string): Promise<void> => {
      if (!mountedRef.current || blocked || inFlightRef.current) return;
      const fields: RelatedContentFields = { lists, ruleKey, maxCandidates };
      const prepared = buildRelatedContentRequest(fields, {
        entryId: entry.entryId,
        entryVersion,
      });
      if (!prepared.ok) {
        setStatus({ kind: 'invalid', issues: prepared.issues });
        return;
      }
      // The same unchanged request reuses its key only while the outcome is unknown.
      const key =
        attemptRef.current?.body === prepared.body
          ? attemptRef.current.key
          : crypto.randomUUID();
      attemptRef.current = { body: prepared.body, key };
      inFlightRef.current = true;
      const sequence = ++submitSequenceRef.current;
      setStatus({ kind: 'pending' });
      const result = await submit(prepared.value, csrfToken, key);
      if (!mountedRef.current || submitSequenceRef.current !== sequence) return;
      inFlightRef.current = false;
      if (result.kind !== 'uncertain') attemptRef.current = null;
      if (
        result.kind === 'rejected' &&
        result.status === 429 &&
        result.retryAfterSeconds !== undefined
      )
        rateWait.start(result.retryAfterSeconds);
      if (result.kind === 'saved') {
        setVersion(result.saved.version);
        conflict.clear();
        setRows([]);
        setStatus({ kind: 'saved', saved: result.saved });
        return;
      }
      if (
        result.kind === 'conflict' ||
        (conflict.isRequired() && result.kind !== 'uncertain')
      )
        conflict.requireReview();
      setRows(result.kind === 'refused' ? result.rows : []);
      setStatus({ kind: 'result', result });
    },
    [
      blocked,
      conflict,
      csrfToken,
      entry.entryId,
      lists,
      maxCandidates,
      rateWait,
      ruleKey,
      submit,
    ],
  );

  const save = useCallback(async (): Promise<void> => {
    if (conflict.isRequired()) return;
    await sendOnVersion(version);
  }, [conflict, sendOnVersion, version]);

  const reapply = useCallback(async (): Promise<void> => {
    const reviewed = conflict.reviewed();
    if (!conflict.isRequired() || reviewed === null) return;
    // Pass the reviewed CAS operand directly; a state update would leave a stale save closure.
    await sendOnVersion(reviewed.expectedVersion);
  }, [conflict, sendOnVersion]);

  const review = useCallback(async (): Promise<void> => {
    if (inFlightRef.current) return;
    await conflict.review();
  }, [conflict]);

  return {
    lists,
    ruleKey,
    maxCandidates,
    version,
    candidates: picker,
    status,
    rows,
    note,
    blocked: blocked || conflict.required,
    pending: status.kind === 'pending',
    rateWaiting: rateWait.waiting,
    factsOf: picker.factsOf,
    boundUnknown,
    conflict,
    reapplyBlocked: blocked,
    isUnavailable: (entryId: string): boolean =>
      listComplete && picker.factsOf(entryId) === null,
    pin,
    exclude,
    unpin,
    unexclude,
    move,
    chooseRule,
    setMaxCandidates,
    save,
    reapply,
    review,
  };
};
