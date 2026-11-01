import type { RelatedContentRuleRequest } from '@wejammin/contracts';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useCmsTemplateRateWait } from '../cms-composition/cms-template-rate-wait';
import { fetchCandidatePage, type CandidatePage } from './related-candidates';
import type { RelatedLists } from './related-content-lists';
import {
  buildRelatedContentRequest,
  type RelatedContentFields,
} from './related-content-request';
import {
  submitRelatedContent,
  type RefusedRow,
} from './related-content-submit';
import type {
  RelatedEntryFacts,
  RelatedRuleSnapshot,
  RelatedStatus,
} from './related-content-types';
import { ruleByKey, type RelatedRuleKey } from './related-rules';
import { useRelatedCandidates } from './use-related-candidates';
import { useRelatedConflictReview } from './use-related-conflict-review';
import { keepOnEdit, useRelatedListEdits } from './use-related-list-edits';
import { useRelatedOutcomes } from './use-related-outcomes';

export const RELATED_RESULT_HEADING_ID = 'cms-related-result-heading';
export const RELATED_RECHECK_ID = 'cms-related-recheck';

export type { RelatedStatus };

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
  const attemptRef = useRef<{
    body: string;
    key: string;
    value: RelatedContentRuleRequest;
  } | null>(null);
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
    // A person still on "Check again" keeps focus while that read goes on being unverified.
    if (
      status.kind !== 'idle' &&
      status.kind !== 'pending' &&
      document.activeElement?.id !== RELATED_RECHECK_ID
    )
      document.getElementById(RELATED_RESULT_HEADING_ID)?.focus();
  }, [status]);

  const { pin, exclude, unpin, unexclude, move } = useRelatedListEdits(lists, {
    setLists,
    setRows,
    setNote,
    setStatus,
  });
  const chooseRule = useCallback((key: RelatedRuleKey | '') => {
    setRuleKey(key);
    setRows([]);
    // Like `edited`: a rule chosen while the save is pending keeps the stable pending label.
    setStatus(keepOnEdit);
  }, []);

  // FE03 1050: while an unknown outcome is unreconciled (being read, or the read could not verify) no save is offered.
  const unsettled =
    status.kind === 'reconciling' ||
    (status.kind === 'result' && status.result.kind === 'uncertain');
  const blocked = csrfToken.length === 0 || rateWait.waiting || unsettled;
  const outcomes = useRelatedOutcomes({
    entryId: entry.entryId,
    setStatus,
    setVersion,
    startWait: rateWait.start,
    isLatest: (sequence) => submitSequenceRef.current === sequence,
    nextSequence: () => ++submitSequenceRef.current,
    settle: () => {
      attemptRef.current = null;
      conflict.clear();
    },
  });

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
      attemptRef.current = { body: prepared.body, key, value: prepared.value };
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
        // FE03 1047: a verified success refetches the saved rule.
        void outcomes.refreshAfterSave(result.saved);
        return;
      }
      if (result.kind === 'uncertain') {
        // FE03 1050: reconcile by reading the entry's rule before any retry is offered.
        await outcomes.reconcile(prepared.value);
        return;
      }
      if (result.kind === 'conflict' || conflict.isRequired())
        conflict.requireReview();
      setRows(result.kind === 'refused' ? result.rows : []);
      setStatus({ kind: 'result', result });
      // FE03 1049: a 409 refetches by itself; the person's values stay and are compared with the server state.
      if (result.kind === 'conflict') void conflict.review();
    },
    [
      blocked,
      conflict,
      csrfToken,
      entry.entryId,
      lists,
      maxCandidates,
      outcomes,
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

  /** Reads the rule again for the unknown attempt whose first read did not verify. */
  const recheck = useCallback(async (): Promise<void> => {
    const attempt = attemptRef.current;
    if (attempt === null || rateWait.waiting) return;
    await outcomes.reconcile(attempt.value, true);
  }, [outcomes, rateWait]);

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
    recheck,
    canRecheck:
      (status.kind === 'result' && status.result.kind === 'uncertain') ||
      (status.kind === 'reconciling' && status.again),
    rechecking: status.kind === 'reconciling' || rateWait.waiting,
  };
};
