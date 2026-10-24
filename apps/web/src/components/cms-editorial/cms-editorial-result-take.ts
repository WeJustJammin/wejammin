import { isCmsUuid, isCmsVersion } from '@wejammin/contracts/client';

import { CMS_EDITORIAL_RESULT_SCOPE } from './cms-editorial-result-scope';
import type { CmsEditorialResultSummary } from './cms-editorial-result-types';
import { loadStepUpDraft } from '../identity-authority/step-up-mfa/step-up-draft';

/**
 * The editor page's side of the result handoff (`cms-editorial-result-types.ts`): reads the
 * one-shot record a committed command left in the tab-scoped, subject-bound detour store
 * (`step-up-draft.ts`) and clears it. Loaded by the editor only when the peek in
 * `cms-editorial-result-scope.ts` says a result is waiting.
 */
const RESULT_KINDS: readonly string[] = ['created', 'resolved', 'restored'];
const SUMMARY_KEYS: readonly string[] = [
  'kind',
  'entryId',
  'revisionNumber',
  'entryVersion',
  'state',
  'parentRevisionIds',
  'migrationChainId',
  'edgeCount',
];

const isUuid = (value: unknown): value is string =>
  typeof value === 'string' && isCmsUuid(value);
const isVersion = (value: unknown): value is string =>
  typeof value === 'string' && isCmsVersion(value);

/** True for a well-formed summary: exactly the declared members, each in range. */
const isResultSummary = (
  value: unknown,
): value is CmsEditorialResultSummary => {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    return false;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record);
  if (
    keys.length !== SUMMARY_KEYS.length ||
    !SUMMARY_KEYS.every((key) => keys.includes(key))
  )
    return false;
  const { parentRevisionIds, edgeCount, migrationChainId, state } = record;
  return (
    typeof record.kind === 'string' &&
    RESULT_KINDS.includes(record.kind) &&
    isUuid(record.entryId) &&
    isVersion(record.revisionNumber) &&
    isVersion(record.entryVersion) &&
    typeof state === 'string' &&
    state.length >= 1 &&
    state.length <= 32 &&
    Array.isArray(parentRevisionIds) &&
    parentRevisionIds.length <= 2 &&
    parentRevisionIds.every(isUuid) &&
    (migrationChainId === null || isUuid(migrationChainId)) &&
    (edgeCount === null ||
      (typeof edgeCount === 'number' &&
        Number.isInteger(edgeCount) &&
        edgeCount >= 0 &&
        edgeCount <= 64))
  );
};

/** A result older than this belongs to a navigation that did not happen. */
export const CMS_EDITORIAL_RESULT_TTL_MS = 120_000;

type ResultStorage = Pick<Storage, 'getItem' | 'removeItem' | 'setItem'>;

const decode = (
  values: Readonly<Record<string, string>>,
): { readonly at: number; readonly summary: unknown } => ({
  at: Number(values.at),
  summary: {
    kind: values.kind,
    entryId: values.entryId,
    revisionNumber: values.revisionNumber,
    entryVersion: values.entryVersion,
    state: values.state,
    parentRevisionIds:
      values.parentRevisionIds === undefined || values.parentRevisionIds === ''
        ? []
        : values.parentRevisionIds.split(','),
    migrationChainId:
      values.migrationChainId === undefined || values.migrationChainId === ''
        ? null
        : values.migrationChainId,
    edgeCount:
      values.edgeCount === undefined || values.edgeCount === ''
        ? null
        : Number(values.edgeCount),
  },
});

/**
 * Reads and clears the result. The record is ALWAYS removed by a read: it is
 * returned only when it was left by this signed-in subject, is well formed,
 * fresh, and for exactly this entry; a stale, foreign (another entry or
 * subject), malformed or future-dated record is cleared without being shown.
 */
export const takeCmsEditorialResult = (
  storage: ResultStorage | null,
  entryId: string,
  now: number = Date.now(),
): CmsEditorialResultSummary | null => {
  const draft = loadStepUpDraft(storage, CMS_EDITORIAL_RESULT_SCOPE);
  if (draft === null) return null;
  const decoded = decode(draft.values);
  const age = now - decoded.at;
  return isResultSummary(decoded.summary) &&
    decoded.summary.entryId === entryId &&
    Number.isFinite(age) &&
    age >= 0 &&
    age <= CMS_EDITORIAL_RESULT_TTL_MS
    ? decoded.summary
    : null;
};
