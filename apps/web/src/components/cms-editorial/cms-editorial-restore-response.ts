import {
  ApiErrorSchema,
  EntryRevisionResourceSchema,
} from '@wejammin/contracts';

import {
  cmsEditorialReasonMessage,
  isCmsEditorialReasonCode,
} from './cms-editorial-reason-copy';
import type { CmsEditorialUiError } from './cms-editorial-types';

/**
 * Response classification for the locked CMS-03B-04 restore submission: the
 * result union, the fixed safe copy per status, the `Cache-Control: no-store`
 * check, the canonical `Location` proof, and the mapping of a refusal to a
 * typed error that never echoes an unverified body. The submitter owns the
 * request; this module only decides what a response means.
 */

export type CmsEditorialRestoreSubmitResult =
  | { readonly status: 'refused'; readonly message: string }
  | {
      readonly status: 'error';
      readonly error: CmsEditorialUiError;
      readonly retryable: boolean;
      readonly outcomeUnknown: boolean;
      readonly idempotencyKey: string;
    }
  | {
      readonly status: 'created';
      readonly location: string;
      readonly resource: ReturnType<typeof EntryRevisionResourceSchema.parse>;
      readonly etag: string;
      readonly idempotencyKey: string;
    };

const SAFE_ERROR_MESSAGES: Readonly<Record<number, string>> = {
  400: 'This restore request is malformed. Nothing was changed.',
  401: 'Your session expired. Sign in again to restore this revision.',
  403: 'You no longer have edit capability for this entry.',
  404: 'This entry or revision is not available.',
  409: 'The entry changed or the chain no longer matches. Reload and recheck.',
  415: 'The restore command format is not supported.',
  422: 'The restore command is invalid. Nothing was changed.',
  429: 'Too many restores. Try again shortly.',
  502: 'The restore could not be completed. Nothing was changed.',
  503: 'The restore is unavailable right now. Nothing was changed.',
  504: 'The restore did not finish in time. Check the entry before retrying.',
};

export const hasNoStore = (response: Response): boolean =>
  response.headers
    .get('cache-control')
    ?.split(',')
    .some((token) => token.trim().toLowerCase() === 'no-store') ?? false;

export const canonicalRestoreLocation = (
  rawLocation: string,
  entryId: string,
  revisionId: string,
): string | null => {
  const expectedPath = `/api/v1/cms/entries/${encodeURIComponent(entryId)}/revisions/${encodeURIComponent(revisionId)}`;
  const baseOrigin =
    typeof window !== 'undefined'
      ? window.location.origin
      : 'https://cms.invalid';
  try {
    const target = new URL(rawLocation, baseOrigin);
    if (
      target.origin !== baseOrigin ||
      target.pathname !== expectedPath ||
      target.search !== '' ||
      target.hash !== ''
    )
      return null;
    return target.origin === baseOrigin && rawLocation.startsWith('/')
      ? rawLocation
      : target.pathname;
  } catch {
    return null;
  }
};

export const errorFromResponse = async (
  response: Response,
  idempotencyKey: string,
): Promise<Extract<CmsEditorialRestoreSubmitResult, { status: 'error' }>> => {
  let parsed: unknown = null;
  try {
    parsed = await response.clone().json();
  } catch {
    // The fixed status copy below is intentionally the only fallback text.
  }
  const apiError = ApiErrorSchema.safeParse(parsed);
  const outcomeUnknown = response.status >= 500;
  // Only fixed copy reaches the author: a verified typed reason first, then the
  // status copy. The upstream message and details are never relayed.
  const reason = apiError.success
    ? cmsEditorialReasonMessage(
        isCmsEditorialReasonCode(apiError.data.details.reasonCode)
          ? apiError.data.details.reasonCode
          : null,
      )
    : null;
  return {
    status: 'error',
    error: {
      code: apiError.success
        ? apiError.data.code
        : response.status >= 500
          ? 'DEPENDENCY_UNAVAILABLE'
          : 'CONFLICT',
      message:
        reason ??
        SAFE_ERROR_MESSAGES[response.status] ??
        'The restore could not be completed. Nothing was changed.',
      requestId: apiError.success ? apiError.data.requestId : 'unknown',
      details: null,
    },
    retryable: outcomeUnknown || response.status === 429,
    outcomeUnknown,
    idempotencyKey,
  };
};
