import { CMS_EDITORIAL_RESULT_SCOPE } from './cms-editorial-result-scope';
import type { CmsEditorialResultSummary } from './cms-editorial-result-types';
import { saveStepUpDraft } from '../identity-authority/step-up-mfa/step-up-draft';

/**
 * The producers' side of the result handoff (`cms-editorial-result-types.ts`): create, conflict
 * resolution and restore leave the canonical result of a committed command for the editor page
 * they navigate to. It holds identifiers the caller can already read, versions and counts: never a
 * value, an owner, an assignee or a capability. The record lives in the tab-scoped, subject-bound
 * detour store (`step-up-draft.ts`): it is stamped with the opaque `wj_step_up_scope` the browser
 * held when it was written, and the auth-scope cleanup (`clearAllStepUpState`: logout, session
 * switch, reaching sign-in) removes it, so the lineage identifiers can never reach another
 * signed-in subject of the same tab (Codex final review s10-final-4).
 */
type ResultStorage = Pick<Storage, 'getItem' | 'removeItem' | 'setItem'>;

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

/** Leaves the one-shot result for the page the command navigates to. */
export const saveCmsEditorialResult = (
  storage: ResultStorage | null,
  summary: CmsEditorialResultSummary,
  now: number = Date.now(),
): void => {
  saveStepUpDraft(storage, CMS_EDITORIAL_RESULT_SCOPE, {
    values: encode(summary, now),
    idempotencyKey: '',
    expectedVersion: null,
  });
};
