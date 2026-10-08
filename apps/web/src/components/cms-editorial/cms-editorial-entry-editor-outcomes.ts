import type { CmsEditorialEditorState } from './cms-editorial-entry-editor-state';
import type { CmsEditorialMutationResult } from './cms-editorial-runtime';
import { cmsEditorialViolationsFrom } from './cms-editorial-entry-create-submit';
import { cmsEditorialReasonMessage } from './cms-editorial-reason-copy';
import { safeCmsEditorialErrorMessage } from './cms-editorial-types';

/**
 * The part of the editor state a refused or interrupted save changes. Copy is
 * fixed here: a server message never reaches the author, and every refusal says
 * the unsent edits were kept.
 */
export type CmsEditorialEditorPatch = Partial<CmsEditorialEditorState>;

export const SAVE_COPY = {
  saving: 'Saving changes.',
  unknown:
    'The save could not be confirmed. Retrying the same request; your edits are kept.',
  manualRetry:
    'The save still could not be confirmed. Your edits are kept; choose Retry save to try again.',
  invalidLocal:
    'Fix the highlighted fields before saving. Your edits are kept.',
  csrf: 'Your session is missing its CSRF token. Reload the page before saving; your edits stay in this page.',
  merged:
    'Saved. Changes made elsewhere were merged in; review the updated fields.',
  conflict:
    'This entry changed elsewhere and nothing was overwritten. Resolve the conflict to continue; your unsent changes are kept in this browser only.',
  stale:
    'This entry changed elsewhere and nothing was overwritten. Your unsent changes are kept in this browser only; load the current version to continue.',
  rebasing:
    'This entry changed elsewhere. Saving your edits again in a moment; they are kept.',
  rebaseLimit:
    'This entry keeps changing elsewhere, so automatic saving stopped. Nothing was overwritten and your edits are kept; choose Save draft to try again.',
  expired:
    'Your session expired. Sign in again to keep editing; your unsent edits stay in this page.',
} as const;

export const waitingMessage = (seconds: number | null): string =>
  seconds === null
    ? 'Too many saves. Retrying shortly. Your unsent edits are kept.'
    : `Too many saves. Retrying in ${seconds} seconds. Your unsent edits are kept.`;

/** A definite refusal of the request, mapped to the state it leaves behind. */
export const refusalPatch = (
  result: CmsEditorialMutationResult,
  summaryToken: number,
): CmsEditorialEditorPatch | null => {
  if (result.outcome === 'unauthenticated')
    return {
      phase: 'unauthenticated',
      alert: true,
      message: SAVE_COPY.expired,
    };
  if (result.outcome === 'forbidden' || result.outcome === 'not-found')
    return {
      phase: 'denied',
      alert: true,
      message: safeCmsEditorialErrorMessage(
        result.outcome === 'forbidden' ? 'FORBIDDEN' : 'NOT_FOUND',
      ),
    };
  if (
    result.outcome === 'validation' ||
    result.outcome === 'unsupported-media' ||
    result.outcome === 'payload-too-large'
  ) {
    const fieldIds = cmsEditorialViolationsFrom(result.errorDetails).flatMap(
      (violation) => (violation.fieldId === null ? [] : [violation.fieldId]),
    );
    return {
      phase: 'invalid',
      alert: false,
      refusedFieldIds: fieldIds,
      summaryToken: summaryToken + 1,
      message:
        cmsEditorialReasonMessage(result.reasonCode) ??
        safeCmsEditorialErrorMessage(result.errorCode ?? 'VALIDATION_FAILED'),
    };
  }
  return null;
};
