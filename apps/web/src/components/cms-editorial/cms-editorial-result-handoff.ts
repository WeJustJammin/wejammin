import { CmsUuidSchema, CmsVersionSchema } from '@wejammin/contracts';
import { z } from 'zod';

import {
  loadStepUpDraft,
  saveStepUpDraft,
} from '../identity-authority/step-up-mfa/step-up-draft';

/**
 * The canonical result of a committed command, handed to the page it navigates
 * to. Create, conflict resolution and restore all end on the entry's editor
 * page; FE03 "Completion" (:1219) asks that page to state the result and expose
 * the exact next action, but the 201 body is only in hand BEFORE the navigation.
 * The producer leaves this one-shot, tab-scoped record and the editor consumes
 * it on its next load. It holds identifiers the caller can already read
 * (revision ids, the migration chain id), versions and counts: never a value, an
 * owner, an assignee or a capability.
 */
export const CmsEditorialResultSummarySchema = z.strictObject({
  kind: z.enum(['created', 'resolved', 'restored']),
  entryId: CmsUuidSchema,
  revisionNumber: CmsVersionSchema,
  /** The committed entry version: the next `If-Match`. */
  entryVersion: CmsVersionSchema,
  state: z.string().min(1).max(32),
  /** `[current draft, source]` for a restore; empty for a created entry. */
  parentRevisionIds: z.array(CmsUuidSchema).max(2),
  migrationChainId: CmsUuidSchema.nullable(),
  edgeCount: z.number().int().min(0).max(64).nullable(),
});

export type CmsEditorialResultSummary = z.infer<
  typeof CmsEditorialResultSummarySchema
>;

type ResultStorage = Pick<Storage, 'getItem' | 'removeItem' | 'setItem'>;

/**
 * The record lives in the tab-scoped, subject-bound detour store that protected
 * forms already use (`step-up-draft.ts`): it is stamped with the opaque
 * `wj_step_up_scope` the browser held when it was written and restores only for
 * the same scope inside its window, and the auth-scope cleanup
 * (`clearAllStepUpState`: logout, session switch, reaching sign-in) removes it.
 * So the lineage identifiers it holds can never reach another signed-in subject
 * of the same tab (Codex final review s10-final-4).
 */
const RESULT_SCOPE = 'cms-editorial-result';
/** A result older than this belongs to a navigation that did not happen. */
export const CMS_EDITORIAL_RESULT_TTL_MS = 120_000;

const encode = (
  summary: CmsEditorialResultSummary,
  now: number,
): Readonly<Record<string, string>> => ({
  at: String(now),
  kind: summary.kind,
  entryId: summary.entryId,
  revisionNumber: summary.revisionNumber,
  entryVersion: summary.entryVersion,
  state: summary.state,
  parentRevisionIds: summary.parentRevisionIds.join(','),
  migrationChainId: summary.migrationChainId ?? '',
  edgeCount: summary.edgeCount === null ? '' : String(summary.edgeCount),
});

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

/** Leaves the one-shot result for the page the command navigates to. */
export const saveCmsEditorialResult = (
  storage: ResultStorage | null,
  summary: CmsEditorialResultSummary,
  now: number = Date.now(),
): void => {
  saveStepUpDraft(storage, RESULT_SCOPE, {
    values: encode(summary, now),
    idempotencyKey: '',
    expectedVersion: null,
  });
};

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
  const draft = loadStepUpDraft(storage, RESULT_SCOPE);
  if (draft === null) return null;
  const decoded = decode(draft.values);
  const parsed = CmsEditorialResultSummarySchema.safeParse(decoded.summary);
  const age = now - decoded.at;
  return parsed.success &&
    parsed.data.entryId === entryId &&
    Number.isFinite(age) &&
    age >= 0 &&
    age <= CMS_EDITORIAL_RESULT_TTL_MS
    ? parsed.data
    : null;
};
